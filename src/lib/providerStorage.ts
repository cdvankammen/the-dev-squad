export const STORAGE_KEYS = {
  provider: 'devsquad.selectedProvider',
  modelPrefix: 'devsquad.selectedModel.',
  providerConfigPrefix: 'devsquad.providerConfig.',
};

export const AGENT_MODEL_OVERRIDE_IDS = ['S', 'A', 'B', 'C', 'D', 'E'] as const;

export function readStoredValue(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(key);
    return value && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

export function writeStoredValue(key: string, value: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export function removeStoredValue(key: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function getModelStorageKey(providerId?: string) {
  return `${STORAGE_KEYS.modelPrefix}${providerId || 'default'}`;
}

export function getAgentModelStorageKey(providerId?: string, agent?: string) {
  return `${STORAGE_KEYS.modelPrefix}${providerId || 'default'}.${agent || 'A'}`;
}

export function getProviderStorageKey(field: string, providerId?: string) {
  return `${STORAGE_KEYS.providerConfigPrefix}${providerId || 'default'}.${field}`;
}

export function readProviderSelection(defaultProvider = 'claude') {
  const stored = readStoredValue(STORAGE_KEYS.provider);
  return stored || defaultProvider;
}

export function writeProviderSelection(providerId: string) {
  const normalized = String(providerId || '').trim();
  if (normalized) {
    writeStoredValue(STORAGE_KEYS.provider, normalized);
    return;
  }
  removeStoredValue(STORAGE_KEYS.provider);
}

export function readModelSelection(providerId?: string, fallback = '') {
  return readStoredValue(getModelStorageKey(providerId)) || fallback;
}

export function writeModelSelection(providerId: string | undefined, modelId?: string | null) {
  const key = getModelStorageKey(providerId);
  const normalized = String(modelId ?? '').trim();
  if (normalized) {
    writeStoredValue(key, normalized);
    return;
  }
  removeStoredValue(key);
}

export interface ProviderRuntimeSettings {
  host?: string;
  port?: string;
  baseUrl?: string;
  apiKey?: string;
  workingDir?: string;
}

export function readProviderRuntimeSettings(providerId?: string): ProviderRuntimeSettings {
  return {
    host: readStoredValue(getProviderStorageKey('host', providerId)) || undefined,
    port: readStoredValue(getProviderStorageKey('port', providerId)) || undefined,
    baseUrl: readStoredValue(getProviderStorageKey('baseUrl', providerId)) || undefined,
    // API keys are intentionally not read back from browser storage. The server-side
    // provider config owns persisted secrets; the browser may hold a typed key only
    // in React state long enough to submit it to /api/provider-config.
    apiKey: undefined,
    workingDir: readStoredValue(getProviderStorageKey('workingDir', providerId)) || undefined,
  };
}

export function writeProviderRuntimeSettings(providerId: string | undefined, settings: ProviderRuntimeSettings) {
  const normalizedProvider = providerId || 'default';
  const entries: Array<[string, string | undefined]> = [
    ['host', settings.host],
    ['port', settings.port],
    ['baseUrl', settings.baseUrl],
    ['workingDir', settings.workingDir],
  ];

  // Remove legacy client-side API-key copies if an older build wrote them.
  removeStoredValue(getProviderStorageKey('apiKey', normalizedProvider));

  for (const [field, value] of entries) {
    const key = getProviderStorageKey(field, normalizedProvider);
    const normalized = String(value || '').trim();
    if (normalized) {
      writeStoredValue(key, normalized);
    } else {
      removeStoredValue(key);
    }
  }
}

export function readAgentModelOverrides(providerId?: string, agents: readonly string[] = AGENT_MODEL_OVERRIDE_IDS) {
  const result: Record<string, string> = {};
  for (const agent of agents) {
    const stored = readStoredValue(getAgentModelStorageKey(providerId, agent));
    if (stored) result[agent] = stored;
  }
  return result;
}

export function writeAgentModelOverride(providerId: string | undefined, agent: string, value?: string | null) {
  const key = getAgentModelStorageKey(providerId, agent);
  const normalized = String(value ?? '').trim();
  if (normalized) {
    writeStoredValue(key, normalized);
    return;
  }
  removeStoredValue(key);
}
