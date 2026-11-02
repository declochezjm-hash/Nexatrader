import { memo, useEffect, useState } from 'react';
import { BookOpen, ShieldAlert, Sparkles, Trophy } from 'lucide-react';
import { getChallengeWgfProgram } from '../lib/wgfPrograms.js';
import { describeNextWgfPhase, computeProfitProgress } from '../lib/wgfProfitTarget.js';
import { computeWgfComplianceStatus } from '../lib/wgfCompliance.js';
import { isOneDayPassEnabled } from '../lib/wgfOneDayPass.js';
import {
  challengeUsesDailyGmtReset,
  formatGmtCountdown,
  msUntilNextGmtMidnight,
} from '../lib/wgfDailyReset.js';
import {
  challengeUsesEodTrailing,
  computeEodDrawdownMetrics,
} from '../lib/wgfEodTrailing.js';
import { useTradingSession } from '../context/TradingContext.jsx';
import DisciplineScoreCard from './DisciplineScoreCard.jsx';
import TradingPanel from './TradingPanel.jsx';
import TipsBanner from './TipsBanner.jsx';
import StableAiInsight from './StableAiInsight.jsx';
import TradingStatusBanner from './TradingStatusBanner.jsx';
import WgfWhatIfPanel from './WgfWhatIfPanel.jsx';
import WgfPhaseReadinessPanel from './WgfPhaseReadinessPanel.jsx';
import PropGuardReplayPanel from './PropGuardReplayPanel.jsx';
import WgfProgramPreparationPanel from './WgfProgramPreparationPanel.jsx';
import LocalSocialCard from './LocalSocialCard.jsx';

function GaugeBar({ label, value, max, tone = 'emerald' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const bar =
    tone === 'rose'
      ? 'bg-gradient-to-r from-rose-600 to-rose-400'
      : tone === 'emerald'
        ? 'bg-gradient-to-r from-emerald-600 to-emerald-400'
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

function DailyGmtResetInfo({ challenge }) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  if (!challengeUsesDailyGmtReset(challenge)) return null;

  const base = challenge?.starting_daily_balance ?? challenge?.initial_balance ?? 0;
  const countdown = formatGmtCountdown(msUntilNextGmtMidnight(new Date(nowMs)));

  return (
    <p className="-mt-2 text-[10px] leading-snug text-slate-500">
      Reset journalier WGF à 00:00 GMT · base du jour{' '}
      <span className="tabular-nums text-slate-300">
        {Number(base).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} $
      </span>
      · prochain reset dans {countdown}
    </p>
  );
}

function EodTrailingInfo({ challenge, propGuard }) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  if (!challengeUsesEodTrailing(challenge)) return null;

  const equity = Number(challenge?.current_equity ?? challenge?.initial_balance ?? 0);
  const metrics = computeEodDrawdownMetrics(challenge, equity);
  const floor = propGuard.eodFloor ?? metrics.eodFloor;
  const maxPct = metrics.maxLossPercent;
  const consumed = Math.max(0, Number((maxPct - metrics.marginPctOfInitial).toFixed(2)));
  const countdown = formatGmtCountdown(msUntilNextGmtMidnight(new Date(nowMs)));

  return (
    <div className="space-y-2">
      <GaugeBar label="Buffer EOD consommé" value={consumed} max={maxPct} tone="rose" />
      <p className="text-[10px] leading-snug text-slate-500">
        Plancher EOD{' '}
        <span className="tabular-nums text-slate-300">
          {Number(floor).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} $
        </span>
        · marge{' '}
        <span className="tabular-nums text-slate-300">
          {metrics.marginDollars.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} $
        </span>
        {metrics.lockedAtInitial ? (
          <span className="text-emerald-400/90"> · verrouillé à la balance initiale</span>
        ) : null}
        · prochain recalcul EOD dans {countdown}
      </p>
    </div>
  );
}

