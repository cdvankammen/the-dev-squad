#!/usr/bin/env python3
"""
Optional adapters for OpenAI and Cohere embedding APIs.

These functions are safe to have in the repo but will raise if API keys are not set.
They are not used by the local pipeline unless you explicitly call them.
"""
import os

def openai_embeddings(texts, model="text-embedding-3-small"):
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise RuntimeError("OPENAI_API_KEY not set. Set it to use OpenAI adapter.")
    import openai
    openai.api_key = key
    resp = openai.Embedding.create(model=model, input=texts)
    return [item["embedding"] for item in resp["data"]]

def cohere_embeddings(texts, model="embed-english-v2.0"):
    key = os.environ.get("COHERE_API_KEY")
    if not key:
        raise RuntimeError("COHERE_API_KEY not set. Set it to use Cohere adapter.")
    from cohere import Client
    client = Client(key)
    resp = client.embed(texts=texts, model=model)
    return resp.embeddings
