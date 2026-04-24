Vector memory — what I changed and how to update it

What I did for you
- Regenerated `devSquadMemory/workspace_vectors.jsonl` using a deterministic offline fallback (no external dependencies).
- Backed up the previous vectors file to `devSquadMemory/workspace_vectors.jsonl.bak.<timestamp>`.
- Added a safe regenerator script: `devSquadMemory/tools/regen_vectors_fallback.py` (runs without sentence-transformers; produces deterministic pseudo-embeddings).

Primary (recommended) workflow — accurate embeddings
1. Install Python deps for local model embedding:

```bash
pip3 install --user -r devSquadMemory/requirements.txt
```

2. Rebuild docs + vectors using a real model (sentence-transformers):

```bash
python3 devSquadMemory/build_local_embeddings.py --source devSquadMemory --out-docs devSquadMemory/workspace_docs.jsonl --out-vectors devSquadMemory/workspace_vectors.jsonl
```

This will download and use `all-MiniLM-L6-v2` by default and write vectors with real embeddings.

Fallback (safe, offline) — deterministic pseudo-embeddings
If you cannot install heavy deps or want a quick dev rebuild:

```bash
python3 devSquadMemory/tools/regen_vectors_fallback.py --backup
```

This reads `devSquadMemory/workspace_docs.jsonl` and writes `devSquadMemory/workspace_vectors.jsonl` using a deterministic pseudo-rng derived from the text (dimension: 384). Use for development/testing only (retrieval quality will be approximate).

Verify retrieval locally

```bash
python3 devSquadMemory/query_helper.py --query "your question" --topk 5
```

Notes and safety
- Do NOT upload secrets or private keys into external vector DBs without redaction.
- To import into a managed vector DB (Chroma, Qdrant, LanceDB), export `devSquadMemory/workspace_vectors.jsonl` and use the DB-specific ingestion tool.
- If you want me to run the full sentence-transformers pipeline here I can attempt it, but it may require large downloads and is best done on your machine where you control environments.

Files I created/modified
- `devSquadMemory/tools/regen_vectors_fallback.py` — fallback regeneration script
- `devSquadMemory/workspace_vectors.jsonl` — regenerated vectors (backup created)
- `devSquadMemory/README_MEMORY.md` — (this file)

If you want, I can now:
- Run the sentence-transformers build here (may take time and download models), or
- Add an OpenAI/Cohere provider adapter to compute embeddings instead of local models, or
- Import vectors into a local LanceDB/Chroma instance and run queries there.

Tell me which you'd prefer and I will proceed.