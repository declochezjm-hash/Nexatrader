import { getDb } from './db.js';
import { canOpenTrade } from '../engine/propGuard.js';
import { calculateLotSize } from '../engine/positionSizer.js';
import { syncChallengeEquity } from './challengeEquity.js';

/**
 * Ouvre un ordre mémorisé en SQLite avec taille calculée PropGuard.
 */
export async function executeOpenOrder({
  symbol,
  side,
  challenge,
  settings,
  marketPrice,
  stopLossPrice,
  takeProfitPrice,
  currentSpread,
  inSession,
  killSwitchActive,
}) {
  const gate = canOpenTrade({
    symbol,
    currentSpread,
    challenge,
    inSession,
    killSwitchActive,
    paperTrading:
      settings?.paper_trading == null || Number(settings?.paper_trading) === 1,
  });

  if (!gate.allowed) {
    return { ok: false, error: gate.reasons.join(' · '), gate };
  }

  const db = getDb();
  if (!db) {
    return { ok: false, error: 'SQLite indisponible.' };
  }

  const entry = marketPrice;
  const sl =
    stopLossPrice ??
    (side === 'BUY' ? entry - 5 : entry + 5);

  const riskPercent = settings?.default_risk_percent ?? 1;
  const balance = challenge?.current_equity ?? challenge?.initial_balance ?? 0;

  const sizing = calculateLotSize({
    balance,
    riskPercent,
    entryPrice: entry,
    stopLossPrice: sl,
    symbol,
  });

  if (!sizing.valid) {
    return { ok: false, error: sizing.reason ?? 'Sizing invalide.', gate, sizing };
  }

  const result = await db.run(
    `INSERT INTO trades (
      symbol, type, lot_size, risk_percent, entry_price, stop_loss, take_profit, pnl, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'open')`,
    [
      symbol,
      side,
      sizing.lotSize,
      riskPercent,
      entry,
      sl,
      takeProfitPrice ?? null,
    ],
  );

  return {
    ok: true,
    tradeId: result.lastInsertRowid,
    sizing,
    gate,
  };
}

export async function refreshEquityState(challenge) {
  if (!challenge) return null;
  return syncChallengeEquity(challenge);
}
