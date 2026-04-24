RAG ingestion helper
=====================

This folder contains a small helper script to produce JSONL from the persistent
memory directory used by the DevSquad deep-dive. It intentionally does not
perform embedding uploads unless the user supplies credentials and opts in.

Quick start
-----------

1. Generate JSONL from memory files:

```bash
python3 tools/rag/ingest_and_embed.py --source /memories/devSqauCodeMemory --out devsquad_memory.jsonl
```

2. To create embeddings with OpenAI (requires `pip install openai` and
   environment variable `OPENAI_API_KEY`):

```bash
export OPENAI_API_KEY=sk-...
python3 tools/rag/ingest_and_embed.py --source /memories/devSqauCodeMemory --out devsquad_memory.jsonl --provider openai --model text-embedding-3-small
```

Security
--------

- Do NOT commit API keys. Use environment variables or a secrets manager.
- Review the JSONL before uploading to any third-party service.
