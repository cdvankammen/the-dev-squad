import ClaudeCliAdapter from './claudeCliAdapter';
import OpenAIHttpAdapter from './openaiHttpAdapter';
import OpenClaudeCodeAdapter from './openClaudeCodeAdapter';
import OpenClaudeAdapter from './openClaudeAdapter';
import LMStudioAdapter from './lmStudioAdapter';
import ClaudeCodeRouterAdapter from './claudeCodeRouterAdapter';
import OllamaAdapter from './ollamaAdapter';
import OpenWebUIAdapter from './openWebUIAdapter';
import OpenAICompatAdapter from './openAICompatAdapter';
import type { ModelAdapter } from './ModelAdapter';

/**
 * Simple adapter factory for the pipeline runner.
 *
 * Recognizes a small set of well-known provider identifiers and returns a
 * corresponding ModelAdapter instance. Returns null when no matching adapter
 * is known.
 */
export function getModelAdapter(provider?: string): ModelAdapter | null {
  const p = (provider || 'claude-cli').toLowerCase();

  if (p === 'claude-cli' || p === 'claude') {
    return new ClaudeCliAdapter();
  }

  if (p === 'occ' || p === 'open-claude-code' || p === '@ruvnet/open-claude-code') {
    return new OpenClaudeCodeAdapter();
  }

  if (p === 'openclaude' || p === '@gitlawb/openclaude') {
    return new OpenClaudeAdapter();
  }

  if (p === 'openai-http' || p === 'openai') {
    return new OpenAIHttpAdapter();
  }

  if (p === 'lm-studio' || p === 'lmstudio') {
    return new LMStudioAdapter();
  }


  if (p === 'ccr' || p === 'claude-code-router') {
    return new ClaudeCodeRouterAdapter();
  }

  if (p === 'ollama') {
    return new OllamaAdapter();
  }

  if (p === 'openwebui' || p === 'open-webui') {
    return new OpenWebUIAdapter();
  }

  if (p === 'openai-compat' || p === 'openai-compatible') {
    return new OpenAICompatAdapter();
  }

  // Unknown provider
  return null;
}

export default getModelAdapter;
