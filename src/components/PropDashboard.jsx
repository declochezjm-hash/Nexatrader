import { memo, useState } from 'react';
import { BookOpen, ShieldAlert, Sparkles } from 'lucide-react';
import { useTradingSession } from '../context/TradingContext.jsx';
import DisciplineScoreCard from './DisciplineScoreCard.jsx';
import TradingPanel from './TradingPanel.jsx';
import TipsBanner from './TipsBanner.jsx';
import StableAiInsight from './StableAiInsight.jsx';
import TradingStatusBanner from './TradingStatusBanner.jsx';

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

export default memo(function PropDashboard() {
  const {
    propGuard,
    aiInsight,
    executeKillSwitch,
    resumeKillSwitch,
    killSwitchActive,
    challenge,
    settings,
    requestDailySummary,
    coachBusy,
    disciplineScore,
  } = useTradingSession();

  const [readingMode, setReadingMode] = useState(true);
  const tradingPaused = killSwitchActive || challenge?.status === 'paused';

  return (
    <aside className="flex h-full min-h-0 w-full flex-col bg-slate-950/80">
      <div className="flex items-start justify-between gap-2 border-b border-slate-800 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">PropGuard Ultra</h2>
          <p className="text-[11px] text-slate-500">
            WGF · IA contextuelle ·{' '}
            {Number(settings?.auto_pilot) === 1 ? (
              <span className="text-sky-400">Auto-Pilot ON</span>
            ) : (
              <span className="text-slate-600">Ctrl+Shift+K Kill</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setReadingMode((v) => !v)}
          className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[10px] ${
            readingMode
              ? 'border-sky-500/50 bg-sky-500/15 text-sky-200'
              : 'border-slate-700 text-slate-400 hover:text-slate-200'
          }`}
          title="Figé : score IA et lot ralentis. Désactivez pour suivre le marché tick par tick."
        >
          <BookOpen className="h-3.5 w-3.5" />
          Lecture
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {challenge?.status === 'failed' && (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            Challenge FAILED — {challenge.failure_reason}
          </div>
        )}

        <TradingStatusBanner
          killSwitchActive={killSwitchActive}
          tradingPaused={tradingPaused}
          blocked={propGuard.blocked && !killSwitchActive}
          reasons={propGuard.reasons}
          onResume={() => resumeKillSwitch()}
        />

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

        <DisciplineScoreCard discipline={disciplineScore} />

        <StableAiInsight
          insight={aiInsight}
          aiProvider={settings?.ai_provider}
          frozen={readingMode}
        />

        <button
          type="button"
          disabled={coachBusy}
          onClick={() => void requestDailySummary()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-violet-500/35 bg-violet-500/10 py-2 text-xs font-medium text-violet-200 hover:border-violet-400/50 disabled:opacity-40"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Résumé journalier IA
        </button>

        <TipsBanner />

        <TradingPanel readingMode={readingMode} />

        {propGuard.blocked && !killSwitchActive && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            <div className="mb-1 flex items-center gap-1.5 font-medium">
              <ShieldAlert className="h-3.5 w-3.5" />
              Détails PropGuard
            </div>
            <ul className="list-inside list-disc space-y-0.5 text-amber-100/90">
              {propGuard.reasons
                .filter((r) => !/kill switch/i.test(r))
                .map((r) => (
                  <li key={r}>{r}</li>
                ))}
            </ul>
          </div>
        )}

        {!tradingPaused && (
          <button
            type="button"
            onClick={() => executeKillSwitch()}
            className="mt-auto flex items-center justify-center gap-2 rounded-xl border-2 border-rose-600 bg-rose-950/80 py-3 text-sm font-bold text-rose-200 transition hover:bg-rose-900"
          >
            🚨 KILL SWITCH
          </button>
        )}
      </div>
    </aside>
  );
});
