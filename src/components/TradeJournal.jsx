import { useCallback, useEffect, useState } from 'react';
import { Download, Eye, LineChart, Pencil } from 'lucide-react';
import { useTradingSession } from '../context/TradingContext.jsx';
import { fetchAllTradesForExport } from '../lib/db.js';
import { fetchWgfAuditLog, formatAuditEventType } from '../lib/wgfAuditLog.js';
import {
  buildWgfPhaseDossierCsv,
  buildWgfPhaseDossierHtml,
  suggestWgfDossierBasename,
} from '../lib/wgfPhaseExport.js';
import { downloadTextFile } from '../lib/analytics.js';
import SessionReplayBar from './SessionReplayBar.jsx';
import TradeRecordModal from './TradeRecordModal.jsx';

function eventTone(eventType) {
  if (eventType === 'phase_pass' || eventType === 'phase_advance') return 'text-emerald-400';
  if (eventType === 'phase_fail') return 'text-rose-400';
  if (eventType === 'kill_switch') return 'text-rose-300';
  return 'text-slate-400';
}

export default function TradeJournal() {
  const {
    trades,
    challenge,
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

  const [tab, setTab] = useState('trades');
  const [auditRows, setAuditRows] = useState([]);
  const [selectedTradeId, setSelectedTradeId] = useState(null);
  const [openTradeInEdit, setOpenTradeInEdit] = useState(false);

  const loadAudit = useCallback(async () => {
    const rows = await fetchWgfAuditLog(challenge?.id, 100);
    setAuditRows(rows);
  }, [challenge?.id]);

  useEffect(() => {
    if (tab === 'audit') void loadAudit();
  }, [tab, loadAudit, challenge?.id]);

  useEffect(() => {
    function onOpenTrade(e) {
      const id = e.detail?.tradeId;
      if (id == null) return;
      setOpenTradeInEdit(false);
      setSelectedTradeId(id);
      setTab('trades');
    }
    function onAuditUpdated() {
      if (tab === 'audit') void loadAudit();
    }
    window.addEventListener('nexatrader:open-trade', onOpenTrade);
    window.addEventListener('nexatrader:wgf-audit-updated', onAuditUpdated);
    return () => {
      window.removeEventListener('nexatrader:open-trade', onOpenTrade);
      window.removeEventListener('nexatrader:wgf-audit-updated', onAuditUpdated);
    };
  }, [loadAudit, tab]);

  const reloadTrades = useCallback(async () => {
    await refreshTrades?.();
    await refreshChallenge?.();
    if (tab === 'audit') await loadAudit();
  }, [loadAudit, refreshChallenge, refreshTrades, tab]);

  const exportDossierCsv = useCallback(async () => {
    if (!challenge?.id) return;
    const allTrades = await fetchAllTradesForExport();
    const audit = await fetchWgfAuditLog(challenge.id, 500);
    const csv = buildWgfPhaseDossierCsv({
      challenge,
      trades: allTrades,
      auditRows: audit,
    });
    downloadTextFile(suggestWgfDossierBasename(challenge, 'csv'), csv, 'text/csv;charset=utf-8');
  }, [challenge]);

  const exportDossierHtml = useCallback(async () => {
    if (!challenge?.id) return;
    const allTrades = await fetchAllTradesForExport();
    const audit = await fetchWgfAuditLog(challenge.id, 500);
    const html = buildWgfPhaseDossierHtml({
      challenge,
      trades: allTrades,
      auditRows: audit,
    });
    downloadTextFile(
      suggestWgfDossierBasename(challenge, 'html'),
      html,
      'text/html;charset=utf-8',
    );
  }, [challenge]);

  return (
    <section className="flex h-full min-h-0 flex-col bg-slate-950/90">
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-800/80 bg-slate-900/30 px-3 py-1.5">
        <div className="flex rounded-lg border border-slate-800 p-0.5">
          <button
            type="button"
            onClick={() => setTab('trades')}
            className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${
              tab === 'trades' ? 'bg-slate-800 text-slate-100' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Trades
          </button>
          <button
            type="button"
            onClick={() => setTab('audit')}
            className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${
              tab === 'audit' ? 'bg-slate-800 text-slate-100' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Audit WGF
          </button>
        </div>
        {tab === 'trades' ? (
          <SessionReplayBar
            replayActive={replayActive}
            replayFrame={replayFrame}
            replayTotal={replayTotal}
            onStart={() => startSessionReplay()}
            onStop={() => stopSessionReplay()}
            onStep={(d) => stepSessionReplay(d)}
          />
        ) : (
          <>
            <button
              type="button"
              onClick={() => void loadAudit()}
              className="text-[10px] text-violet-400 hover:text-violet-300"
            >
              Actualiser
            </button>
            <button
              type="button"
              title="Export dossier CSV"
              onClick={() => void exportDossierCsv()}
              className="inline-flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300"
            >
              <Download className="h-3 w-3" />
              CSV
            </button>
            <button
              type="button"
              title="Rapport HTML (imprimer en PDF)"
              onClick={() => void exportDossierHtml()}
              className="inline-flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300"
            >
              <Download className="h-3 w-3" />
              PDF
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => setAnalyticsOpen(true)}
          className="ml-auto text-[10px] text-sky-400 hover:text-sky-300"
        >
          Analytics →
        </button>
        <span className="text-[10px] text-slate-600">
          {tab === 'trades' ? `${trades.length} trades` : `${auditRows.length} audit`}
          {' · '}
          <span className="text-slate-500">Disposition : barre au-dessus du graphique</span>
        </span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col p-2">
        {tab === 'audit' ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-800/80">
            <div className="flex-1 overflow-auto">
              {auditRows.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-slate-600">
                  Aucun événement WGF enregistré pour ce challenge (pass, fail, reset GMT, Kill Switch…).
                </p>
              ) : (
                <ul className="divide-y divide-slate-800/80">
                  {auditRows.map((row) => (
                    <li key={row.id} className="px-3 py-2 text-[11px]">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className={`font-medium ${eventTone(row.event_type)}`}>
                          {formatAuditEventType(row.event_type)}
                        </span>
                        <time className="text-[10px] tabular-nums text-slate-600">
                          {row.created_at}
                        </time>
                      </div>
                      <p className="mt-0.5 text-slate-300">{row.title}</p>
                      {row.detail ? (
                        <p className="mt-0.5 leading-snug text-slate-500">{row.detail}</p>
                      ) : null}
                      {row.equity != null ? (
                        <p className="mt-0.5 text-[10px] tabular-nums text-slate-600">
                          Équité : {Number(row.equity).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} $
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="border-t border-slate-800/60 px-2 py-1 text-[9px] text-slate-600">
              Journal d&apos;audit SQLite — export CSV dossier complet ou HTML (Imprimer → PDF).
            </p>
          </div>
        ) : (
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
        )}
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
