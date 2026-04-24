#!/usr/bin/env python3
"""
Compute an embedding for a given text using sentence-transformers and print
the result as JSON to stdout.

Usage:
  python3 query_embed.py --text "your query here" --model all-MiniLM-L6-v2
"""
import argparse
import json
from sentence_transformers import SentenceTransformer


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--text', required=True)
    parser.add_argument('--model', default='all-MiniLM-L6-v2')
    args = parser.parse_args()

    model = SentenceTransformer(args.model)
    emb = model.encode([args.text], show_progress_bar=False)[0]
    print(json.dumps({'embedding': emb.tolist()}))


if __name__ == '__main__':
    main()
