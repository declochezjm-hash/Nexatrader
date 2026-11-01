/**
 * Wick Analyzer — Web Worker
 * Analyse les bougies en arrière-plan (ratios de mèches, sweeps de liquidité).
 */

import { enrichGoldAnalysis } from '../engine/goldWickAnalyzer.js';
import { enrichNasdaqAnalysis } from '../engine/nasdaqAnalyzer.js';

const DEFAULT_CONFIG = {
  minBodyRatio: 0.15,
  wickDominanceThreshold: 0.55,
  liquiditySweepWickRatio: 0.65,
  liquiditySweepCloseBeyond: 0.02,
};

/**
 * @param {{ open: number, high: number, low: number, close: number }} candle
 */
function candleRange(candle) {
  return Math.max(candle.high - candle.low, Number.EPSILON);
}

/**
 * @param {{ open: number, high: number, low: number, close: number }} candle
 */
function analyzeWick(candle, config = DEFAULT_CONFIG) {
  const range = candleRange(candle);
  const bodyTop = Math.max(candle.open, candle.close);
  const bodyBottom = Math.min(candle.open, candle.close);
  const bodySize = bodyTop - bodyBottom;

  const upperWick = candle.high - bodyTop;
  const lowerWick = bodyBottom - candle.low;

  const upperWickRatio = upperWick / range;
  const lowerWickRatio = lowerWick / range;
  const bodyRatio = bodySize / range;

  const isBullish = candle.close >= candle.open;
  const dominantUpper = upperWickRatio >= config.wickDominanceThreshold;
  const dominantLower = lowerWickRatio >= config.wickDominanceThreshold;

  let patternType = 'neutral';
  if (dominantUpper && !dominantLower) {
    patternType = 'upper_wick_rejection';
  } else if (dominantLower && !dominantUpper) {
    patternType = 'lower_wick_rejection';
  } else if (dominantUpper && dominantLower) {
    patternType = 'indecision';
  } else if (bodyRatio >= 1 - config.minBodyRatio) {
    patternType = isBullish ? 'strong_bullish_body' : 'strong_bearish_body';
  }

  const sweepThreshold = config.liquiditySweepWickRatio;
  const closeBeyond = config.liquiditySweepCloseBeyond * range;

  let isLiquiditySweep = 0;
  if (lowerWickRatio >= sweepThreshold && candle.close > candle.low + closeBeyond) {
    isLiquiditySweep = 1;
  } else if (upperWickRatio >= sweepThreshold && candle.close < candle.high - closeBeyond) {
    isLiquiditySweep = 1;
  }

  return {
    upperWickRatio: Number(upperWickRatio.toFixed(6)),
    lowerWickRatio: Number(lowerWickRatio.toFixed(6)),
    bodyRatio: Number(bodyRatio.toFixed(6)),
    patternType,
    isLiquiditySweep,
    isBullish: isBullish ? 1 : 0,
  };
}

/**
 * @param {Array<{ open, high, low, close, time?, symbol? }>} candles
 */
function analyzeBatch(candles, config) {
  return candles.map((candle, index) => ({
    index,
    time: candle.time ?? index,
    symbol: candle.symbol ?? null,
    ...analyzeWick(candle, config),
  }));
}

/**
 * Détection de clusters de mèches dominantes sur une fenêtre glissante.
 * @param {ReturnType<typeof analyzeBatch>} analyzed
 * @param {number} windowSize
 */
function detectWickClusters(analyzed, windowSize = 5) {
  if (analyzed.length < windowSize) {
    return [];
  }

  const clusters = [];
  for (let i = windowSize - 1; i < analyzed.length; i += 1) {
    const slice = analyzed.slice(i - windowSize + 1, i + 1);
    const upperHits = slice.filter((c) => c.upperWickRatio >= DEFAULT_CONFIG.wickDominanceThreshold).length;
    const lowerHits = slice.filter((c) => c.lowerWickRatio >= DEFAULT_CONFIG.wickDominanceThreshold).length;
    const sweeps = slice.filter((c) => c.isLiquiditySweep === 1).length;

    if (upperHits >= Math.ceil(windowSize / 2) || lowerHits >= Math.ceil(windowSize / 2) || sweeps >= 2) {
      clusters.push({
        endIndex: i,
        endTime: slice[slice.length - 1].time,
        upperWickHits: upperHits,
        lowerWickHits: lowerHits,
        liquiditySweeps: sweeps,
      });
    }
  }
  return clusters;
}

self.onmessage = (event) => {
  const { type, requestId, payload } = event.data ?? {};

  try {
    if (type === 'ANALYZE_CANDLES') {
      const { candles, config, detectClusters, clusterWindow, symbol } = payload ?? {};
      if (!Array.isArray(candles)) {
        throw new Error('payload.candles doit être un tableau.');
      }

      const mergedConfig = { ...DEFAULT_CONFIG, ...config };
      const analyzed = analyzeBatch(candles, mergedConfig);
      const clusters =
        detectClusters === true ? detectWickClusters(analyzed, clusterWindow ?? 5) : [];

      let assetSignals = [];
      if (symbol === 'XAUUSD') {
        assetSignals = enrichGoldAnalysis(candles, analyzed);
      } else if (symbol === 'NAS100') {
        assetSignals = enrichNasdaqAnalysis(candles, analyzed);
      }

      const latestSignal =
        assetSignals.find((s) => s.isLatest) ?? assetSignals[assetSignals.length - 1] ?? null;

      self.postMessage({
        type: 'ANALYZE_CANDLES_RESULT',
        requestId,
        ok: true,
        result: { analyzed, clusters, assetSignals, latestSignal, count: analyzed.length },
      });
      return;
    }

    if (type === 'PING') {
      self.postMessage({ type: 'PONG', requestId, ok: true });
      return;
    }

    self.postMessage({
      type: 'ERROR',
      requestId,
      ok: false,
      error: `Type de message worker inconnu : ${type}`,
    });
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      requestId,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export {};
