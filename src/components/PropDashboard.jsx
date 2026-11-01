import { ShieldAlert } from 'lucide-react';
import { useTrading } from '../context/TradingContext.jsx';
import { geminiProviderLabel } from '../lib/geminiModels.js';
import TradingPanel from './TradingPanel.jsx';
import TipsBanner from './TipsBanner.jsx';

function GaugeBar({ label, value, max, tone = 'emerald' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const bar =
    tone === 'rose'
      ? 'bg-gradient-to-r from-rose-600 to-rose-400'
      : 'bg-gradient-to-r from-amber-600 to-amber-400';

  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px]">
        <span className="text-slate-400">{label}</span>
        <span className="tabular-nums text-slate-300">
          {value.toFixed(2)} % / {max} %
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function scoreTone(confidence) {
  if (confidence >= 75) return { bar: 'bg-emerald-400', text: 'text-emerald-300', ring: 'ring-emerald-500/30' };
  if (confidence >= 50) return { bar: 'bg-amber-400', text: 'text-amber-300', ring: 'ring-amber-500/30' };
  return { bar: 'bg-rose-500', text: 'text-rose-300', ring: 'ring-rose-500/30' };
}

function AiInsightCard({ insight, aiProvider }) {
  const confidence = insight.confidence ?? 0;
  const tone = scoreTone(confidence);
  const signalStyles = {
    BUY: 'bg-emerald-500/20 text-emerald-300',
    SELL: 'bg-rose-500/20 text-rose-300',
    SKIP: 'bg-slate-700/80 text-slate-300',
  };

  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-950/60 p-3 ring-1 ${tone.ring}`}>
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">
            {geminiProviderLabel(aiProvider)}
            {insight.source === 'sqlite' && (
              <span className="ml-1 text-slate-600">· fallback SQLite</span>
            )}
          </p>
          <p className={`text-2xl font-semibold tabular-nums ${tone.text}`}>{confidence} %</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${signalStyles[insight.signal] ?? signalStyles.SKIP}`}
        >
          {insight.signal}
        </span>
      </div>
      <div className="mb-2 h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full transition-all duration-500 ${tone.bar}`}
          style={{ width: `${Math.min(100, confidence)}%` }}
        />
      </div>
      <p className="text-[11px] leading-relaxed text-slate-400">
        {insight.advice ?? 'Analyse en cours…'}
      </p>
    </div>
  );
}

export default function PropDashboard() {
  const {
    propGuard,
    aiInsight,
    executeKillSwitch,
    resumeKillSwitch,
    killSwitchActive,
    challenge,
    settings,
  } = useTrading();

  const tradingPaused = killSwitchActive || challenge?.status === 'paused';

  return (
    <aside className="flex w-[320px] shrink-0 flex-col border-l border-slate-800 bg-slate-950/80">
      <div className="border-b border-slate-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-100">PropGuard Ultra</h2>
        <p className="text-[11px] text-slate-500">
          WGF · IA contextuelle ·{' '}
          {Number(settings?.auto_pilot) === 1 ? (
            <span className="text-sky-400">Auto-Pilot ON (≥80%)</span>
          ) : (
            <span className="text-slate-600">Ctrl+Shift+K Kill</span>
          )}
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {challenge?.status === 'failed' && (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            Challenge FAILED — {challenge.failure_reason}
          </div>
        )}

        <GaugeBar
          label="Drawdown journalier"
          value={propGuard.dailyDrawdownPct}
          max={propGuard.maxDaily}
          tone="amber"
        />
        <GaugeBar
          label="Drawdown total"
          value={propGuard.overallDrawdownPct}
          max={propGuard.maxOverall}
          tone="rose"
        />

        <AiInsightCard insight={aiInsight} aiProvider={settings?.ai_provider} />

        <TipsBanner />

        <TradingPanel />

        {propGuard.blocked && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            <div className="mb-1 flex items-center gap-1.5 font-medium">
              <ShieldAlert className="h-3.5 w-3.5" />
              Exécution bloquée
            </div>
            <ul className="list-inside list-disc space-y-0.5 text-amber-100/90">
              {propGuard.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        {tradingPaused ? (
          <button
            type="button"
            onClick={() => resumeKillSwitch()}
            className="mt-auto flex items-center justify-center gap-2 rounded-xl border-2 border-emerald-600 bg-emerald-950/50 py-3 text-sm font-bold text-emerald-100 transition hover:bg-emerald-900/80"
          >
            Reprendre le trading
          </button>
        ) : (
          <button
            type="button"
            onClick={() => executeKillSwitch()}
            className="mt-auto flex items-center justify-center gap-2 rounded-xl border-2 border-rose-600 bg-rose-950/80 py-3 text-sm font-bold text-rose-200 transition hover:bg-rose-900"
          >
            🚨 KILL SWITCH
          </button>
        )}
        {tradingPaused && (
          <p className="text-center text-[11px] text-amber-300">
            Pause sécurisée — cliquez « Reprendre le trading » pour réactiver ACHAT / VENTE.
          </p>
        )}
      </div>
    </aside>
  );
}
