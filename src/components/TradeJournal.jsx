import { useCallback, useEffect, useState } from 'react';
import { Eye, LineChart, Pencil } from 'lucide-react';
import { useTradingSession } from '../context/TradingContext.jsx';
import SessionReplayBar from './SessionReplayBar.jsx';
import TradeRecordModal from './TradeRecordModal.jsx';

export default function TradeJournal() {
  const {
    trades,
    setAnalyticsOpen,
    replayActive,
    replayFrame,
    replayTotal,
    startSessionReplay,
    stopSessionReplay,
    stepSessionReplay,
    refreshTrades,
    refreshChallenge,
    focusTradeOnChart,
    activeTradeReview,
  } = useTradingSession();

  const [selectedTradeId, setSelectedTradeId] = useState(null);
  const [openTradeInEdit, setOpenTradeInEdit] = useState(false);

  useEffect(() => {
    function onOpenTrade(e) {
      const id = e.detail?.tradeId;
      if (id == null) return;
      setOpenTradeInEdit(false);
      setSelectedTradeId(id);
    }
    window.addEventListener('nexatrader:open-trade', onOpenTrade);
    return () => window.removeEventListener('nexatrader:open-trade', onOpenTrade);
  }, []);

  const reloadTrades = useCallback(async () => {
    await refreshTrades?.();
    await refreshChallenge?.();
  }, [refreshChallenge, refreshTrades]);

  return (
    <section className="flex h-full min-h-0 flex-col bg-slate-950/90">
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-800/80 px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Journal SQLite
        </h3>
        <SessionReplayBar
          replayActive={replayActive}
          replayFrame={replayFrame}
          replayTotal={replayTotal}
          onStart={() => startSessionReplay()}
          onStop={() => stopSessionReplay()}
          onStep={(d) => stepSessionReplay(d)}
        />
        <button
          type="button"
          onClick={() => setAnalyticsOpen(true)}
          className="ml-auto text-[10px] text-sky-400 hover:text-sky-300"
        >
          Analytics →
        </button>
        <span className="text-[10px] text-slate-600">{trades.length} trades</span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col p-2">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-800/80">
          <div className="flex-1 overflow-auto">
            <table className="w-full min-w-[580px] text-left text-xs">
              <thead className="sticky top-0 bg-slate-950 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="px-2 py-1 font-medium">#</th>
                  <th className="px-2 py-1 font-medium">Symbole</th>
                  <th className="px-2 py-1 font-medium">Type</th>
                  <th className="px-2 py-1 font-medium">Lot</th>
                  <th className="px-2 py-1 font-medium">PnL</th>
                  <th className="px-2 py-1 font-medium">Statut</th>
                  <th className="px-2 py-1 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {trades.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-2 py-4 text-center text-slate-600">
                      Aucun trade.
                    </td>
                  </tr>
                ) : (
                  trades.map((t) => (
                    <tr
                      key={t.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        void focusTradeOnChart(t.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          void focusTradeOnChart(t.id);
                        }
                      }}
                      className={`cursor-pointer border-t border-slate-800/60 text-slate-300 ${
                        activeTradeReview?.trade?.id === t.id || selectedTradeId === t.id
                          ? 'bg-sky-500/10'
                          : 'hover:bg-slate-900/40'
                      }`}
                    >
                      <td className="px-2 py-1 tabular-nums text-slate-500">{t.id}</td>
                      <td className="px-2 py-1">{t.symbol}</td>
                      <td
                        className={`px-2 py-1 font-medium ${
                          t.type === 'BUY' ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {t.type}
                      </td>
                      <td className="px-2 py-1 tabular-nums">{t.lot_size}</td>
                      <td className="px-2 py-1 tabular-nums">{t.pnl ?? '—'}</td>
                      <td className="px-2 py-1 text-slate-500">{t.status}</td>
                      <td className="px-2 py-1">
                        <div className="flex justify-end gap-0.5">
                          <button
                            type="button"
                            title="Graphique + analyse"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenTradeInEdit(false);
                              setSelectedTradeId(t.id);
                              void focusTradeOnChart(t.id);
                            }}
                            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-sky-300"
                          >
                            <LineChart className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Consulter"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenTradeInEdit(false);
                              setSelectedTradeId(t.id);
                            }}
                            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-sky-300"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Modifier"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenTradeInEdit(true);
                              setSelectedTradeId(t.id);
                            }}
                            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-amber-300"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="border-t border-slate-800/60 px-2 py-1 text-[9px] text-slate-600">
            Cliquez une ligne pour centrer le graphique et comparer votre décision (SL / IA). Œil =
            fiche · icône graphique = même action sans ouvrir la fiche.
          </p>
        </div>
      </div>

      <TradeRecordModal
        tradeId={selectedTradeId}
        startInEdit={openTradeInEdit}
        onClose={() => {
          setSelectedTradeId(null);
          setOpenTradeInEdit(false);
        }}
        onChanged={reloadTrades}
      />
    </section>
  );
}
