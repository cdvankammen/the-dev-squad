'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/shared/Badge';
import { AutoGrowTextarea } from '@/components/shared/AutoGrowTextarea';
import { MarkdownText } from '@/components/shared/MarkdownText';
import { getExecutionPathStatus, getSupervisorRecommendation, getSupervisorUpdate } from '@/lib/pipeline-supervisor';
import { usePipelineState, type AgentId, type AppMode, type PendingApproval, type RunGoal, type SecurityMode } from '@/lib/use-pipeline';
import { useProviderRuntime } from '@/lib/use-provider-runtime';

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

const MODEL_OPTIONS = [
  { value: 'claude-opus-4-6', label: 'Opus 4.6' },
  { value: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
];

const PROVIDER_OPTIONS = [
  { value: 'claude', label: 'Claude Code' },
  { value: 'lm-studio', label: 'LM Studio' },
  { value: 'ollama', label: 'Ollama' },
  { value: 'openwebui', label: 'Open WebUI' },
  { value: 'openai-compat', label: 'OpenAI-Compatible' },
  { value: 'claude-code-router', label: 'Claude Code Router' },
  { value: 'openclaude-code', label: 'OpenClaude Code' },
  { value: 'opencode', label: 'OpenCode' },
];

const AGENT_ORDER: AgentId[] = ['S', 'A', 'B', 'C', 'D', 'E'];

type QueueMessage = {
  id: string;
  text: string;
  isEditing?: boolean;
};

function createInitialQueueState(): Record<AgentId, QueueMessage[]> {
  return { A: [], B: [], C: [], D: [], E: [], S: [] };
}

function createInitialQueueDispatchingState(): Record<AgentId, boolean> {
  return { A: false, B: false, C: false, D: false, E: false, S: false };
}

function cardTone(tone: 'neutral' | 'info' | 'warning' | 'success') {
  if (tone === 'warning') return 'border-amber-500/30 bg-amber-500/10 text-amber-100';
  if (tone === 'success') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100';
  return 'border-white/10 bg-white/5 text-slate-200';
}

function segmentClass(active: boolean, activeBgClass: string) {
  return `flex-1 rounded-md px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider transition ${
    active ? `${activeBgClass} text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]` : 'text-slate-400 hover:text-slate-200'
  }`;
}

function eventLabel(type: string) {
  return type.replace(/_/g, ' ');
}

