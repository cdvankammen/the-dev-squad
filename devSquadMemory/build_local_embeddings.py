#!/usr/bin/env python3
"""
Build local embeddings for workspace files using sentence-transformers.

Outputs:
 - devSquadMemory/workspace_docs.jsonl  (document chunks)
 - devSquadMemory/workspace_vectors.jsonl (id + vector + metadata)

Usage:
  python3 devSquadMemory/build_local_embeddings.py --source . --out-docs devSquadMemory/workspace_docs.jsonl --out-vectors devSquadMemory/workspace_vectors.jsonl

This script excludes common binary and secret folders (node_modules, .git, devSquadMemory, .claude, .env files).
"""
import argparse
import json
import os
from pathlib import Path
from typing import List


EXCLUDE_DIRS = {'.git', 'node_modules', 'venv', '.venv', '__pycache__', 'dist', 'build', 'out', 'memories'}
EXT_WHITELIST = {'.md', '.mdx', '.py', '.ts', '.tsx', '.js', '.jsx', '.json', '.txt', '.yaml', '.yml', '.toml', '.cfg', '.ini', '.html', '.css', '.jsonl', '.sh', '.Dockerfile'}
MAX_CHARS_PER_CHUNK = 2000
SKIP_FILE_MAX_BYTES = 2 * 1024 * 1024  # 2MB


def is_text_file(path: Path) -> bool:
    if path.suffix.lower() in EXT_WHITELIST:
        return True
    name = path.name.lower()
    if name in ('dockerfile',):
        return True
    return False


def gather_files(root: Path) -> List[Path]:
    files: List[Path] = []
    for p in sorted(root.rglob('*')):
        if p.is_dir():
            # skip excluded dirs
            if any(part in EXCLUDE_DIRS for part in p.parts):
                continue
        else:
            if any(part in EXCLUDE_DIRS for part in p.parts):
                continue
            if not is_text_file(p):
                continue
            try:
                if p.stat().st_size > SKIP_FILE_MAX_BYTES:
                    continue
            except Exception:
                continue
            files.append(p)
    return files


def chunk_text(text: str, max_chars: int = MAX_CHARS_PER_CHUNK):
    if len(text) <= max_chars:
        yield text
        return
    start = 0
    while start < len(text):
        end = start + max_chars
        yield text[start:end]
        start = end


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', default='devSquadMemory')
    parser.add_argument('--out-docs', default='devSquadMemory/workspace_docs.jsonl')
    parser.add_argument('--out-vectors', default='devSquadMemory/workspace_vectors.jsonl')
    parser.add_argument('--model', default='all-MiniLM-L6-v2')
    parser.add_argument('--batch-size', type=int, default=32)
    args = parser.parse_args()

    root = Path(args.source).resolve()
    out_docs = Path(args.out_docs)
    out_vectors = Path(args.out_vectors)

    print(f'Gathering files under {root} (this may take a moment)')
    files = gather_files(root)
    print(f'Found {len(files)} files to index')

    docs = []
    for p in files:
        try:
            text = p.read_text(encoding='utf-8')
        except Exception:
            continue
        # simple chunking
        chunks = list(chunk_text(text))
        for i, chunk in enumerate(chunks):
            doc_id = f"{p.relative_to(root)}::chunk{i}"
            docs.append({'id': doc_id, 'path': str(p.relative_to(root)), 'title': p.name, 'chunk': i, 'text': chunk})

    print(f'Created {len(docs)} document chunks; writing docs JSONL to {out_docs}')
    out_docs.parent.mkdir(parents=True, exist_ok=True)
    with out_docs.open('w', encoding='utf-8') as f:
        for d in docs:
            f.write(json.dumps(d, ensure_ascii=False) + '\n')

    # Compute embeddings using sentence-transformers
    try:
        from sentence_transformers import SentenceTransformer
        import numpy as np
    except Exception as e:
        print('Missing dependencies. Please run: pip install -r devSquadMemory/requirements.txt')
        raise

    model_name = args.model
    print(f'Loading embedding model {model_name} (this may download model weights)')
    model = SentenceTransformer(model_name)

    batch_size = args.batch_size
    print(f'Encoding {len(docs)} chunks (batch_size={batch_size})')

    out_vectors.parent.mkdir(parents=True, exist_ok=True)
    with out_vectors.open('w', encoding='utf-8') as vf:
        for i in range(0, len(docs), batch_size):
            batch = docs[i:i+batch_size]
            texts = [d['text'] for d in batch]
            embs = model.encode(texts, batch_size=batch_size, show_progress_bar=False)
            # embs may be numpy array
            for d, emb in zip(batch, embs):
                rec = {'id': d['id'], 'vector': emb.tolist() if hasattr(emb, 'tolist') else list(map(float, emb)), 'meta': {'path': d['path'], 'title': d['title'], 'chunk': d['chunk']}}
                vf.write(json.dumps(rec, ensure_ascii=False) + '\n')

    print(f'Wrote vectors to {out_vectors}')
    print('Done')


if __name__ == '__main__':
    main()
