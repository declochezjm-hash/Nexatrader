import { memo, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Lock,
  Newspaper,
  PauseCircle,
  TrendingDown,
  TrendingUp,
  WifiOff,
  X,
} from 'lucide-react';
import { useTradingMarket, useTradingSession } from '../context/TradingContext.jsx';
import { calculateLotSize } from '../engine/positionSizer.js';
import { GOLD_RULES } from '../engine/goldWickAnalyzer.js';
import { useStableNumeric } from '../hooks/useDebouncedValue.js';

const BADGE_ICON = {
  spread: WifiOff,
  'anti-tilt': PauseCircle,
  news: Newspaper,
  kill: AlertTriangle,
};

const STABLE_MS = 3500;
const STABLE_SL_MS = 2000;

function AlertBadge({ badge }) {
  const Icon = BADGE_ICON[badge.id] ?? AlertTriangle;
  const tone =
    badge.tone === 'rose'
      ? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
      : 'border-amber-500/40 bg-amber-500/10 text-amber-200';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${tone}`}
    >
      <Icon className="h-3 w-3" />
      {badge.label}
    </span>
  );
}

function TradingPanelInner({ readingMode = false }) {
  const { symbol, marketPrice, activeStopLoss } = useTradingMarket();
  const {
    propGuard,
    requestPlaceOrder,
    challenge,
    settings,
    latestChartSignal,
    killSwitchActive,
  } = useTradingSession();

  const [tradePlan, setTradePlan] = useState(null);

  const liveEntry = marketPrice ?? latestChartSignal?.entry ?? 0;
  const stableEntry = useStableNumeric(liveEntry, {
    minIntervalMs: readingMode ? 86_400_000 : STABLE_MS,
    jumpThreshold: 0.35,
  });

  const rawSl =
    activeStopLoss ??
    latestChartSignal?.stopLoss ??
    null;
  const stableSl = useStableNumeric(rawSl, {
    minIntervalMs: readingMode ? 86_400_000 : STABLE_SL_MS,
    jumpThreshold: 0.15,
  });

  const side = latestChartSignal?.direction === 'SELL' ? 'SELL' : 'BUY';

  const entry = tradePlan?.entry ?? stableEntry;
  const stopLoss =
    tradePlan?.stopLoss ??
    stableSl ??
    (side === 'BUY'
      ? entry - GOLD_RULES.slBufferDollars - 2
      : entry + GOLD_RULES.slBufferDollars + 2);

  const sizing = useMemo(() => {
    if (tradePlan?.sizing) return tradePlan.sizing;
    if (!entry || !stopLoss) return null;
    return calculateLotSize({
      balance: challenge?.current_equity ?? challenge?.initial_balance ?? 0,
      riskPercent: settings?.default_risk_percent ?? 1,
      entryPrice: entry,
      stopLossPrice: stopLoss,
      symbol,
    });
  }, [challenge, entry, settings, stopLoss, symbol, tradePlan?.sizing]);

  const disabled = propGuard.blocked || killSwitchActive;
  const disableReason = killSwitchActive
    ? 'Kill Switch actif — cliquez « Reprendre le trading »'
    : propGuard.reasons?.[0] ?? 'PropGuard bloque l’ordre';

  const displayBadges = useMemo(
    () => propGuard.badges?.filter((b) => !(killSwitchActive && b.id === 'kill')) ?? [],
    [propGuard.badges, killSwitchActive],
  );

  const liveDrift =
    !tradePlan &&
    !readingMode &&
    (Math.abs(liveEntry - stableEntry) > 0.08 ||
      (rawSl != null && stableSl != null && Math.abs(rawSl - stableSl) > 0.08));

  function capturePlan() {
    if (!sizing || !entry) return;
    setTradePlan({
      entry: Number(entry.toFixed(2)),
      stopLoss: Number(stopLoss.toFixed(2)),
      sizing: { ...sizing },
      side,
      capturedAt: Date.now(),
    });
  }

  const slDistanceLabel =
    symbol === 'XAUUSD'
      ? `${sizing?.stopDistance ?? '—'} $`
      : `${sizing?.stopDistance ?? '—'} pts`;

  return (
    <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {displayBadges.length ? (
            displayBadges.map((b) => <AlertBadge key={b.id} badge={b} />)
          ) : (
            <span className="text-[10px] text-emerald-400/80">Compliance OK</span>
          )}
        </div>
        <button
          type="button"
          onClick={capturePlan}
          title="Figer entrée, SL et lot pour lecture"
          className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-0.5 text-[10px] text-slate-400 hover:border-sky-500/40 hover:text-sky-300"
        >
          <Camera className="h-3 w-3" />
          Capturer
        </button>
      </div>

      {tradePlan && (
        <div className="flex items-start justify-between gap-2 rounded-lg border border-sky-500/30 bg-sky-500/5 px-2 py-1.5 text-[10px] text-sky-200/90">
          <p>
            <Lock className="mr-1 inline h-3 w-3" />
            Plan figé · {tradePlan.side} @ {tradePlan.entry} · SL {tradePlan.stopLoss} ·{' '}
            {tradePlan.sizing.lotSize} lots
          </p>
          <button
            type="button"
            onClick={() => setTradePlan(null)}
            className="shrink-0 rounded p-0.5 text-sky-400/70 hover:text-sky-200"
            aria-label="Effacer le plan capturé"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 px-3 py-2 text-[11px]">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="font-medium uppercase tracking-wide text-slate-500">Taille de lot</p>
          {(readingMode || tradePlan) && (
            <span className="text-[9px] uppercase tracking-wide text-sky-500/80">Stable</span>
          )}
        </div>
        {sizing ? (
          <div className="space-y-0.5 tabular-nums text-slate-200">
            <p>
              <span className="text-slate-400">Lots :</span>{' '}
              <span className="text-lg font-semibold text-sky-300">{sizing.lotSize}</span>
            </p>
            <p className="text-slate-500">
              Entrée ~{Number(entry).toFixed(2)} · Risque {settings?.default_risk_percent ?? 1}% →{' '}
              {sizing.riskAmount} $ · Distance SL {slDistanceLabel}
            </p>
            <p className="text-slate-500">Perte théorique max : {sizing.theoreticalLoss} $</p>
            {liveDrift && (
              <p className="text-[10px] text-slate-600">
                Marché live en mouvement — affichage stabilisé toutes les ~{STABLE_MS / 1000}s
              </p>
            )}
          </div>
        ) : (
          <p className="text-slate-500">En attente du prix / SL graphique…</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={disabled}
          title={disabled ? disableReason : 'Achat simulé'}
          onClick={() => requestPlaceOrder('BUY')}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
        >
          <TrendingUp className="h-4 w-4" />
          ACHAT
        </button>
        <button
          type="button"
          disabled={disabled}
          title={disabled ? disableReason : 'Vente simulée'}
          onClick={() => requestPlaceOrder('SELL')}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
        >
          <TrendingDown className="h-4 w-4" />
          VENTE
        </button>
      </div>

      {disabled && (
        <p className="text-center text-[10px] leading-snug text-amber-300/90">{disableReason}</p>
      )}
    </div>
  );
}

export default memo(TradingPanelInner);
