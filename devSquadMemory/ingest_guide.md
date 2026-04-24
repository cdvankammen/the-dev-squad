RAG ingestion guide — how to turn these notes into a searchable index
=====================================================================

Goal
----
Create a JSONL file of documents in `devSquadMemory` and then compute embeddings for each document to load into a vector store for RAG.

Prerequisites
-------------
- Python 3.10+
- `pip install openai requests tqdm sentence-transformers` (or use your embedding provider's SDK)
- Access to an embedding provider (OpenAI, Cohere, Hugging Face, or a local model) — local is recommended if you want no cloud upload.

Steps
-----
1. Generate a JSONL bundle of files (one line per document) using `rag_ingest_example.py`:

```bash
python3 devSquadMemory/rag_ingest_example.py --source devSquadMemory --out devsquad_memory.jsonl
```

2. Convert JSONL into embeddings. Example (local sentence-transformers):

- Install: `pip install sentence-transformers`
- Run a script that reads each JSONL line, computes an embedding, and stores [id, vector] in a local JSONL or vector DB.

Tips
----
- Decide on chunking: for long files, break into 1-3KB chunks and keep `path`/`offset` metadata to map back.
- Keep `title` and `path` metadata for precise retrieval.
- Consider adding tags for `type:architecture|code|skill` to influence retrieval ranking.

Security
--------
- Do not upload secrets (API keys, tokens, `.claude/settings.json`) to external vector DBs. Review and redact sensitive content before ingestion.