function WgfCompliancePanel({ challenge, trades }) {
  const program = getChallengeWgfProgram(challenge);
  if (program.minTradingDays == null && program.consistencyPercent == null) {
    return null;
  }

  const equity = Number(challenge?.current_equity ?? challenge?.initial_balance ?? 0);
  const status = computeWgfComplianceStatus(challenge, trades, equity);
  const { minDays, consistency } = status;

  return (
    <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        Règles WGF (consistency et jours)
      </p>
      {isOneDayPassEnabled(challenge) ? (
        <p className="rounded border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-[10px] text-violet-200">
          One Day Pass actif — 1 jour GMT minimum · consistency désactivée.
        </p>
      ) : null}
      {minDays.required > 0 ? (
        <>
          <GaugeBar
            label="Jours de trading (GMT)"
            value={minDays.activeDays}
            max={minDays.required}
            tone={minDays.met ? 'emerald' : 'amber'}
          />
          <p className="text-[10px] text-slate-500">
            Comptés sur les jours avec au moins un trade clôturé.
          </p>
        </>
      ) : null}
      {consistency.limit != null && !consistency.noProfitYet ? (
        <GaugeBar
          label="Part du meilleur jour / profit total"
          value={Math.min(consistency.limit, consistency.bestDaySharePct)}
          max={consistency.limit}
          tone={consistency.compliant ? 'emerald' : 'rose'}
        />
      ) : consistency.limit != null ? (
        <p className="text-[10px] text-slate-500">
          Consistency max {consistency.limit} % — calculée dès que le profit net est positif.
        </p>
      ) : null}
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
    advanceWgfPhase,
    trades,
  } = useTradingSession();

  const [readingMode, setReadingMode] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [sideTab, setSideTab] = useState('trade');
  const tradingPaused =
    killSwitchActive || challenge?.status === 'paused' || challenge?.status === 'passed';
  const wgfProgram = getChallengeWgfProgram(challenge);
  const nextPhase = describeNextWgfPhase(challenge);
  const equity = Number(challenge?.current_equity ?? challenge?.initial_balance ?? 0);
  const profitProgress = computeProfitProgress(challenge, equity);
  const complianceStatus = computeWgfComplianceStatus(challenge, trades, equity);
  const profitPendingPass =
    challenge?.status === 'active' &&
    profitProgress.reached &&
    !complianceStatus.readyForPass;

  return (
    <aside className="flex h-full min-h-0 w-full flex-col bg-slate-950/80">
      <div className="shrink-0 border-b border-slate-800 bg-slate-900/50 px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight text-slate-100">PropGuard Ultra</h2>
            <p className="truncate text-[10px] text-slate-500">
              {wgfProgram.shortLabel} ·{' '}
              <span className={propGuard.wgfOfficial ? 'text-emerald-400' : 'text-amber-400'}>
                {propGuard.wgfOfficial ? 'WGF strict' : 'Conservateur'}
              </span>
              {Number(settings?.auto_pilot) === 1 ? (
                <span className="text-sky-400"> · Auto-Pilot</span>
              ) : null}
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
            title="Mode lecture — fige score IA et lot"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Lecture
          </button>
        </div>
        <nav className="mt-2 flex gap-0.5 rounded-lg bg-slate-950/80 p-0.5 ring-1 ring-slate-800/80">
          {[
            { id: 'trade', label: 'Trading' },
            { id: 'wgf', label: 'WGF' },
            { id: 'tools', label: 'Outils' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSideTab(t.id)}
              className={`flex-1 rounded-md py-1.5 text-[10px] font-semibold uppercase tracking-wide transition ${
                sideTab === t.id
                  ? 'bg-slate-800 text-emerald-300 shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        {challenge?.status === 'failed' && (
          <div className="shrink-0 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            Challenge FAILED — {challenge.failure_reason}
          </div>
        )}

        {challenge?.status === 'passed' && (
          <div className="shrink-0 space-y-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
            <div className="flex items-center gap-1.5 font-medium text-emerald-200">
              <Trophy className="h-4 w-4 shrink-0" />
              Phase validée
            </div>
            <p className="text-emerald-100/90">{challenge.pass_reason}</p>
            {nextPhase ? (
              <button
                type="button"
                disabled={advancing}
                onClick={() => {
                  setAdvancing(true);
                  void advanceWgfPhase().finally(() => setAdvancing(false));
                }}
                className="w-full rounded-lg border border-emerald-400/50 bg-emerald-500/20 py-2 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-50"
              >
                {advancing ? 'Transition…' : `Passer à ${nextPhase.label}`}
              </button>
            ) : null}
          </div>
        )}

        {profitPendingPass ? (
          <div className="shrink-0 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            <p className="font-medium text-amber-200">Objectif % — validation en attente</p>
            <ul className="mt-1 list-inside list-disc text-[11px] text-amber-100/90">
              {complianceStatus.blockingReasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {sideTab === 'trade' && (
          <>
            <TradingStatusBanner
              killSwitchActive={killSwitchActive}
              tradingPaused={tradingPaused}
              blocked={propGuard.blocked && !killSwitchActive}
              reasons={propGuard.reasons}
              onResume={() => resumeKillSwitch()}
            />

            <TradingPanel readingMode={readingMode} />

            {propGuard.profitTargetPct > 0 && challenge?.status !== 'passed' ? (
              <GaugeBar
                label="Objectif de profit WGF"
                value={Math.min(propGuard.profitTargetPct, Math.max(0, propGuard.profitPct))}
                max={propGuard.profitTargetPct}
                tone="emerald"
              />
            ) : null}

            {propGuard.maxDaily != null ? (
              <GaugeBar
                label="Drawdown journalier"
                value={propGuard.dailyDrawdownPct}
                max={propGuard.maxDaily}
                tone="amber"
              />
            ) : (
              <p className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-[11px] text-slate-400">
                Mode EOD trailing ({propGuard.maxOverall} %)
              </p>
            )}
            <EodTrailingInfo challenge={challenge} propGuard={propGuard} />
            <DailyGmtResetInfo challenge={challenge} />
            {!challengeUsesEodTrailing(challenge) ? (
              <GaugeBar
                label="Drawdown total"
                value={propGuard.overallDrawdownPct}
                max={propGuard.maxOverall}
                tone="rose"
              />
            ) : null}

            <StableAiInsight
              insight={aiInsight}
              aiProvider={settings?.ai_provider}
              frozen={readingMode}
            />

            <DisciplineScoreCard discipline={disciplineScore} />

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
                className="sticky bottom-0 flex items-center justify-center gap-2 rounded-xl border-2 border-rose-600 bg-rose-950/90 py-2.5 text-sm font-bold text-rose-200 shadow-lg shadow-rose-950/50 hover:bg-rose-900"
              >
                🚨 KILL SWITCH
              </button>
            )}
          </>
        )}

        {sideTab === 'wgf' && (
          <>
            <WgfCompliancePanel challenge={challenge} trades={trades} />
            <WgfPhaseReadinessPanel challenge={challenge} trades={trades} />
            <WgfProgramPreparationPanel challenge={challenge} trades={trades} />
            <PropGuardReplayPanel challenge={challenge} trades={trades} />
            <LocalSocialCard challenge={challenge} trades={trades} settings={settings} />
            <WgfWhatIfPanel challenge={challenge} trades={trades} />
          </>
        )}

        {sideTab === 'tools' && (
          <>
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
          </>
        )}
      </div>
    </aside>
  );
});
