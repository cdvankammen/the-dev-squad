Vector DB manifest
===================

Generated: 2026-04-23

Summary
-------
Local vector index built from files under `devSquadMemory` using `sentence-transformers`.

Details
-------
- Embedding model: all-MiniLM-L6-v2
- Number of source files indexed: 17
- Number of document chunks created: 39
- Docs JSONL: `devSquadMemory/workspace_docs.jsonl`
- Vectors JSONL: `devSquadMemory/workspace_vectors.jsonl`

How to reproduce
-----------------
1. Create and activate the virtualenv (created here as `.venv`):

```bash
python3 -m venv devSquadMemory/.venv
source devSquadMemory/.venv/bin/activate
pip install -r devSquadMemory/requirements.txt
```

2. Run the build script (will download model weights on first run):

```bash
python3 devSquadMemory/build_local_embeddings.py
```

Notes
-----
- No files containing credentials or `.claude` settings were included in the index (explicitly excluded).
- The index is stored as plain JSONL for portability; you can import it into a vector DB (Chroma, LanceDB, Qdrant) if desired.
