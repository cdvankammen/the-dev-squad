#!/usr/bin/env python3
"""
Simple nearest-neighbor query helper for workspace vectors.

Usage:
  python3 devSquadMemory/query_helper.py --vectors devSquadMemory/workspace_vectors.jsonl --query "how does runner spawn claude" --topk 5

This script computes an embedding for the query using the same sentence-transformers
model and returns the top-k most similar document chunks from the vectors JSONL.
"""
import argparse
import json
from pathlib import Path

def load_vectors(path):
    ids = []
    metas = []
    vecs = []
    for line in Path(path).read_text(encoding='utf-8').splitlines():
        if not line.strip():
            continue
        rec = json.loads(line)
        ids.append(rec.get('id'))
        metas.append(rec.get('meta'))
        vecs.append(rec.get('vector'))
    return ids, metas, vecs


def cosine_sim(a, b):
    # a: 1-D list/array, b: 2-D list of arrays
    import numpy as np
    a = np.array(a, dtype=float)
    B = np.array(b, dtype=float)
    a_norm = np.linalg.norm(a)
    B_norm = np.linalg.norm(B, axis=1)
    sims = (B @ a) / (B_norm * (a_norm + 1e-12))
    return sims


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--vectors', default='devSquadMemory/workspace_vectors.jsonl')
    parser.add_argument('--query', required=True)
    parser.add_argument('--model', default='all-MiniLM-L6-v2')
    parser.add_argument('--topk', type=int, default=5)
    args = parser.parse_args()

    ids, metas, vecs = load_vectors(args.vectors)
    if len(vecs) == 0:
        print('No vectors found. Run build_local_embeddings first.')
        return

    try:
        from sentence_transformers import SentenceTransformer
    except Exception:
        print('Missing sentence-transformers. Install: pip install -r devSquadMemory/requirements.txt')
        return

    model = SentenceTransformer(args.model)
    q_emb = model.encode([args.query])[0]
    import numpy as np
    sims = cosine_sim(q_emb, vecs)
    idxs = list(reversed(np.argsort(sims)[: args.topk]))
    # reversed because we used argsort ascending then reversed to get descending
    print(f'Top {args.topk} matches for query: "{args.query}"')
    for rank, i in enumerate(idxs, start=1):
        print('---')
        print(f'Rank {rank} score={sims[i]:.4f} id={ids[i]}')
        print('meta:', json.dumps(metas[i], ensure_ascii=False))


if __name__ == '__main__':
    main()
