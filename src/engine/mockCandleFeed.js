const TIMEFRAME_SECONDS = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '1D': 86400,
};

const BASE_PRICES = {
  XAUUSD: 2650,
  NAS100: 18500,
};

const VOLATILITY = {
  XAUUSD: { step: 0.8, wick: 2.2 },
  NAS100: { step: 12, wick: 35 },
};

function seededNoise(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function alignTime(unix, intervalSec) {
  return Math.floor(unix / intervalSec) * intervalSec;
}

/**
 * Génère un historique de bougies OHLC.
 */
export function generateHistoricalCandles(symbol, timeframe, count = 240) {
  const intervalSec = TIMEFRAME_SECONDS[timeframe] ?? 900;
  const base = BASE_PRICES[symbol] ?? 100;
  const vol = VOLATILITY[symbol] ?? VOLATILITY.XAUUSD;

  let now = alignTime(Math.floor(Date.now() / 1000), intervalSec);
  const candles = [];

  let price = base;
  for (let i = count - 1; i >= 0; i -= 1) {
    const time = now - i * intervalSec;
    const n1 = seededNoise(time + symbol.length);
    const n2 = seededNoise(time * 1.37);
    const drift = (n1 - 0.5) * vol.step * 2;
    const open = price;
    const close = open + drift;
    const wickUp = n2 * vol.wick;
    const wickDown = (1 - n2) * vol.wick;
    const high = Math.max(open, close) + wickUp;
    const low = Math.min(open, close) - wickDown;
    candles.push({ time, open, high, low, close, symbol });
    price = close;
  }

  return candles;
}

/**
 * Met à jour la dernière bougie ou en crée une nouvelle selon le tick simulé.
 */
export function applySimulatedTick(candles, symbol, timeframe, tickIndex) {
  if (!candles.length) {
    return generateHistoricalCandles(symbol, timeframe, 120);
  }

  const intervalSec = TIMEFRAME_SECONDS[timeframe] ?? 900;
  const vol = VOLATILITY[symbol] ?? VOLATILITY.XAUUSD;
  const next = [...candles];
  const last = { ...next[next.length - 1] };
  const now = Math.floor(Date.now() / 1000);
  const bucket = alignTime(now, intervalSec);

  const n = seededNoise(now + tickIndex + symbol.charCodeAt(0));
  const delta = (n - 0.5) * vol.step;

  if (bucket > last.time) {
    const open = last.close;
    const close = open + delta;
    next.push({
      time: bucket,
      open,
      high: Math.max(open, close) + vol.wick * 0.35,
      low: Math.min(open, close) - vol.wick * 0.35,
      close,
      symbol,
    });
    if (next.length > 400) next.shift();
    return next;
  }

  last.close = last.close + delta;
  last.high = Math.max(last.high, last.close + vol.wick * 0.2);
  last.low = Math.min(last.low, last.close - vol.wick * 0.2);
  next[next.length - 1] = last;
  return next;
}

export function getTimeframeSeconds(timeframe) {
  return TIMEFRAME_SECONDS[timeframe] ?? 900;
}
