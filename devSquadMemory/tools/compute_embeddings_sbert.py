#!/usr/bin/env python3
"""
Compute sentence-transformers embeddings for text files under a root directory and write a JSONL of {id,path,start,end,text,embedding}.

Usage:
  python3 compute_embeddings_sbert.py --root devSquadMemory --output devSquadMemory/workspace_vectors_sbert.jsonl

This script is intentionally simple and avoids external APIs.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path

def find_files(root, include_exts=None, exclude_dirs=None):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in exclude_dirs]
        for fname in filenames:
            if include_exts is None or any(fname.lower().endswith(ext) for ext in include_exts):
                yield os.path.join(dirpath, fname)

def chunk_text(text, chunk_size=1000, overlap=200):
    if chunk_size <= overlap:
        raise ValueError("chunk_size must be > overlap")
    start = 0
    L = len(text)
    while start < L:
        end = min(start + chunk_size, L)
        yield start, end, text[start:end]
        if end == L:
            break
        start = end - overlap

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default="devSquadMemory", help="Root directory to scan for files")
    parser.add_argument("--model", default="all-mpnet-base-v2", help="SentenceTransformer model name")
    parser.add_argument("--output", default="devSquadMemory/workspace_vectors_sbert.jsonl", help="Output JSONL path")
    parser.add_argument("--chunk-size", type=int, default=1000)
    parser.add_argument("--overlap", type=int, default=200)
    parser.add_argument("--batch-size", type=int, default=64)
    args = parser.parse_args()

    include_exts = [
        ".md", ".txt", ".py", ".js", ".ts", ".json", ".html", ".yaml", ".yml", ".cfg", ".ini", ".toml", ".rst"
    ]
    exclude_dirs = {'.git', 'node_modules', '__pycache__', '.venv', 'venv', '.cache', 'build', 'dist', '.ipynb_checkpoints'}

    root = Path(args.root)
    files = list(find_files(root, include_exts=include_exts, exclude_dirs=exclude_dirs))
    print(f"Found {len(files)} files under {root}")

    chunks = []
    metadata = []
    for fpath in files:
        try:
            with open(fpath, 'r', encoding='utf-8', errors='ignore') as fh:
                text = fh.read().strip()
        except Exception:
            continue
        if not text:
            continue
        for start, end, chunk in chunk_text(text, chunk_size=args.chunk_size, overlap=args.overlap):
            sha = hashlib.sha1(f"{fpath}:{start}:{end}".encode('utf-8')).hexdigest()
            chunks.append(chunk)
            metadata.append({"id": sha, "path": str(fpath), "start": start, "end": end})

    if not chunks:
        print("No text chunks found to embed. Exiting.")
        return

    # lazy import to keep startup fast when script is inspected
    from sentence_transformers import SentenceTransformer
    from tqdm import tqdm

    print(f"Loading model {args.model} (this will download if needed)")
    model = SentenceTransformer(args.model)

    out_file = Path(args.output)
    out_file.parent.mkdir(parents=True, exist_ok=True)

    with out_file.open('w', encoding='utf-8') as outf:
        for i in range(0, len(chunks), args.batch_size):
            batch_texts = chunks[i:i + args.batch_size]
            embs = model.encode(batch_texts, batch_size=args.batch_size, convert_to_numpy=True, show_progress_bar=False)
            for j, emb in enumerate(embs):
                meta = metadata[i + j]
                record = {
                    "id": meta["id"],
                    "path": meta["path"],
                    "start": meta["start"],
                    "end": meta["end"],
                    "text": batch_texts[j],
                    "embedding": emb.tolist(),
                }
                outf.write(json.dumps(record) + "\n")

    print(f"Wrote {out_file}")


if __name__ == "__main__":
    main()
