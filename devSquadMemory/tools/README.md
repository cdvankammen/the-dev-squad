Local embedding & vector-store helpers

Files added:
- compute_embeddings_sbert.py — compute SBERT embeddings for text files under a directory (writes JSONL)
- import_to_chroma.py — import JSONL embeddings into a local Chroma DB and run a sample query
- openai_cohere_adapter.py — optional OpenAI/Cohere adapter functions (require API keys; disabled by default)
- requirements.txt — packages needed for local pipeline (sentence-transformers, chromadb)

Quick commands (run from repo root):

Install dependencies:
```bash
python3 -m pip install -r devSquadMemory/tools/requirements.txt
```

Compute embeddings (default model all-mpnet-base-v2 — may download ~200-400MB):
```bash
python3 devSquadMemory/tools/compute_embeddings_sbert.py --root devSquadMemory --output devSquadMemory/workspace_vectors_sbert.jsonl
```

Import into Chroma and run a sample query:
```bash
python3 devSquadMemory/tools/import_to_chroma.py --vectors devSquadMemory/workspace_vectors_sbert.jsonl
```

Notes:
- The OpenAI/Cohere adapter file contains helper functions but will raise unless you set OPENAI_API_KEY or COHERE_API_KEY in your environment.
- Chroma is used in local (duckdb+parquet) mode and does not require cloud services.
