import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, ChevronRight, Download, RefreshCw, X } from 'lucide-react';
import { useTradingSession } from '../context/TradingContext.jsx';
import {
  buildPerformanceMetrics,
  computePerformanceMetrics,
  downloadTextFile,
  exportTradesCsv,
  exportTradesJson,
} from '../lib/analytics.js';
import {
  DRILL_PRESETS,
  drillFromHour,
  filterTradesByDrill,
  sortDrillTrades,
} from '../lib/analyticsDrill.js';
import TradeRecordModal from './TradeRecordModal.jsx';
import DisciplineHeatmap from './DisciplineHeatmap.jsx';

function MetricCard({ label, value, sub, tone = 'default', active, onClick }) {
  const valueClass =
    tone === 'profit'
      ? 'text-emerald-400'
      : tone === 'loss'
        ? 'text-rose-400'
        : 'text-slate-100';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border p-3 text-left transition ${
        active
          ? 'border-sky-500/50 bg-sky-500/10 ring-1 ring-sky-500/30'
          : 'border-slate-800 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-900/80'
      }`}
    >
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${valueClass}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-slate-500">{sub}</p>}
      <p className="mt-1.5 text-[9px] text-sky-500/70">Cliquer → détail</p>
    </button>
  );
}

const DEFAULT_DRILL = { id: 'all', title: 'Vue d’ensemble', subtitle: 'Cliquez une métrique pour filtrer' };

export default function Analytics({ onClose }) {
  const { trades, challenge, refreshTrades, refreshChallenge } = useTradingSession();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const firstLoadRef = useRef(true);
  const [drill, setDrill] = useState(DEFAULT_DRILL);
  const [selectedTradeId, setSelectedTradeId] = useState(null);

  const tradeSignal = useMemo(
    () => trades.map((t) => `${t.id}:${t.status}:${t.pnl ?? ''}:${t.symbol}`).join('|'),
    [trades],
  );

  const challengeSignal = useMemo(
    () =>
      challenge
        ? `${challenge.id}:${challenge.current_equity}:${challenge.status}`
        : '',
    [challenge],
  );

  const reload = useCallback(async () => {
    const isFirst = firstLoadRef.current;
    if (isFirst) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await computePerformanceMetrics(challenge);
      setMetrics(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
      firstLoadRef.current = false;
    }
  }, [challenge]);

  useEffect(() => {
    void reload();
  }, [reload, tradeSignal, challengeSignal]);

  const filteredTrades = useMemo(() => {
    if (!metrics?.trades) return [];
    const raw = filterTradesByDrill(metrics.trades, drill.id);
    return sortDrillTrades(raw, drill.id);
  }, [metrics?.trades, drill.id]);

  const filteredMetrics = useMemo(() => {
    if (!metrics?.trades || drill.id === 'all') return null;
    return buildPerformanceMetrics(filteredTrades, challenge);
  }, [challenge, drill.id, filteredTrades, metrics?.trades]);

  const hourlyActive =
    metrics?.hourlyBuckets?.filter((b) => b.trades > 0).slice(0, 12) ?? [];

  const updatedLabel = metrics?.computedAt
    ? new Date(metrics.computedAt).toLocaleTimeString('fr-FR')
    : '—';

  function applyPreset(key) {
    const preset = DRILL_PRESETS[key];
    if (preset) setDrill(preset);
  }

  async function onTradeChanged() {
    await refreshTrades?.();
    await refreshChallenge?.();
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-slate-950/95">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-3 py-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-sky-400" />
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
              Analytics interactif — SQLite live
            </h3>
            <p className="text-[9px] text-slate-600">
              Chaque carte ouvre le détail · MAJ {updatedLabel}
              {refreshing && <span className="ml-1 text-sky-500/80">· sync…</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void reload()}
            disabled={refreshing}
            className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:border-sky-500/40 disabled:opacity-40"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
          <button
            type="button"
            disabled={!metrics?.trades?.length}
            onClick={() =>
              downloadTextFile(
                `nexatrader-trades-${Date.now()}.csv`,
                exportTradesCsv(filteredTrades.length ? filteredTrades : metrics.trades),
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
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:text-white"
            aria-label="Fermer analytics"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 overflow-auto border-b border-slate-800/80 p-3">
          {loading && !metrics && (
            <p className="text-xs text-slate-500">Calcul des métriques…</p>
          )}
          {metrics && (
            <div className={`space-y-3 ${refreshing ? 'opacity-85' : ''}`}>
              <DisciplineHeatmap trades={metrics.trades ?? trades} />
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
                <MetricCard
                  label="Win rate global"
                  value={`${metrics.winRateGlobal} %`}
                  active={drill.id === DRILL_PRESETS.winRateGlobal.id}
                  onClick={() => applyPreset('winRateGlobal')}
                />
                <MetricCard
                  label="XAUUSD"
                  value={`${metrics.winRateXAUUSD} %`}
                  sub="Win rate"
                  active={drill.id === 'xau'}
                  onClick={() => applyPreset('winRateXAUUSD')}
                />
                <MetricCard
                  label="NAS100"
                  value={`${metrics.winRateNAS100} %`}
                  sub="Win rate"
                  active={drill.id === 'nas'}
                  onClick={() => applyPreset('winRateNAS100')}
                />
                <MetricCard
                  label="Profit factor"
                  value={
                    metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)
                  }
                  active={drill.id === 'closed' && drill.title.includes('clôturés')}
                  onClick={() => applyPreset('profitFactor')}
                />
                <MetricCard
                  label="R:R moyen"
                  value={`${metrics.averageRR} R`}
                  onClick={() => applyPreset('averageRR')}
                />
                <MetricCard
                  label="PnL net"
                  value={`${metrics.totalPnl}$`}
                  tone={metrics.totalPnl >= 0 ? 'profit' : 'loss'}
                  sub={`${metrics.wins}W / ${metrics.losses}L`}
                  onClick={() => applyPreset('totalPnl')}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <MetricCard
                  label="Trades total"
                  value={String(metrics.totalTrades)}
                  sub={`${metrics.openTrades} ouvert(s)`}
                  active={drill.id === 'all'}
                  onClick={() => applyPreset('totalTrades')}
                />
                <MetricCard
                  label="Gagnants"
                  value={String(metrics.wins)}
                  tone="profit"
                  onClick={() => applyPreset('wins')}
                />
                <MetricCard
                  label="Perdants"
                  value={String(metrics.losses)}
                  tone="loss"
                  onClick={() => applyPreset('losses')}
                />
                {metrics.challengeEquity != null && (
                  <MetricCard
                    label="Équité challenge"
                    value={`${Number(metrics.challengeEquity).toLocaleString('fr-FR')}$`}
                    sub={`Capital ${Number(metrics.challengeInitial ?? 0).toLocaleString('fr-FR')}$`}
                    onClick={() => setDrill(DEFAULT_DRILL)}
                  />
                )}
              </div>

              <div>
                <p className="mb-2 text-[10px] uppercase tracking-wide text-slate-500">
                  Rentabilité par heure UTC — cliquer une tranche
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {hourlyActive.map((b) => (
                    <button
                      key={b.hour}
                      type="button"
                      onClick={() => setDrill(drillFromHour(b.hour))}
                      className={`rounded-full px-2 py-0.5 text-[10px] tabular-nums transition hover:ring-1 hover:ring-sky-500/40 ${
                        drill.id === `hour:${b.hour}`
                          ? 'ring-1 ring-sky-400 bg-sky-500/20 text-sky-100'
                          : b.pnl >= 0
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-rose-500/15 text-rose-300'
                      }`}
                    >
                      {String(b.hour).padStart(2, '0')}h · {b.pnl.toFixed(0)}$ ({b.trades})
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col bg-slate-950/50">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-800/60 px-3 py-2">
            <ChevronRight className="h-3.5 w-3.5 text-sky-500" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-200">{drill.title}</p>
              <p className="text-[10px] text-slate-500">{drill.subtitle}</p>
            </div>
            {filteredMetrics && (
              <p className="text-[10px] tabular-nums text-slate-400">
                Sous-total : {filteredMetrics.totalTrades} trades · PnL{' '}
                <span
                  className={
                    filteredMetrics.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }
                >
                  {filteredMetrics.totalPnl}$
                </span>{' '}
                · WR {filteredMetrics.winRateGlobal}%
              </p>
            )}
            {drill.id !== 'all' && (
              <button
                type="button"
                onClick={() => setDrill(DEFAULT_DRILL)}
                className="text-[10px] text-sky-400 hover:text-sky-300"
              >
                Tout afficher
              </button>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="sticky top-0 bg-slate-950 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-1.5">#</th>
                  <th className="px-3 py-1.5">Symbole</th>
                  <th className="px-3 py-1.5">Type</th>
                  <th className="px-3 py-1.5">Lot</th>
                  <th className="px-3 py-1.5">PnL</th>
                  <th className="px-3 py-1.5">Statut</th>
                  <th className="px-3 py-1.5">Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrades.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-slate-600">
                      Aucun trade pour ce filtre.
                    </td>
                  </tr>
                ) : (
                  filteredTrades.map((t) => (
                    <tr
                      key={t.id}
                      className="cursor-pointer border-t border-slate-800/50 text-slate-300 hover:bg-sky-500/10"
                      onClick={() => setSelectedTradeId(t.id)}
                    >
                      <td className="px-3 py-1.5 tabular-nums text-slate-500">{t.id}</td>
                      <td className="px-3 py-1.5">{t.symbol}</td>
                      <td
                        className={`px-3 py-1.5 font-medium ${
                          t.type === 'BUY' ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {t.type}
                      </td>
                      <td className="px-3 py-1.5 tabular-nums">{t.lot_size}</td>
                      <td
                        className={`px-3 py-1.5 tabular-nums ${
                          (t.pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {t.pnl ?? '—'}
                      </td>
                      <td className="px-3 py-1.5 text-slate-500">{t.status}</td>
                      <td className="px-3 py-1.5 text-[10px] text-slate-600">
                        {t.created_at ?? '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="shrink-0 border-t border-slate-800/60 px-3 py-1 text-[9px] text-slate-600">
            Cliquez une ligne pour consulter, modifier ou supprimer le trade (journal SQLite).
          </p>
        </div>
      </div>

      <TradeRecordModal
        tradeId={selectedTradeId}
        onClose={() => setSelectedTradeId(null)}
        onChanged={onTradeChanged}
      />
    </section>
  );
}
