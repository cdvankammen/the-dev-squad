'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/shared/Badge';
import { AutoGrowTextarea } from '@/components/shared/AutoGrowTextarea';
import { MarkdownText } from '@/components/shared/MarkdownText';
import { getExecutionPathStatus, getSupervisorRecommendation, getSupervisorUpdate } from '@/lib/pipeline-supervisor';
import { usePipelineState, type AgentId, type AppMode, type PendingApproval, type RunGoal, type SecurityMode } from '@/lib/use-pipeline';

const AGENT_NAMES: Record<AgentId, string> = {
  A: 'Planner',
  B: 'Plan Reviewer',
  C: 'Coder',
  D: 'Tester',
  E: 'Security Auditor',
  S: 'Supervisor',
};

const AGENT_DESCRIPTIONS: Record<AgentId, string> = {
  S: 'Normal Claude session with a dev team behind it.',
  A: 'Researches and writes the build plan.',
  B: 'Challenges the plan until there are no gaps.',
  C: 'Builds the approved plan.',
  D: 'Reviews and tests the implementation.',
  E: 'Optional. Audits the final code for OWASP-class vulnerabilities. Runs only when enabled at build start.',
};

const PHASE_LABELS: Record<string, string> = {
  concept: 'Concept',
  planning: 'Planning',
  'plan-review': 'Plan Review',
  coding: 'Coding',
  'code-review': 'Code Review',
  testing: 'Testing',
  'security-audit': 'Security Audit',
  deploy: 'Deploy',
  complete: 'Complete',
};

const PROVIDER_FALLBACK_MODELS: Record<string, string[]> = {
  'claude-cli': ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5'],
  occ: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5'],
  openclaude: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5'],
  ccr: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5'],
  'openai-http': ['gpt-4o-mini', 'gpt-4.1-mini'],
  'lm-studio': [],
};

const INITIAL_MODEL_OPTIONS = (PROVIDER_FALLBACK_MODELS['claude-cli'] || []).map((m) => ({
  value: m,
  label: m,
}));

function cardTone(tone: 'neutral' | 'info' | 'warning' | 'success') {
  if (tone === 'warning') return 'border-amber-500/30 bg-amber-500/10 text-amber-100';
  if (tone === 'success') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100';
  return 'border-white/10 bg-white/5 text-slate-200';
}

function segmentClass(active: boolean) {
  return `flex-1 rounded-md px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider transition ${
    active ? 'text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]' : 'text-slate-400 hover:text-slate-200'
  }`;
}

function eventLabel(type: string) {
  return type.replace(/_/g, ' ');
}

