import { computeEquityFromTrades, computeDrawdowns, shouldFailChallenge } from '../engine/propGuard.js';
import { computeWgfComplianceStatus } from './wgfCompliance.js';
import {
  challengeUsesEodTrailing,
  computeEodDrawdownMetrics,
} from './wgfEodTrailing.js';
import { computeProfitProgress, evaluateProfitTargetPass } from './wgfProfitTarget.js';
import { getGmtDateKey } from './wgfDailyReset.js';
import { WGF_PROGRAM_LIST, limitsForProgram } from './wgfPrograms.js';

/**
 * PnL $ correspondant à un % de la balance initiale du challenge.
 * @param {object|null|undefined} challenge
 * @param {number} percentDelta
 */
export function pnlForBalancePercent(challenge, percentDelta) {
  const initial = Number(challenge?.initial_balance ?? 0);
  return Number((initial * (percentDelta / 100)).toFixed(2));
}

/**
 * Scénario what-if : PnL supplémentaire (réalisé) sans modifier SQLite.
 * @param {object} params
 * @param {object|null|undefined} params.challenge
 * @param {Array<object>} [params.trades]
 * @param {number} [params.additionalPnl]
 * @param {boolean} [params.countAsTradingDay]
 * @param {Date} [params.scenarioDate]
 */
export function runWgfWhatIfScenario({
  challenge,
  trades = [],
  additionalPnl = 0,
  countAsTradingDay = true,
  scenarioDate = new Date(),
}) {
  if (!challenge?.id) {
    return { ok: false, error: 'Aucun challenge actif pour la simulation.' };
  }

  const currentEquity = computeEquityFromTrades(challenge, trades);
  const projectedEquity = Number((currentEquity + additionalPnl).toFixed(2));
  const projectedChallenge = { ...challenge, current_equity: projectedEquity };

  let projectedTrades = [...trades];
  if (additionalPnl !== 0 || countAsTradingDay) {
    projectedTrades.push({
      id: '__whatif__',
      status: 'closed',
      pnl: additionalPnl,
      created_at: scenarioDate.toISOString(),
    });
  }

  const profit = computeProfitProgress(projectedChallenge, projectedEquity);
  const compliance = computeWgfComplianceStatus(projectedChallenge, projectedTrades, projectedEquity);
  const fail = shouldFailChallenge(projectedChallenge, projectedEquity);
  const drawdowns = computeDrawdowns(projectedChallenge);

  const canEvaluatePass = ['active', 'paused'].includes(String(challenge.status));
  const passEval = canEvaluatePass
    ? evaluateProfitTargetPass(challenge, projectedEquity, projectedTrades)
    : { pass: false, skipped: challenge.status };

  const eod = challengeUsesEodTrailing(projectedChallenge)
    ? computeEodDrawdownMetrics(projectedChallenge, projectedEquity)
    : null;

  /** @type {Array<{ tone: string, text: string }>} */
  const headlines = [];

  if (fail.fail) {
    headlines.push({ tone: 'rose', text: `Échec WGF probable : ${fail.reason}` });
  } else if (eod && projectedEquity < eod.eodFloor - 0.001) {
    headlines.push({ tone: 'rose', text: 'Sous le plancher EOD simulé.' });
  } else {
    headlines.push({ tone: 'emerald', text: 'Limites de perte : OK dans ce scénario.' });
  }

  if (passEval.pass) {
    headlines.push({ tone: 'emerald', text: passEval.message ?? 'Phase validée (simulation).' });
  } else if (passEval.profitReached) {
    headlines.push({
      tone: 'amber',
      text: passEval.message ?? passEval.blockers?.join(' · ') ?? 'Objectif % atteint, règles en attente.',
    });
  } else if (profit.targetPct > 0) {
    headlines.push({
      tone: 'slate',
      text: `Profit projeté ${profit.profitPct} % / objectif ${profit.targetPct} % (reste ${profit.remainingPct} %).`,
    });
  }

  if (!compliance.readyForPass && profit.reached && canEvaluatePass) {
    for (const b of compliance.blockingReasons) {
      headlines.push({ tone: 'amber', text: b });
    }
  }

  return {
    ok: true,
    currentEquity,
    projectedEquity,
    additionalPnl,
    profit,
    compliance,
    fail,
    passEval,
    drawdowns,
    eod,
    headlines,
    scenarioGmtDay: getGmtDateKey(scenarioDate),
  };
}

/** Presets pédagogiques (% balance initiale). */
export const WGF_WHATIF_PRESETS = [
  { id: 'loss_2', label: '−2 %', percent: -2 },
  { id: 'loss_4', label: '−4 % (1 Step EOD)', percent: -4 },
  { id: 'gain_1', label: '+1 %', percent: 1 },
  { id: 'gain_6', label: '+6 % (1 Step)', percent: 6 },
  { id: 'gain_8', label: '+8 % (2 Step P1)', percent: 8 },
];

/**
 * What-if sur plusieurs programmes WGF (même historique, limites du profil).
 * @param {object} params
 */
export function runWgfWhatIfMultiProgram({
  challenge,
  trades = [],
  additionalPnl = 0,
  countAsTradingDay = true,
  scenarioDate = new Date(),
}) {
  if (!challenge?.id) return [];

  return WGF_PROGRAM_LIST.map((program) => {
    const limits = limitsForProgram(program.id);
    const synthetic = {
      ...challenge,
      wgf_program_id: program.id,
      wgf_phase: program.phase ?? 1,
      profit_target_percent: limits.profit_target_percent,
      max_daily_loss_percent: limits.max_daily_loss_percent,
      max_overall_loss_percent: limits.max_overall_loss_percent,
      one_day_pass: program.id === 'wgf_1step_eval' ? challenge.one_day_pass : 0,
    };
    const scenario = runWgfWhatIfScenario({
      challenge: synthetic,
      trades,
      additionalPnl,
      countAsTradingDay,
      scenarioDate,
    });
    return {
      programId: program.id,
      shortLabel: program.shortLabel,
      scenario,
    };
  });
}
