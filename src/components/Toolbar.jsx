import { Activity, BookOpen, Database, Settings2 } from 'lucide-react';
import { useTrading } from '../context/TradingContext.jsx';

const SYMBOLS = ['XAUUSD', 'NAS100'];
const TIMEFRAMES = ['1m', '5m', '15m', '1h', '1D'];

function StatusDot({ status }) {
  const color =
    status === 'connected' || status === 'ready'
      ? 'bg-emerald-400'
      : status === 'connecting'
        ? 'bg-amber-400 animate-pulse'
        : 'bg-rose-500';
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

function CapitalGauge({ challenge }) {
  const initial = challenge?.initial_balance ?? 0;
  const equity = challenge?.current_equity ?? initial;
  const pct = initial > 0 ? Math.min(100, (equity / initial) * 100) : 0;

  return (
    <div className="hidden min-w-[140px] flex-col gap-1 md:flex">
      <div className="flex justify-between text-[10px] uppercase tracking-wide text-slate-500">
        <span>Capital</span>
        <span className="tabular-nums text-slate-300">
          {equity.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} $
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function Toolbar() {
  const {
    symbol,
    setSymbol,
    timeframe,
    setTimeframe,
    dbStatus,
    workerStatus,
    challenge,
    setSettingsOpen,
    analyticsOpen,
    setAnalyticsOpen,
    setTutorialOpen,
  } = useTrading();

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-slate-800 bg-slate-950/90 px-3">
      <div className="flex items-center gap-2 pr-3">
        <Activity className="h-5 w-5 text-emerald-400" aria-hidden />
        <span className="text-sm font-semibold tracking-tight text-slate-100">NexaTrader</span>
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/80 p-0.5">
        {SYMBOLS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSymbol(s)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              symbol === s
                ? 'bg-slate-700 text-emerald-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/80 p-0.5">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            type="button"
            onClick={() => setTimeframe(tf)}
            className={`rounded-md px-2 py-1 text-xs font-medium ${
              timeframe === tf
                ? 'bg-slate-700 text-sky-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-4">
        <CapitalGauge challenge={challenge} />

        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5" />
            <StatusDot status={dbStatus} />
            SQLite
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="font-mono text-[10px]">WK</span>
            <StatusDot status={workerStatus} />
            Worker
          </span>
        </div>

        <button
          type="button"
          onClick={() => setTutorialOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300 hover:border-emerald-500/40 hover:text-emerald-200"
        >
          <BookOpen className="h-3.5 w-3.5" />
          Tutoriel
        </button>

        <button
          type="button"
          onClick={() => setAnalyticsOpen((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${
            analyticsOpen
              ? 'border-sky-500/50 bg-sky-500/15 text-sky-200'
              : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
          }`}
        >
          📊 Analytics
        </button>

        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300 hover:border-slate-500 hover:text-white"
          aria-label="Paramètres"
        >
          <Settings2 className="h-3.5 w-3.5" />
          Paramètres
        </button>
      </div>
    </header>
  );
}