export default function SquadPage() {
  const [mode, setMode] = useState<AppMode>('pipeline');
  const [selectedAgent, setSelectedAgent] = useState<AgentId>('S');
  const [rightTab, setRightTab] = useState<'next' | 'activity' | 'controls'>('next');
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-6');
  const [selectedProvider, setSelectedProvider] = useState<string | undefined>(undefined);
  const [availableProviders, setAvailableProviders] = useState<Array<{ id: string; label: string; available: boolean }>>([]);
  const [modelOptions, setModelOptions] = useState(INITIAL_MODEL_OPTIONS);
  const availableModelCount = modelOptions.filter((o) => !!o.value).length;
  const [discoveryInfo, setDiscoveryInfo] = useState<Record<string, { usedDiscovery: boolean; modelCount: number; fallbackUsed: boolean }>>({});
  const [discoveredOnly, setDiscoveredOnly] = useState(false);
  const [selectedSecurityMode, setSelectedSecurityMode] = useState<SecurityMode>('fast');
  const [selectedRunGoal, setSelectedRunGoal] = useState<RunGoal>('full-build');
  const [selectedRunFinalAudit, setSelectedRunFinalAudit] = useState<boolean>(false);
  const [chatInput, setChatInput] = useState('');
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);
  const [sendingAgents, setSendingAgents] = useState<Set<AgentId>>(new Set());
  const [pipelineStartError, setPipelineStartError] = useState<string | null>(null);

  // Endpoint config for HTTP-based providers
  const CONFIGURABLE_PROVIDERS = ['ollama', 'lm-studio', 'openwebui', 'openai-compat'];
  const [endpointHost, setEndpointHost] = useState('localhost');
  const [endpointPort, setEndpointPort] = useState<number>(11434);
  const [endpointApiKey, setEndpointApiKey] = useState('');
  const [endpointSaving, setEndpointSaving] = useState(false);
  const [endpointSaveMsg, setEndpointSaveMsg] = useState('');
  const DEFAULT_PORTS: Record<string, number> = {
    ollama: 11434, 'lm-studio': 1234, openwebui: 3000, 'openai-compat': 8080,
  };

  const {
    state,
    sendChat,
    startPipeline,
    resumePipeline,
    stopPipeline,
    setStopAfterReview,
    approveBash,
    resetState,
    agentEvents,
  } = usePipelineState({ pollInterval: 400, mode, model: selectedModel, provider: selectedProvider });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/providers');
        const data = await res.json();
        const list = Array.isArray(data?.providers) ? data.providers : [];
        setAvailableProviders(list);
        const first = list.find((p: any) => p.available) || list[0];
        if (first) setSelectedProvider(first.id);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('discoveredOnly');
      if (stored !== null) setDiscoveredOnly(stored === 'true');
    } catch {}
  }, []);

  const toModelOptions = (models: string[]) => models.map((m) => ({ value: m, label: m }));

  const fallbackOptionsForProvider = (providerId: string) => {
    const fallback = PROVIDER_FALLBACK_MODELS[providerId] || [];
    return fallback.length > 0 ? toModelOptions(fallback) : [{ value: '', label: 'No models available' }];
  };

  async function loadEndpointConfig(providerId: string) {
    if (!CONFIGURABLE_PROVIDERS.includes(providerId)) return;
    try {
      const res = await fetch(`/api/provider-config?id=${encodeURIComponent(providerId)}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const cfg = data?.config;
      if (cfg) {
        setEndpointHost(cfg.host ?? 'localhost');
        setEndpointPort(cfg.port ?? DEFAULT_PORTS[providerId] ?? 8080);
        setEndpointApiKey(cfg.apiKey ?? '');
      }
    } catch { /* ignore */ }
  }

  async function saveEndpointConfig(providerId: string) {
    if (!CONFIGURABLE_PROVIDERS.includes(providerId)) return;
    setEndpointSaving(true);
    setEndpointSaveMsg('');
    try {
      const res = await fetch('/api/provider-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: providerId, host: endpointHost, port: endpointPort, apiKey: endpointApiKey }),
      });
      if (res.ok) {
        setEndpointSaveMsg('Saved ✓');
        void fetchModelsForProvider(providerId);
      } else {
        setEndpointSaveMsg('Save failed');
      }
    } catch {
      setEndpointSaveMsg('Save failed');
    } finally {
      setEndpointSaving(false);
      setTimeout(() => setEndpointSaveMsg(''), 3000);
    }
  }

  async function fetchModelsForProvider(providerId: string) {    try {
      const res = await fetch(`/api/models?provider=${encodeURIComponent(providerId)}`, { cache: 'no-store' });
      if (!res.ok) {
        const fallbackOptions = fallbackOptionsForProvider(providerId);
        setModelOptions(fallbackOptions);
        const first = fallbackOptions.find((o) => !!o.value);
        setSelectedModel(first?.value || '');
        return;
      }

      const data = await res.json();
      const list = Array.isArray(data?.models)
        ? data.models.filter((m: unknown): m is string => typeof m === 'string' && m.trim().length > 0)
        : [];
      const usedDiscovery = Boolean(data?.usedDiscovery);
      const fallbackUsed = Boolean(data?.fallbackUsed);

      setDiscoveryInfo((prev) => ({ ...prev, [providerId]: { usedDiscovery, modelCount: list.length, fallbackUsed } }));

      if (list.length > 0) {
        const opts = toModelOptions(list);
        setModelOptions(opts);
        if (!list.includes(selectedModel)) setSelectedModel(list[0]);
        return;
      }

      if (usedDiscovery && !fallbackUsed && discoveredOnly) {
        setModelOptions([{ value: '', label: 'No models discovered' }]);
        setSelectedModel('');
        return;
      }

      const fallbackOptions = fallbackOptionsForProvider(providerId);
      setModelOptions(fallbackOptions);
      const first = fallbackOptions.find((o) => !!o.value);
      setSelectedModel(first?.value || '');
    } catch {
      const fallbackOptions = fallbackOptionsForProvider(providerId);
      setModelOptions(fallbackOptions);
      const first = fallbackOptions.find((o) => !!o.value);
      setSelectedModel(first?.value || '');
    }
  }

  useEffect(() => {
    if (!selectedProvider) return;

    const fallbackOptions = fallbackOptionsForProvider(selectedProvider);
    setModelOptions(fallbackOptions);
    const first = fallbackOptions.find((o) => !!o.value);
    if (first?.value && first.value !== selectedModel) {
      setSelectedModel(first.value);
    }

    void loadEndpointConfig(selectedProvider);
    void fetchModelsForProvider(selectedProvider);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProvider, discoveredOnly]);

  // duplicate model discovery effect removed (handled above)

  useEffect(() => {
    if (mode !== 'pipeline') return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/pending?_=' + Date.now());
        const data = await res.json();
        setPendingApproval(data?.tool && data?.approved === null ? data : null);
      } catch {}
    }, 500);
    return () => clearInterval(interval);
  }, [mode]);

  const isPipeline = mode === 'pipeline';
  const pipelineRunning = isPipeline && state.pipelineStatus === 'running';
  const pipelinePaused = isPipeline && state.pipelineStatus === 'paused';
  const activeSecurityMode = state.projectDir ? (state.securityMode || 'fast') : selectedSecurityMode;
  const activeRunGoal = state.projectDir ? (state.runGoal || 'full-build') : selectedRunGoal;
  const activeRunFinalAudit = state.projectDir ? !!state.runFinalAudit : selectedRunFinalAudit;
  const securityModeLocked = isPipeline && (pipelineRunning || pipelinePaused);
  const displayedSecurityMode = securityModeLocked ? activeSecurityMode : selectedSecurityMode;
  const displayedRunGoal = securityModeLocked ? activeRunGoal : selectedRunGoal;
  const displayedRunFinalAudit = securityModeLocked ? activeRunFinalAudit : selectedRunFinalAudit;
  const stopAfterReviewArmed = state.stopAfterPhase === 'plan-review' || activeRunGoal === 'plan-only';
  const canContinueApprovedPlan = pipelinePaused && state.currentPhase === 'plan-review';

  const visiblePendingApproval = isPipeline ? pendingApproval : null;
  const supervisorRecommendation = isPipeline ? getSupervisorRecommendation(state, visiblePendingApproval) : null;
  const supervisorUpdate = isPipeline ? getSupervisorUpdate(state, visiblePendingApproval) : null;
  const executionPathStatus = isPipeline ? getExecutionPathStatus(state) : null;

  const modePosture = isPipeline
    ? {
        title: 'Supervisor-Run Build',
        summary: activeSecurityMode === 'strict'
          ? 'Strict mode is active. Every Coder/Tester Bash call pauses for approval.'
          : 'Fast mode is active. The team stays moving under guardrails, but this is still not a sandbox.',
        detail: executionPathStatus?.detail || 'Host execution is still the normal path. Docker isolation is built, but still alpha.',
      }
    : {
        title: 'Direct Specialist Sessions',
        summary: 'You are talking to the team directly. Claude permission prompts still apply, but pipeline guardrails are not enforcing the build flow for you.',
        detail: 'Use this when you want normal Claude-style back-and-forth with one specialist at a time.',
      };

  const timeline = useMemo(() => state.events.slice(-24), [state.events]);
  const selectedEvents = agentEvents(selectedAgent);

  async function handleSend() {
    const message = chatInput.trim();
    if (!message || sendingAgents.has(selectedAgent)) return;
    setSendingAgents((prev) => new Set(prev).add(selectedAgent));
    await sendChat(selectedAgent, message, isPipeline ? {
      securityMode: selectedSecurityMode,
      runGoal: selectedRunGoal,
      runFinalAudit: selectedRunFinalAudit,
    } : undefined);
    setChatInput('');
    setSendingAgents((prev) => {
      const next = new Set(prev);
      next.delete(selectedAgent);
      return next;
    });
  }

  async function handleStart() {
    setPipelineStartError(null);
    const res = await startPipeline(selectedSecurityMode, selectedRunGoal, undefined, selectedRunFinalAudit, discoveredOnly);
    if (!res?.success) {
      const err = res?.error || 'Unknown error';
      console.error('Pipeline failed to start:', err);
      setPipelineStartError(err);
    }
    setSelectedAgent('S');
  }

  async function handleReset() {
    if (isPipeline) {
      await fetch('/api/stop-pipeline', { method: 'POST' });
    }
    await resetState();
    setChatInput('');
    setPendingApproval(null);
    setPipelineStartError(null);
    setSelectedAgent('S');
  }

  return (
    <div className="h-screen overflow-hidden bg-[radial-gradient(circle_at_top,rgba(25,30,45,0.9),rgba(9,9,11,1)_55%)] p-4 text-white">
      <div className="mx-auto flex h-full max-w-7xl flex-col gap-4">
        <div className="shrink-0 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(18,21,33,0.96),rgba(10,11,18,0.98))] px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Squad View</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold text-white">Supervisor-first dev team</h1>
                <span className="text-xs text-slate-400">Same runtime, less chrome.</span>
              </div>
            </div>
            <Link
              href="/"
              className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
            >
              Open Office View
            </Link>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[220px_minmax(0,1fr)_250px]">
          <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(18,21,33,0.96),rgba(10,11,18,0.98))] p-3">
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              <div>
                <div className="mb-1.5 text-[9px] uppercase tracking-[0.18em] text-slate-500">Mode</div>
                <div className="flex rounded-lg border border-white/10 bg-white/5 p-1">
                  <button
                    onClick={() => setMode('pipeline')}
                    className={segmentClass(isPipeline)}
                    style={isPipeline ? { background: '#7c3aed' } : undefined}
                  >
                    Pipeline
                  </button>
                  <button
                    onClick={() => setMode('manual')}
                    className={segmentClass(!isPipeline)}
                    style={!isPipeline ? { background: '#2563eb' } : undefined}
                  >
                    Manual
                  </button>
                </div>
              </div>

              {/* Provider & Model — visible in both pipeline and manual modes */}
              <div>
                <div className="mb-1.5 text-[9px] uppercase tracking-[0.18em] text-slate-500">
                  {isPipeline ? 'Provider & Model' : 'Model'}
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={selectedProvider}
                      onChange={(e) => setSelectedProvider(e.target.value)}
                      disabled={isPipeline && securityModeLocked}
                      className={`rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 focus:border-blue-600 focus:outline-none${isPipeline && securityModeLocked ? ' cursor-not-allowed opacity-50' : ''}`}
                    >
                      {availableProviders.length === 0 ? (
                        <option value="claude-cli">Claude</option>
                      ) : (
                        availableProviders.map((p) => (
                          <option key={p.id} value={p.id} disabled={!p.available}>{p.label}{!p.available ? ' (unavailable)' : ''}</option>
                        ))
                      )}
                    </select>

                    <button
                      onClick={() => selectedProvider && fetchModelsForProvider(selectedProvider)}
                      disabled={isPipeline && securityModeLocked}
                      className="rounded px-2 py-1 text-xs font-bold uppercase tracking-wider text-slate-300 bg-white/5 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Refresh
                    </button>

                    <label className="inline-flex items-center gap-2 text-[11px] text-slate-400">
                      <input
                        type="checkbox"
                        checked={discoveredOnly}
                        disabled={isPipeline && securityModeLocked}
                        onChange={(e) => {
                          const v = e.target.checked;
                          setDiscoveredOnly(v);
                          try { localStorage.setItem('discoveredOnly', String(v)); } catch {}
                          if (selectedProvider) void fetchModelsForProvider(selectedProvider);
                        }}
                        className="h-4 w-4 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <span className="text-xs">Discovered-only</span>
                    </label>
                  </div>

                  <div className="text-[11px] text-slate-400">
                    Models: <span className="font-mono">{availableModelCount}</span>
                    {selectedProvider && discoveryInfo[selectedProvider] && (
                      discoveryInfo[selectedProvider].usedDiscovery && discoveryInfo[selectedProvider].modelCount === 0
                        ? <span className="mt-0.5 block text-xs text-amber-300">{discoveredOnly ? '(discovery found 0 — discovered-only)' : '(discovery found 0 — provider fallback)'}</span>
                        : discoveryInfo[selectedProvider].usedDiscovery
                          ? <span className="mt-0.5 block text-xs text-slate-400">(discovered {discoveryInfo[selectedProvider].modelCount})</span>
                          : discoveryInfo[selectedProvider].fallbackUsed
                            ? <span className="mt-0.5 block text-xs text-slate-400">(provider fallback)</span>
                            : null
                    )}
                  </div>

                  {/* Endpoint Config panel */}
                  {selectedProvider && CONFIGURABLE_PROVIDERS.includes(selectedProvider) && (
                    <div className="rounded-lg border border-white/10 bg-white/5 p-2 space-y-2">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Endpoint Config</div>
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="flex flex-col gap-0.5">
                          <label className="text-[9px] text-slate-500 uppercase tracking-wider">Host</label>
                          <input
                            type="text"
                            title="Endpoint host"
                            value={endpointHost}
                            onChange={(e) => setEndpointHost(e.target.value)}
                            placeholder="localhost"
                            disabled={isPipeline && securityModeLocked}
                            className="w-32 rounded border border-white/10 bg-[#0c0c18] px-2 py-1 text-xs text-slate-200 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                          />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <label className="text-[9px] text-slate-500 uppercase tracking-wider">Port</label>
                          <input
                            type="number"
                            title="Endpoint port"
                            value={endpointPort}
                            onChange={(e) => setEndpointPort(Number(e.target.value))}
                            min={1}
                            max={65535}
                            disabled={isPipeline && securityModeLocked}
                            className="w-16 rounded border border-white/10 bg-[#0c0c18] px-2 py-1 text-xs text-slate-200 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                          />
                        </div>
                        {(selectedProvider === 'openwebui' || selectedProvider === 'openai-compat' || selectedProvider === 'openai-http') && (
                          <div className="flex flex-col gap-0.5">
                            <label className="text-[9px] text-slate-500 uppercase tracking-wider">API Key</label>
                            <input
                              type="password"
                              title="API Key"
                              value={endpointApiKey}
                              onChange={(e) => setEndpointApiKey(e.target.value)}
                              placeholder="(optional)"
                              disabled={isPipeline && securityModeLocked}
                              className="w-28 rounded border border-white/10 bg-[#0c0c18] px-2 py-1 text-xs text-slate-200 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                            />
                          </div>
                        )}
                        <button
                          onClick={() => selectedProvider && void saveEndpointConfig(selectedProvider)}
                          disabled={endpointSaving || (isPipeline && securityModeLocked)}
                          className="rounded px-2 py-1 text-[9px] font-bold uppercase tracking-wider bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {endpointSaving ? 'Saving…' : 'Save'}
                        </button>
                        {endpointSaveMsg && <span className="text-[10px] text-emerald-400">{endpointSaveMsg}</span>}
                      </div>
                      <div className="text-[9px] text-slate-500 font-mono">http://{endpointHost}:{endpointPort}</div>
                    </div>
                  )}

                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    disabled={isPipeline && securityModeLocked}
                    className={`w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 focus:border-blue-600 focus:outline-none${isPipeline && securityModeLocked ? ' cursor-not-allowed opacity-50' : ''}`}
                  >
                    {modelOptions.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-[#121522]" disabled={opt.value === ''}>
                          {opt.label}
                        </option>
                      ))}
                  </select>

                  {isPipeline && !securityModeLocked && (
                    <p className="text-[9px] text-slate-500">
                      Pipeline agents will use this provider &amp; model. Locks when pipeline starts.
                    </p>
                  )}
                </div>
              </div>

              {isPipeline && (
                <>
                  <div>
                    <div className="mb-1.5 text-[9px] uppercase tracking-[0.18em] text-slate-500">Security</div>
                    <div className="flex rounded-lg border border-white/10 bg-white/5 p-1">
                      <button
                        onClick={() => setSelectedSecurityMode('fast')}
                        disabled={securityModeLocked}
                        className={`${segmentClass(displayedSecurityMode === 'fast')} disabled:opacity-40`}
                        style={displayedSecurityMode === 'fast' ? { background: '#166534' } : undefined}
                      >
                        Fast
                      </button>
                      <button
                        onClick={() => setSelectedSecurityMode('strict')}
                        disabled={securityModeLocked}
                        className={`${segmentClass(displayedSecurityMode === 'strict')} disabled:opacity-40`}
                        style={displayedSecurityMode === 'strict' ? { background: '#b45309' } : undefined}
                      >
                        Strict
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 text-[9px] uppercase tracking-[0.18em] text-slate-500">Goal</div>
                    <div className="flex rounded-lg border border-white/10 bg-white/5 p-1">
                      <button
                        onClick={() => setSelectedRunGoal('full-build')}
                        disabled={securityModeLocked}
                        className={`${segmentClass(displayedRunGoal === 'full-build')} disabled:opacity-40`}
                        style={displayedRunGoal === 'full-build' ? { background: '#1d4ed8' } : undefined}
                      >
                        Full
                      </button>
                      <button
                        onClick={() => setSelectedRunGoal('plan-only')}
                        disabled={securityModeLocked}
                        className={`${segmentClass(displayedRunGoal === 'plan-only')} disabled:opacity-40`}
                        style={displayedRunGoal === 'plan-only' ? { background: '#7c3aed' } : undefined}
                      >
                        Plan Only
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 text-[9px] uppercase tracking-[0.18em] text-slate-500">Security Audit</div>
                    <div className="flex rounded-lg border border-white/10 bg-white/5 p-1">
                      <button
                        onClick={() => setSelectedRunFinalAudit(false)}
                        disabled={securityModeLocked}
                        className={`${segmentClass(!displayedRunFinalAudit)} disabled:opacity-40`}
                        style={!displayedRunFinalAudit ? { background: '#475569' } : undefined}
                      >
                        Off
                      </button>
                      <button
                        onClick={() => setSelectedRunFinalAudit(true)}
                        disabled={securityModeLocked}
                        className={`${segmentClass(displayedRunFinalAudit)} disabled:opacity-40`}
                        style={displayedRunFinalAudit ? { background: '#e11d48' } : undefined}
                      >
                        On
                      </button>
                    </div>
                  </div>
                </>
              )}

              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                <div className="mb-1 text-[9px] uppercase tracking-[0.18em] text-slate-500">Posture</div>
                <p className="text-xs leading-relaxed text-slate-300">{modePosture.summary}</p>
              </div>

              <div>
                <div className="mb-1.5 text-[9px] uppercase tracking-[0.18em] text-slate-500">Team</div>
                <div className="space-y-2">
                  {(['S', 'A', 'B', 'C', 'D'] as AgentId[]).map((agent) => (
                    <button
                      key={agent}
                      onClick={() => setSelectedAgent(agent)}
                      className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                        selectedAgent === agent
                          ? 'border-violet-500/40 bg-violet-500/10'
                          : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-white">{AGENT_NAMES[agent]}</div>
                          <div className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{AGENT_DESCRIPTIONS[agent]}</div>
                        </div>
                        <Badge variant={(state.agentStatus[agent] === 'active' || state.agentStatus[agent] === 'working') ? 'success' : 'neutral'}>
                          {state.agentStatus[agent] || 'idle'}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(18,21,33,0.96),rgba(10,11,18,0.98))]">
            <div className="shrink-0 border-b border-white/10 px-4 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{isPipeline ? 'Supervisor-led team run' : 'Direct specialist session'}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h2 className="text-lg font-semibold text-white">{AGENT_NAMES[selectedAgent]}</h2>
                    <p className="text-xs text-slate-400">{AGENT_DESCRIPTIONS[selectedAgent]}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {isPipeline && (
                    <>
                      <Badge variant={activeSecurityMode === 'strict' ? 'warning' : 'success'}>
                        {activeSecurityMode === 'strict' ? 'STRICT' : 'FAST'}
                      </Badge>
                      <Badge variant={activeRunGoal === 'plan-only' ? 'purple' : 'neutral'}>
                        {activeRunGoal === 'plan-only' ? 'PLAN ONLY' : 'FULL BUILD'}
                      </Badge>
                      {activeRunFinalAudit && (
                        <Badge variant="warning">AUDIT ON</Badge>
                      )}
                    </>
                  )}
                  {executionPathStatus && (
                    <Badge variant={executionPathStatus.variant}>{executionPathStatus.label}</Badge>
                  )}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400">
                <span className="font-semibold text-slate-200">{modePosture.title}</span>
                <span className="text-slate-600">•</span>
                <span>{PHASE_LABELS[state.currentPhase] || 'Concept'}</span>
                <span className="text-slate-600">•</span>
                <span>{state.pipelineStatus || 'idle'}</span>
                {isPipeline && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span>{activeSecurityMode === 'strict' ? 'Strict approvals' : 'Fast guardrails'}</span>
                  </>
                )}
                {executionPathStatus && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span>{executionPathStatus.label}</span>
                  </>
                )}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-black/10 px-4 py-3">
              {selectedAgent === 'S' && supervisorUpdate && isPipeline && (
                <div className={`mb-3 border-l-2 px-3 py-2 ${supervisorUpdate.severity === 'warning'
                  ? 'border-amber-400/70 bg-amber-500/5'
                  : supervisorUpdate.severity === 'success'
                  ? 'border-emerald-400/70 bg-emerald-500/5'
                  : 'border-violet-400/60 bg-white/[0.02]'
                }`}>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Supervisor Update</div>
                  <div className="mt-1 text-sm font-medium text-white">{supervisorUpdate.title}</div>
                  <p className="mt-1 text-sm leading-relaxed text-slate-300">{supervisorUpdate.summary}</p>
                  {supervisorUpdate.ask && <p className="mt-2 text-[11px] uppercase tracking-wider text-slate-400">{supervisorUpdate.ask}</p>}
                </div>
              )}

              {selectedEvents.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="max-w-md text-center text-sm leading-relaxed text-slate-500">
                    {selectedAgent === 'S'
                      ? 'Start with the Supervisor. Describe what you want to build, then ask it to start planning or the full build.'
                      : `No messages with ${AGENT_NAMES[selectedAgent]} yet. Jump in here whenever you want direct specialist context.`}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedEvents.map((event, index) => {
                    const isUser = event.type === 'user_msg';
                    const isFailure = event.type === 'failure' || event.type === 'issue';
                    const isTool = event.type === 'tool_call';
                    const isStatus = event.type === 'status';
                    const bodyClass = isUser
                      ? 'border-blue-500/20 bg-blue-500/[0.08] text-blue-50'
                      : isFailure
                      ? 'border-red-500/25 bg-red-500/[0.08] text-red-50'
                      : isTool
                      ? 'border-white/8 bg-black/25 text-slate-200'
                      : isStatus
                      ? 'border-violet-500/15 bg-violet-500/[0.06] text-slate-100'
                      : 'border-white/8 bg-white/[0.03] text-slate-100';
                    return (
                      <div
                        key={`${event.time}-${index}`}
                        className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`w-full max-w-[88%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                          <div className={`flex w-full items-center gap-2 text-[10px] uppercase tracking-[0.18em] ${isUser ? 'justify-end' : 'justify-start'} text-slate-500`}>
                            {!isUser && <span>{eventLabel(event.type)}</span>}
                            <span className="font-mono tracking-[0.12em]">
                              {new Date(event.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                            {isUser && <span>{eventLabel(event.type)}</span>}
                          </div>
                          <div className={`w-full rounded-lg border px-3 py-2.5 text-[15px] leading-7 ${bodyClass}`}>
                            <MarkdownText className="[&_p]:leading-7">{event.text}</MarkdownText>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-white/10 px-4 py-3">
              <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-slate-500">
                {selectedAgent === 'S'
                  ? 'Recommended: talk to the Supervisor first'
                  : `Direct ${AGENT_NAMES[selectedAgent]} chat`}
              </div>
              <div className="flex items-end gap-3">
                <AutoGrowTextarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder={selectedAgent === 'S'
                    ? (isPipeline && supervisorRecommendation?.chatCommand
                      ? `Ask the supervisor anything, or try "${supervisorRecommendation.chatCommand}"`
                      : 'Ask the supervisor what to build, what is blocked, or what to do next...')
                    : `Message ${AGENT_NAMES[selectedAgent]} directly...`}
                  disabled={sendingAgents.has(selectedAgent)}
                  className="max-h-36 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none disabled:opacity-40"
                />
                <button
                  onClick={() => void handleSend()}
                  disabled={sendingAgents.has(selectedAgent) || !chatInput.trim()}
                  className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-40"
                >
                  Send
                </button>
              </div>
            </div>
          </section>

          <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(18,21,33,0.96),rgba(10,11,18,0.98))] p-3">
            <div className="mb-3 flex rounded-lg border border-white/10 bg-white/5 p-1">
              {[
                ['next', 'Next'],
                ['activity', 'Activity'],
                ['controls', 'Controls'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setRightTab(value as 'next' | 'activity' | 'controls')}
                  className={`flex-1 rounded-md px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition ${
                    rightTab === value ? 'bg-violet-600 text-white' : 'text-slate-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              {rightTab === 'next' && (
                <div className="space-y-4">
                  {isPipeline && supervisorRecommendation && (
                    <div className={`rounded-xl border px-3 py-3 ${cardTone(supervisorRecommendation.severity)}`}>
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Suggested Next Action</div>
                      <div className="mt-2 text-sm font-semibold">{supervisorRecommendation.title}</div>
                      <p className="mt-2 text-sm leading-relaxed">{supervisorRecommendation.detail}</p>
                      {supervisorRecommendation.chatCommand && (
                        <p className="mt-2 text-xs uppercase tracking-wider text-slate-300/80">Try: &quot;{supervisorRecommendation.chatCommand}&quot;</p>
                      )}
                    </div>
                  )}

                  <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Run Summary</div>
                    <dl className="mt-3 space-y-2 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-slate-500">Phase</dt>
                        <dd className="text-right text-slate-200">{PHASE_LABELS[state.currentPhase] || 'Concept'}</dd>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-slate-500">Status</dt>
                        <dd className="text-right text-slate-200">{state.pipelineStatus || 'idle'}</dd>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-slate-500">Active</dt>
                        <dd className="text-right text-slate-200">{state.activeAgent || 'None'}</dd>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-slate-500">Project</dt>
                        <dd className="max-w-[170px] text-right text-slate-200">{state.projectDir ? state.projectDir.split('/').pop() : 'Not started'}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              )}

              {rightTab === 'activity' && (
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Recent Activity</div>
                  <div className="mt-3 space-y-2">
                    {timeline.length === 0 ? (
                      <p className="text-sm text-slate-500">No activity yet.</p>
                    ) : (
                      timeline.map((event, index) => (
                        <div key={`${event.time}-${index}`} className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs leading-relaxed text-slate-300">
                          <div className="mb-1 flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-slate-500">
                            <span>{event.agent === 'system' ? 'System' : AGENT_NAMES[event.agent as AgentId] || event.agent}</span>
                            <span>{new Date(event.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                          </div>
                          <MarkdownText className="text-xs leading-relaxed">{event.text}</MarkdownText>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {rightTab === 'controls' && (
                <div className="space-y-4">
                  {visiblePendingApproval && (
                    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-amber-100">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">Approval Required</div>
                      <p className="mt-2 text-sm leading-relaxed">{visiblePendingApproval.description}</p>
                      <p className="mt-2 text-xs uppercase tracking-wider text-amber-300">
                        Agent {visiblePendingApproval.agent} · {visiblePendingApproval.phase || state.currentPhase}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button onClick={() => void approveBash(true, visiblePendingApproval)} className="flex-1 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-black">
                          Approve
                        </button>
                        <button onClick={() => void approveBash(false, visiblePendingApproval)} className="flex-1 rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold text-white">
                          Deny
                        </button>
                      </div>
                    </div>
                  )}

                  {isPipeline && (
                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Run Controls</div>
                      <div className="mt-3 space-y-2">
                        {/* Pipeline start error — surface it inline so users see it immediately */}
                        {pipelineStartError && (
                          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
                            <span className="font-semibold">Could not start: </span>{pipelineStartError}
                            {(pipelineStartError.includes('staging') || pipelineStartError.includes('concept')) && (
                              <p className="mt-1 text-[10px] text-red-200/70">💬 <strong>Chat with S first:</strong> describe your project in the chat box, then click Start.</p>
                            )}
                          </div>
                        )}
                        {/* Staging-ready hint: guide user to chat with S before clicking Start */}
                        {!pipelineRunning && !pipelinePaused && !state.concept && !pipelineStartError && (
                          <p className="text-[10px] text-slate-500">
                            💬 Describe your project to <strong className="text-emerald-400">S</strong> first, then click Start.
                          </p>
                        )}
                        {!pipelineRunning && !pipelinePaused && (!state.projectDir || state.currentPhase === 'concept' || state.buildComplete) && (
                          <button onClick={() => void handleStart()} className="w-full rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400">
                            {selectedRunGoal === 'plan-only' ? 'Start Plan Only' : 'Start Full Build'}
                          </button>
                        )}
                        {pipelineRunning && (state.currentPhase === 'planning' || state.currentPhase === 'plan-review') && activeRunGoal === 'full-build' && (
                          <button
                            onClick={() => { void setStopAfterReview(!stopAfterReviewArmed); }}
                            className="w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500"
                          >
                            {stopAfterReviewArmed ? 'Keep Running After Review' : 'Stop After Review'}
                          </button>
                        )}
                        {canContinueApprovedPlan && (
                          <button onClick={() => void resumePipeline()} className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500">
                            Continue Build
                          </button>
                        )}
                        <button onClick={() => void stopPipeline()} className="w-full rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-400">
                          Stop
                        </button>
                        <button onClick={() => void handleReset()} className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/10">
                          Reset
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
