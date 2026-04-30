'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
}

export interface UseProviderRuntimeOptions {
  defaultProvider?: string;
  defaultModel?: string;
  defaultWorkingDir?: string;
}

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
  const [providerBaseUrl, setProviderBaseUrlState] = useState('');
  const [providerApiKey, setProviderApiKeyState] = useState('');
  const [agentModels, setAgentModelsState] = useState<Partial<Record<AgentId, string>>>({});
  const [hydrated, setHydrated] = useState(false);

  const selectedProviderDefinition = useMemo(
    () => providers.find((provider) => provider.id === selectedProvider) || null,
    [providers, selectedProvider]
  );

  const providerMode = selectedProviderDefinition?.mode || providerModeFallback(selectedProvider);
  const availableModels = models.length > 0 ? models : [];

  const refreshProviders = useCallback(async () => {
    try {
      const res = await fetch('/api/providers');
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
    try {
      const res = await fetch(`/api/models?provider=${encodeURIComponent(resolvedProvider)}`);
      if (!res.ok) return;
      const data = await res.json();
      const nextModels = Array.isArray(data?.models) ? (data.models as ProviderModelSummary[]) : [];
      const modelIds = new Set(nextModels.map((model) => String(model.id || '').trim()).filter(Boolean));

      if (Array.isArray(data?.models)) {
        setModels(nextModels);
      } else {
        setModels([]);
      }

      const nextDefault = String(data?.defaultModel || data?.provider?.defaultModel || '').trim();
      const stored = readModelSelection(resolvedProvider, '');
      const current = String(selectedModel || '').trim();
      const firstAvailable = nextModels[0]?.id ? String(nextModels[0].id) : '';

      const nextSelected =
        (stored && modelIds.has(stored) && stored) ||
        (current && modelIds.has(current) && current) ||
        (nextDefault && modelIds.has(nextDefault) && nextDefault) ||
        firstAvailable ||
        stored ||
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
    } catch {
      setModels([]);
    }
  }, [defaultModel, selectedModel, selectedProvider]);

  useEffect(() => {
    const storedProvider = readProviderSelection(defaultProvider);
    const runtime = readProviderRuntimeSettings(storedProvider);
    setSelectedProviderState(storedProvider);
    setSelectedWorkingDirState(runtime.workingDir || defaultWorkingDir);
    setProviderHostState(runtime.host || '');
    setProviderPortState(runtime.port || '');
    setProviderBaseUrlState(runtime.baseUrl || '');
    setProviderApiKeyState(runtime.apiKey || '');
    const storedModel = readModelSelection(storedProvider, defaultModel);
    setSelectedModelState(storedModel || defaultModel);
    setAgentModelsState(readAgentModelOverrides(storedProvider) as Partial<Record<AgentId, string>>);
    setHydrated(true);

    void refreshProviders();
    void refreshModels(storedProvider);
  }, [defaultProvider, defaultModel, defaultWorkingDir, refreshModels, refreshProviders]);

  useEffect(() => {
    if (!hydrated) return;
    const runtime = readProviderRuntimeSettings(selectedProvider);
    const provider = selectedProviderDefinition;
    setSelectedWorkingDirState(runtime.workingDir || defaultWorkingDir);
    setProviderHostState(runtime.host || provider?.config?.host || '');
    setProviderPortState(runtime.port || (provider?.config?.port ? String(provider.config.port) : ''));
    setProviderBaseUrlState(runtime.baseUrl || provider?.config?.baseUrl || '');
    setProviderApiKeyState(runtime.apiKey || provider?.config?.apiKey || '');
    setSelectedModelState(readModelSelection(selectedProvider, provider?.defaultModel || defaultModel) || provider?.defaultModel || defaultModel);
    setAgentModelsState(readAgentModelOverrides(selectedProvider) as Partial<Record<AgentId, string>>);
    void refreshModels(selectedProvider);
  }, [defaultModel, defaultWorkingDir, hydrated, refreshModels, selectedProvider, selectedProviderDefinition]);

  useEffect(() => {
    if (!hydrated) return;
    writeProviderSelection(selectedProvider);
    writeModelSelection(selectedProvider, selectedModel);
    writeProviderRuntimeSettings(selectedProvider, {
      host: providerHost,
      port: providerPort,
      baseUrl: providerBaseUrl,
      apiKey: providerApiKey,
      workingDir: selectedWorkingDir,
    });
    for (const agent of AGENT_ORDER) {
      writeAgentModelOverride(selectedProvider, agent, agentModels[agent]);
    }

    if (providerMode === 'openai-compat-http') {
      const port = normalizePort(providerPort);
      const payload = {
        id: selectedProvider,
        host: providerHost.trim() || undefined,
        port,
        baseUrl: providerBaseUrl.trim() || undefined,
        apiKey: providerApiKey.trim() || undefined,
      };
      void fetch('/api/provider-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => undefined);
    }
  }, [agentModels, hydrated, providerApiKey, providerBaseUrl, providerHost, providerMode, providerPort, selectedModel, selectedProvider, selectedWorkingDir]);

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
    providerBaseUrl,
    setProviderBaseUrl: setProviderBaseUrlState,
    providerApiKey,
    setProviderApiKey: setProviderApiKeyState,
    agentModels,
    setAgentModel,
    refreshProviders,
    refreshModels,
  };
}
