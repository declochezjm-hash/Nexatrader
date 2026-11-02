import { computeDrawdowns } from '../engine/propGuard.js';
import {
  getChallengeWgfProgram,
  resolveDailyLossLimitPercent,
  resolveOverallLossLimitPercent,
} from './wgfPrograms.js';
import { computeWgfComplianceStatus } from './wgfCompliance.js';
import { isConsistencyDisabledByOneDayPass } from './wgfOneDayPass.js';
import {
  challengeUsesEodTrailing,
  computeEodDrawdownMetrics,
} from './wgfEodTrailing.js';
import { computeProfitProgress } from './wgfProfitTarget.js';

/** @typedef {'ok' | 'warn' | 'pending' | 'fail' | 'na'} WgfReadinessStatus */

/**
 * Checklist unifiée d’avancement WGF (évaluation + funded).
 * @param {object|null|undefined} challenge
 * @param {Array<object>} trades
 * @param {number} [equity]
 */
export function buildWgfPhaseReadiness(challenge, trades = [], equity) {
  if (!challenge?.id) {
    return { items: [], scorePercent: 0, evaluationReady: false, program: null };
  }

  const program = getChallengeWgfProgram(challenge);
  const eq = Number(equity ?? challenge.current_equity ?? challenge.initial_balance ?? 0);
  const profit = computeProfitProgress(challenge, eq);
  const compliance = computeWgfComplianceStatus(challenge, trades, eq);
  const drawdowns = computeDrawdowns({ ...challenge, current_equity: eq });
  const maxDaily = resolveDailyLossLimitPercent(challenge);
  const maxOverall = resolveOverallLossLimitPercent(challenge);

  /** @type {Array<{ id: string, label: string, status: WgfReadinessStatus, detail: string }>} */
  const items = [];

  if (program.kind === 'evaluation' && profit.targetPct > 0) {
    let status = 'pending';
    if (profit.reached) status = 'ok';
    else if (profit.profitPct >= profit.targetPct * 0.85) status = 'warn';
    items.push({
      id: 'profit',
      label: 'Objectif de profit',
      status,
      detail: `${profit.profitPct} % / ${profit.targetPct} %`,
    });
  } else if (program.kind === 'funded') {
    items.push({
      id: 'profit',
      label: 'Objectif de profit',
      status: 'na',
      detail: 'Aucun objectif imposé (compte funded simulé)',
    });
  }

  if (compliance.minDays.required > 0) {
    items.push({
      id: 'days',
      label: 'Jours actifs GMT',
      status: compliance.minDays.met ? 'ok' : 'pending',
      detail: `${compliance.minDays.activeDays} / ${compliance.minDays.required}`,
    });
  }

  const c = compliance.consistency;
  if (isConsistencyDisabledByOneDayPass(challenge)) {
    items.push({
      id: 'consistency',
      label: 'Consistency',
      status: 'na',
      detail: 'Désactivée (One Day Pass)',
    });
  } else if (c.limit != null) {
    if (c.noProfitYet) {
      items.push({
        id: 'consistency',
        label: 'Consistency',
        status: 'pending',
        detail: `Max ${c.limit} % — actif dès profit positif`,
      });
    } else {
      const ratio = c.limit > 0 ? c.bestDaySharePct / c.limit : 0;
      let status = c.compliant ? 'ok' : 'fail';
      if (c.compliant && ratio >= 0.85) status = 'warn';
      items.push({
        id: 'consistency',
        label: 'Consistency',
        status,
        detail: `${c.bestDaySharePct} % / max ${c.limit} %`,
      });
    }
  }

  if (maxDaily != null && maxDaily > 0) {
    const ratio = drawdowns.dailyDrawdownPct / maxDaily;
    let status = 'ok';
    if (ratio >= 1) status = 'fail';
    else if (ratio >= 0.8) status = 'warn';
    items.push({
      id: 'daily_dd',
      label: 'Drawdown journalier',
      status,
      detail: `${drawdowns.dailyDrawdownPct} % / ${maxDaily} %`,
    });
  }

  if (challengeUsesEodTrailing(challenge)) {
    const eod = computeEodDrawdownMetrics(challenge, eq);
    const bufferPct = maxOverall > 0 ? eod.marginPctOfInitial / maxOverall : 1;
    let status = 'ok';
    if (eod.marginDollars <= 0) status = 'fail';
    else if (bufferPct <= 0.25) status = 'warn';
    items.push({
      id: 'eod',
      label: 'Marge plancher EOD',
      status,
      detail: `${eod.marginDollars.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} $ sous plancher`,
    });
  } else if (maxOverall > 0) {
    const ratio = drawdowns.overallDrawdownPct / maxOverall;
    let status = 'ok';
    if (ratio >= 1) status = 'fail';
    else if (ratio >= 0.8) status = 'warn';
    items.push({
      id: 'overall_dd',
      label: 'Drawdown total',
      status,
      detail: `${drawdowns.overallDrawdownPct} % / ${maxOverall} %`,
    });
  }

  const scorable = items.filter((i) => i.status !== 'na');
  const okCount = scorable.filter((i) => i.status === 'ok').length;
  const scorePercent =
    scorable.length > 0 ? Math.round((okCount / scorable.length) * 100) : 100;

  const evaluationReady =
    program.kind === 'evaluation' && profit.reached && compliance.readyForPass;

  return {
    items,
    scorePercent,
    evaluationReady,
    program,
    profit,
    compliance,
    payout: computeFundedPayoutSimulation(challenge, eq),
  };
}

