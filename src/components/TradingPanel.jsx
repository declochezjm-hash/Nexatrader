import { AlertTriangle, Newspaper, PauseCircle, TrendingDown, TrendingUp, WifiOff } from 'lucide-react';
import { useMemo } from 'react';
import { useTrading } from '../context/TradingContext.jsx';
import { calculateLotSize } from '../engine/positionSizer.js';
import { GOLD_RULES } from '../engine/goldWickAnalyzer.js';

const BADGE_ICON = {
  spread: WifiOff,
  'anti-tilt': PauseCircle,
  news: Newspaper,
};

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

export default function TradingPanel() {
  const {
    propGuard,
    placeOrder,
    symbol,
    challenge,
    settings,
    marketPrice,
    activeStopLoss,
    latestChartSignal,
    killSwitchActive,
  } = useTrading();

  const disabled = propGuard.blocked || killSwitchActive;

  const side = latestChartSignal?.direction === 'SELL' ? 'SELL' : 'BUY';
  const entry = marketPrice ?? latestChartSignal?.entry ?? 0;
  const stopLoss =
    activeStopLoss ??
    latestChartSignal?.stopLoss ??
    (side === 'BUY' ? entry - GOLD_RULES.slBufferDollars - 2 : entry + GOLD_RULES.slBufferDollars + 2);

  const sizing = useMemo(() => {
    if (!entry || !stopLoss) return null;
    return calculateLotSize({
      balance: challenge?.current_equity ?? challenge?.initial_balance ?? 0,
      riskPercent: settings?.default_risk_percent ?? 1,
      entryPrice: entry,
      stopLossPrice: stopLoss,
      symbol,
    });
  }, [challenge, entry, settings, stopLoss, symbol]);

  return (
    <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
      <div className="flex flex-wrap gap-1.5">
        {propGuard.badges?.length ? (
          propGuard.badges.map((b) => <AlertBadge key={b.id} badge={b} />)
        ) : (
          <span className="text-[10px] text-emerald-400/80">Compliance OK</span>
        )}
      </div>

      <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 px-3 py-2 text-[11px]">
        <p className="mb-1 font-medium uppercase tracking-wide text-slate-500">Taille de lot</p>
        {sizing ? (
          <div className="space-y-0.5 tabular-nums text-slate-200">
            <p>
              <span className="text-slate-400">Lots :</span>{' '}
              <span className="text-lg font-semibold text-sky-300">{sizing.lotSize}</span>
            </p>
            <p className="text-slate-500">
              Risque {settings?.default_risk_percent ?? 1}% → {sizing.riskAmount}$ · SL{' '}
              {sizing.stopDistance}
              {symbol === 'XAUUSD' ? '$' : ' pts'}
            </p>
            <p className="text-slate-500">Perte théorique max : {sizing.theoreticalLoss}$</p>
          </div>
        ) : (
          <p className="text-slate-500">En attente du prix / SL graphique…</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => placeOrder('BUY')}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
        >
          <TrendingUp className="h-4 w-4" />
          ACHAT
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => placeOrder('SELL')}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
        >
          <TrendingDown className="h-4 w-4" />
          VENTE
        </button>
      </div>
    </div>
  );
}
