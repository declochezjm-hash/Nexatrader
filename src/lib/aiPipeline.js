import { analyzePattern, toAiInsight } from '../engine/aiService.js';
import {
  buildPatternSnapshotFromSignal,
  getPatternHistoricalStats,
  normalizePatternType,
} from './patternMemory.js';

export function isActionableWickSignal(signal) {
  if (!signal) return false;
  const marker = signal.marker ?? signal.pattern;
  return (
    marker === 'hammer' ||
    marker === 'shooting_star' ||
    signal.pattern === 'hammer' ||
    signal.pattern === 'shooting_star' ||
    signal.type === 'bullish_sweep' ||
    signal.type === 'bearish_sweep'
  );
}

/**
 * Pipeline Worker → SQLite → Gemini / fallback.
 */
export async function processWickSignal({ signal, symbol, settings }) {
  if (!isActionableWickSignal(signal)) {
    return null;
  }

  const patternType = normalizePatternType(signal.pattern ?? signal.marker);
  const tradeHour = new Date().getUTCHours();
  const historicalStats = await getPatternHistoricalStats(symbol, patternType, tradeHour);

  const candleData = {
    symbol,
    patternType,
    upperWickRatio: signal.upperWickRatio ?? 0,
    lowerWickRatio: signal.lowerWickRatio ?? 0,
    isLiquiditySweep: Boolean(signal.isLiquiditySweep ?? signal.type?.includes('sweep')),
    tradeHour,
    tradeDayOfWeek: new Date().getUTCDay(),
    suggestedDirection: signal.direction ?? (patternType === 'hammer' ? 'BUY' : 'SELL'),
  };

  const analysis = await analyzePattern(candleData, historicalStats, settings);
  const insight = toAiInsight(analysis);
  const patternSnapshot = buildPatternSnapshotFromSignal(signal, symbol, insight.confidence);

  return {
    insight,
    analysis,
    historicalStats,
    patternSnapshot,
    signalKey: `${symbol}-${signal.time ?? 'na'}-${patternType}`,
  };
}
