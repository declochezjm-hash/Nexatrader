/**
 * Twelve Data — flux autonome sans clé API.
 * Moteur de ticks (order flow, sessions, spread dynamique) + agrégation multi-timeframe.
 * Interface compatible avec une WebSocket Twelve Data (subscribe / onTick / onCandleClose).
 */

export const TIMEFRAME_SECONDS = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '1D': 86400,
};

export const MULTI_TF_KEYS = ['1m', '5m', '15m', '1h', '1D'];

const BASE_PRICES = {
  XAUUSD: 2650,
  NAS100: 18500,
};

const ASSET_PROFILE = {
  XAUUSD: {
    tickVol: 0.045,
    barVol: 0.85,
    wickFactor: 2.4,
    spreadMin: 0.2,
    spreadMax: 0.35,
    spreadSessionBump: 0.06,
  },
  NAS100: {
    tickVol: 0.55,
    barVol: 11,
    wickFactor: 32,
    spreadMin: 1.2,
    spreadMax: 2.0,
    spreadSessionBump: 0.35,
  },
};

function seededNoise(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function alignTime(unix, intervalSec) {
  return Math.floor(unix / intervalSec) * intervalSec;
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

/** Multiplicateur de volatilité selon la session (UTC). */
export function sessionVolatilityMultiplier(symbol, unixSec = Math.floor(Date.now() / 1000)) {
  const hour = new Date(unixSec * 1000).getUTCHours();
  if (symbol === 'NAS100') {
    if (hour >= 14 && hour < 21) return 1.45;
    if (hour >= 12 && hour < 14) return 1.15;
    return 0.75;
  }
  if (hour >= 13 && hour < 21) return 1.35;
  if (hour >= 7 && hour < 13) return 1.2;
  return 0.85;
}

export function computeDynamicSpread(symbol, { sessionMult = 1, microVol = 0.5, tickIndex = 0 } = {}) {
  const p = ASSET_PROFILE[symbol] ?? ASSET_PROFILE.XAUUSD;
  const n = seededNoise(tickIndex * 0.71 + symbol.length);
  const sessionPart = sessionMult > 1.1 ? p.spreadSessionBump : 0;
  const spike = tickIndex % 29 === 0 ? (p.spreadMax - p.spreadMin) * 0.35 : 0;
  const raw = p.spreadMin + n * (p.spreadMax - p.spreadMin) * 0.55 + sessionPart + microVol * 0.04 + spike;
  return Number(clamp(raw, p.spreadMin, p.spreadMax).toFixed(symbol === 'XAUUSD' ? 3 : 2));
}

export function candleAmplitude(candle) {
  const range = Math.max(candle.high - candle.low, 1e-9);
  const bodyTop = Math.max(candle.open, candle.close);
  const bodyBottom = Math.min(candle.open, candle.close);
  return {
    range: Number(range.toFixed(4)),
    body: Number((bodyTop - bodyBottom).toFixed(4)),
    upperWick: Number((candle.high - bodyTop).toFixed(4)),
    lowerWick: Number((bodyBottom - candle.low).toFixed(4)),
    bodyRatio: Number(((bodyTop - bodyBottom) / range).toFixed(4)),
  };
}

function emptyCandle(time, open, symbol) {
  return { time, open, high: open, low: open, close: open, symbol };
}

function createMultiTfState(symbol, anchorPrice, nowSec) {
  const state = {};
  for (const tf of MULTI_TF_KEYS) {
    const sec = TIMEFRAME_SECONDS[tf];
    const bucket = alignTime(nowSec, sec);
    state[tf] = { bucket, candle: emptyCandle(bucket, anchorPrice, symbol) };
  }
  return state;
}

function syncMultiTfFromChart(multiTf, lastChartCandle, symbol) {
  if (!lastChartCandle) return;
  const chartTf = lastChartCandle.time;
  for (const tf of MULTI_TF_KEYS) {
    const sec = TIMEFRAME_SECONDS[tf];
    const bucket = alignTime(chartTf, sec);
    if (multiTf[tf].bucket === bucket) {
      multiTf[tf].candle = { ...lastChartCandle, symbol };
    }
  }
}

/**
 * Historique OHLC réaliste (sessions + mèches).
 */
export function generateHistoricalCandles(symbol, timeframe, count = 240) {
  const intervalSec = TIMEFRAME_SECONDS[timeframe] ?? 900;
  const base = BASE_PRICES[symbol] ?? 100;
  const profile = ASSET_PROFILE[symbol] ?? ASSET_PROFILE.XAUUSD;

  let now = alignTime(Math.floor(Date.now() / 1000), intervalSec);
  const candles = [];
  let price = base;

  for (let i = count - 1; i >= 0; i -= 1) {
    const time = now - i * intervalSec;
    const sessionMult = sessionVolatilityMultiplier(symbol, time);
    const n1 = seededNoise(time + symbol.length);
    const n2 = seededNoise(time * 1.37);
    const drift = (n1 - 0.5) * profile.barVol * 2 * sessionMult;
    const open = price;
    const close = open + drift;
    const wickUp = n2 * profile.wickFactor * sessionMult;
    const wickDown = (1 - n2) * profile.wickFactor * sessionMult;
    const high = Math.max(open, close) + wickUp;
    const low = Math.min(open, close) - wickDown;
    candles.push({ time, open, high, low, close, symbol });
    price = close;
  }

  return candles;
}

export function getTimeframeSeconds(timeframe) {
  return TIMEFRAME_SECONDS[timeframe] ?? 900;
}

function createInternalState(symbol, chartTimeframe) {
  const now = Math.floor(Date.now() / 1000);
  const base = BASE_PRICES[symbol] ?? 100;
  return {
    symbol,
    chartTimeframe,
    midPrice: base,
    tickIndex: 0,
    orderFlow: 0,
    microVol: 0.4,
    spread: computeDynamicSpread(symbol, { tickIndex: 0 }),
    multiTf: createMultiTfState(symbol, base, now),
  };
}

function applyOrderFlowTick(state, delta) {
  state.orderFlow = clamp(state.orderFlow * 0.9 + Math.sign(delta) * 0.12, -1, 1);
  const bias = state.orderFlow * state.microVol * 0.35;
  return delta + bias;
}

function maybeMicroWick(state, mid, profile, sessionMult) {
  const n = seededNoise(state.tickIndex * 3.17);
  const sweep = n > 0.992 ? profile.wickFactor * 0.25 * sessionMult : 0;
  const up = profile.tickVol * sessionMult * (0.3 + n * 0.7) + sweep;
  const down = profile.tickVol * sessionMult * (0.3 + (1 - n) * 0.7) + sweep * 0.5;
  return { up, down, sweep: sweep > 0 };
}

function updateMultiTfBuckets(state, mid, nowSec, onClose) {
  const closed = [];
  for (const tf of MULTI_TF_KEYS) {
    const sec = TIMEFRAME_SECONDS[tf];
    const bucket = alignTime(nowSec, sec);
    const slot = state.multiTf[tf];
    if (bucket > slot.bucket) {
      const amplitude = candleAmplitude(slot.candle);
      closed.push({
        symbol: state.symbol,
        timeframe: tf,
        candle: { ...slot.candle },
        amplitude,
        event: 'candle_close',
      });
      slot.bucket = bucket;
      slot.candle = emptyCandle(bucket, mid, state.symbol);
    }
    const c = slot.candle;
    c.close = mid;
    c.high = Math.max(c.high, mid);
    c.low = Math.min(c.low, mid);
  }
  for (const evt of closed) {
    onClose?.(evt);
  }
  return closed;
}

/**
 * Avance d’un tick sur la série chart (timeframe affiché).
 */
export function advanceFeedTick(candles, state) {
  if (!candles?.length) {
    const seeded = generateHistoricalCandles(state.symbol, state.chartTimeframe, 120);
    return advanceFeedTick(seeded, state);
  }

  const profile = ASSET_PROFILE[state.symbol] ?? ASSET_PROFILE.XAUUSD;
  const intervalSec = TIMEFRAME_SECONDS[state.chartTimeframe] ?? 900;
  const now = Math.floor(Date.now() / 1000);
  const bucket = alignTime(now, intervalSec);
  const sessionMult = sessionVolatilityMultiplier(state.symbol, now);

  state.tickIndex += 1;
  const n = seededNoise(now + state.tickIndex + state.symbol.charCodeAt(0));
  let delta = (n - 0.5) * profile.tickVol * 2 * sessionMult;
  delta = applyOrderFlowTick(state, delta);

  state.microVol = clamp(state.microVol * 0.94 + Math.abs(delta) * 0.4, 0.15, 1.2);
  state.spread = computeDynamicSpread(state.symbol, {
    sessionMult,
    microVol: state.microVol,
    tickIndex: state.tickIndex,
  });

  const next = [...candles];
  const last = { ...next[next.length - 1] };
  let chartClosed = null;

  if (bucket > last.time) {
    const open = last.close;
    const close = open + delta;
    const wick = maybeMicroWick(state, close, profile, sessionMult);
    const newBar = {
      time: bucket,
      open,
      high: Math.max(open, close) + wick.up,
      low: Math.min(open, close) - wick.down,
      close,
      symbol: state.symbol,
    };
    next.push(newBar);
    if (next.length > 520) next.shift();
    state.midPrice = close;
    chartClosed = {
      symbol: state.symbol,
      timeframe: state.chartTimeframe,
      candle: { ...last },
      amplitude: candleAmplitude(last),
      event: 'candle_close',
    };
  } else {
    const mid = last.close + delta;
    const wick = maybeMicroWick(state, mid, profile, sessionMult);
    last.close = mid;
    last.high = Math.max(last.high, mid + wick.up * 0.6, last.open);
    last.low = Math.min(last.low, mid - wick.down * 0.6, last.open);
    if (wick.sweep) {
      last.high = Math.max(last.high, mid + profile.wickFactor * 0.15 * sessionMult);
      last.low = Math.min(last.low, mid - profile.wickFactor * 0.12 * sessionMult);
    }
    next[next.length - 1] = last;
    state.midPrice = mid;
  }

  const multiClosed = updateMultiTfBuckets(state, state.midPrice, now, null);
  const lastCandle = next[next.length - 1];
  const half = state.spread / 2;
  const tick = {
    symbol: state.symbol,
    time: now,
    price: state.midPrice,
    bid: Number((state.midPrice - half).toFixed(2)),
    ask: Number((state.midPrice + half).toFixed(2)),
    spread: state.spread,
    orderFlow: state.orderFlow,
    sessionMult,
    candle: lastCandle,
    candles: next,
  };

  return { candles: next, tick, chartClosed, multiClosed };
}

/**
 * Flux simulé type WebSocket Twelve Data (sans réseau).
 */
export class TwelveDataFeed {
  constructor({ symbol = 'XAUUSD', timeframe = '15m' } = {}) {
    this.symbol = symbol;
    this.timeframe = timeframe;
    this._state = createInternalState(symbol, timeframe);
    this._candles = [];
    this._subscriptions = new Set();
    this._tickHandlers = new Set();
    this._closeHandlers = new Set();
    this._timer = null;
    this._intervalMs = 900;
  }

  subscribe(symbols, { timeframe = this.timeframe } = {}) {
    const list = Array.isArray(symbols) ? symbols : [symbols];
    for (const s of list) {
      this._subscriptions.add(String(s));
    }
    if (timeframe) this.timeframe = timeframe;
    return { subscribed: [...this._subscriptions] };
  }

  unsubscribe(symbols) {
    const list = Array.isArray(symbols) ? symbols : [symbols];
    for (const s of list) {
      this._subscriptions.delete(String(s));
    }
    return { subscribed: [...this._subscriptions] };
  }

  onTick(handler) {
    if (typeof handler !== 'function') return () => {};
    this._tickHandlers.add(handler);
    return () => this._tickHandlers.delete(handler);
  }

  onCandleClose(handler) {
    if (typeof handler !== 'function') return () => {};
    this._closeHandlers.add(handler);
    return () => this._closeHandlers.delete(handler);
  }

  seedCandles(candles) {
    this._candles = candles?.length ? [...candles] : generateHistoricalCandles(this.symbol, this.timeframe, 480);
    const last = this._candles[this._candles.length - 1];
    if (last) {
      this._state.midPrice = last.close;
      syncMultiTfFromChart(this._state.multiTf, last, this.symbol);
    }
    return this._candles;
  }

  getCandles() {
    return this._candles;
  }

  getSpread() {
    return this._state.spread;
  }

  getState() {
    return this._state;
  }

  /** Alias explicite pour NexaTrader. */
  tickOnce() {
    return this._step();
  }

  _step() {
    if (this._subscriptions.size > 0 && !this._subscriptions.has(this.symbol)) {
      return null;
    }

    const prevMulti = { ...this._state.multiTf };
    const result = advanceFeedTick(this._candles, this._state);
    this._candles = result.candles;

    const emitClose = (evt) => {
      for (const h of this._closeHandlers) {
        try {
          h(evt);
        } catch {
          /* listener */
        }
      }
    };

    if (result.chartClosed) emitClose(result.chartClosed);
    for (const evt of result.multiClosed) emitClose(evt);

    for (const h of this._tickHandlers) {
      try {
        h(result.tick);
      } catch {
        /* listener */
      }
    }

    return result;
  }

  start(intervalMs = 900) {
    this.stop();
    this._intervalMs = intervalMs;
    if (!this._candles.length) {
      this.seedCandles(generateHistoricalCandles(this.symbol, this.timeframe, 480));
    }
    if (this._subscriptions.size === 0) {
      this.subscribe(this.symbol, { timeframe: this.timeframe });
    }
    this._timer = setInterval(() => this._step(), this._intervalMs);
    return this;
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  reconfigure({ symbol, timeframe }) {
    this.stop();
    if (symbol) this.symbol = symbol;
    if (timeframe) this.timeframe = timeframe;
    this._state = createInternalState(this.symbol, this.timeframe);
    this._subscriptions.clear();
    this.subscribe(this.symbol, { timeframe: this.timeframe });
    this._candles = generateHistoricalCandles(this.symbol, this.timeframe, 480);
    this.seedCandles(this._candles);
  }
}

export function createTwelveDataFeed(options) {
  return new TwelveDataFeed(options);
}

/** @deprecated Utiliser TwelveDataFeed — compatibilité ascendante. */
export function applySimulatedTick(candles, symbol, timeframe, tickIndex) {
  const state = createInternalState(symbol, timeframe);
  state.tickIndex = tickIndex;
  return advanceFeedTick(candles, state).candles;
}
