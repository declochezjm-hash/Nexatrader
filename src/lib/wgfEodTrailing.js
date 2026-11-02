import {
  getChallengeWgfProgram,
  resolveOverallLossLimitPercent,
} from './wgfPrograms.js';
import { getGmtDateKey } from './wgfDailyReset.js';

/**
 * @param {object|null|undefined} challenge
 */
export function challengeUsesEodTrailing(challenge) {
  return getChallengeWgfProgram(challenge).drawdownMode === 'eod_trailing';
}

export function computeEodLossBuffer(challenge) {
  const initial = Number(challenge?.initial_balance ?? 0);
  const pct = resolveOverallLossLimitPercent(challenge);
  return initial * (pct / 100);
}

export function computeInitialEodFloor(challenge) {
  const initial = Number(challenge?.initial_balance ?? 0);
  return Number((initial - computeEodLossBuffer(challenge)).toFixed(2));
}

export function resolveEodTrailingFloor(challenge) {
  if (challenge?.eod_trailing_floor != null && Number.isFinite(Number(challenge.eod_trailing_floor))) {
    return Number(challenge.eod_trailing_floor);
  }
  return computeInitialEodFloor(challenge);
}

/**
 * Recalcule le plancher après clôture EOD (WGF 1 Step).
 * @param {number} currentFloor
 * @param {number} eodEquity
 * @param {object} challenge
 */
export function applyEodTrailingStep(currentFloor, eodEquity, challenge) {
  const initial = Number(challenge?.initial_balance ?? 0);
  const buffer = computeEodLossBuffer(challenge);
  const candidate = Number(eodEquity) - buffer;
  let next = Math.max(Number(currentFloor), candidate);
  next = Math.min(next, initial);
  return Number(next.toFixed(2));
}

/**
 * @param {object|null|undefined} challenge
 * @param {number} equity
 * @param {Date} [now]
 */
export function evaluateEodMidnightRollover(challenge, equity, now = new Date()) {
  if (!challenge?.id || !challengeUsesEodTrailing(challenge)) {
    return { apply: false, challenge };
  }
  if (!['active', 'paused'].includes(String(challenge.status))) {
    return { apply: false, challenge, skipped: 'inactive' };
  }

  const todayKey = getGmtDateKey(now);
  const lastKey = challenge.last_eod_process_gmt
    ? String(challenge.last_eod_process_gmt).slice(0, 10)
    : null;

  if (lastKey === todayKey) {
    return { apply: false, challenge, todayKey, lastKey };
  }

  const eodEquity = Number(challenge.last_equity_snapshot ?? equity);
  const prevFloor = resolveEodTrailingFloor(challenge);
  const newFloor = applyEodTrailingStep(prevFloor, eodEquity, challenge);
  const initial = Number(challenge.initial_balance ?? 0);
  const locked = newFloor >= initial - 0.01;

  const nextChallenge = {
    ...challenge,
    eod_trailing_floor: newFloor,
    last_eod_process_gmt: todayKey,
    last_equity_snapshot: equity,
  };

  return {
    apply: true,
    challenge: nextChallenge,
    todayKey,
    lastKey,
    eodEquity,
    newFloor,
    locked,
    message: locked
      ? 'Plancher EOD verrouillé à la balance initiale WGF.'
      : `Plancher EOD recalculé (clôture ${eodEquity.toFixed(0)} $ → plancher ${newFloor.toFixed(0)} $).`,
  };
}

/**
 * @param {object|null|undefined} challenge
 * @param {number} equity
 */
export function evaluateEodIntradayFail(challenge, equity) {
  if (!challengeUsesEodTrailing(challenge)) return { fail: false };
  const floor = resolveEodTrailingFloor(challenge);
  if (Number(equity) < floor - 0.001) {
    return {
      fail: true,
      reason: `Sous le plancher EOD WGF (${Number(equity).toFixed(2)} $ < ${floor.toFixed(2)} $)`,
    };
  }
  return { fail: false };
}

/**
 * @param {object|null|undefined} challenge
 * @param {number} [equity]
 */
export function computeEodDrawdownMetrics(challenge, equity) {
  const initial = Number(challenge?.initial_balance ?? 1);
  const eq = Number(equity ?? challenge?.current_equity ?? initial);
  const floor = resolveEodTrailingFloor(challenge);
  const margin = eq - floor;
  const maxPct = resolveOverallLossLimitPercent(challenge);
  const marginPctOfInitial = initial > 0 ? (margin / initial) * 100 : 0;

  return {
    eodFloor: floor,
    marginDollars: Number(margin.toFixed(2)),
    marginPctOfInitial: Number(marginPctOfInitial.toFixed(2)),
    maxLossPercent: maxPct,
    lockedAtInitial: floor >= initial - 0.01,
    distanceToFail: margin,
  };
}

/**
 * Initialise les champs EOD pour un nouveau challenge 1 Step.
 * @param {object} challenge
 */
export function withEodTrailingDefaults(challenge) {
  if (!challengeUsesEodTrailing(challenge)) return challenge;
  const initial = Number(challenge.initial_balance ?? 0);
  const floor = computeInitialEodFloor(challenge);
  return {
    ...challenge,
    eod_trailing_floor: floor,
    last_eod_process_gmt: getGmtDateKey(),
    last_equity_snapshot: initial,
  };
}
