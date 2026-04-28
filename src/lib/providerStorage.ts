export const STORAGE_KEYS = {
  provider: 'devsquad.selectedProvider',
  modelPrefix: 'devsquad.selectedModel.',
};

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

export function getModelStorageKey(providerId?: string) {
  return `${STORAGE_KEYS.modelPrefix}${providerId || 'default'}`;
}

export function getAgentModelStorageKey(providerId?: string, agent?: string) {
  return `${STORAGE_KEYS.modelPrefix}${providerId || 'default'}.${agent || 'A'}`;
}
