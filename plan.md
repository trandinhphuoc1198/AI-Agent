
---

## Plan: RAG Integration with ChromaDB

**What:** Add Retrieval-Augmented Generation using ChromaDB as the vector store. Documents are auto-ingested from a watched `rag_docs/` folder, embedded with `text-embedding-3-small`, and retrieved at query time — both automatically injected into every prompt AND available as an explicit LLM tool.

---

### Phase 1 — Config & Dependencies
1. Add to requirements.txt: `chromadb`, `langchain-chroma`, `watchdog`, `pypdf`, `openai` (for embedding API)
2. Extend config.py with new env vars — `RAG_DOCS_DIR` (default: `rag_docs/`), `CHROMA_PERSIST_DIR` (default: `chroma_db/`), `RAG_COLLECTION_NAME`, `RAG_TOP_K` (default: `5`), `OPENAI_API_KEY` (for embeddings — *see note below*)
3. Create the `rag_docs/` folder at project root; add `chroma_db/` to .gitignore

### Phase 2 — RAG Module (`backend/rag/`)
4. `embeddings.py` — configure `OpenAIEmbeddings(model="text-embedding-3-small")` pointed at OpenRouter base URL using the existing `OPENROUTER_API_KEY`
5. `chroma_client.py` — `chromadb.PersistentClient` singleton + `get_or_create_collection()`
6. `ingestor.py` — loaders for `.txt`/`.md` (plain read), `.pdf` (PyPDF), URLs (reuse `scrape_url` logic); chunk with `RecursiveCharacterTextSplitter(chunk_size=1000, overlap=200)`; hash-based deduplication to avoid re-ingesting unchanged files; upsert into ChromaDB with metadata (source path, chunk index, type)
7. `retriever.py` — embed query, call `collection.query(n_results=RAG_TOP_K)`, return formatted context string

### Phase 3 — File Watcher
8. `watcher.py` — `watchdog` `Observer` watching `RAG_DOCS_DIR`; **on create/modify** → ingest; **on delete** → remove all chunks for that source
9. In main.py `lifespan` startup event: scan all existing files in `rag_docs/` and ingest them, then start watcher — *parallel with existing startup logic, non-blocking*

### Phase 4 — Agent Integration (*depends on Phase 2*)
10. `backend/tools/rag_search.py` — new `@tool search_knowledge_base(query: str)` that calls `retriever.py`; register in `ALL_TOOLS` in __init__.py
11. agent.py — before each agent run, retrieve top-K chunks for the incoming user message; prepend as an extra `SystemMessage("Relevant context from knowledge base:\n{chunks}")` only if results exist (skip injection on empty KB)

### Phase 5 — Tests
12. `backend/tests/test_rag_ingestor.py` — unit tests for each loader and chunking logic (mock ChromaDB)
13. `backend/tests/test_rag_retriever.py` — test retrieval formatting and top-K behavior
14. `backend/tests/test_rag_search.py` — test the LangChain tool wrapper

---

**Relevant files**
- requirements.txt — add 5 new packages
- config.py — add 5 RAG settings using same `Settings` pydantic pattern
- main.py — extend `lifespan` with startup scan + watcher start
- agent.py — add pre-run context injection
- __init__.py — register `search_knowledge_base`
- `backend/rag/` *(new module — 5 files)*
- `backend/tools/rag_search.py` *(new)*

**Verification**
1. Drop a `.txt` file in `rag_docs/` → watch logs confirm ingestion
2. Ask the agent a question about the file's content → verify both auto-injected context and tool call path work
3. Run `pytest backend/tests/test_rag_*.py`
4. Delete the file from `rag_docs/` → verify chunks are removed from ChromaDB

---

**Further Considerations**

1. **OpenRouter vs. OpenAI for embeddings** — OpenRouter's embeddings endpoint may not support `text-embedding-3-small`. If it doesn't work, the fallback is either a direct `OPENAI_API_KEY` or switching to a local `sentence-transformers` model (e.g., `all-MiniLM-L6-v2`) which needs no API key. Recommend testing OpenRouter first; the config should make swapping easy.

2. **Auto-inject threshold** — Should we only inject context when ChromaDB returns results above a minimum similarity score (e.g., distance < 0.8), to avoid injecting irrelevant chunks? Recommend yes, with a configurable `RAG_MIN_SCORE` threshold.

3. **workspace/ folder** — You selected "Files already in workspace/" as a source. Should the watcher also watch workspace in addition to `rag_docs/`, or should users manually copy files from workspace into `rag_docs/`? Recommend separate folders to keep agent execution artifacts separate from the knowledge base.