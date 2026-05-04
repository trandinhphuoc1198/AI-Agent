"""Tests for backend/agent.py."""
from __future__ import annotations

import asyncio
import json
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fake_astream_events(*events: dict):
    """Return a callable that yields *events* from an async generator."""
    async def _gen(*args: Any, **kwargs: Any):
        for e in events:
            yield e

    return _gen


def _make_chunk(text: str):
    chunk = MagicMock()
    chunk.content = text
    return chunk


def _chain_end_event(messages: list):
    """Build an on_chain_end event with a messages output."""
    return {
        "event": "on_chain_end",
        "name": "LangGraph",
        "data": {"output": {"messages": messages}},
    }


async def _collect(session_id: str, message: str) -> list[dict]:
    """Run agent and return every dict emitted via ws_send."""
    from agent import run_agent

    events: list[dict] = []

    async def ws_send(data: dict) -> None:
        events.append(data)

    await run_agent(session_id, message, ws_send)
    return events


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _env(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-test")
    monkeypatch.setenv("MODEL", "test-model")
    import config
    config.reset_settings()
    yield
    config.reset_settings()


@pytest.fixture(autouse=True)
def _clear_history():
    yield
    import agent
    agent._chat_histories.clear()


# ---------------------------------------------------------------------------
# History management (sync)
# ---------------------------------------------------------------------------

def test_get_history_creates_empty_list_on_first_call():
    from agent import clear_history, get_history
    clear_history("new-session")
    history = get_history("new-session")
    assert history == []


def test_get_history_returns_same_list_on_repeated_calls():
    from agent import get_history
    h1 = get_history("same-session")
    h2 = get_history("same-session")
    assert h1 is h2


def test_clear_history_removes_session():
    from agent import clear_history, get_history
    h = get_history("to-clear")
    h.append(HumanMessage(content="hi"))
    clear_history("to-clear")
    assert get_history("to-clear") == []


def test_clear_history_noop_for_unknown_session():
    from agent import clear_history
    clear_history("does-not-exist")


# ---------------------------------------------------------------------------
# run_agent — event emission
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_done_event_always_emitted():
    ai_msg = AIMessage(content="Hello!")
    with (
        patch("agent._make_llm"),
        patch("agent._make_agent") as MockMakeAgent,
    ):
        MockMakeAgent.return_value.astream_events = _fake_astream_events(
            _chain_end_event([ai_msg])
        )
        events = await _collect("sess-done", "hi")

    assert events[-1] == {"type": "done"}


@pytest.mark.asyncio
async def test_token_events_forwarded():
    stream_event = {
        "event": "on_chat_model_stream",
        "name": "llm",
        "data": {"chunk": _make_chunk("Hello")},
    }
    ai_msg = AIMessage(content="Hello")
    with (
        patch("agent._make_llm"),
        patch("agent._make_agent") as MockMakeAgent,
    ):
        MockMakeAgent.return_value.astream_events = _fake_astream_events(
            stream_event, _chain_end_event([ai_msg])
        )
        events = await _collect("sess-token", "hi")

    token_events = [e for e in events if e["type"] == "token"]
    assert len(token_events) == 1
    assert token_events[0]["content"] == "Hello"


@pytest.mark.asyncio
async def test_empty_token_chunks_not_forwarded():
    """Chunks with empty content must be suppressed."""
    stream_event = {
        "event": "on_chat_model_stream",
        "name": "llm",
        "data": {"chunk": _make_chunk("")},
    }
    with (
        patch("agent._make_llm"),
        patch("agent._make_agent") as MockMakeAgent,
    ):
        MockMakeAgent.return_value.astream_events = _fake_astream_events(
            stream_event, _chain_end_event([AIMessage(content="")])
        )
        events = await _collect("sess-empty", "hi")

    assert not any(e["type"] == "token" for e in events)


@pytest.mark.asyncio
async def test_tool_start_event_forwarded():
    tool_start = {
        "event": "on_tool_start",
        "name": "calculator",
        "data": {"input": {"expression": "2+2"}},
    }
    with (
        patch("agent._make_llm"),
        patch("agent._make_agent") as MockMakeAgent,
    ):
        MockMakeAgent.return_value.astream_events = _fake_astream_events(
            tool_start, _chain_end_event([AIMessage(content="4")])
        )
        events = await _collect("sess-ts", "what is 2+2?")

    starts = [e for e in events if e["type"] == "tool_start"]
    assert len(starts) == 1
    assert starts[0]["tool"] == "calculator"
    assert starts[0]["input"] == {"expression": "2+2"}


@pytest.mark.asyncio
async def test_tool_end_event_forwarded():
    tool_end = {
        "event": "on_tool_end",
        "name": "calculator",
        "data": {"output": "4"},
    }
    with (
        patch("agent._make_llm"),
        patch("agent._make_agent") as MockMakeAgent,
    ):
        MockMakeAgent.return_value.astream_events = _fake_astream_events(
            tool_end, _chain_end_event([AIMessage(content="4")])
        )
        events = await _collect("sess-te", "what is 2+2?")

    ends = [e for e in events if e["type"] == "tool_end"]
    assert len(ends) == 1
    assert ends[0]["tool"] == "calculator"
    assert ends[0]["output"] == "4"


@pytest.mark.asyncio
async def test_multiple_tokens_in_order():
    def _stream(text: str):
        return {
            "event": "on_chat_model_stream",
            "name": "llm",
            "data": {"chunk": _make_chunk(text)},
        }

    with (
        patch("agent._make_llm"),
        patch("agent._make_agent") as MockMakeAgent,
    ):
        MockMakeAgent.return_value.astream_events = _fake_astream_events(
            _stream("Hi"), _stream(" "), _stream("there"),
            _chain_end_event([AIMessage(content="Hi there")])
        )
        events = await _collect("sess-multi-tok", "hello")

    tokens = [e["content"] for e in events if e["type"] == "token"]
    assert tokens == ["Hi", " ", "there"]


# ---------------------------------------------------------------------------
# run_agent — chat history
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_history_updated_after_turn():
    from agent import clear_history, get_history

    clear_history("sess-hist")
    ai_msg = AIMessage(content="World")
    with (
        patch("agent._make_llm"),
        patch("agent._make_agent") as MockMakeAgent,
    ):
        MockMakeAgent.return_value.astream_events = _fake_astream_events(
            _chain_end_event([ai_msg])
        )
        await _collect("sess-hist", "Hello")

    history = get_history("sess-hist")
    assert len(history) == 2
    assert isinstance(history[0], HumanMessage)
    assert history[0].content == "Hello"
    assert isinstance(history[1], AIMessage)
    assert history[1].content == "World"


@pytest.mark.asyncio
async def test_history_accumulates_across_turns():
    from agent import clear_history, get_history

    clear_history("sess-accum")

    def _make_graph(answer: str):
        mock = MagicMock()
        mock.astream_events = _fake_astream_events(
            _chain_end_event([AIMessage(content=answer)])
        )
        return mock

    with (
        patch("agent._make_llm"),
        patch("agent._make_agent") as MockMakeAgent,
    ):
        MockMakeAgent.side_effect = [_make_graph("A1"), _make_graph("A2")]
        await _collect("sess-accum", "Q1")
        await _collect("sess-accum", "Q2")

    history = get_history("sess-accum")
    assert len(history) == 4
    assert history[0].content == "Q1"
    assert history[1].content == "A1"
    assert history[2].content == "Q2"
    assert history[3].content == "A2"


@pytest.mark.asyncio
async def test_history_not_updated_on_error():
    from agent import clear_history, get_history

    clear_history("sess-err")

    with (
        patch("agent._make_llm"),
        patch("agent._make_agent") as MockMakeAgent,
    ):
        async def _boom(*args, **kwargs):
            raise RuntimeError("LLM exploded")
            yield

        MockMakeAgent.return_value.astream_events = _boom
        events = await _collect("sess-err", "hello")

    assert any(e["type"] == "error" for e in events)
    assert get_history("sess-err") == []


# ---------------------------------------------------------------------------
# run_agent — error handling
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_error_event_emitted_on_exception():
    with (
        patch("agent._make_llm"),
        patch("agent._make_agent") as MockMakeAgent,
    ):
        async def _boom(*args, **kwargs):
            raise ValueError("something went wrong")
            yield

        MockMakeAgent.return_value.astream_events = _boom
        events = await _collect("sess-exc", "trigger error")

    error_events = [e for e in events if e["type"] == "error"]
    assert len(error_events) == 1
    assert "something went wrong" in error_events[0]["content"]


@pytest.mark.asyncio
async def test_done_not_emitted_on_error():
    with (
        patch("agent._make_llm"),
        patch("agent._make_agent") as MockMakeAgent,
    ):
        async def _boom(*args, **kwargs):
            raise ValueError("oops")
            yield

        MockMakeAgent.return_value.astream_events = _boom
        events = await _collect("sess-no-done", "hi")

    assert not any(e["type"] == "done" for e in events)


@pytest.mark.asyncio
async def test_llm_request_and_response_are_logged(tmp_path):
    log_path = tmp_path / "llm-test.jsonl"
    chat_start = {
        "event": "on_chat_model_start",
        "name": "ChatOpenAI",
        "data": {
            "input": {
                "messages": [
                    SystemMessage(content="You are a helpful AI assistant."),
                    HumanMessage(content="Log this prompt"),
                ]
            }
        },
    }
    chat_end = {
        "event": "on_chat_model_end",
        "name": "ChatOpenAI",
        "data": {"output": AIMessage(content="Logged answer")},
    }

    with (
        patch("agent._make_llm"),
        patch("agent._make_agent") as MockMakeAgent,
        patch("agent._get_llm_log_path", return_value=log_path),
    ):
        MockMakeAgent.return_value.astream_events = _fake_astream_events(
            chat_start,
            chat_end,
            _chain_end_event([AIMessage(content="Logged answer")])
        )
        await _collect("sess-log", "Log this prompt")

    entries = [json.loads(line) for line in log_path.read_text(encoding="utf-8").splitlines()]
    assert [entry["direction"] for entry in entries] == ["request", "response"]
    assert entries[0]["session_id"] == "sess-log"
    assert entries[0]["provider"] == "ChatOpenAI"
    assert entries[0]["payload"]["messages"][-1]["content"] == "Log this prompt"
    assert entries[1]["payload"]["content"] == "Logged answer"


# ---------------------------------------------------------------------------
# run_agent — chain_end with empty messages list
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_chain_end_with_no_ai_message():
    """on_chain_end with no messages still completes cleanly."""
    from agent import clear_history, get_history

    clear_history("sess-nomsg")
    with (
        patch("agent._make_llm"),
        patch("agent._make_agent") as MockMakeAgent,
    ):
        MockMakeAgent.return_value.astream_events = _fake_astream_events(
            _chain_end_event([])
        )
        events = await _collect("sess-nomsg", "question")

    # done should still emit, history final answer is empty string
    assert events[-1] == {"type": "done"}
    history = get_history("sess-nomsg")
    assert history[1].content == ""

