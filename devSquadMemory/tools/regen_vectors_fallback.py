#!/usr/bin/env python3
"""
Re-generate `devSquadMemory/workspace_vectors.jsonl` from `devSquadMemory/workspace_docs.jsonl` using a deterministic pseudo-embedding.

This is a safe fallback for local development when a real embedding model (sentence-transformers or remote API) is not available.

Usage:
  python3 devSquadMemory/tools/regen_vectors_fallback.py

Options:
  --docs PATH          JSONL of docs (default: devSquadMemory/workspace_docs.jsonl)
  --out PATH           Vectors JSONL output (default: devSquadMemory/workspace_vectors.jsonl)
  --dim N              Embedding dimension (default: 384)
  --backup             Create a timestamped backup of existing vectors file

The produced JSONL lines have the shape:
  {"id": "<id>", "vector": [floats...], "meta": {...}}

This script is deterministic: the same input text yields the same pseudo-embedding.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import random
import sys
from datetime import datetime
from pathlib import Path


def pseudo_embedding(text: str, dim: int = 384):
    # Deterministic seed from text
    h = hashlib.sha256(text.encode('utf-8')).digest()
    seed = int.from_bytes(h[:8], 'big')
    rng = random.Random(seed)
    vec = [rng.random() * 2.0 - 1.0 for _ in range(dim)]
    # normalize
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    vec = [x / norm for x in vec]
    return vec


def ensure_docs(docs_path: Path):
    if docs_path.exists():
        return True
    print(f'Docs JSONL not found at {docs_path}. Attempting to create with rag_ingest_example.py')
    script = Path('devSquadMemory') / 'rag_ingest_example.py'
    if script.exists():
        cmd = f'python3 "{script}" --source devSquadMemory --out "{docs_path}"'
        rc = os.system(cmd)
        if rc == 0 and docs_path.exists():
            print('Created docs JSONL')
            return True
        print('Failed to generate docs JSONL (execute rag_ingest_example.py manually)')
        return False
    else:
        print('rag_ingest_example.py not found; create devSquadMemory/workspace_docs.jsonl first')
        return False


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument('--docs', default='devSquadMemory/workspace_docs.jsonl')
    parser.add_argument('--out', default='devSquadMemory/workspace_vectors.jsonl')
    parser.add_argument('--dim', type=int, default=384)
    parser.add_argument('--backup', action='store_true')
    args = parser.parse_args(argv)

    docs_path = Path(args.docs)
    out_path = Path(args.out)
    dim = args.dim

    if not ensure_docs(docs_path):
        print('No docs to process; aborting')
        sys.exit(1)

    if args.backup and out_path.exists():
        stamp = datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
        bak = out_path.with_suffix(out_path.suffix + f'.bak.{stamp}')
        out_path.replace(bak)
        print(f'Backed up existing vectors file to {bak}')

    total = 0
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open('w', encoding='utf-8') as vf:
        for line in docs_path.read_text(encoding='utf-8').splitlines():
            if not line.strip():
                continue
            try:
                d = json.loads(line)
            except Exception:
                continue
            text = d.get('text', '')
            emb = pseudo_embedding(text, dim=dim)
            rec = {'id': d.get('id'), 'vector': emb, 'meta': {'path': d.get('path'), 'title': d.get('title'), 'chunk': d.get('chunk')}}
            vf.write(json.dumps(rec, ensure_ascii=False) + '\n')
            total += 1

    print(f'Wrote {total} vectors to {out_path} (dim={dim})')


if __name__ == '__main__':
    main()
