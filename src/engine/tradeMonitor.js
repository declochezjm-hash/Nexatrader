import { closeOpenTrade, fetchOpenTrades, updateTradeStopLoss } from '../lib/tradeLifecycle.js';
import { estimatePnl } from './positionSizer.js';

const BE_RR = 1.5;

/** Part maximale de l’amplitude de bougie utilisée comme glissement admissible. */
const SLIPPAGE_RANGE_FRACTION = 0.35;
const SLIPPAGE_FLOOR = {
  XAUUSD: 0.12,
  NAS100: 0.9,
  DEFAULT: 0.05,
};

function initialRisk(trade) {
  if (trade.entry_price == null || trade.stop_loss == null) return 0;
  return Math.abs(trade.entry_price - trade.stop_loss);
}

function isBreakEvenSl(trade) {
  if (trade.entry_price == null || trade.stop_loss == null) return false;
  return Math.abs(trade.entry_price - trade.stop_loss) < 0.0001;
}

function slippageAllowance(symbol, candle) {
  const range = Math.max(0, (candle.high ?? 0) - (candle.low ?? 0));
  const floor = SLIPPAGE_FLOOR[symbol] ?? SLIPPAGE_FLOOR.DEFAULT;
  return Math.max(floor, range * SLIPPAGE_RANGE_FRACTION);
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

/**
 * Prix de sortie SL avec glissement plafonné sur bougies volatiles.
 */
export function resolveStopLossExitPrice(trade, candle) {
  const sl = trade.stop_loss;
  if (sl == null) return sl;
  const allowance = slippageAllowance(trade.symbol, candle);

  if (trade.type === 'BUY') {
    if (candle.low > sl) return Number(sl.toFixed(2));
    const worst = Math.max(candle.low, sl - allowance);
    return Number(worst.toFixed(2));
  }

  if (candle.high < sl) return Number(sl.toFixed(2));
  const worst = Math.min(candle.high, sl + allowance);
  return Number(worst.toFixed(2));
}

/**
 * Prix de sortie TP avec glissement défavorable plafonné.
 */
export function resolveTakeProfitExitPrice(trade, candle) {
  const tp = trade.take_profit;
  if (tp == null) return tp;
  const allowance = slippageAllowance(trade.symbol, candle);

  if (trade.type === 'BUY') {
    if (candle.high < tp) return Number(tp.toFixed(2));
    const fill = Math.max(tp, candle.high - allowance);
    return Number(Math.min(candle.high, fill).toFixed(2));
  }

  if (candle.low > tp) return Number(tp.toFixed(2));
  const fill = Math.min(tp, candle.low + allowance);
  return Number(Math.max(candle.low, fill).toFixed(2));
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
      const exit = resolveStopLossExitPrice(trade, candle);
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
          exitPrice: exit,
        });
      }
      continue;
    }

    if (tpHit(trade, candle)) {
      const exit = resolveTakeProfitExitPrice(trade, candle);
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
          exitPrice: exit,
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
