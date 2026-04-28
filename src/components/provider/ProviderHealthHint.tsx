import Link from 'next/link';

export type ProviderHealthStatus = {
  id: string;
  label: string;
  available: boolean;
  installedOrConfigured?: boolean;
  executable?: boolean;
  reason?: string;
  suggestion?: string;
  diagnosticScript?: string;
  fixScript?: string;
  helpHref?: string;
};

export function ProviderHealthHint({ provider }: { provider?: ProviderHealthStatus }) {
  if (!provider) return null;

  const tone = provider.available
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
    : 'border-amber-500/30 bg-amber-500/10 text-amber-100';

  return (
    <div data-testid="provider-health" className={`rounded-lg border p-3 ${tone}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-current/70">Provider health</div>
          <div className="mt-1 text-xs font-semibold">
            {provider.label}: {provider.available ? 'ready for execution' : 'needs setup / verification'}
          </div>
        </div>
        {provider.helpHref && (
          <Link
            href={provider.helpHref}
            className="rounded border border-current/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-current/90 transition hover:border-current/40 hover:bg-black/10"
          >
            Provider Help
          </Link>
        )}
      </div>

      {provider.reason && (
        <p className="mt-2 text-[11px] leading-relaxed text-current/90">{provider.reason}</p>
      )}

      {provider.suggestion && (
        <p className="mt-1 text-[11px] leading-relaxed text-current/80">{provider.suggestion}</p>
      )}

      {(provider.diagnosticScript || provider.fixScript) && (
        <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-current/80">
          {provider.diagnosticScript && (
            <code className="rounded bg-black/20 px-2 py-1">./scripts/{provider.diagnosticScript}</code>
          )}
          {provider.fixScript && (
            <code className="rounded bg-black/20 px-2 py-1">./scripts/{provider.fixScript}</code>
          )}
        </div>
      )}

      {!provider.available && (
        <p className="mt-2 text-[10px] leading-relaxed text-current/70">
          If this provider cannot be confirmed during page load, the UI may fall back to another working provider after refresh until the CLI or endpoint is configured.
        </p>
      )}
    </div>
  );
}

export default ProviderHealthHint;
