import { memo, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert, X } from 'lucide-react';
import { setSkipPreTradeChecklist } from '../lib/preTradeChecklist.js';
import {
  assessAiOrderConflict,
  suggestStopLossForSide,
  validateStopLossForSide,
} from '../lib/preTradeValidation.js';
import { calculateLotSize } from '../engine/positionSizer.js';
import { useTradingMarket, useTradingSession } from '../context/TradingContext.jsx';

function PreTradeChecklistModalInner() {
  const { symbol, setActiveStopLoss } = useTradingMarket();
  const {
    pendingPreTradeSide,
    preTradeSnapshot,
    refreshPreTradeSnapshot,
    patchPreTradeSnapshot,
    cancelPreTradeOrder,
    confirmPreTradeOrder,
    propGuard,
    killSwitchActive,
  } = useTradingSession();

  const [checked, setChecked] = useState({
    readAi: false,
    acceptRisk: false,
    acceptAgainstAi: false,
  });
  const [skipNext, setSkipNext] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!pendingPreTradeSide) return;
    setChecked({ readAi: false, acceptRisk: false, acceptAgainstAi: false });
    setSkipNext(false);
    setSubmitError('');
  }, [pendingPreTradeSide]);

  const snap = preTradeSnapshot;
  const side = snap?.side ?? pendingPreTradeSide;
  const sym = snap?.symbol ?? symbol;
  const entry = snap?.entry ?? null;
  const sl = snap?.stopLoss ?? null;
  const risk = snap?.riskPercent ?? 1;

  const slValidation = useMemo(
    () => validateStopLossForSide(side, entry, sl),
    [side, entry, sl],
  );

  const suggestedSl = useMemo(
    () => suggestStopLossForSide(side, entry, sym),
    [side, entry, sym],
  );

  const aiInsightFrozen = useMemo(
    () => ({
      signal: snap?.aiSignal ?? 'SKIP',
      confidence: snap?.aiConfidence ?? 0,
    }),
    [snap?.aiConfidence, snap?.aiSignal],
  );

  const aiConflict = useMemo(
    () => assessAiOrderConflict(side, aiInsightFrozen),
    [side, aiInsightFrozen],
  );

  const sizing = useMemo(() => {
    if (!slValidation.valid || entry == null || sl == null || !snap) return null;
    return calculateLotSize({
      balance: snap.balance,
      riskPercent: risk,
      entryPrice: entry,
      stopLossPrice: sl,
      symbol: sym,
    });
  }, [entry, risk, sl, slValidation.valid, snap, sym]);

  const checklistItems = useMemo(() => {
    const aiLabel =
      aiConflict.conflict && aiConflict.severity === 'strong'
        ? `Conflit IA : vous ${side} alors que l’IA recommande ${aiConflict.signal} (${aiConflict.confidence} %) — j’ai lu le conseil`
        : `Score IA : ${aiInsightFrozen.signal} (${aiInsightFrozen.confidence} %) — j’ai lu le conseil`;

    return [
      {
        id: 'readAi',
        label: aiLabel,
        highlight: aiConflict.conflict ? 'amber' : null,
      },
      {
        id: 'acceptRisk',
        label:
          risk > 2
            ? `Risque élevé : ${risk} % — je confirme volontairement`
            : `Risque paramétré : ${risk} % par trade (~${sizing?.riskAmount ?? '—'} $ max)`,
        highlight: risk > 2 ? 'amber' : null,
      },
    ];
  }, [aiConflict, aiInsightFrozen, risk, side, sizing]);

  if (!pendingPreTradeSide || !snap) return null;

  const liveBlockers = [];
  if (killSwitchActive) liveBlockers.push('Kill Switch actif');
  if (propGuard.blocked) liveBlockers.push(...(propGuard.reasons ?? []).slice(0, 2));

  const slOk = slValidation.valid;
  const aiOk = checked.readAi && (!aiConflict.conflict || checked.acceptAgainstAi);
  const riskOk = checked.acceptRisk;

  const checksOk =
    slOk && riskOk && aiOk && sizing?.valid !== false;

  const confirmDisabled = busy || liveBlockers.length > 0 || !checksOk;

  const missingForConfirm = [];
  if (!slOk) missingForConfirm.push('stop loss valide (voir ci-dessous)');
  if (!checked.readAi) missingForConfirm.push('cocher « j’ai lu le conseil IA »');
  if (aiConflict.conflict && !checked.acceptAgainstAi) {
    missingForConfirm.push('cocher « j’assume un ordre contraire à l’IA »');
  }
  if (!checked.acceptRisk) missingForConfirm.push('cocher le risque paramétré');

  const confirmTone =
    side === 'SELL' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500';

  function applySuggestedStopLoss() {
    if (suggestedSl == null) return;
    patchPreTradeSnapshot({ stopLoss: suggestedSl });
    setActiveStopLoss?.(suggestedSl);
  }

  async function onConfirm() {
    if (confirmDisabled) return;
    setBusy(true);
    setSubmitError('');
    try {
      if (skipNext) {
        setSkipPreTradeChecklist(true);
      }
      const result = await confirmPreTradeOrder();
      if (result && result.ok === false) {
        setSubmitError(result.error ?? 'Ordre refusé.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950 p-4 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Checklist pré-ordre</h2>
            <p className="text-xs text-slate-500">
              <span className={side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}>{side}</span> ·{' '}
              {sym} @ ~{Number(entry ?? 0).toFixed(2)}
            </p>
            <p className="mt-0.5 text-[10px] text-sky-500/80">
              Cochez les cases actives · le stop loss se valide automatiquement (pas une case à cocher).
            </p>
          </div>
          <button
            type="button"
            onClick={cancelPreTradeOrder}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          className={`mb-3 rounded-lg border px-3 py-2 text-xs ${
            slOk
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
              : 'border-rose-500/40 bg-rose-500/10 text-rose-100'
          }`}
        >
          <div className="flex items-start gap-2">
            {slOk ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            )}
            <div className="min-w-0 flex-1">
              {slOk ? (
                <p>
                  Stop loss OK ({Number(sl).toFixed(2)}) · distance{' '}
                  {slValidation.distance?.toFixed(2) ?? '—'}
                </p>
              ) : (
                <>
                  <p className="font-medium">{slValidation.message}</p>
                  <p className="mt-1 text-[10px] text-rose-200/80">
                    Glissez la ligne orange sur le graphique, puis « Actualiser », ou corrigez en un clic
                    ci-dessous.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={refreshPreTradeSnapshot}
                      className="rounded-md border border-slate-600 px-2 py-1 text-[10px] text-slate-200 hover:border-sky-500/50"
                    >
                      Actualiser depuis le graphique
                    </button>
                    {suggestedSl != null && (
                      <button
                        type="button"
                        onClick={applySuggestedStopLoss}
                        className="rounded-md border border-emerald-600/50 bg-emerald-600/20 px-2 py-1 text-[10px] text-emerald-100 hover:bg-emerald-600/30"
                      >
                        Corriger SL → {suggestedSl.toFixed(2)}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {sizing?.valid && (
          <div className="mb-3 grid grid-cols-3 gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-2 py-2 text-center text-[10px] tabular-nums">
            <div>
              <p className="text-slate-500">Lot</p>
              <p className="font-semibold text-sky-300">{sizing.lotSize}</p>
            </div>
            <div>
              <p className="text-slate-500">Distance SL</p>
              <p className="font-semibold text-slate-200">{sizing.stopDistance}</p>
            </div>
            <div>
              <p className="text-slate-500">Perte théo.</p>
              <p className="font-semibold text-amber-200/90">{sizing.theoreticalLoss} $</p>
            </div>
          </div>
        )}

        {aiConflict.conflict && (
          <div
            className={`mb-3 rounded-lg border px-3 py-2 text-xs ${
              aiConflict.severity === 'strong'
                ? 'border-rose-500/50 bg-rose-500/10 text-rose-100'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-100'
            }`}
          >
            <ShieldAlert className="mr-1 inline h-3.5 w-3.5" />
            L’IA penche pour{' '}
            <strong className="font-semibold">{aiConflict.signal}</strong> ({aiConflict.confidence}{' '}
            %). Un {side} va à l’encontre du score — vérifiez votre plan.
          </div>
        )}

        {liveBlockers.length > 0 && (
          <div className="mb-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
            {liveBlockers.join(' · ')}
          </div>
        )}

        <ul className="space-y-2">
          {checklistItems.map((item) => (
            <li key={item.id}>
              <label
                className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
                  item.highlight === 'amber'
                    ? 'border-amber-500/30 bg-amber-500/5 text-amber-100'
                    : 'border-slate-800 bg-slate-900/50 text-slate-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={Boolean(checked[item.id])}
                  onChange={(e) =>
                    setChecked((c) => ({ ...c, [item.id]: e.target.checked }))
                  }
                  className="mt-0.5"
                />
                <span>{item.label}</span>
              </label>
            </li>
          ))}
        </ul>

        {aiConflict.conflict && (
          <label className="mt-2 flex cursor-pointer items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-[11px] text-rose-100">
            <input
              type="checkbox"
              checked={checked.acceptAgainstAi}
              onChange={(e) =>
                setChecked((c) => ({ ...c, acceptAgainstAi: e.target.checked }))
              }
              className="mt-0.5"
            />
            J’assume un ordre contraire à l’IA ({aiConflict.signal} {aiConflict.confidence} %)
          </label>
        )}

        {confirmDisabled && missingForConfirm.length > 0 && !liveBlockers.length && (
          <p className="mt-2 text-[10px] leading-snug text-amber-200/90">
            Pour activer « Confirmer » : {missingForConfirm.join(' · ')}.
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-500">
            <input type="checkbox" checked={skipNext} onChange={(e) => setSkipNext(e.target.checked)} />
            Ne plus afficher (Paramètres)
          </label>
          <button
            type="button"
            onClick={refreshPreTradeSnapshot}
            className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-400 hover:border-sky-500/40 hover:text-sky-300"
          >
            <RefreshCw className="h-3 w-3" />
            Actualiser le plan
          </button>
        </div>

        {submitError && <p className="mt-2 text-[11px] text-rose-300">{submitError}</p>}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={cancelPreTradeOrder}
            className="flex-1 rounded-lg border border-slate-700 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={confirmDisabled}
            onClick={() => void onConfirm()}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold text-white disabled:opacity-40 ${confirmTone}`}
            title={
              confirmDisabled && missingForConfirm.length
                ? missingForConfirm.join(' · ')
                : undefined
            }
          >
            {busy ? 'Envoi…' : `Confirmer ${side}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(PreTradeChecklistModalInner);
