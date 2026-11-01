import { getDb } from './db.js';

const OUTCOMES = new Set(['WIN', 'LOSS']);

function normalizePatternType(patternType) {
  const p = String(patternType ?? '').toLowerCase();
  if (p.includes('shoot') || p === 'ss' || p === 'bearish_sweep') return 'shooting_star';
  if (p.includes('hammer') || p === 'h' || p === 'bullish_sweep') return 'hammer';
  return p || 'unknown';
}

function computeWinRate(rows) {
  if (!rows?.length) {
    return { winRate: null, sampleSize: 0, wins: 0, losses: 0 };
  }
  const wins = rows.filter((r) => r.outcome === 'WIN').length;
  const losses = rows.filter((r) => r.outcome === 'LOSS').length;
  const sampleSize = wins + losses;
  const winRate = sampleSize > 0 ? Number(((wins / sampleSize) * 100).toFixed(1)) : null;
  return { winRate, sampleSize, wins, losses };
}

/**
 * Win rate historique filtré par actif, pattern et tranche horaire.
 */
export async function getPatternHistoricalStats(symbol, patternType, tradeHour) {
  const db = getDb();
  const normalized = normalizePatternType(patternType);

  if (!db) {
    return { winRate: null, sampleSize: 0, wins: 0, losses: 0, scope: 'offline' };
  }

  let rows = await db.query(
    `SELECT outcome FROM ai_pattern_memory
     WHERE symbol = ? AND pattern_type = ? AND trade_hour = ? AND outcome IN ('WIN', 'LOSS')`,
    [symbol, normalized, tradeHour],
  );

  let scope = 'hour';
  if (rows.length < 5) {
    rows = await db.query(
      `SELECT outcome FROM ai_pattern_memory
       WHERE symbol = ? AND pattern_type = ? AND outcome IN ('WIN', 'LOSS')`,
      [symbol, normalized],
    );
    scope = 'symbol_pattern';
  }

  if (rows.length < 3) {
    rows = await db.query(
      `SELECT outcome FROM ai_pattern_memory
       WHERE symbol = ? AND outcome IN ('WIN', 'LOSS')`,
      [symbol],
    );
    scope = 'symbol';
  }

  return { ...computeWinRate(rows), scope };
}

/**
 * @param {object} patternData
 * @param {'WIN'|'LOSS'} outcome
 */
export async function recordPatternOutcome(patternData, outcome) {
  const db = getDb();
  if (!db) return null;

  const normalizedOutcome = OUTCOMES.has(outcome) ? outcome : 'LOSS';
  const patternType = normalizePatternType(patternData.pattern_type ?? patternData.pattern);

  const result = await db.run(
    `INSERT INTO ai_pattern_memory (
      symbol, pattern_type, upper_wick_ratio, lower_wick_ratio,
      is_liquidity_sweep, trade_hour, trade_day_of_week, market_trend,
      outcome, ai_confidence_score
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      patternData.symbol,
      patternType,
      patternData.upper_wick_ratio ?? 0,
      patternData.lower_wick_ratio ?? 0,
      patternData.is_liquidity_sweep ? 1 : 0,
      patternData.trade_hour ?? new Date().getUTCHours(),
      patternData.trade_day_of_week ?? new Date().getUTCDay(),
      patternData.market_trend ?? null,
      normalizedOutcome,
      patternData.ai_confidence_score ?? null,
    ],
  );

  return result.lastInsertRowid;
}

export function buildPatternSnapshotFromSignal(signal, symbol, aiConfidence = null) {
  const now = new Date();
  return {
    symbol,
    pattern_type: signal.pattern ?? signal.marker,
    upper_wick_ratio: signal.upperWickRatio ?? 0,
    lower_wick_ratio: signal.lowerWickRatio ?? 0,
    is_liquidity_sweep:
      signal.isLiquiditySweep || String(signal.type ?? '').includes('sweep') ? 1 : 0,
    trade_hour: now.getUTCHours(),
    trade_day_of_week: now.getUTCDay(),
    market_trend: signal.direction ?? null,
    ai_confidence_score: aiConfidence,
  };
}

export { normalizePatternType };
