/** Règles XAUUSD — mèches, amplitude minimale, buffer SL. */

export const GOLD_RULES = {
  minWickRatio: 0.65,
  minRangeDollars: 2.5,
  slBufferDollars: 3.5,
  riskRewardForBE: 1.5,
};

/**
 * @param {{ open: number, high: number, low: number, close: number }} candle
 */
export function analyzeGoldCandle(candle) {
  const range = candle.high - candle.low;
  if (range < GOLD_RULES.minRangeDollars) {
    return null;
  }

  const bodyTop = Math.max(candle.open, candle.close);
  const bodyBottom = Math.min(candle.open, candle.close);
  const upperWick = candle.high - bodyTop;
  const lowerWick = bodyBottom - candle.low;
  const upperRatio = upperWick / range;
  const lowerRatio = lowerWick / range;

  const entry = candle.close;

  if (lowerRatio >= GOLD_RULES.minWickRatio && upperRatio < GOLD_RULES.minWickRatio) {
    const stopLoss = candle.low - GOLD_RULES.slBufferDollars;
    const risk = Math.abs(entry - stopLoss);
    return {
      pattern: 'hammer',
      marker: 'hammer',
      direction: 'BUY',
      entry,
      stopLoss,
      breakEven: entry + risk * GOLD_RULES.riskRewardForBE,
      upperWickRatio: upperRatio,
      lowerWickRatio: lowerRatio,
      range,
    };
  }

  if (upperRatio >= GOLD_RULES.minWickRatio && lowerRatio < GOLD_RULES.minWickRatio) {
    const stopLoss = candle.high + GOLD_RULES.slBufferDollars;
    const risk = Math.abs(stopLoss - entry);
    return {
      pattern: 'shooting_star',
      marker: 'shooting_star',
      direction: 'SELL',
      entry,
      stopLoss,
      breakEven: entry - risk * GOLD_RULES.riskRewardForBE,
      upperWickRatio: upperRatio,
      lowerWickRatio: lowerRatio,
      range,
    };
  }

  return null;
}

/**
 * Enrichit l'analyse worker pour l'or.
 * @param {Array} candles
 * @param {Array} analyzed
 */
export function enrichGoldAnalysis(candles, analyzed) {
  const signals = [];
  const lastIndex = candles.length - 1;

  for (let i = 0; i < candles.length; i += 1) {
    const candle = candles[i];
    const meta = analyzed[i];
    const gold = analyzeGoldCandle(candle);
    if (!gold) continue;

    signals.push({
      index: i,
      time: candle.time ?? meta?.time,
      isLatest: i === lastIndex,
      ...gold,
      aiConfidence: Math.round(55 + gold.lowerWickRatio * 40 + (gold.pattern === 'hammer' ? 5 : 0)),
    });
  }

  return signals;
}

export function pickLatestGoldSignal(signals) {
  if (!signals?.length) return null;
  return signals.filter((s) => s.isLatest).pop() ?? signals[signals.length - 1];
}
