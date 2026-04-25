#!/usr/bin/env python3
"""
DevSquad Memory — Persistent RAG Retriever Service
===================================================
A FastAPI server that provides persistent vector-search over devSquadMemory
workspace embeddings. Keeps the SentenceTransformer model and the full
vector index loaded in memory for fast repeated queries.

Usage:
    # From the workspace root (with .venv active):
    python tools/rag/retriever_service.py

    # Or with custom settings:
    VECTORS_PATH=devSquadMemory/workspace_vectors.jsonl \\
    RETRIEVER_PORT=8765 \\
    python tools/rag/retriever_service.py

Endpoints:
    GET  /health                      — liveness + stats
    POST /query                       — semantic search
    POST /reload                      — hot-reload vectors from disk
    GET  /vectors/count               — number of indexed vectors

Environment:
    VECTORS_PATH      path to workspace_vectors.jsonl (default: devSquadMemory/workspace_vectors.jsonl)
    SBERT_MODEL       sentence-transformers model name (default: all-MiniLM-L6-v2)
    RETRIEVER_PORT    TCP port to bind (default: 8765)
    RETRIEVER_HOST    host to bind (default: 127.0.0.1)
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any

import numpy as np

# ---------------------------------------------------------------------------
# Lazy FastAPI / uvicorn import (so the file is still importable for testing
# even if these packages aren't installed yet)
# ---------------------------------------------------------------------------
try:
    from fastapi import FastAPI, HTTPException
    from fastapi.responses import JSONResponse
    from pydantic import BaseModel
    import uvicorn
    _HAS_FASTAPI = True
except ImportError:
    _HAS_FASTAPI = False

try:
    from sentence_transformers import SentenceTransformer
    _HAS_SBERT = True
except ImportError:
    _HAS_SBERT = False

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
VECTORS_PATH = os.environ.get(
    "VECTORS_PATH",
    str(Path(__file__).parent.parent.parent / "devSquadMemory" / "workspace_vectors.jsonl"),
)
SBERT_MODEL = os.environ.get("SBERT_MODEL", "all-MiniLM-L6-v2")
RETRIEVER_PORT = int(os.environ.get("RETRIEVER_PORT", "8765"))
RETRIEVER_HOST = os.environ.get("RETRIEVER_HOST", "127.0.0.1")

# ---------------------------------------------------------------------------
# In-memory index
# ---------------------------------------------------------------------------
_index: dict[str, Any] = {
    "ids": [],
    "metas": [],
    "vectors": None,   # np.ndarray  shape (N, D)
    "loaded_at": None,
    "vectors_path": VECTORS_PATH,
}

_model: Any = None  # SentenceTransformer instance


def _load_vectors(path: str) -> None:
    """Load vectors JSONL into the in-memory index."""
    ids: list[str] = []
    metas: list[dict] = []
    vecs: list[list[float]] = []

    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"Vectors file not found: {path}")

    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        rec = json.loads(line)
        ids.append(str(rec.get("id", "")))
        metas.append(rec.get("meta") or {})
        vec = rec.get("vector")
        if vec:
            vecs.append(vec)

    _index["ids"] = ids
    _index["metas"] = metas
    _index["vectors"] = np.array(vecs, dtype=np.float32) if vecs else np.zeros((0, 1), dtype=np.float32)
    _index["loaded_at"] = time.time()
    _index["vectors_path"] = path
    print(f"[retriever] Loaded {len(ids)} vectors from {path}")


def _get_model() -> Any:
    """Lazily initialise and cache the SentenceTransformer model."""
    global _model
    if _model is None:
        if not _HAS_SBERT:
            raise RuntimeError(
                "sentence-transformers is not installed. "
                "Run: pip install -r devSquadMemory/requirements.txt"
            )
        print(f"[retriever] Loading SentenceTransformer model: {SBERT_MODEL}")
        _model = SentenceTransformer(SBERT_MODEL)
        print("[retriever] Model ready.")
    return _model


def _cosine_similarity(query_vec: np.ndarray, matrix: np.ndarray) -> np.ndarray:
    """Cosine similarity between a 1-D query vector and each row of matrix."""
    q_norm = np.linalg.norm(query_vec) + 1e-12
    m_norms = np.linalg.norm(matrix, axis=1) + 1e-12
    return (matrix @ query_vec) / (m_norms * q_norm)


def _search(query: str, top_k: int = 5) -> list[dict]:
    """Embed query and return the top-k most similar chunks."""
    if _index["vectors"] is None or len(_index["ids"]) == 0:
        return []

    model = _get_model()
    q_emb = model.encode([query], show_progress_bar=False)[0].astype(np.float32)

    sims = _cosine_similarity(q_emb, _index["vectors"])
    top_idxs = np.argsort(sims)[::-1][:top_k]

    results = []
    for rank, idx in enumerate(top_idxs, start=1):
        results.append(
            {
                "rank": rank,
                "score": float(sims[idx]),
                "id": _index["ids"][idx],
                "meta": _index["metas"][idx],
            }
        )
    return results


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
if _HAS_FASTAPI:
    app = FastAPI(
        title="DevSquad Memory Retriever",
        version="1.0.0",
        description="Persistent semantic search service for devSquadMemory workspace vectors.",
    )

    class QueryRequest(BaseModel):
        query: str
        top_k: int = 5
        vectors_path: str | None = None  # optional per-request override

    @app.on_event("startup")
    async def _startup() -> None:
        """Load vectors and warm up the embedding model at startup."""
        try:
            _load_vectors(VECTORS_PATH)
            _get_model()  # warm up
        except FileNotFoundError as exc:
            print(f"[retriever] WARNING: {exc}  (will serve empty results until /reload is called)")
        except RuntimeError as exc:
            print(f"[retriever] WARNING: {exc}")

    @app.get("/health")
    async def health() -> dict:
        n_vectors = len(_index["ids"])
        return {
            "ok": True,
            "n_vectors": n_vectors,
            "vectors_path": _index["vectors_path"],
            "sbert_model": SBERT_MODEL,
            "model_loaded": _model is not None,
            "loaded_at": _index["loaded_at"],
        }

    @app.get("/vectors/count")
    async def vectors_count() -> dict:
        return {"count": len(_index["ids"])}

    @app.post("/query")
    async def query_endpoint(req: QueryRequest) -> JSONResponse:
        if not req.query.strip():
            raise HTTPException(status_code=422, detail="query must not be empty")

        # Optional per-request vector path override
        if req.vectors_path and req.vectors_path != _index["vectors_path"]:
            try:
                _load_vectors(req.vectors_path)
            except FileNotFoundError as exc:
                raise HTTPException(status_code=404, detail=str(exc))

        if not _HAS_SBERT:
            raise HTTPException(
                status_code=503,
                detail="sentence-transformers not installed — run: pip install -r devSquadMemory/requirements.txt",
            )

        try:
            results = _search(req.query, top_k=req.top_k)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc))

        return JSONResponse(
            {
                "query": req.query,
                "top_k": req.top_k,
                "n_results": len(results),
                "results": results,
            }
        )

    @app.post("/reload")
    async def reload_endpoint(vectors_path: str | None = None) -> dict:
        """Reload vectors from disk (hot reload without restart)."""
        path = vectors_path or VECTORS_PATH
        try:
            _load_vectors(path)
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc))
        return {"ok": True, "n_vectors": len(_index["ids"]), "vectors_path": path}


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def main() -> None:
    if not _HAS_FASTAPI:
        print("ERROR: fastapi and uvicorn are required.")
        print("Install: pip install fastapi uvicorn")
        raise SystemExit(1)

    print(f"[retriever] Starting on http://{RETRIEVER_HOST}:{RETRIEVER_PORT}")
    uvicorn.run(
        "retriever_service:app",
        host=RETRIEVER_HOST,
        port=RETRIEVER_PORT,
        reload=False,
        log_level="info",
    )


if __name__ == "__main__":
    main()
