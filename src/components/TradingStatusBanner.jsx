import { memo } from 'react';
import { PauseCircle, ShieldAlert, TrendingUp } from 'lucide-react';

function TradingStatusBanner({
  killSwitchActive,
  tradingPaused,
  blocked,
  reasons,
  onResume,
}) {
  if (killSwitchActive || tradingPaused) {
    return (
      <div className="rounded-xl border-2 border-amber-500/50 bg-amber-950/40 p-3">
        <div className="mb-2 flex items-center gap-2 text-amber-100">
          <PauseCircle className="h-5 w-5 shrink-0" />
          <div>
            <p className="text-sm font-bold">Trading en pause (Kill Switch)</p>
            <p className="text-[11px] text-amber-200/80">
              ACHAT / VENTE désactivés volontairement. Reprenez quand vous êtes prêt.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onResume}
          className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-500"
        >
          Reprendre le trading
        </button>
      </div>
    );
  }

  if (blocked && reasons?.length) {
    const filtered = reasons.filter((r) => !/kill switch/i.test(r));
    if (!filtered.length) return null;
    return (
      <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 text-xs text-amber-100">
        <div className="mb-1 flex items-center gap-1.5 font-semibold">
          <ShieldAlert className="h-4 w-4" />
          Ordres bloqués par PropGuard
        </div>
        <ul className="list-inside list-disc space-y-0.5 opacity-90">
          {filtered.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200">
      <TrendingUp className="h-3.5 w-3.5" />
      Session prête — vous pouvez passer un ordre si le risque vous convient.
    </div>
  );
}

export default memo(TradingStatusBanner);
