#!/usr/bin/env python3
"""
Simple JSONL bundler for devSquadMemory
Usage:
  python3 rag_ingest_example.py --source devSquadMemory --out devsquad_memory.jsonl

This script writes lines with the shape:
{ "id": "<path>", "path": "<path>", "title": "<filename>", "text": "<file contents>" }

It does NOT call an embedding API — use your embedding provider script to read the JSONL and create vectors.
"""
import argparse
import json
from pathlib import Path


def gather_files(source: str):
    p = Path(source)
    for f in sorted(p.rglob('*')):
        if f.is_file():
            yield f


def make_record(path: Path):
    text = path.read_text(encoding='utf-8')
    return {
        'id': str(path),
        'path': str(path),
        'title': path.name,
        'text': text,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', required=True)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()

    out_path = Path(args.out)
    with out_path.open('w', encoding='utf-8') as out:
        for f in gather_files(args.source):
            rec = make_record(f)
            out.write(json.dumps(rec, ensure_ascii=False) + '\n')

    print(f'Wrote {out_path} — ready for embedding conversion')


if __name__ == '__main__':
    main()
