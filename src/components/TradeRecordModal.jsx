import { useEffect, useMemo, useState } from 'react';
import { LineChart, Pencil, Trash2, X } from 'lucide-react';
import { useTradingSession } from '../context/TradingContext.jsx';
import { compareTradeDecision } from '../lib/tradeDecisionCompare.js';
import TwinTradePanel from './TwinTradePanel.jsx';
import {
  deleteTradeRecord,
  fetchTradeDetail,
  updateTradeRecord,
} from '../lib/tradeJournalAdmin.js';

function Field({ label, value }) {
  return (
    <div>
      <p className="text-[10px] uppercase text-slate-500">{label}</p>
      <p className="text-sm tabular-nums text-slate-200">{value ?? '—'}</p>
    </div>
  );
}

export default function TradeRecordModal({ tradeId, startInEdit = false, onClose, onChanged }) {
  const { focusTradeOnChart, aiInsight, activeTradeReview } = useTradingSession();
  const [detail, setDetail] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!tradeId) return;
    let cancelled = false;
    setEditing(false);
    setError('');
    void (async () => {
      const row = await fetchTradeDetail(tradeId);
      if (!cancelled) {
        setDetail(row);
        setForm(row ?? {});
        setEditing(Boolean(startInEdit && row));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tradeId, startInEdit]);

  const comparison = useMemo(() => {
    if (!detail) return null;
    if (activeTradeReview?.trade?.id === detail.id && activeTradeReview.comparison) {
      return activeTradeReview.comparison;
    }
    return compareTradeDecision(detail, {
      aiSignal: aiInsight?.signal,
      aiConfidence: aiInsight?.confidence,
    });
  }, [detail, aiInsight?.confidence, aiInsight?.signal, activeTradeReview]);

  if (!tradeId) return null;

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    setBusy(true);
    setError('');
    try {
      const updated = await updateTradeRecord(tradeId, form);
      setDetail(updated);
      setEditing(false);
      await onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement échoué.');
    } finally {
      setBusy(false);
    }
  }

  async function handleShowOnChart() {
    if (!detail) return;
    setError('');
    try {
      await focusTradeOnChart(detail);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de centrer le graphique.');
    }
  }

  async function handleDelete() {
    if (
      !window.confirm(
        `Supprimer définitivement le trade #${tradeId} ? Cette action recalcule l’équité WGF.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await deleteTradeRecord(tradeId);
      await onChanged?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suppression échouée.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 p-4">
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trade-detail-title"
      >
        <header className="flex items-start justify-between gap-2 border-b border-slate-800 px-4 py-3">
          <div>
            <h2 id="trade-detail-title" className="text-base font-semibold text-slate-100">
              Trade #{tradeId}
            </h2>
            <p className="text-[11px] text-slate-500">
              Consultation · modification · suppression (SQLite)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-800"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {!detail ? (
          <p className="px-4 py-6 text-sm text-slate-500">Chargement…</p>
        ) : editing ? (
          <div className="space-y-3 px-4 py-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-slate-400">
                Symbole
                <select
                  value={form.symbol ?? 'XAUUSD'}
                  onChange={(e) => setField('symbol', e.target.value)}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100"
                >
                  <option value="XAUUSD">XAUUSD</option>
                  <option value="NAS100">NAS100</option>
                </select>
              </label>
              <label className="block text-slate-400">
                Type
                <select
                  value={form.type ?? 'BUY'}
                  onChange={(e) => setField('type', e.target.value)}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100"
                >
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                </select>
              </label>
              <label className="block text-slate-400">
                Lot
                <input
                  type="number"
                  step="0.01"
                  value={form.lot_size ?? ''}
                  onChange={(e) => setField('lot_size', e.target.value)}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100"
                />
              </label>
              <label className="block text-slate-400">
                Risque %
                <input
                  type="number"
                  step="0.1"
                  value={form.risk_percent ?? ''}
                  onChange={(e) => setField('risk_percent', e.target.value)}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100"
                />
              </label>
              <label className="block text-slate-400">
                Entrée
                <input
                  type="number"
                  step="0.01"
                  value={form.entry_price ?? ''}
                  onChange={(e) => setField('entry_price', e.target.value)}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100"
                />
              </label>
              <label className="block text-slate-400">
                Sortie
                <input
                  type="number"
                  step="0.01"
                  value={form.exit_price ?? ''}
                  onChange={(e) => setField('exit_price', e.target.value)}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100"
                />
              </label>
              <label className="block text-slate-400">
                Stop loss
                <input
                  type="number"
                  step="0.01"
                  value={form.stop_loss ?? ''}
                  onChange={(e) => setField('stop_loss', e.target.value)}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100"
                />
              </label>
              <label className="block text-slate-400">
                Take profit
                <input
                  type="number"
                  step="0.01"
                  value={form.take_profit ?? ''}
                  onChange={(e) => setField('take_profit', e.target.value)}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100"
                />
              </label>
              <label className="block text-slate-400">
                PnL ($)
                <input
                  type="number"
                  step="0.01"
                  value={form.pnl ?? ''}
                  onChange={(e) => setField('pnl', e.target.value)}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100"
                />
              </label>
              <label className="block text-slate-400">
                Statut
                <select
                  value={form.status ?? 'closed'}
                  onChange={(e) => setField('status', e.target.value)}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100"
                >
                  <option value="open">open</option>
                  <option value="closed">closed</option>
                  <option value="emergency_closed">emergency_closed</option>
                  <option value="pending">pending</option>
                </select>
              </label>
            </div>
            {error && <p className="text-[11px] text-rose-300">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setEditing(false);
                  setForm(detail);
                  setError('');
                }}
                className="flex-1 rounded-lg border border-slate-700 py-2 text-slate-300 hover:bg-slate-800"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSave()}
                className="flex-1 rounded-lg bg-emerald-600 py-2 font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {busy ? '…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 px-4 py-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Symbole" value={detail.symbol} />
              <Field label="Type" value={detail.type} />
              <Field label="Statut" value={detail.status} />
              <Field label="Lot" value={detail.lot_size} />
              <Field label="Risque %" value={detail.risk_percent} />
              <Field label="PnL" value={detail.pnl} />
              <Field label="Entrée" value={detail.entry_price} />
              <Field label="Sortie" value={detail.exit_price} />
              <Field label="Stop loss" value={detail.stop_loss} />
              <Field label="Take profit" value={detail.take_profit} />
              <Field label="Créé le" value={detail.created_at} />
            </div>

            {comparison && (
              <div className="rounded-lg border border-sky-500/25 bg-sky-500/5 p-3 text-xs">
                <p className="mb-1 font-medium text-sky-200">Analyse comparative</p>
                <p className="mb-2 text-[11px] text-slate-300">{comparison.summary}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <p className="text-[10px] text-slate-400">
                    Vous : <span className="text-slate-200">{comparison.actualSide}</span>
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Structure SL :{' '}
                    <span className="text-slate-200">{comparison.structuralSide ?? '—'}</span> · IA{' '}
                    {comparison.aiSignal} ({comparison.aiConfidence}%)
                  </p>
                </div>
                <p className="mt-2 text-[10px] text-slate-500">
                  Discipline {comparison.disciplineScore}/100 · {comparison.outcomeLabel}
                </p>
              </div>
            )}

            {detail ? <TwinTradePanel trade={detail} /> : null}

            {error && <p className="text-[11px] text-rose-300">{error}</p>}
            <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleShowOnChart()}
                className="inline-flex items-center gap-1 rounded-lg border border-sky-400/60 bg-sky-500/25 px-3 py-2 text-xs font-medium text-sky-100 hover:bg-sky-500/40 disabled:opacity-50"
              >
                <LineChart className="h-3.5 w-3.5" />
                Voir sur le graphique
              </button>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-200 hover:border-sky-500/40"
              >
                <Pencil className="h-3.5 w-3.5" />
                Modifier
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleDelete()}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200 hover:bg-rose-500/20 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Supprimer
              </button>
              <button
                type="button"
                onClick={onClose}
                className="ml-auto rounded-lg px-3 py-2 text-xs text-slate-400 hover:text-slate-200"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
