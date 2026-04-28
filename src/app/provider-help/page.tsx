import Link from 'next/link';

const PROVIDER_HELP = [
  {
    id: 'ccr',
    title: 'Claude Code Router (ccr)',
    why: 'CCR is a router/CLI wrapper, not the actual local model server. It can reject local model ids before the request is proxied if the model is not mapped in ~/.claude-code-router/config.json.',
    checks: ['which ccr', 'ccr code --help', 'cat ~/.claude-code-router/config.json', './scripts/diag-ccr.sh'],
    fix: './scripts/fix-ccr.sh',
  },
  {
    id: 'openclaude',
    title: 'OpenClaude',
    why: 'OpenClaude is an agent CLI/runtime. This repo uses it as a spawned CLI, not as a local HTTP model server.',
    checks: ['which openclaude', 'openclaude --help', 'cat ~/.openclaude/config.json', './scripts/diag-openclaude.sh'],
    fix: './scripts/fix-openclaude.sh',
  },
  {
    id: 'occ',
    title: 'Open Claude Code (occ)',
    why: 'occ is also a CLI agent runtime. Model availability depends on its provider credentials/config, often Bedrock-oriented rather than local OpenAI-compatible HTTP endpoints.',
    checks: ['which occ', 'occ --help', './scripts/diag-openclaude.sh'],
    fix: './scripts/fix-occ.sh',
  },
  {
    id: 'ollama',
    title: 'Ollama',
    why: 'Ollama is best treated as a local HTTP backend. This repo discovers via ollama list or /api/tags and executes via the OpenAI-compatible /v1/chat/completions path through the HTTP shim.',
    checks: ['which ollama', 'ollama list', 'curl -sS http://localhost:11434/api/tags', './scripts/diag-ollama.sh'],
    fix: './scripts/fix-ollama.sh',
  },
  {
    id: 'lm-studio',
    title: 'LM Studio',
    why: 'LM Studio is used as an HTTP model server. Discovery comes from /api/v1/models or /v1/models; execution uses /v1/chat/completions through the HTTP shim.',
    checks: ['curl -sS http://localhost:1234/api/v1/models', 'curl -sS http://localhost:1234/v1/models', './scripts/diag-lm-studio.sh'],
    fix: './scripts/fix-lm-studio.sh',
  },
  {
    id: 'openai-http',
    title: 'OpenAI / OpenAI-compatible HTTP',
    why: 'This adapter now reads both env vars and provider-config.json. Use it when you want a saved base URL/API key without changing your shell environment.',
    checks: ['cat provider-config.json', './scripts/diagnose-providers.sh'],
    fix: './scripts/fix-openai-http.sh',
  },
];

export default function ProviderHelpPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(25,30,45,0.9),rgba(9,9,11,1)_55%)] px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Provider Help</p>
            <h1 className="mt-1 text-3xl font-semibold">Local provider troubleshooting</h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300">
              This page summarizes how the app talks to local/offline providers. In this repo, LM Studio and Ollama are treated as HTTP backends,
              while Claude CLI / CCR / OpenClaude / occ are treated as agent CLIs or router layers. If a provider is not fully configured,
              the UI can fall back to a safer default provider after refresh or at runner start.
            </p>
          </div>
          <Link href="/" className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-200 hover:bg-white/10">
            Back to app
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold text-white">General checks</div>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li><code className="rounded bg-black/20 px-2 py-1">./scripts/diagnose-providers.sh</code></li>
            <li><code className="rounded bg-black/20 px-2 py-1">cat provider-config.json</code> — saved host/port/API key overrides from the UI</li>
            <li><code className="rounded bg-black/20 px-2 py-1">cat ~/Builds/&lt;project&gt;/pipeline-events.json</code> — authoritative selectedProvider / selectedModel / agentModels for a run</li>
          </ul>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {PROVIDER_HELP.map((provider) => (
            <section key={provider.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-lg font-semibold text-white">{provider.title}</div>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{provider.why}</p>
              <div className="mt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Checks</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {provider.checks.map((check) => (
                  <code key={check} className="rounded bg-black/20 px-2 py-1 text-[11px] text-slate-200">{check}</code>
                ))}
              </div>
              <div className="mt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Fix helper</div>
              <code className="mt-2 inline-block rounded bg-black/20 px-2 py-1 text-[11px] text-slate-200">{provider.fix}</code>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