/**
 * Split trader WGF simulé sur le profit net (compte funded).
 * @param {object|null|undefined} challenge
 * @param {number} [equity]
 * @param {number} [traderSharePercent]
 */
export function computeFundedPayoutSimulation(challenge, equity, traderSharePercent = 80) {
  const program = getChallengeWgfProgram(challenge);
  const initial = Number(challenge?.initial_balance ?? 0);
  const eq = Number(equity ?? challenge?.current_equity ?? initial);
  const grossProfit = Math.max(0, eq - initial);
  const share = Math.min(100, Math.max(0, traderSharePercent)) / 100;

  return {
    applies: program.kind === 'funded' || program.kind === 'instant',
    programKind: program.kind,
    grossProfit: Number(grossProfit.toFixed(2)),
    traderSharePercent,
    traderPayout: Number((grossProfit * share).toFixed(2)),
    firmShare: Number((grossProfit * (1 - share)).toFixed(2)),
  };
}

/**
 * Alertes proactives dérivées de l’état WGF (étape 8).
 * @param {object} params
 * @param {object|null|undefined} params.challenge
 * @param {Array<object>} params.trades
 * @param {object} params.propGuard
 */
export function collectWgfProactiveAlerts({ challenge, trades, propGuard }) {
  if (!challenge?.id) return [];

  const readiness = buildWgfPhaseReadiness(
    challenge,
    trades,
    challenge.current_equity ?? challenge.initial_balance,
  );
  /** @type {Array<{ id: string, level: 'warn' | 'critical', title: string, message: string }>} */
  const alerts = [];

  if (
    readiness.profit.reached &&
    !readiness.evaluationReady &&
    readiness.compliance.blockingReasons?.length
  ) {
    alerts.push({
      id: 'wgf:pass-pending',
      level: 'warn',
      title: 'Objectif % atteint — règles en attente',
      message: readiness.compliance.blockingReasons.join(' · '),
    });
  }

  const c = readiness.compliance.consistency;
  if (c.limit != null && !c.noProfitYet && c.compliant && c.bestDaySharePct / c.limit >= 0.85) {
    alerts.push({
      id: 'wgf:consistency-near',
      level: 'warn',
      title: 'Consistency proche du plafond',
      message: `Meilleur jour à ${c.bestDaySharePct} % du profit total (max ${c.limit} %).`,
    });
  }

  if (c.limit != null && !c.noProfitYet && !c.compliant) {
    alerts.push({
      id: 'wgf:consistency-fail',
      level: 'critical',
      title: 'Règle consistency WGF dépassée',
      message: `${c.bestDaySharePct} % > plafond ${c.limit} % — phase non validable.`,
    });
  }

  const eodItem = readiness.items.find((i) => i.id === 'eod');
  if (eodItem?.status === 'warn') {
    alerts.push({
      id: 'wgf:eod-margin',
      level: 'critical',
      title: 'Plancher EOD — marge faible',
      message: eodItem.detail,
    });
  }

  if (
    readiness.profit.targetPct > 0 &&
    !readiness.profit.reached &&
    readiness.profit.remainingPct <= 1.5
  ) {
    alerts.push({
      id: 'wgf:profit-near',
      level: 'warn',
      title: 'Objectif WGF presque atteint',
      message: `Plus que ${readiness.profit.remainingPct} % (${readiness.profit.profitPct} / ${readiness.profit.targetPct} %).`,
    });
  }

  return alerts;
}
