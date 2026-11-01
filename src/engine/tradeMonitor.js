import { closeOpenTrade, fetchOpenTrades, updateTradeStopLoss } from '../lib/tradeLifecycle.js';
import { estimatePnl } from './positionSizer.js';

const BE_RR = 1.5;

function initialRisk(trade) {
  if (trade.entry_price == null || trade.stop_loss == null) return 0;
  return Math.abs(trade.entry_price - trade.stop_loss);
}

function isBreakEvenSl(trade) {
  if (trade.entry_price == null || trade.stop_loss == null) return false;
  return Math.abs(trade.entry_price - trade.stop_loss) < 0.0001;
}

function slHit(trade, candle) {
  const sl = trade.stop_loss;
  if (sl == null) return false;
  if (trade.type === 'BUY') return candle.low <= sl;
  return candle.high >= sl;
}

function tpHit(trade, candle) {
  const tp = trade.take_profit;
  if (tp == null) return false;
  if (trade.type === 'BUY') return candle.high >= tp;
  return candle.low <= tp;
}

function unrealizedAtExtreme(trade, candle) {
  if (trade.entry_price == null) return 0;
  if (trade.type === 'BUY') return candle.high - trade.entry_price;
  return trade.entry_price - candle.low;
}

function shouldMoveToBreakEven(trade, candle) {
  if (isBreakEvenSl(trade)) return false;
  const risk = initialRisk(trade);
  if (risk <= 0) return false;
  return unrealizedAtExtreme(trade, candle) >= risk * BE_RR;
}

/**
 * @param {{
 *   symbol: string,
 *   candle: { open, high, low, close },
 *   challenge: object | null,
 *   patternByTradeId?: Record<number, object>,
 *   fallbackPattern?: object | null,
 * }} params
 */
export async function processMarketTick({
  symbol,
  candle,
  challenge,
  patternByTradeId = {},
  fallbackPattern = null,
}) {
  const events = [];
  let nextChallenge = challenge;
  const breakEvenUpdates = [];

  const openTrades = await fetchOpenTrades(symbol);
  if (!openTrades.length) {
    return { events, breakEvenUpdates, challenge: nextChallenge };
  }

  for (const trade of openTrades) {
    const pattern =
      patternByTradeId[trade.id] ?? fallbackPattern ?? null;

    if (shouldMoveToBreakEven(trade, candle) && trade.entry_price != null) {
      const newSl = Number(trade.entry_price.toFixed(2));
      await updateTradeStopLoss(trade.id, newSl);
      trade.stop_loss = newSl;
      breakEvenUpdates.push({ tradeId: trade.id, stopLoss: newSl, entry: newSl });
      events.push({ type: 'BREAK_EVEN', tradeId: trade.id, stopLoss: newSl });
    }

    if (slHit(trade, candle)) {
      const exit = trade.stop_loss;
      const result = await closeOpenTrade({
        trade,
        exitPrice: exit,
        challenge: nextChallenge,
        patternSnapshot: pattern,
        closeReason: 'SL',
      });
      if (result.ok) {
        nextChallenge = result.challenge;
        events.push({
          type: 'SL_HIT',
          tradeId: trade.id,
          pnl: result.pnl,
          outcome: result.outcome,
        });
      }
      continue;
    }

    if (tpHit(trade, candle)) {
      const exit = trade.take_profit;
      const result = await closeOpenTrade({
        trade,
        exitPrice: exit,
        challenge: nextChallenge,
        patternSnapshot: pattern,
        closeReason: 'TP',
      });
      if (result.ok) {
        nextChallenge = result.challenge;
        events.push({
          type: 'TP_HIT',
          tradeId: trade.id,
          pnl: result.pnl,
          outcome: result.outcome,
        });
      }
    }
  }

  return { events, breakEvenUpdates, challenge: nextChallenge };
}

export function previewFloatingPnl(trade, markPrice) {
  return estimatePnl({
    symbol: trade.symbol,
    type: trade.type,
    lotSize: trade.lot_size,
    entryPrice: trade.entry_price,
    exitPrice: markPrice,
  });
}
