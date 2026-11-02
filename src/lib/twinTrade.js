/**
 * Twin trade : compare le plan capturé (checklist / snapshot) vs l’exécution SQLite.
 * @param {object|null|undefined} trade
 * @param {object|null|undefined} [planFromDb]
 */
export function parseTradePlanSnapshot(trade) {
  const raw = trade?.plan_snapshot;
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
}

/**
 * @param {object|null|undefined} trade
 * @param {object|null|undefined} [inlinePlan]
 */
export function buildTwinTradeComparison(trade, inlinePlan = null) {
  const plan = inlinePlan ?? parseTradePlanSnapshot(trade);
  if (!trade?.id) {
    return { available: false, reason: 'Trade introuvable.' };
  }
  if (!plan) {
    return {
      available: false,
      reason: 'Aucun plan capturé à l’ouverture (ordre direct ou ancien trade).',
    };
  }

  const executedSide = trade.type === 'SELL' ? 'SELL' : 'BUY';
  const plannedSide = plan.side === 'SELL' ? 'SELL' : 'BUY';
  const entryDelta =
    plan.entry != null && trade.entry_price != null
      ? Number((trade.entry_price - plan.entry).toFixed(4))
      : null;
  const slDelta =
    plan.stopLoss != null && trade.stop_loss != null
      ? Number((trade.stop_loss - plan.stopLoss).toFixed(4))
      : null;

  /** @type {Array<{ id: string, label: string, ok: boolean, detail: string }>} */
  const rows = [];

  rows.push({
    id: 'side',
    label: 'Sens',
    ok: plannedSide === executedSide,
    detail: `Plan ${plannedSide} · exécuté ${executedSide}`,
  });

  if (plan.symbol && trade.symbol) {
    rows.push({
      id: 'symbol',
      label: 'Actif',
      ok: plan.symbol === trade.symbol,
      detail: `${plan.symbol} → ${trade.symbol}`,
    });
  }

  if (entryDelta != null) {
    const tol = plan.symbol === 'NAS100' ? 2 : 0.5;
    rows.push({
      id: 'entry',
      label: 'Entrée',
      ok: Math.abs(entryDelta) <= tol,
      detail: `Δ ${entryDelta >= 0 ? '+' : ''}${entryDelta}`,
    });
  }

  if (slDelta != null) {
    const tol = plan.symbol === 'NAS100' ? 3 : 1;
    rows.push({
      id: 'sl',
      label: 'Stop loss',
      ok: Math.abs(slDelta) <= tol,
      detail: `Δ ${slDelta >= 0 ? '+' : ''}${slDelta}`,
    });
  }

  if (plan.aiSignal && plan.aiSignal !== 'SKIP') {
    const aligned = plan.aiSignal === executedSide;
    rows.push({
      id: 'ai',
      label: 'IA (plan)',
      ok: aligned,
      detail: `${plan.aiSignal} (${plan.aiConfidence ?? 0} %) vs trade ${executedSide}`,
    });
  }

  const alignedCount = rows.filter((r) => r.ok).length;
  const score = rows.length ? Math.round((alignedCount / rows.length) * 100) : 0;

  return {
    available: true,
    plan,
    executed: {
      side: executedSide,
      symbol: trade.symbol,
      entry: trade.entry_price,
      stopLoss: trade.stop_loss,
      lot: trade.lot_size,
    },
    rows,
    alignmentScore: score,
    summary:
      score >= 85
        ? 'Exécution fidèle au plan capturé.'
        : score >= 60
          ? 'Écarts modérés — vérifiez entrée / SL.'
          : 'Décision vs plan : écart important.',
  };
}

export function serializePlanSnapshot(plan) {
  return JSON.stringify(plan);
}
