"""LangChain tool-calling agent with per-session chat history and WebSocket streaming."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Awaitable, Callable
from uuid import uuid4

from langchain.agents import create_agent
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from config import get_settings
from rag.retriever import retrieve as rag_retrieve
from tools import ALL_TOOLS

# ---------------------------------------------------------------------------
# Per-session chat history  {session_id: [HumanMessage, AIMessage, ...]}
# ---------------------------------------------------------------------------

_chat_histories: dict[str, list[BaseMessage]] = {}

SYSTEM_PROMPT = (
    "You are a helpful AI assistant with access to tools. "
    "Use the tools when appropriate to answer the user's questions. "
)


def _get_llm_log_path() -> Path:
    """Return the daily JSONL log file for LLM request/response logging."""
    settings = get_settings()
    log_dir = Path(settings.logs_dir)
    log_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return log_dir / f"llm-{stamp}.jsonl"


def _serialize_message(message: BaseMessage) -> dict[str, Any]:
    """Convert a LangChain message into a JSON-serializable payload."""
    payload: dict[str, Any] = {
        "type": message.type,
        "content": message.content,
    }

    name = getattr(message, "name", None)
    if name:
        payload["name"] = name

    tool_calls = getattr(message, "tool_calls", None)
    if tool_calls:
        payload["tool_calls"] = tool_calls

    additional_kwargs = getattr(message, "additional_kwargs", None)
    if additional_kwargs:
        payload["additional_kwargs"] = additional_kwargs

    return payload


def _serialize_for_log(value: Any) -> Any:
    """Recursively convert event payloads into JSON-serializable data."""
    if isinstance(value, BaseMessage):
        return _serialize_message(value)
    if isinstance(value, list):
        return [_serialize_for_log(item) for item in value]
    if isinstance(value, tuple):
        return [_serialize_for_log(item) for item in value]
    if isinstance(value, dict):
        return {str(key): _serialize_for_log(item) for key, item in value.items()}
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


def _append_llm_log(entry: dict[str, Any]) -> None:
    """Append one JSON entry describing LLM traffic to the daily log file."""
    log_path = _get_llm_log_path()
    with log_path.open("a", encoding="utf-8") as log_file:
        json.dump(entry, log_file, ensure_ascii=True, default=str)
        log_file.write("\n")


def get_history(session_id: str) -> list[BaseMessage]:
    """Return (and lazily create) the message history for *session_id*."""
    if session_id not in _chat_histories:
        _chat_histories[session_id] = []
    return _chat_histories[session_id]


def clear_history(session_id: str) -> None:
    """Remove all history for *session_id*."""
    _chat_histories.pop(session_id, None)


# ---------------------------------------------------------------------------
# Agent factory
# ---------------------------------------------------------------------------

def _make_llm() -> ChatOpenAI:
    s = get_settings()
    return ChatOpenAI(
        model=s.model,
        api_key=s.openrouter_api_key,
        base_url="https://openrouter.ai/api/v1",
        streaming=True,
        temperature=0,
    )


def _make_agent(llm: ChatOpenAI):
    """Return a compiled LangGraph agent graph using only currently enabled tools."""
    s = get_settings()
    if s.enabled_tools:
        enabled = set(s.enabled_tools)
        active_tools = [t for t in ALL_TOOLS if t.name in enabled]
    else:
        active_tools = ALL_TOOLS
    return create_agent(model=llm, tools=active_tools, system_prompt=SYSTEM_PROMPT)


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

async def run_agent(
    session_id: str,
    user_message: str,
    ws_send: Callable[[dict[str, Any]], Awaitable[None]],
) -> None:
    """Run one agent turn, streaming events back over the WebSocket.

    Emits these message types via *ws_send*:
      ``{"type": "token",      "content": "..."}``           — streaming text chunk
      ``{"type": "tool_start", "tool": "name", "input": {}}`` — tool invocation begins
      ``{"type": "tool_end",   "tool": "name", "output": ""}`` — tool invocation ends
      ``{"type": "error",      "content": "..."}``            — unhandled exception
      ``{"type": "done"}``                                     — turn complete
    """
    from tools.shell import session_id_var, ws_send_var

    history = get_history(session_id)

    llm = _make_llm()
    graph = _make_agent(llm)

    # Inject context variables consumed by the shell permission gate.
    token_sid = session_id_var.set(session_id)
    token_ws = ws_send_var.set(ws_send)

    final_answer = ""
    error_occurred = False
    turn_id = uuid4().hex

    # Build the input messages: existing history + new human turn.
    input_messages = list(history) + [HumanMessage(content=user_message)]

    # RAG context injection — prepend relevant knowledge-base chunks.
    rag_context = rag_retrieve(user_message)
    if rag_context:
        input_messages.insert(
            0,
            SystemMessage(
                content=f"Relevant context from knowledge base:\n{rag_context}"
            ),
        )

    try:
        async for event in graph.astream_events(
            {"messages": input_messages},
            version="v2",
        ):
            kind = event["event"]
            name = event.get("name", "")

            if kind == "on_chat_model_start":
                _append_llm_log(
                    {
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "turn_id": turn_id,
                        "session_id": session_id,
                        "direction": "request",
                        "model": get_settings().model,
                        "provider": name,
                        "payload": _serialize_for_log(event["data"].get("input", {})),
                    }
                )

            elif kind == "on_chat_model_stream":
                chunk = event["data"]["chunk"]
                content = chunk.content
                if isinstance(content, str) and content:
                    await ws_send({"type": "token", "content": content})

            elif kind == "on_chat_model_end":
                _append_llm_log(
                    {
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "turn_id": turn_id,
                        "session_id": session_id,
                        "direction": "response",
                        "model": get_settings().model,
                        "provider": name,
                        "payload": _serialize_for_log(event["data"].get("output")),
                    }
                )

            elif kind == "on_tool_start":
                await ws_send(
                    {
                        "type": "tool_start",
                        "tool": name,
                        "input": event["data"].get("input", {}),
                    }
                )

            elif kind == "on_tool_end":
                await ws_send(
                    {
                        "type": "tool_end",
                        "tool": name,
                        "output": str(event["data"].get("output", "")),
                    }
                )

            elif kind == "on_chain_end":
                # Extract the final text from the last AIMessage in the output.
                output = event["data"].get("output", {})
                if isinstance(output, dict):
                    messages_out = output.get("messages", [])
                    if messages_out:
                        last = messages_out[-1]
                        if isinstance(last, AIMessage):
                            final_answer = last.content if isinstance(last.content, str) else ""

    except Exception as exc:  # noqa: BLE001
        error_occurred = True
        _append_llm_log(
            {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "turn_id": turn_id,
                "session_id": session_id,
                "direction": "error",
                "model": get_settings().model,
                "error": str(exc),
            }
        )
        await ws_send({"type": "error", "content": str(exc)})

    finally:
        session_id_var.reset(token_sid)
        ws_send_var.reset(token_ws)

    if not error_occurred:
        # Persist this turn in the session history.
        history.append(HumanMessage(content=user_message))
        history.append(AIMessage(content=final_answer))
        await ws_send({"type": "done"})
