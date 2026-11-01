/** Règles NAS100 — sweeps multi-bougies et session US. */

export const NASDAQ_RULES = {
  sweepWindow: 10,
  sweepWickRatio: 0.55,
  sessionStartEt: { hour: 9, minute: 30 },
  sessionEndEt: { hour: 16, minute: 0 },
};

/**
 * Vérifie si l'horodatage UTC tombe dans la session cash US (approx. ET).
 * @param {number} unixSeconds
 */
export function isUsCashSession(unixSeconds) {
  const date = new Date(unixSeconds * 1000);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    weekday: 'short',
  }).formatToParts(date);

  const map = Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
  const weekday = map.weekday;
  if (weekday === 'Sat' || weekday === 'Sun') {
    return false;
  }

  const hour = Number(map.hour);
  const minute = Number(map.minute);
  const minutes = hour * 60 + minute;
  const open = NASDAQ_RULES.sessionStartEt.hour * 60 + NASDAQ_RULES.sessionStartEt.minute;
  const close = NASDAQ_RULES.sessionEndEt.hour * 60 + NASDAQ_RULES.sessionEndEt.minute;

  return minutes >= open && minutes <= close;
}

/**
 * Balayage de liquidité multi-boucles sur `windowSize` bougies.
 * @param {Array<{ high, low, close, open, time? }>} candles
 * @param {number} windowSize
 */
export function detectMultiBarSweep(candles, windowSize = NASDAQ_RULES.sweepWindow) {
  if (candles.length < windowSize) {
    return [];
  }

  const sweeps = [];

  for (let end = windowSize - 1; end < candles.length; end += 1) {
    const slice = candles.slice(end - windowSize + 1, end + 1);
    const prior = slice.slice(0, -1);
    const last = slice[slice.length - 1];

    const priorHigh = Math.max(...prior.map((c) => c.high));
    const priorLow = Math.min(...prior.map((c) => c.low));

    const range = Math.max(last.high - last.low, Number.EPSILON);
    const bodyTop = Math.max(last.open, last.close);
    const bodyBottom = Math.min(last.open, last.close);
    const upperWick = last.high - bodyTop;
    const lowerWick = bodyBottom - last.low;

    const sweptHigh = last.high > priorHigh && last.close < priorHigh;
    const sweptLow = last.low < priorLow && last.close > priorLow;

    if (sweptHigh && upperWick / range >= NASDAQ_RULES.sweepWickRatio) {
      sweeps.push({
        index: end,
        time: last.time,
        type: 'bearish_sweep',
        marker: 'shooting_star',
        direction: 'SELL',
        entry: last.close,
        stopLoss: last.high + 15,
        breakEven: last.close - Math.abs(last.high + 15 - last.close) * 1.5,
        priorHigh,
      });
    } else if (sweptLow && lowerWick / range >= NASDAQ_RULES.sweepWickRatio) {
      sweeps.push({
        index: end,
        time: last.time,
        type: 'bullish_sweep',
        marker: 'hammer',
        direction: 'BUY',
        entry: last.close,
        stopLoss: last.low - 15,
        breakEven: last.close + Math.abs(last.close - (last.low - 15)) * 1.5,
        priorLow,
      });
    }
  }

  return sweeps;
}

/**
 * @param {Array} candles
 * @param {Array} _analyzed
 */
export function enrichNasdaqAnalysis(candles, _analyzed) {
  const sweeps = detectMultiBarSweep(candles);
  const lastIndex = candles.length - 1;

  return sweeps.map((s) => ({
    ...s,
    isLatest: s.index === lastIndex,
    inSession: isUsCashSession(typeof s.time === 'number' ? s.time : Math.floor(Date.now() / 1000)),
    aiConfidence: 68,
    pattern: s.type,
  }));
}

export function pickLatestNasdaqSignal(signals) {
  if (!signals?.length) return null;
  const inSession = signals.filter((s) => s.isLatest && s.inSession !== false);
  return (inSession.length ? inSession : signals.filter((s) => s.isLatest)).pop() ?? null;
}