export default function SquadPage() {
  const [mode, setMode] = useState<AppMode>('pipeline');
  const [selectedAgent, setSelectedAgent] = useState<AgentId>('S');
  const [rightTab, setRightTab] = useState<'next' | 'activity' | 'controls'>('next');
  const [selectedSecurityMode, setSelectedSecurityMode] = useState<SecurityMode>('fast');
  const [selectedRunGoal, setSelectedRunGoal] = useState<RunGoal>('full-build');
  const [selectedRunFinalAudit, setSelectedRunFinalAudit] = useState<boolean>(false);
  const [chatInput, setChatInput] = useState('');
  const [queuedMessages, setQueuedMessages] = useState<Record<AgentId, QueueMessage[]>>(createInitialQueueState);
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);
  const [sendingAgents, setSendingAgents] = useState<Set<AgentId>>(new Set());
  const [queueDispatching, setQueueDispatching] = useState<Record<AgentId, boolean>>(createInitialQueueDispatchingState);

  const {
    providers,
    models,
    selectedProvider,
    setSelectedProvider,
    providerMode,
    selectedModel,
    setSelectedModel,
    selectedWorkingDir,
    setSelectedWorkingDir,
    providerHost,
    setProviderHost,
    providerPort,
    setProviderPort,
    providerResolvedUrl,
    providerApiKey,
    setProviderApiKey,
    providerStatusKind,
    providerStatusMessage,
    agentModels,
    setAgentModel,
    refreshModels,
  } = useProviderRuntime({ defaultProvider: 'claude', defaultModel: 'claude-sonnet-4-6' });

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
  } = usePipelineState({ pollInterval: mode === 'pipeline' ? 5000 : 10000, mode, model: selectedModel, provider: selectedProvider, workingDir: selectedWorkingDir, agentModels });

  useEffect(() => {
    const shouldPollPending = mode === 'pipeline' && (
      state.pipelineStatus === 'running' ||
      state.pipelineStatus === 'paused' ||
      state.pipelineStatus === 'awaiting-audit-decision' ||
      Boolean(pendingApproval)
    );
    if (!shouldPollPending) return;

    let active = true;
    let timer: number | null = null;

    const pollPending = async () => {
      try {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          return;
        }
        const res = await fetch('/api/pending?_=' + Date.now(), { cache: 'no-store' });
        const data = await res.json();
        if (active) {
          setPendingApproval(data?.tool && data?.approved === null ? data : null);
        }
      } catch {
        // keep existing pending state on transient polling failures
      } finally {
        if (active) {
          const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
          timer = window.setTimeout(pollPending, hidden ? 30000 : 12000);
        }
      }
    };

    void pollPending();
    return () => {
      active = false;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [mode, pendingApproval, state.pipelineStatus]);

  const isPipeline = mode === 'pipeline';
  const pipelineRunning = isPipeline && state.pipelineStatus === 'running';
  const pipelinePaused = isPipeline && state.pipelineStatus === 'paused';
  const activeSecurityMode = state.projectDir ? (state.securityMode || 'fast') : selectedSecurityMode;
  const activeRunGoal = state.projectDir ? (state.runGoal || 'full-build') : selectedRunGoal;
  const activeRunFinalAudit = state.projectDir ? !!state.runFinalAudit : selectedRunFinalAudit;
  const securityModeLocked = isPipeline && (pipelineRunning || pipelinePaused || !!state.projectDir);
  const displayedSecurityMode = securityModeLocked ? activeSecurityMode : selectedSecurityMode;
  const displayedRunGoal = securityModeLocked ? activeRunGoal : selectedRunGoal;
  const displayedRunFinalAudit = securityModeLocked ? activeRunFinalAudit : selectedRunFinalAudit;
  const stopAfterReviewArmed = state.stopAfterPhase === 'plan-review' || activeRunGoal === 'plan-only';
  const canContinueApprovedPlan = pipelinePaused && state.currentPhase === 'plan-review';

  const providerOptions = providers.length > 0
    ? providers
    : PROVIDER_OPTIONS.map((opt) => ({
        id: opt.value,
        label: opt.label,
        description: '',
        defaultModel: '',
        mode: opt.value === 'claude' ? 'claude-code-cli' : opt.value === 'opencode' ? 'opencode-cli' : 'openai-compat-http',
        config: { host: '', port: 0, baseUrl: '', apiKey: '', enabled: true },
      }));
  const modelOptions = models.length > 0
    ? models
    : selectedProvider === 'claude'
    ? MODEL_OPTIONS.map((opt) => ({
        id: opt.value,
        label: opt.label,
        providerId: selectedProvider,
        source: 'static',
      }))
    : [];
  const selectedModelValue = modelOptions.some((opt) => opt.id === selectedModel) ? selectedModel : '';
  const selectedProviderDefinition = providers.find((provider) => provider.id === selectedProvider);
  const showHttpSettings = (selectedProviderDefinition?.mode || providerMode) === 'openai-compat-http';
  const showApiKeyInput = ['openwebui', 'openai-compat', 'claude-code-router', 'openclaude-code'].includes(selectedProvider);
  const providerSelectTone = providerStatusKind === 'error'
    ? 'border-red-500/50'
    : providerStatusKind === 'empty'
    ? 'border-amber-500/40'
    : providerStatusKind === 'ok'
    ? 'border-emerald-500/30'
    : 'border-white/10';

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

  const dispatchDirectMessage = useCallback(async (agent: AgentId, message: string) => {
    setSendingAgents((prev) => new Set(prev).add(agent));
    try {
      return await sendChat(agent, message, isPipeline ? {
        securityMode: selectedSecurityMode,
        runGoal: selectedRunGoal,
        runFinalAudit: selectedRunFinalAudit,
      } : undefined);
    } finally {
      setSendingAgents((prev) => {
        const next = new Set(prev);
        next.delete(agent);
        return next;
      });
    }
  }, [isPipeline, selectedRunFinalAudit, selectedRunGoal, selectedSecurityMode, sendChat]);

  async function handleSend() {
    const message = chatInput.trim();
    if (!message) return;
    const hasQueuedDispatch = AGENT_ORDER.some((agent) => queueDispatching[agent]);
    if (sendingAgents.size > 0 || hasQueuedDispatch) {
      setQueuedMessages((prev) => ({
        ...prev,
        [selectedAgent]: [...prev[selectedAgent], { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, text: message, isEditing: false }],
      }));
      setChatInput('');
      return;
    }
    const response = await dispatchDirectMessage(selectedAgent, message);
    if ((response as { success?: boolean } | undefined)?.success !== false) {
      setChatInput('');
    }
  }

  async function sendQueuedMessage(agent: AgentId, itemId: string) {
    const queued = queuedMessages[agent].find((item) => item.id === itemId);
    const hasQueuedDispatch = AGENT_ORDER.some((candidate) => queueDispatching[candidate]);
    if (!queued || sendingAgents.size > 0 || hasQueuedDispatch) return;
    setQueueDispatching((prev) => ({ ...prev, [agent]: true }));
    try {
      const response = await dispatchDirectMessage(agent, queued.text);
      if ((response as { success?: boolean } | undefined)?.success !== false) {
        setQueuedMessages((prev) => ({
          ...prev,
          [agent]: prev[agent].filter((item) => item.id !== itemId),
        }));
      }
    } finally {
      setQueueDispatching((prev) => ({ ...prev, [agent]: false }));
    }
  }

  function updateQueuedMessage(agent: AgentId, itemId: string, text: string) {
    setQueuedMessages((prev) => ({
      ...prev,
      [agent]: prev[agent].map((item) => (item.id === itemId ? { ...item, text } : item)),
    }));
  }

  function setQueuedMessageEditing(agent: AgentId, itemId: string, isEditing: boolean) {
    setQueuedMessages((prev) => ({
      ...prev,
      [agent]: prev[agent].map((item) => (item.id === itemId ? { ...item, isEditing } : item)),
    }));
  }

  function removeQueuedMessage(agent: AgentId, itemId: string) {
    setQueuedMessages((prev) => ({
      ...prev,
      [agent]: prev[agent].filter((item) => item.id !== itemId),
    }));
  }

  useEffect(() => {
    if (sendingAgents.size > 0) return;
    if (AGENT_ORDER.some((agent) => queueDispatching[agent])) return;

    const nextAgent = AGENT_ORDER.find((agent) => {
      if (queueDispatching[agent]) return false;
      const nextQueued = queuedMessages[agent]?.[0];
      return Boolean(nextQueued && !nextQueued.isEditing);
    });

    if (!nextAgent) return;
    const nextQueued = queuedMessages[nextAgent]?.[0];
    if (!nextQueued) return;

    const queuedText = nextQueued.text.trim();
    if (!queuedText) {
      setQueuedMessages((prev) => ({
        ...prev,
        [nextAgent]: prev[nextAgent].filter((item) => item.id !== nextQueued.id),
      }));
      return;
    }

    setQueueDispatching((prev) => ({ ...prev, [nextAgent]: true }));
    void dispatchDirectMessage(nextAgent, queuedText)
      .then((response) => {
        if ((response as { success?: boolean } | undefined)?.success !== false) {
          setQueuedMessages((prev) => ({
            ...prev,
            [nextAgent]: prev[nextAgent].filter((item) => item.id !== nextQueued.id),
          }));
        }
      })
      .finally(() => {
        setQueueDispatching((prev) => ({ ...prev, [nextAgent]: false }));
      });
  }, [dispatchDirectMessage, queueDispatching, queuedMessages, sendingAgents]);

  async function handleStart() {
    await startPipeline(selectedSecurityMode, selectedRunGoal, undefined, selectedRunFinalAudit);
    setSelectedAgent('S');
  }

  async function handleReset() {
    if (isPipeline) {
      await fetch('/api/stop-pipeline', { method: 'POST' });
    }
    await resetState();
    setChatInput('');
    setQueuedMessages(createInitialQueueState());
    setQueueDispatching(createInitialQueueDispatchingState());
    setPendingApproval(null);
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

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[300px_minmax(0,1fr)_320px]">
          <aside className="flex min-h-[24rem] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(18,21,33,0.96),rgba(10,11,18,0.98))] p-3 xl:min-h-0">
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              <div>
                <div className="mb-1.5 text-[9px] uppercase tracking-[0.18em] text-slate-500">Mode</div>
                <div className="flex rounded-lg border border-white/10 bg-white/5 p-1">
                  <button
                    onClick={() => setMode('pipeline')}
                    className={segmentClass(isPipeline, 'bg-violet-600')}
                  >
                    Pipeline
                  </button>
                  <button
                    onClick={() => setMode('manual')}
                    className={segmentClass(!isPipeline, 'bg-blue-600')}
                  >
                    Manual
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                  <div className="grid gap-2">
                    <select
                      title="Provider"
                      value={selectedProvider}
                      onChange={(e) => setSelectedProvider(e.target.value)}
                      className={`w-full rounded-lg border bg-white/5 px-3 py-2 text-xs text-slate-200 focus:border-blue-600 focus:outline-none ${providerSelectTone}`}
                    >
                      {providerOptions.map((opt) => (
                        <option key={opt.id} value={opt.id} className="bg-[#121522]">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <select
                      title="Model"
                      value={selectedModelValue}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      disabled={providerStatusKind === 'loading' && modelOptions.length === 0}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 focus:border-blue-600 focus:outline-none"
                    >
                      {modelOptions.length === 0 && (
                        <option value="" className="bg-[#121522]">
                          Loading provider models…
                        </option>
                      )}
                      {modelOptions.map((opt) => (
                        <option key={opt.id} value={opt.id} className="bg-[#121522]">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => void refreshModels(selectedProvider)}
                    className="min-h-[5.4rem] rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
                  >
                    Refresh Models
                  </button>
                </div>
                {!!providerStatusMessage && (
                  <p className={`text-[10px] ${providerStatusKind === 'error' ? 'text-red-300' : providerStatusKind === 'empty' ? 'text-amber-300' : providerStatusKind === 'ok' ? 'text-emerald-300' : 'text-slate-500'}`}>
                    {providerStatusMessage}
                  </p>
                )}
                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-[0.18em] text-slate-500">Workspace root override (optional)</label>
                  <input
                    title="Working directory"
                    value={selectedWorkingDir}
                    onChange={(e) => setSelectedWorkingDir(e.target.value)}
                    placeholder="Example: /Users/stillbulldog35/Documents/personalGithub/the-dev-squad"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500">Sets the workspace boundary for the current provider run. Leave it blank to use the app default workspace root.</p>
                </div>
                {showHttpSettings && (
                  <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-[9px] uppercase tracking-[0.18em] text-slate-500">Connection</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        title="Host or IP address"
                        value={providerHost}
                        onChange={(e) => setProviderHost(e.target.value)}
                        placeholder="e.g. 10.2.0.90"
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none"
                      />
                      <input
                        title="Port"
                        value={providerPort}
                        onChange={(e) => setProviderPort(e.target.value)}
                        placeholder="e.g. 1234"
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500">Full URL in use: <span className="font-mono text-slate-400">{providerResolvedUrl || 'http://host:port'}</span></p>
                    {showApiKeyInput && (
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase tracking-[0.18em] text-slate-500">API key</label>
                        <input
                          title="API Key"
                          value={providerApiKey}
                          onChange={(e) => setProviderApiKey(e.target.value)}
                          placeholder={selectedProvider === 'openwebui' ? 'Paste the Open WebUI JWT token here' : 'Example: provider API key'}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none"
                        />
                        {selectedProvider === 'openwebui' && (
                          <p className="text-[9px] text-slate-500">
                            Use the JWT token from Open WebUI Account → API keys. The visible API key may not authorize model discovery.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {isPipeline && (
                <>
                  <div>
                    <div className="mb-1.5 text-[9px] uppercase tracking-[0.18em] text-slate-500">Security</div>
                    <div className="flex rounded-lg border border-white/10 bg-white/5 p-1">
                      <button
                        onClick={() => setSelectedSecurityMode('fast')}
                        disabled={securityModeLocked}
                        className={`${segmentClass(displayedSecurityMode === 'fast', 'bg-emerald-600')} disabled:opacity-40`}
                      >
                        Fast
                      </button>
                      <button
                        onClick={() => setSelectedSecurityMode('strict')}
                        disabled={securityModeLocked}
                        className={`${segmentClass(displayedSecurityMode === 'strict', 'bg-amber-600')} disabled:opacity-40`}
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
                        className={`${segmentClass(displayedRunGoal === 'full-build', 'bg-blue-600')} disabled:opacity-40`}
                      >
                        Full
                      </button>
                      <button
                        onClick={() => setSelectedRunGoal('plan-only')}
                        disabled={securityModeLocked}
                        className={`${segmentClass(displayedRunGoal === 'plan-only', 'bg-violet-600')} disabled:opacity-40`}
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
                        className={`${segmentClass(!displayedRunFinalAudit, 'bg-slate-600')} disabled:opacity-40`}
                      >
                        Off
                      </button>
                      <button
                        onClick={() => setSelectedRunFinalAudit(true)}
                        disabled={securityModeLocked}
                        className={`${segmentClass(displayedRunFinalAudit, 'bg-rose-600')} disabled:opacity-40`}
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
                  {(['S', 'A', 'B', 'C', 'D', 'E'] as AgentId[]).map((agent) => (
                    <div key={agent} className="space-y-1">
                      <button
                        type="button"
                        onClick={() => setSelectedAgent(agent)}
                        className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                          selectedAgent === agent
                            ? 'border-violet-500/40 bg-violet-500/10'
                            : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 text-sm font-semibold text-white">
                              <span>{AGENT_NAMES[agent]}</span>
                              {queuedMessages[agent].length > 0 && (
                                <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold text-violet-200">{queuedMessages[agent].length}</span>
                              )}
                            </div>
                            <div className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{AGENT_DESCRIPTIONS[agent]}</div>
                          </div>
                          <Badge variant={(state.agentStatus[agent] === 'active' || state.agentStatus[agent] === 'working') ? 'success' : 'neutral'}>
                            {state.agentStatus[agent] || 'idle'}
                          </Badge>
                        </div>
                      </button>
                      <label className="text-[9px] uppercase tracking-[0.16em] text-slate-500">Model override</label>
                      <select
                        title={`Model for ${AGENT_NAMES[agent]}`}
                        value={agentModels[agent] || selectedModel}
                        onChange={(e) => setAgentModel(agent, e.target.value)}
                        className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-[10px] text-slate-300 focus:outline-none"
                      >
                        {modelOptions.map((opt) => (
                          <option key={opt.id} value={opt.id} className="bg-[#121522]">{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          <section className="flex min-h-[34rem] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(18,21,33,0.96),rgba(10,11,18,0.98))] xl:min-h-0">
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
                  className="max-h-36 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none disabled:opacity-40"
                />
                <button
                  onClick={() => void handleSend()}
                  disabled={!chatInput.trim()}
                  className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-40"
                >
                  Send
                </button>
              </div>
              {queuedMessages[selectedAgent].length > 0 && (
                <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Pending queue (auto-send when ready)</div>
                  {queuedMessages[selectedAgent].map((item, index) => (
                    <div key={item.id} className="rounded-lg border border-white/10 bg-black/20 p-2">
                      <div className="mb-1 flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-slate-500">
                        <span>Queued #{index + 1}</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void sendQueuedMessage(selectedAgent, item.id)}
                            className="rounded bg-violet-600 px-2 py-1 text-[9px] font-semibold text-white hover:bg-violet-500"
                          >
                            Send
                          </button>
                          <button
                            type="button"
                            onClick={() => removeQueuedMessage(selectedAgent, item.id)}
                            className="rounded bg-white/10 px-2 py-1 text-[9px] font-semibold text-slate-200 hover:bg-white/15"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <AutoGrowTextarea
                        value={item.text}
                        onChange={(e) => updateQueuedMessage(selectedAgent, item.id, e.target.value)}
                        onFocus={() => setQueuedMessageEditing(selectedAgent, item.id, true)}
                        onBlur={() => setQueuedMessageEditing(selectedAgent, item.id, false)}
                        className="min-h-20 w-full rounded-md border border-white/10 bg-[#14141e] px-2 py-1.5 text-xs text-white focus:border-violet-500 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              )}
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
