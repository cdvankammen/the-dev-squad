#!/usr/bin/env python3
"""
Produce a JSONL file from the /memories/devSqauCodeMemory folder and optionally
create embeddings using OpenAI or a local provider. This script is provider-
agnostic and will NOT upload embeddings unless credentials are provided and the
user enables the provider.

Usage:
  python3 tools/rag/ingest_and_embed.py --source /memories/devSqauCodeMemory --out devsquad_memory.jsonl

Optional environment variables:
  OPENAI_API_KEY  - used when --provider openai is selected

Note: Install dependencies for providers as needed (e.g., `pip install openai`).
"""

import argparse
import json
import os
from pathlib import Path


def collect_texts(source: Path):
    docs = []
    for p in source.rglob('*.md'):
        try:
            text = p.read_text(encoding='utf8')
        except Exception:
            continue
        docs.append({'id': str(p.relative_to(source)), 'text': text, 'path': str(p)})
    return docs


def write_jsonl(docs, out_path: Path):
    with out_path.open('w', encoding='utf8') as f:
        for d in docs:
            f.write(json.dumps(d, ensure_ascii=False) + '\n')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', default='/memories/devSqauCodeMemory')
    parser.add_argument('--out', default='devsquad_memory.jsonl')
    parser.add_argument('--provider', choices=['openai', 'ollama', 'local'], default=None)
    parser.add_argument('--model', default='text-embedding-3-small')
    args = parser.parse_args()

    source = Path(args.source)
    out = Path(args.out)

    if not source.exists():
        print(f'Error: source {source} does not exist.')
        return

    docs = collect_texts(source)
    print(f'Collected {len(docs)} documents from {source}')
    write_jsonl(docs, out)
    print(f'Wrote JSONL to {out}')

    if args.provider == 'openai':
        try:
            import openai
        except Exception:
            print('OpenAI SDK not installed. `pip install openai` to enable embedding uploads.')
            return

        key = os.environ.get('OPENAI_API_KEY')
        if not key:
            print('OPENAI_API_KEY not set; skipping embedding creation.')
            return

        openai.api_key = key
        print('Embedding generation against OpenAI is configured but not executed by default.')
        print('You can iterate over the JSONL and call openai.Embeddings.create(model=..., input=...)')


if __name__ == '__main__':
    main()
