import { useCallback, useEffect, useState } from 'react';
import { BarChart3, Download, X } from 'lucide-react';
import {
  computePerformanceMetrics,
  downloadTextFile,
  exportTradesCsv,
  exportTradesJson,
} from '../lib/analytics.js';

function MetricCard({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-slate-100">{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-slate-500">{sub}</p>}
    </div>
  );
}

export default function Analytics({ onClose }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await computePerformanceMetrics();
      setMetrics(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <section className="flex h-72 shrink-0 flex-col border-t border-slate-800 bg-slate-950/95">
      <header className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-sky-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
            Analytics — Bilan post-session
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!metrics?.trades?.length}
            onClick={() =>
              downloadTextFile(
                `nexatrader-trades-${Date.now()}.csv`,
                exportTradesCsv(metrics.trades),
                'text/csv',
              )
            }
            className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:border-slate-500 disabled:opacity-40"
          >
            <Download className="h-3 w-3" />
            CSV
          </button>
          <button
            type="button"
            disabled={!metrics?.trades?.length}
            onClick={() =>
              downloadTextFile(
                `nexatrader-trades-${Date.now()}.json`,
                exportTradesJson(metrics.trades),
                'application/json',
              )
            }
            className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:border-slate-500 disabled:opacity-40"
          >
            <Download className="h-3 w-3" />
            JSON
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:text-white"
            aria-label="Fermer analytics"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-3">
        {loading && <p className="text-xs text-slate-500">Calcul des métriques…</p>}
        {!loading && metrics && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
              <MetricCard label="Win rate global" value={`${metrics.winRateGlobal} %`} />
              <MetricCard label="XAUUSD" value={`${metrics.winRateXAUUSD} %`} sub="Win rate" />
              <MetricCard label="NAS100" value={`${metrics.winRateNAS100} %`} sub="Win rate" />
              <MetricCard
                label="Profit factor"
                value={
                  metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)
                }
              />
              <MetricCard label="R:R moyen" value={`${metrics.averageRR} R`} />
              <MetricCard
                label="PnL net"
                value={`${metrics.totalPnl}$`}
                sub={`${metrics.closedTrades} clôturés / ${metrics.totalTrades} total`}
              />
            </div>

            <div>
              <p className="mb-2 text-[10px] uppercase tracking-wide text-slate-500">
                Rentabilité par heure UTC (top tranches)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {metrics.hourlyBuckets.slice(0, 8).map((b) => (
                  <span
                    key={b.hour}
                    className={`rounded-full px-2 py-0.5 text-[10px] tabular-nums ${
                      b.pnl >= 0
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-rose-500/15 text-rose-300'
                    }`}
                  >
                    {String(b.hour).padStart(2, '0')}h · {b.pnl.toFixed(0)}$ ({b.trades})
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
