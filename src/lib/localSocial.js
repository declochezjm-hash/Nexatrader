const CLOSED = new Set(['closed', 'emergency_closed']);

/**
 * Challenge social local (option) : stats personnelles sans réseau.
 * @param {object|null|undefined} challenge
 * @param {Array<object>} trades
 * @param {number|null|undefined} [storedBestProfit]
 */
export function computeLocalSocialStats(challenge, trades = [], storedBestProfit = null) {
  const closed = trades.filter((t) => CLOSED.has(String(t.status ?? '').toLowerCase()));
  const totalPnl = closed.reduce((s, t) => s + Number(t.pnl ?? 0), 0);

  const daily = new Map();
  for (const t of closed) {
    const key = String(t.created_at ?? '').slice(0, 10);
    if (!key) continue;
    daily.set(key, (daily.get(key) ?? 0) + Number(t.pnl ?? 0));
  }

  let bestDayPnl = 0;
  let bestDayKey = null;
  for (const [k, v] of daily) {
    if (v > bestDayPnl) {
      bestDayPnl = v;
      bestDayKey = k;
    }
  }

  const record = Math.max(storedBestProfit ?? 0, bestDayPnl);
  const vsRecord = record > 0 ? (bestDayPnl / record) * 100 : 0;

  return {
    tradesClosed: closed.length,
    totalPnl: Number(totalPnl.toFixed(2)),
    bestDayPnl: Number(bestDayPnl.toFixed(2)),
    bestDayKey,
    personalRecord: Number(record.toFixed(2)),
    currentBestVsRecordPct: Number(vsRecord.toFixed(0)),
    activeDays: daily.size,
    challengeId: challenge?.id ?? null,
  };
}
