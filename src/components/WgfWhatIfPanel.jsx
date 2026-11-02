import { memo, useMemo, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import {
  pnlForBalancePercent,
  runWgfWhatIfScenario,
  runWgfWhatIfMultiProgram,
  WGF_WHATIF_PRESETS,
} from '../lib/wgfWhatIf.js';

function toneClass(tone) {
  if (tone === 'rose') return 'text-rose-300';
  if (tone === 'amber') return 'text-amber-200';
  if (tone === 'emerald') return 'text-emerald-300';
  return 'text-slate-300';
}

export default memo(function WgfWhatIfPanel({ challenge, trades }) {
  const [open, setOpen] = useState(false);
  const [additionalPnl, setAdditionalPnl] = useState('0');
  const [countDay, setCountDay] = useState(true);

  const pnlNum = Number(additionalPnl);
  const validPnl = Number.isFinite(pnlNum) ? pnlNum : 0;

  const scenario = useMemo(
    () =>
      runWgfWhatIfScenario({
        challenge,
        trades,
        additionalPnl: validPnl,
        countAsTradingDay: countDay,
      }),
    [challenge, trades, validPnl, countDay],
  );

  const multi = useMemo(
    () =>
      open
        ? runWgfWhatIfMultiProgram({
            challenge,
            trades,
            additionalPnl: validPnl,
            countAsTradingDay: countDay,
          })
        : [],
    [challenge, trades, validPnl, countDay, open],
  );

  if (!challenge?.id) return null;

  return (
    <div className="rounded-lg border border-violet-500/25 bg-violet-500/5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[11px] font-medium text-violet-200"
      >
        <span className="inline-flex items-center gap-1.5">
          <FlaskConical className="h-3.5 w-3.5" />
          Simulateur what-if WGF
        </span>
        <span className="text-[10px] text-violet-300/80">{open ? 'Masquer' : 'Ouvrir'}</span>
      </button>

      {open ? (
        <div className="space-y-3 border-t border-violet-500/20 px-3 pb-3 pt-2">
          <p className="text-[10px] leading-snug text-slate-500">
            Projette un PnL réalisé supplémentaire sans enregistrer de trade. Utile avant de sur-risquer
            ou pour voir si une grosse journée casse la consistency.
          </p>

          <div className="flex flex-wrap gap-1.5">
            {WGF_WHATIF_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setAdditionalPnl(String(pnlForBalancePercent(challenge, p.percent)))}
                className="rounded-md border border-slate-700 bg-slate-900/80 px-2 py-1 text-[10px] text-slate-300 hover:border-violet-500/40"
              >
                {p.label}
              </button>
            ))}
          </div>

          <label className="block text-[11px] text-slate-400">
            PnL hypothétique ($)
            <input
              type="number"
              step="50"
              value={additionalPnl}
              onChange={(e) => setAdditionalPnl(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm tabular-nums text-slate-100"
            />
          </label>

          <label className="flex items-center gap-2 text-[10px] text-slate-400">
            <input
              type="checkbox"
              checked={countDay}
              onChange={(e) => setCountDay(e.target.checked)}
              className="rounded border-slate-600"
            />
            Attribuer à aujourd&apos;hui (GMT) pour jours actifs / consistency
          </label>

          {scenario.ok ? (
            <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-2 text-[11px]">
              <p className="text-slate-400">
                Équité{' '}
                <span className="tabular-nums text-slate-200">
                  {scenario.currentEquity.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}
                </span>
                {' → '}
                <span className="tabular-nums font-medium text-violet-200">
                  {scenario.projectedEquity.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}{' '}
                  $
                </span>
              </p>
              <ul className="space-y-1">
                {scenario.headlines.map((h) => (
                  <li key={h.text} className={toneClass(h.tone)}>
                    {h.text}
                  </li>
                ))}
              </ul>
              {scenario.eod ? (
                <p className="text-[10px] text-slate-500">
                  Marge EOD simulée :{' '}
                  <span className="tabular-nums text-slate-300">
                    {scenario.eod.marginDollars.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} $
                  </span>
                </p>
              ) : null}
              {scenario.compliance?.consistency?.limit != null ? (
                <p className="text-[10px] text-slate-500">
                  Meilleur jour / profit total :{' '}
                  <span className="tabular-nums text-slate-300">
                    {scenario.compliance.consistency.bestDaySharePct} % / max{' '}
                    {scenario.compliance.consistency.limit} %
                  </span>
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-[11px] text-amber-300">{scenario.error}</p>
          )}

          {multi.length ? (
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-2 py-2">
              <p className="text-[10px] font-medium text-violet-200">Comparaison multi-programmes</p>
              <ul className="mt-1 max-h-32 space-y-0.5 overflow-auto text-[10px] text-slate-400">
                {multi.map((row) => (
                  <li key={row.programId} className="flex justify-between gap-2">
                    <span>{row.shortLabel}</span>
                    <span className="tabular-nums text-slate-300">
                      {row.scenario.ok && row.scenario.passEval?.pass
                        ? 'Pass simulé'
                        : row.scenario.ok && row.scenario.fail?.fail
                          ? 'Fail'
                          : row.scenario.ok
                            ? `${row.scenario.profit?.profitPct ?? 0} %`
                            : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});
