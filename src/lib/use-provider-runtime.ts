import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AgentId } from '@/lib/use-pipeline';
import {
  readAgentModelOverrides,
  readModelSelection,
  readProviderRuntimeSettings,
  readProviderSelection,
  writeAgentModelOverride,
  writeModelSelection,
  writeProviderRuntimeSettings,
  writeProviderSelection,
} from '@/lib/providerStorage';

export type ProviderMode = 'claude-code-cli' | 'opencode-cli' | 'openai-compat-http';

export interface ProviderConfigSummary {
  host: string;
  port: number;
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
}

export interface ProviderSummary {
  id: string;
  label: string;
  description: string;
  defaultModel: string;
  mode: ProviderMode;
  config: ProviderConfigSummary;
}

export interface ProviderModelSummary {
  id: string;
  label: string;
  providerId: string;
  source: string;
  paramsString?: string;
  sizeB?: number;
  cooldownExempt?: boolean;
}

export interface UseProviderRuntimeOptions {
  defaultProvider?: string;
  defaultModel?: string;
  defaultWorkingDir?: string;
}

export type ProviderStatusKind = 'idle' | 'loading' | 'ok' | 'empty' | 'error';

const AGENT_ORDER: AgentId[] = ['S', 'A', 'B', 'C', 'D', 'E'];

