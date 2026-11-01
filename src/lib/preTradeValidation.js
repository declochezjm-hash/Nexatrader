import { GOLD_RULES } from '../engine/goldWickAnalyzer.js';

/** Seuil de confiance IA au-delà duquel un ordre contraire exige une confirmation explicite. */
export const AI_CONFLICT_CONFIDENCE = 70;

export function suggestStopLossForSide(side, entry, symbol = 'XAUUSD') {
  if (side !== 'BUY' && side !== 'SELL') return null;
  if (!Number.isFinite(entry)) return null;
  const buffer = symbol === 'NAS100' ? 15 : GOLD_RULES.slBufferDollars + 2;
  const sl =
    side === 'BUY' ? entry - buffer : entry + buffer;
  return Number(sl.toFixed(2));
}

/**
 * @param {'BUY'|'SELL'} side
 * @param {number|null|undefined} entry
 * @param {number|null|undefined} stopLoss
 */
export function validateStopLossForSide(side, entry, stopLoss) {
  if (side !== 'BUY' && side !== 'SELL') {
    return { valid: false, code: 'side', message: 'Sens d’ordre invalide.' };
  }
  if (stopLoss == null || !Number.isFinite(stopLoss)) {
    return {
      valid: false,
      code: 'missing',
      message: 'Stop loss manquant — placez la ligne orange sur le graphique.',
    };
  }
  if (!Number.isFinite(entry) || entry <= 0) {
    return {
      valid: false,
      code: 'entry',
      message: 'Prix d’entrée indisponible — attendez un tick ou reprenez le direct.',
    };
  }

  const distance = Math.abs(entry - stopLoss);
  if (distance < 0.01) {
    return {
      valid: false,
      code: 'distance',
      distance,
      message: 'Le SL est collé au prix — écartez la ligne stop.',
    };
  }

  if (side === 'BUY' && stopLoss >= entry) {
    return {
      valid: false,
      code: 'wrong_side',
      distance,
      message: `Pour un BUY, le SL (${stopLoss.toFixed(2)}) doit être sous l’entrée (~${entry.toFixed(2)}).`,
    };
  }
  if (side === 'SELL' && stopLoss <= entry) {
    return {
      valid: false,
      code: 'wrong_side',
      distance,
      message: `Pour un SELL, le SL (${stopLoss.toFixed(2)}) doit être au-dessus de l’entrée (~${entry.toFixed(2)}).`,
    };
  }

  return {
    valid: true,
    code: 'ok',
    distance,
    message: `SL valide · distance ${distance.toFixed(2)}`,
  };
}

/**
 * @param {'BUY'|'SELL'} side
 * @param {{ signal?: string, confidence?: number }|null|undefined} aiInsight
 */
export function assessAiOrderConflict(side, aiInsight) {
  if (side !== 'BUY' && side !== 'SELL') {
    return { conflict: false, signal: 'SKIP', confidence: 0, severity: 'none' };
  }
  const signal = (aiInsight?.signal ?? 'SKIP').toUpperCase();
  const confidence = Number(aiInsight?.confidence ?? 0);

  if (signal === 'SKIP' || confidence < AI_CONFLICT_CONFIDENCE) {
    return { conflict: false, signal, confidence, severity: 'none' };
  }

  const opposite =
    (side === 'BUY' && signal === 'SELL') || (side === 'SELL' && signal === 'BUY');

  if (!opposite) {
    return { conflict: false, signal, confidence, severity: 'aligned' };
  }

  return {
    conflict: true,
    signal,
    confidence,
    severity: confidence >= 85 ? 'strong' : 'moderate',
  };
}
