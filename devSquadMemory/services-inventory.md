# Services Inventory — The Dev Squad

**Last tested: 2026-04-25**

## LLM Provider Status Matrix

| Provider      | Status       | Endpoint                               | Discovery | Models |
|---------------|--------------|----------------------------------------|-----------|--------|
| claude-cli    | ✅ LIVE      | local `~/.claude` + claude binary      | YES       | 2 |
| ccr           | ✅ LIVE      | localhost:3456 (proxies to LM Studio)  | YES       | 25 |
| occ           | ✅ LIVE      | AWS Bedrock via local claude           | YES       | 3 |
| openclaude    | ✅ LIVE      | local claude binary                    | YES       | 2 |
| ollama        | ✅ LIVE      | localhost:11434                        | YES       | 2 |
| lm-studio     | ✅ LIVE      | 192.168.1.90:1234 + 10.2.0.90:1234    | YES       | 23 |
| openwebui     | ✅ LIVE      | detected at localhost                  | YES       | 1 |
| openai-compat | ⚠️ No server | configurable (no host configured)      | YES (0)   | 0 |
| openai-http   | ⚠️ No key   | api.openai.com (no API key set)        | YES (0)   | 0 |

## LM Studio (Remote Machine)

**Machine**: 192.168.1.90 / 10.2.0.90 (same machine, two network interfaces)
**Port**: 1234
**APIs**:
- Native: `GET /api/v1/models` → `{ models: [{ key, display_name }] }`
- OpenAI-compat: `GET /v1/models` → `{ data: [{ id }] }`
- Chat: `POST /v1/chat/completions` (OpenAI-compat format)

**CCR Config** (`~/.claude-code-router/config.json`):
```json
{
  "Providers": [
    { "name": "lmstudio", "api_base_url": "http://192.168.1.90:1234/v1/chat/completions", "models": [...23] },
    { "name": "lmstudio-10.2", "api_base_url": "http://10.2.0.90:1234/v1/chat/completions", "models": [...23] }
  ],
  "Router": {
    "default": "lmstudio,lfm2.5-1.2b-distilled-claude-4.6",
    "background": "lmstudio,lfm2.5-1.2b-distilled-claude-4.6",
    "think": "lmstudio,lfm2.5-1.2b-distilled-claude-4.6",
    "longContext": "lmstudio,lfm2.5-1.2b-distilled-claude-4.6",
    "webSearch": "lmstudio,google/gemma-4-31b",
    "image": "lmstudio,google/gemma-4-31b"
  },
  "PORT": 3456
}
```

### LM Studio Model Inventory (23 models, live 2026-04-25)

| Model ID | Category |
|----------|----------|
| allenai/olmo-3-32b-think | reasoning |
| baidu/ernie-4.5-21b-a3b | chat/MoE |
| claude-3.7-sonnet-reasoning-gemma3-12b | distilled |
| essentialai/rnj-1 | unknown |
| glm-4.7-flash-claude-opus-4.5-high-reasoning-distill-v2-heretic-i1 | distilled |
| google/gemma-3-27b | chat |
| google/gemma-3n-e4b | efficient |
| google/gemma-4-26b-a4b | MoE |
| google/gemma-4-31b | chat |
| ibm/granite-3.2-8b | code/chat |
| lfm2.5-1.2b-distilled-claude-4.6 | distilled small |
| liquid/lfm2-1.2b | small |
| liquid/lfm2-24b-a2b | MoE |
| liquid/lfm2.5-1.2b | small |
| meta/llama-3.3-70b | large chat |
| mineru2.5-pro-2604-1.2b-i1 | small |
| minimax-m2.5 | chat |
| nvidia/nemotron-3-nano-4b | small |
| qwen/qwen3.5-35b-a3b | MoE |
| qwen/qwen3.5-9b | chat |
| qwopus3.5-27b-v3 | distilled |
| text-embedding-nomic-embed-text-v1.5 | **embedding** (not for chat) |
| zai-org/glm-4.6v-flash | vision-language |

> ⚠️ `text-embedding-nomic-embed-text-v1.5` is an embedding model — cannot be used for chat/completion tasks.

## Ollama (Local)

**Endpoint**: http://localhost:11434
**API**: `GET /api/tags` → `{ models: [{ name }] }`

| Model | Status |
|-------|--------|
| llama3.2:latest | ✅ installed |
| llama | ✅ installed (alias/base) |

## OpenWebUI

**Endpoint**: localhost (port auto-detected)
**Status**: Online, 1 model ("Claude")

## CCR (Claude Code Router)

**Port**: 3456
**Config**: `~/.claude-code-router/config.json`
**Version**: 2.1.119
**Models exposed**: 25 (LM Studio models + CCR/Bedrock entries)

## Testing Commands

```bash
# Test all 9 providers live:
npx tsx scripts/test-all-providers.mjs

# Test LM Studio 192 directly:
curl -s http://192.168.1.90:1234/api/v1/models | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d['models']), 'models')"

# Test LM Studio 10.2 directly:
curl -s http://10.2.0.90:1234/api/v1/models | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d['models']), 'models')"

# Test via app API (requires dev server running on :3000):
curl -s "http://localhost:3000/api/models?provider=lm-studio" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['modelCount'], 'models via app')"
```
