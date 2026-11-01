import { getDb } from './db.js';
import { estimatePnl } from '../engine/positionSizer.js';
import { registerClosedTradePnl } from './challengeEquity.js';
import { recordPatternOutcome } from './patternMemory.js';

async function persistCloseViaAtomicBridge({
  trade,
  exitPrice,
  pnl,
  challenge,
  patternSnapshot,
}) {
  const db = getDb();
  if (!db?.atomicCloseTrade) return null;

  const res = await db.atomicCloseTrade({
    tradeId: trade.id,
    exitPrice,
    pnl,
    challenge,
    patternSnapshot: patternSnapshot
      ? { ...patternSnapshot, symbol: patternSnapshot.symbol ?? trade.symbol }
      : null,
  });

  if (res?.ok === false) {
    throw new Error(res.error ?? 'Clôture atomique échouée.');
  }

  return res?.data ?? res;
}

/**
 * Clôture une position ouverte et synchronise WGF + mémoire IA.
 */
export async function closeOpenTrade({
  trade,
  exitPrice,
  challenge,
  patternSnapshot,
  closeReason = 'closed',
}) {
  const db = getDb();
  if (!db || !trade?.id) {
    return { ok: false, challenge };
  }

  const pnl = estimatePnl({
    symbol: trade.symbol,
    type: trade.type,
    lotSize: trade.lot_size,
    entryPrice: trade.entry_price,
    exitPrice,
  });

  const outcome = pnl >= 0 ? 'WIN' : 'LOSS';
  const pattern = patternSnapshot
    ? { ...patternSnapshot, symbol: patternSnapshot.symbol ?? trade.symbol }
    : null;

  try {
    const atomic = await persistCloseViaAtomicBridge({
      trade,
      exitPrice,
      pnl,
      challenge,
      patternSnapshot: pattern,
    });

    if (atomic?.ok) {
      return {
        ok: true,
        tradeId: trade.id,
        pnl,
        outcome,
        closeReason,
        challenge: atomic.challenge ?? challenge,
      };
    }
  } catch {
    /* repli IPC classique ci-dessous */
  }

  let updatedChallenge = challenge;
  if (challenge?.id) {
    updatedChallenge = await registerClosedTradePnl(trade.id, pnl, challenge, exitPrice);
  } else {
    await db.run(
      `UPDATE trades SET exit_price = ?, pnl = ?, status = 'closed' WHERE id = ?`,
      [exitPrice, pnl, trade.id],
    );
  }

  if (pattern) {
    await recordPatternOutcome(pattern, outcome);
  }

  return {
    ok: true,
    tradeId: trade.id,
    pnl,
    outcome,
    closeReason,
    challenge: updatedChallenge,
  };
}

export async function fetchOpenTrades(symbol = null) {
  const db = getDb();
  if (!db) return [];

  if (symbol) {
    return db.query(
      `SELECT * FROM trades
       WHERE LOWER(status) IN ('open', 'pending') AND symbol = ?
       ORDER BY id ASC`,
      [symbol],
    );
  }

  return db.query(
    `SELECT * FROM trades
     WHERE LOWER(status) IN ('open', 'pending')
     ORDER BY id ASC`,
  );
}

export async function updateTradeStopLoss(tradeId, stopLoss) {
  const db = getDb();
  if (!db) return;
  await db.run(`UPDATE trades SET stop_loss = ? WHERE id = ?`, [stopLoss, tradeId]);
}
