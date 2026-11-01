/**
 * @param {string|null|undefined} createdAt SQLite datetime
 * @returns {number|null} unix seconds
 */
export function parseTradeCreatedUnix(createdAt) {
  if (!createdAt) return null;
  const trimmed = String(createdAt).trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
  let ms = Date.parse(normalized);
  if (!Number.isFinite(ms)) {
    ms = Date.parse(`${normalized}Z`);
  }
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

/**
 * @param {Array<{ time: number }>} candles
 * @param {number|null} unixSec
 */
export function findCandleIndexForTime(candles, unixSec) {
  if (!candles?.length) return 0;
  if (unixSec == null) return candles.length - 1;
  let best = 0;
  for (let i = 0; i < candles.length; i++) {
    if (candles[i].time <= unixSec) best = i;
    else break;
  }
  return best;
}

export function visibleRangeAroundIndex(index, total, before = 35, after = 12) {
  const from = Math.max(0, index - before);
  const to = Math.min(total + 5, index + after);
  return { from, to };
}

/**
 * Index bougie pour centrer le graphique (heure SQLite + repli prix si flux simulé).
 * @param {Array<{ time: number, close?: number, high?: number, low?: number }>} candles
 * @param {{ created_at?: string, entry_price?: number|null }} trade
 */
export function findCandleIndexForTrade(candles, trade) {
  if (!candles?.length) return 0;
  const unix = parseTradeCreatedUnix(trade?.created_at);
  let idx = findCandleIndexForTime(candles, unix);

  const entry = trade?.entry_price != null ? Number(trade.entry_price) : null;
  const timeOutOfRange =
    unix != null &&
    (candles[0].time > unix + 3600 || candles[candles.length - 1].time < unix - 86400);

  if (Number.isFinite(entry) && (timeOutOfRange || unix == null)) {
    let bestIdx = candles.length - 1;
    let bestDist = Infinity;
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      const dist = Math.min(
        Math.abs((c.close ?? c.open ?? 0) - entry),
        Math.abs((c.high ?? c.close ?? 0) - entry),
        Math.abs((c.low ?? c.close ?? 0) - entry),
      );
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    idx = bestIdx;
  }

  return idx;
}