function normalizePort(value: string): number | undefined {
  const trimmed = String(value || '').trim();
  if (!trimmed) return undefined;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function providerModeFallback(providerId: string): ProviderMode {
  if (providerId === 'opencode') return 'opencode-cli';
  if (providerId === 'claude') return 'claude-code-cli';
  return 'openai-compat-http';
}

function parseBaseUrlParts(baseUrl?: string | null): { host: string; port: string } {
  const trimmed = String(baseUrl || '').trim();
  if (!trimmed) return { host: '', port: '' };
  try {
    const url = new URL(trimmed);
    return {
      host: url.hostname || '',
      port: url.port || (url.protocol === 'https:' ? '443' : '80'),
    };
  } catch {
    return { host: '', port: '' };
  }
}

function buildResolvedUrl(host: string, port: string, fallback?: string | null): string {
  const parsedFallback = parseBaseUrlParts(fallback);
  const resolvedHost = String(host || '').trim() || parsedFallback.host;
  const resolvedPort = String(port || '').trim() || parsedFallback.port;
  if (!resolvedHost) return String(fallback || '').trim();
  const numericPort = normalizePort(resolvedPort);
  const scheme = numericPort === 443 ? 'https' : 'http';
  return `${scheme}://${resolvedHost}${resolvedPort ? `:${resolvedPort}` : ''}`;
}

function dedupeModels(input: ProviderModelSummary[]): ProviderModelSummary[] {
  const seen = new Set<string>();
  const output: ProviderModelSummary[] = [];
  for (const item of input) {
    const id = String(item?.id || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    output.push(item);
  }
  return output;
}

export function useProviderRuntime({
  defaultProvider = 'claude',
  defaultModel = '',
  defaultWorkingDir = '',
}: UseProviderRuntimeOptions = {}) {
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [models, setModels] = useState<ProviderModelSummary[]>([]);
  const [selectedProvider, setSelectedProviderState] = useState(defaultProvider);
  const [selectedModel, setSelectedModelState] = useState(defaultModel);
  const [selectedWorkingDir, setSelectedWorkingDirState] = useState(defaultWorkingDir);
  const [providerHost, setProviderHostState] = useState('');
  const [providerPort, setProviderPortState] = useState('');
  const [providerApiKey, setProviderApiKeyState] = useState('');
  const [agentModels, setAgentModelsState] = useState<Partial<Record<AgentId, string>>>({});
  const [providerStatusKind, setProviderStatusKind] = useState<ProviderStatusKind>('idle');
  const [providerStatusMessage, setProviderStatusMessage] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const configSyncKeyRef = useRef('');
  const refreshSyncKeyRef = useRef('');
  const bootstrapRef = useRef(false);
  const lastPrimaryModelRefreshRef = useRef('');

  const selectedProviderDefinition = useMemo(
    () => providers.find((provider) => provider.id === selectedProvider) || null,
    [providers, selectedProvider]
  );

  const providerMode = selectedProviderDefinition?.mode || providerModeFallback(selectedProvider);
  const availableModels = models.length > 0 ? models : [];
  const providerResolvedUrl = useMemo(
    () => buildResolvedUrl(providerHost, providerPort, selectedProviderDefinition?.config?.baseUrl || ''),
    [providerHost, providerPort, selectedProviderDefinition]
  );

  const refreshProviders = useCallback(async () => {
    try {
      const res = await fetch(`/api/providers?_=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.providers)) {
        setProviders(data.providers as ProviderSummary[]);
      }
    } catch {
      // keep existing provider data on transient failures
    }
  }, []);

  const refreshModels = useCallback(async (providerId?: string) => {
    const resolvedProvider = providerId || selectedProvider;
    if (!resolvedProvider) return;
    setProviderStatusKind('loading');
    setProviderStatusMessage('Checking provider and loading models…');
    try {
      const res = await fetch(`/api/models?provider=${encodeURIComponent(resolvedProvider)}&_=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) {
        setModels([]);
        setProviderStatusKind('error');
        setProviderStatusMessage(`Model discovery failed (HTTP ${res.status}).`);
        return;
      }

      const data = await res.json();
      const routeStatus = String(data?.status || '').trim();
      const routeError = String(data?.error || '').trim();
      const nextModels = dedupeModels(
        Array.isArray(data?.models) ? (data.models as ProviderModelSummary[]) : []
      );
      const modelIds = new Set(nextModels.map((model) => String(model.id || '').trim()).filter(Boolean));
      setModels(nextModels);

      const nextDefault = String(data?.defaultModel || data?.provider?.defaultModel || '').trim();
      const stored = readModelSelection(resolvedProvider, '');
      const current = String(selectedModel || '').trim();
      const firstAvailable = nextModels[0]?.id ? String(nextModels[0].id) : '';

      const nextSelected =
        (stored && modelIds.has(stored) && stored) ||
        (current && modelIds.has(current) && current) ||
        (nextDefault && modelIds.has(nextDefault) && nextDefault) ||
        firstAvailable ||
        nextDefault ||
        defaultModel ||
        '';

      setSelectedModelState(nextSelected);

      const storedOverrides = readAgentModelOverrides(resolvedProvider) as Partial<Record<AgentId, string>>;
      setAgentModelsState((prev) => {
        const merged = { ...prev, ...storedOverrides } as Partial<Record<AgentId, string>>;
        const normalized: Partial<Record<AgentId, string>> = { ...merged };
        for (const agent of AGENT_ORDER) {
          const value = String(merged[agent] || '').trim();
          normalized[agent] = value && modelIds.has(value) ? value : '';
        }
        return normalized;
      });

      if (nextModels.length > 0) {
        setProviderStatusKind('ok');
        setProviderStatusMessage(`${nextModels.length} model${nextModels.length === 1 ? '' : 's'} available.`);
      } else if (routeStatus === 'error' || !!routeError) {
        setProviderStatusKind('error');
        setProviderStatusMessage(routeError || 'Could not reach the provider host. Check the host, port, and API key.');
      } else {
        setProviderStatusKind('empty');
        setProviderStatusMessage(routeError || 'Provider responded, but no models were returned.');
      }
    } catch {
      setModels([]);
      setProviderStatusKind('error');
      setProviderStatusMessage('Could not reach the provider host. Check the host, port, and API key.');
    }
  }, [defaultModel, selectedModel, selectedProvider]);

  useEffect(() => {
    if (bootstrapRef.current) return;
    bootstrapRef.current = true;

    const storedProvider = readProviderSelection(defaultProvider);
    const runtime = readProviderRuntimeSettings(storedProvider);
    const runtimeUrlParts = parseBaseUrlParts(runtime.baseUrl);
    setSelectedProviderState(storedProvider);
    setSelectedWorkingDirState(runtime.workingDir || defaultWorkingDir);
    setProviderHostState(runtimeUrlParts.host || runtime.host || '');
    setProviderPortState(runtimeUrlParts.port || runtime.port || '');
    setProviderApiKeyState(runtime.apiKey || '');
    const storedModel = readModelSelection(storedProvider, defaultModel);
    setSelectedModelState(storedModel || defaultModel);
    setAgentModelsState(readAgentModelOverrides(storedProvider) as Partial<Record<AgentId, string>>);
    setHydrated(true);

    void refreshProviders();
  }, [defaultProvider, defaultModel, defaultWorkingDir, refreshProviders]);

  useEffect(() => {
    if (!hydrated) return;

    const runtime = readProviderRuntimeSettings(selectedProvider);
    const provider = selectedProviderDefinition;
    const fallbackUrl = runtime.baseUrl || provider?.config?.baseUrl || '';
    const parsedUrl = parseBaseUrlParts(fallbackUrl);

    setSelectedWorkingDirState(runtime.workingDir || defaultWorkingDir);
    setProviderHostState(parsedUrl.host || runtime.host || provider?.config?.host || '');
    setProviderPortState(parsedUrl.port || runtime.port || (provider?.config?.port ? String(provider.config.port) : ''));
    setProviderApiKeyState(runtime.apiKey || provider?.config?.apiKey || '');
    setSelectedModelState(
      readModelSelection(selectedProvider, provider?.defaultModel || defaultModel) ||
      provider?.defaultModel ||
      defaultModel
    );
    setAgentModelsState(readAgentModelOverrides(selectedProvider) as Partial<Record<AgentId, string>>);

    if (lastPrimaryModelRefreshRef.current !== selectedProvider) {
      lastPrimaryModelRefreshRef.current = selectedProvider;
      void refreshModels(selectedProvider);
    }
  }, [defaultModel, defaultWorkingDir, hydrated, refreshModels, selectedProvider, selectedProviderDefinition]);

  useEffect(() => {
    if (!hydrated) return;
    writeProviderSelection(selectedProvider);
    writeModelSelection(selectedProvider, selectedModel);
    writeProviderRuntimeSettings(selectedProvider, {
      host: providerHost,
      port: providerPort,
      baseUrl: providerResolvedUrl,
      apiKey: providerApiKey,
      workingDir: selectedWorkingDir,
    });
    for (const agent of AGENT_ORDER) {
      writeAgentModelOverride(selectedProvider, agent, agentModels[agent]);
    }
  }, [agentModels, hydrated, providerApiKey, providerHost, providerPort, providerResolvedUrl, selectedModel, selectedProvider, selectedWorkingDir]);

  useEffect(() => {
    if (!hydrated || providerMode !== 'openai-compat-http') return;

    const payload = {
      id: selectedProvider,
      host: String(providerHost || '').trim() || undefined,
      port: normalizePort(providerPort),
      baseUrl: providerResolvedUrl || undefined,
      apiKey: String(providerApiKey || '').trim() || undefined,
    };
    const syncKey = JSON.stringify(payload);
    if (syncKey === configSyncKeyRef.current) return;

    const timer = window.setTimeout(() => {
      configSyncKeyRef.current = syncKey;
      void fetch('/api/provider-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .catch(() => undefined);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [hydrated, providerApiKey, providerHost, providerMode, providerPort, providerResolvedUrl, refreshModels, selectedProvider]);

  useEffect(() => {
    if (!hydrated || providerMode !== 'openai-compat-http') return;

    const host = String(providerHost || '').trim();
    const port = String(providerPort || '').trim();
    if (!host || !port) return;

    const refreshKey = `${selectedProvider}::${providerResolvedUrl}::${providerApiKey ? 'auth' : 'noauth'}`;
    if (refreshKey === refreshSyncKeyRef.current) return;

    const timer = window.setTimeout(() => {
      refreshSyncKeyRef.current = refreshKey;
      void refreshModels(selectedProvider).catch(() => undefined);
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [hydrated, providerApiKey, providerHost, providerMode, providerPort, providerResolvedUrl, refreshModels, selectedProvider]);

  const setSelectedProvider = useCallback((providerId: string) => {
    const normalized = String(providerId || '').trim() || defaultProvider;
    setSelectedProviderState(normalized);
  }, [defaultProvider]);

  const setSelectedModel = useCallback((modelId: string) => {
    setSelectedModelState(String(modelId || '').trim());
  }, []);

  const setSelectedWorkingDir = useCallback((dir: string) => {
    setSelectedWorkingDirState(String(dir || '').trim());
  }, []);

  const setAgentModel = useCallback((agent: AgentId, value?: string | null) => {
    setAgentModelsState((prev) => ({ ...prev, [agent]: String(value || '').trim() }));
  }, []);

  return {
    providers,
    models: availableModels,
    selectedProvider,
    setSelectedProvider,
    selectedProviderDefinition,
    providerMode,
    selectedModel,
    setSelectedModel,
    selectedWorkingDir,
    setSelectedWorkingDir,
    providerHost,
    setProviderHost: setProviderHostState,
    providerPort,
    setProviderPort: setProviderPortState,
    providerResolvedUrl,
    providerApiKey,
    setProviderApiKey: setProviderApiKeyState,
    providerStatusKind,
    providerStatusMessage,
    agentModels,
    setAgentModel,
    refreshProviders,
    refreshModels,
  };
}