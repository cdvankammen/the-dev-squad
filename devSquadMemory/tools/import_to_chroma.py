#!/usr/bin/env python3
"""
Import JSONL embeddings into Chroma DB and run a sample semantic query using the same SBERT model.

Usage:
  python3 import_to_chroma.py --vectors devSquadMemory/workspace_vectors_sbert.jsonl

This does not use external APIs; it persists a local Chroma DB under --persist-dir.
"""
import argparse
import json
from pathlib import Path

def load_jsonl(path):
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            yield json.loads(line)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--vectors", default="devSquadMemory/workspace_vectors_sbert.jsonl")
    parser.add_argument("--persist-dir", default="devSquadMemory/chroma_db")
    parser.add_argument("--collection", default="dev_squad_memory")
    parser.add_argument("--query-text", default="Assume your context window might be reset at any moment")
    parser.add_argument("--model", default="all-mpnet-base-v2")
    parser.add_argument("--n-results", type=int, default=5)
    args = parser.parse_args()

    recs = list(load_jsonl(args.vectors))
    if not recs:
        print("No vectors found in", args.vectors)
        return
    ids = [r["id"] for r in recs]
    docs = [r["text"] for r in recs]
    embeddings = [r["embedding"] for r in recs]
    metadatas = [{"path": r["path"], "start": r["start"], "end": r["end"]} for r in recs]

    try:
        import chromadb
        from chromadb.config import Settings
    except Exception:
        print("chromadb not installed. Install with: python3 -m pip install chromadb")
        raise
    # Try to create Chroma client; if the installed chromadb has a different config API
    # (or client creation fails), fall back to a local NearestNeighbors search so the
    # import and query still work without external services.
    use_chroma = True
    try:
        client = chromadb.Client(Settings(chroma_db_impl="duckdb+parquet", persist_directory=args.persist_dir))
        try:
            collection = client.get_collection(args.collection)
        except Exception:
            collection = client.create_collection(name=args.collection)

        collection.add(ids=ids, documents=docs, embeddings=embeddings, metadatas=metadatas)
        print(f"Imported {len(ids)} vectors into Chroma collection '{args.collection}' at {args.persist_dir}")

        # compute query embedding using the same sentence-transformers model
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer(args.model)
        q_emb = model.encode([args.query_text], convert_to_numpy=True)[0].tolist()

        res = collection.query(query_embeddings=[q_emb], n_results=args.n_results, include=["documents","distances","metadatas"])
        print("Query results:")
        docs_r = res.get("documents", [[]])[0]
        dists_r = res.get("distances", [[]])[0]
        metas_r = res.get("metadatas", [[]])[0]
        for i, (doc, dist, meta) in enumerate(zip(docs_r, dists_r, metas_r)):
            print(f"{i+1}. distance={dist:.4f}, path={meta.get('path')}, snippet={doc[:160]!r}")
    except Exception as e:
        print("Chroma import failed or is incompatible with this environment; falling back to local nearest-neighbor search.")
        # Local fallback: use sklearn NearestNeighbors (cosine) to query embeddings
        try:
            from sentence_transformers import SentenceTransformer
            import numpy as np
            from sklearn.neighbors import NearestNeighbors
        except Exception:
            print("Fallback requires: sentence-transformers, numpy, scikit-learn. Install with: python3 -m pip install sentence-transformers numpy scikit-learn")
            raise

        model = SentenceTransformer(args.model)
        q_emb = model.encode([args.query_text], convert_to_numpy=True)[0]
        emb_array = np.array(embeddings)
        # use cosine distance via metric='cosine'
        nn = NearestNeighbors(n_neighbors=min(args.n_results, len(emb_array)), metric='cosine')
        nn.fit(emb_array)
        dists, idxs = nn.kneighbors([q_emb])
        print("Fallback query results:")
        for rank, (dist, idx) in enumerate(zip(dists[0], idxs[0]), start=1):
            meta = metadatas[int(idx)]
            snippet = docs[int(idx)][:160]
            print(f"{rank}. distance={dist:.4f}, path={meta.get('path')}, snippet={snippet!r}")

if __name__ == "__main__":
    main()
