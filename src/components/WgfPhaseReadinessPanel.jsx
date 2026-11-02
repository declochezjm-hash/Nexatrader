import { memo, useMemo } from 'react';
import { ListChecks } from 'lucide-react';
import { buildWgfPhaseReadiness } from '../lib/wgfPhaseReadiness.js';

function statusDot(status) {
  if (status === 'ok') return 'bg-emerald-400';
  if (status === 'warn') return 'bg-amber-400';
  if (status === 'fail') return 'bg-rose-500';
  if (status === 'na') return 'bg-slate-600';
  return 'bg-slate-500';
}

export default memo(function WgfPhaseReadinessPanel({ challenge, trades }) {
  const readiness = useMemo(() => {
    const equity = Number(challenge?.current_equity ?? challenge?.initial_balance ?? 0);
    return buildWgfPhaseReadiness(challenge, trades, equity);
  }, [challenge, trades]);

  if (!challenge?.id || !readiness.items.length) return null;

  return (
    <div className="rounded-lg border border-sky-500/25 bg-sky-500/5 px-3 py-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-sky-200">
          <ListChecks className="h-3.5 w-3.5" />
          Synthèse phase WGF
        </p>
        <span className="text-[10px] tabular-nums text-sky-300/90">{readiness.scorePercent}/100</span>
      </div>
      <ul className="space-y-1.5">
        {readiness.items.map((item) => (
          <li key={item.id} className="flex items-start gap-2 text-[10px] text-slate-400">
            <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${statusDot(item.status)}`} />
            <span className="min-w-0 flex-1">
              <span className="text-slate-300">{item.label}</span>
              <span className="block tabular-nums text-slate-500">{item.detail}</span>
            </span>
          </li>
        ))}
      </ul>
      {readiness.evaluationReady ? (
        <p className="mt-2 text-[10px] font-medium text-emerald-300">
          Toutes les conditions de validation sont remplies — statut passed au prochain sync.
        </p>
      ) : null}
      {readiness.payout.applies && readiness.payout.grossProfit > 0 ? (
        <p className="mt-2 text-[10px] text-slate-500">
          Payout simulé ({readiness.payout.traderSharePercent} % trader) :{' '}
          <span className="tabular-nums text-emerald-300/90">
            {readiness.payout.traderPayout.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} $
          </span>
        </p>
      ) : null}
    </div>
  );
});
