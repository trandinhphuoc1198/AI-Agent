"""End-to-end RAG integration check.

Verifies:
  1. Embeddings endpoint works (OpenRouter or OpenAI key).
  2. A document can be ingested into ChromaDB.
  3. Retrieval returns the relevant chunk for a query.
  4. The agent answers a question using auto-injected RAG context.
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "backend"))

from rag.ingestor import ingest_file  # noqa: E402
from rag.retriever import retrieve  # noqa: E402
from rag.chroma_client import get_vectorstore, reset_vectorstore  # noqa: E402
from agent import run_agent  # noqa: E402


DOC = Path(__file__).resolve().parent / "rag_docs" / "zorblax_facts.txt"


async def collected_send():
    received: list[dict] = []

    async def _send(msg: dict) -> None:
        received.append(msg)
        if msg.get("type") == "token":
            print(msg["content"], end="", flush=True)
        elif msg.get("type") == "tool_start":
            print(f"\n[TOOL START] {msg.get('tool')} input={msg.get('input')}")
        elif msg.get("type") == "tool_end":
            out = str(msg.get("output", ""))[:400]
            print(f"\n[TOOL END]   {msg.get('tool')} output={out!r}")
        elif msg.get("type") == "error":
            print(f"\n[ERROR] {msg.get('content')}")

    return _send, received


async def main() -> int:
    print("=== STEP 1: Embeddings smoke test ===")
    from rag.embeddings import get_embeddings
    emb = get_embeddings()
    try:
        v = emb.embed_query("hello world")
        print(f"  embeddings OK, dim={len(v)}")
    except Exception as exc:
        print(f"  EMBEDDINGS FAILED: {type(exc).__name__}: {exc}")
        return 1

    print("\n=== STEP 2: Ingest doc ===")
    reset_vectorstore()
    n = ingest_file(DOC)
    print(f"  ingested {n} chunks from {DOC.name}")

    print("\n=== STEP 3: Retrieve ===")
    ctx = retrieve("What is the Zorblax wrangler password?")
    print(f"  retrieved {len(ctx)} chars of context")
    print("  ---context preview---")
    print(ctx[:500])
    print("  ---")

    print("\n=== STEP 4: Agent end-to-end ===")
    send, received = await collected_send()
    await run_agent(
        session_id="rag-integration-test",
        user_message="What is the secret password used by Zorblax wranglers? Answer with just the password.",
        ws_send=send,
    )
    final = "".join(m["content"] for m in received if m.get("type") == "token")
    print("\n\n=== FINAL ANSWER ===")
    print(final)
    if "QUASAR-9921" in final:
        print("\n[PASS] Agent retrieved the answer from RAG context.")
        return 0
    print("\n[FAIL] Agent answer did not contain expected password.")
    return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
