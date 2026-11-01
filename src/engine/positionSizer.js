/**
 * Calculateur de taille de position — risque fixe vs distance SL.
 */

export const SYMBOL_SPECS = {
  XAUUSD: {
    /** Valeur USD par 1$ de mouvement pour 1 lot standard (100 oz). */
    valuePerPointPerLot: 100,
    minLot: 0.01,
    lotStep: 0.01,
    maxLot: 50,
  },
  NAS100: {
    /** Valeur USD par 1 point d'indice pour 1 lot. */
    valuePerPointPerLot: 1,
    minLot: 0.01,
    lotStep: 0.01,
    maxLot: 100,
  },
};

function roundLot(lot, step) {
  const inv = 1 / step;
  return Math.floor(lot * inv) / inv;
}

/**
 * @param {{
 *   balance: number,
 *   riskPercent: number,
 *   entryPrice: number,
 *   stopLossPrice: number,
 *   symbol: 'XAUUSD' | 'NAS100',
 * }} params
 */
export function calculateLotSize({
  balance,
  riskPercent,
  entryPrice,
  stopLossPrice,
  symbol,
}) {
  const spec = SYMBOL_SPECS[symbol] ?? SYMBOL_SPECS.XAUUSD;
  const riskAmount = balance * (riskPercent / 100);
  const stopDistance = Math.abs(entryPrice - stopLossPrice);

  if (!Number.isFinite(stopDistance) || stopDistance <= 0) {
    return {
      lotSize: spec.minLot,
      riskAmount,
      stopDistance: 0,
      valid: false,
      reason: 'Distance SL invalide.',
    };
  }

  if (!Number.isFinite(balance) || balance <= 0) {
    return {
      lotSize: spec.minLot,
      riskAmount: 0,
      stopDistance,
      valid: false,
      reason: 'Solde invalide.',
    };
  }

  const rawLots = riskAmount / (stopDistance * spec.valuePerPointPerLot);
  let lotSize = roundLot(rawLots, spec.lotStep);
  lotSize = Math.max(spec.minLot, Math.min(spec.maxLot, lotSize));

  const theoreticalLoss = lotSize * stopDistance * spec.valuePerPointPerLot;

  return {
    lotSize: Number(lotSize.toFixed(2)),
    riskAmount: Number(riskAmount.toFixed(2)),
    stopDistance: Number(stopDistance.toFixed(4)),
    theoreticalLoss: Number(theoreticalLoss.toFixed(2)),
    valid: theoreticalLoss <= riskAmount * 1.02,
    reason: null,
  };
}

export function estimatePnl({ symbol, type, lotSize, entryPrice, exitPrice }) {
  const spec = SYMBOL_SPECS[symbol] ?? SYMBOL_SPECS.XAUUSD;
  const diff = type === 'BUY' ? exitPrice - entryPrice : entryPrice - exitPrice;
  return Number((diff * lotSize * spec.valuePerPointPerLot).toFixed(2));
}
