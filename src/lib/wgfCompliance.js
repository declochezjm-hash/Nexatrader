import { getChallengeWgfProgram } from './wgfPrograms.js';
import { getGmtDateKey } from './wgfDailyReset.js';
import {
  getEffectiveMinTradingDays,
  isConsistencyDisabledByOneDayPass,
} from './wgfOneDayPass.js';

const CLOSED_STATUSES = new Set(['closed', 'emergency_closed']);

/** @param {string|null|undefined} iso */
export function gmtDateKeyFromTradeTimestamp(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return getGmtDateKey(d);
}

/**
 * @param {object|null|undefined} challenge
 * @returns {number|null}
 */
export function resolveMinTradingDays(challenge) {
  return getEffectiveMinTradingDays(challenge);
}

/**
 * @param {object|null|undefined} challenge
 * @returns {number|null}
 */
export function resolveConsistencyLimitPercent(challenge) {
  if (isConsistencyDisabledByOneDayPass(challenge)) return null;
  return getChallengeWgfProgram(challenge).consistencyPercent ?? null;
}

/**
 * PnL net par jour GMT (trades clôturés).
 * @param {Array<{ status?: string, pnl?: number, created_at?: string }>} trades
 */
export function aggregateDailyPnlByGmt(trades) {
  /** @type {Map<string, number>} */
  const map = new Map();
  for (const t of trades ?? []) {
    if (!CLOSED_STATUSES.has(String(t.status ?? '').toLowerCase())) continue;
    const key = gmtDateKeyFromTradeTimestamp(t.created_at);
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + Number(t.pnl ?? 0));
  }
  return map;
}

/**
 * @param {Array<{ status?: string, created_at?: string }>} trades
 */
export function countWgfTradingDays(trades) {
  return aggregateDailyPnlByGmt(trades).size;
}

/**
 * @param {object|null|undefined} challenge
 * @param {Array<object>} trades
 */
export function evaluateMinTradingDays(challenge, trades) {
  const required = resolveMinTradingDays(challenge);
  const activeDays = countWgfTradingDays(trades);
  if (required == null || required <= 0) {
    return { met: true, required: 0, activeDays, remaining: 0, skipped: true };
  }
  return {
    met: activeDays >= required,
    required,
    activeDays,
    remaining: Math.max(0, required - activeDays),
    skipped: false,
  };
}

/**
 * Règle WGF : le meilleur jour ne doit pas dépasser X % du profit total du challenge.
 * @param {object|null|undefined} challenge
 * @param {Array<object>} trades
 * @param {number} [equity]
 */
export function evaluateConsistencyRule(challenge, trades, equity) {
  const limit = resolveConsistencyLimitPercent(challenge);
  if (limit == null) {
    return { compliant: true, skipped: true, limit: null };
  }

  const initial = Number(challenge?.initial_balance ?? 0);
  const eq = Number(equity ?? challenge?.current_equity ?? initial);
  const totalProfit = Math.max(0, eq - initial);

  const daily = aggregateDailyPnlByGmt(trades);
  let bestDayKey = null;
  let bestDayProfit = 0;
  for (const [key, pnl] of daily) {
    if (pnl > bestDayProfit) {
      bestDayProfit = pnl;
      bestDayKey = key;
    }
  }

  if (totalProfit <= 0.001) {
    return {
      compliant: true,
      limit,
      totalProfit: 0,
      bestDayProfit: Number(bestDayProfit.toFixed(2)),
      bestDayKey,
      bestDaySharePct: 0,
      noProfitYet: true,
      skipped: false,
    };
  }

  const bestDaySharePct = bestDayProfit > 0 ? (bestDayProfit / totalProfit) * 100 : 0;
  const compliant = bestDayProfit <= 0 || bestDaySharePct <= limit + 0.01;

  return {
    compliant,
    limit,
    totalProfit: Number(totalProfit.toFixed(2)),
    bestDayProfit: Number(bestDayProfit.toFixed(2)),
    bestDayKey,
    bestDaySharePct: Number(bestDaySharePct.toFixed(2)),
    noProfitYet: false,
    skipped: false,
  };
}

/**
 * @param {object|null|undefined} challenge
 * @param {Array<object>} trades
 * @param {number} [equity]
 */
export function computeWgfComplianceStatus(challenge, trades, equity) {
  const minDays = evaluateMinTradingDays(challenge, trades);
  const consistency = evaluateConsistencyRule(challenge, trades, equity);
  /** @type {string[]} */
  const blockingReasons = [];

  if (!minDays.skipped && !minDays.met) {
    blockingReasons.push(
      `Jours actifs ${minDays.activeDays}/${minDays.required} (GMT, trades clôturés)`,
    );
  }
  if (!consistency.skipped && !consistency.noProfitYet && !consistency.compliant) {
    blockingReasons.push(
      `Consistency ${consistency.bestDaySharePct} % > plafond ${consistency.limit} %`,
    );
  }

  const readyForPass =
    minDays.met &&
    (consistency.skipped || consistency.noProfitYet || consistency.compliant);

  return {
    minDays,
    consistency,
    readyForPass,
    blockingReasons,
  };
}
