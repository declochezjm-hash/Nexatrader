const TIMEFRAME_TO_TWELVE = {
  '1m': '1min',
  '5m': '5min',
  '15m': '15min',
  '1h': '1h',
  '1D': '1day',
};

const SYMBOL_TO_TWELVE = {
  XAUUSD: 'XAU/USD',
  NAS100: 'NDX',
};

const TIMEFRAME_TO_FINNHUB = {
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '1h': '60',
  '1D': 'D',
};

const SYMBOL_TO_FINNHUB = {
  XAUUSD: 'OANDA:XAU_USD',
  NAS100: 'OANDA:NAS100_USD',
};

function parseTwelveTime(value) {
  if (typeof value === 'number') return value;
  const d = new Date(String(value).replace(' ', 'T'));
  const ms = d.getTime();
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / 1000);
}

function normalizeCandles(rows, symbol) {
  const out = [];
  for (const row of rows) {
    const time = Number(row.time);
    if (!Number.isFinite(time)) continue;
    const open = Number(row.open);
    const high = Number(row.high);
    const low = Number(row.low);
    const close = Number(row.close);
    if (![open, high, low, close].every(Number.isFinite)) continue;
    out.push({ time, open, high, low, close, symbol });
  }
  out.sort((a, b) => a.time - b.time);
  const deduped = [];
  for (const c of out) {
    if (deduped.length && deduped[deduped.length - 1].time === c.time) {
      deduped[deduped.length - 1] = c;
    } else {
      deduped.push(c);
    }
  }
  return deduped;
}

async function fetchTwelveDataCandles({ apiKey, symbol, timeframe, outputsize = 500 }) {
  const key = apiKey?.trim() || process.env.TWELVEDATA_API_KEY || process.env.TWELVE_DATA_API_KEY || '';
  if (!key) {
    throw new Error('Clé Twelve Data manquante (gratuite sur twelvedata.com).');
  }

  const tdSymbol = SYMBOL_TO_TWELVE[symbol] ?? symbol;
  const interval = TIMEFRAME_TO_TWELVE[timeframe] ?? '15min';
  const url = new URL('https://api.twelvedata.com/time_series');
  url.searchParams.set('symbol', tdSymbol);
  url.searchParams.set('interval', interval);
  url.searchParams.set('outputsize', String(outputsize));
  url.searchParams.set('apikey', key);
  url.searchParams.set('format', 'JSON');

  const response = await fetch(url.toString());
  const json = await response.json();
  if (json.status === 'error' || json.code != null) {
    throw new Error(json.message ?? json.code ?? 'Twelve Data a refusé la requête.');
  }
  const values = json.values ?? [];
  const rows = values.map((v) => ({
    time: parseTwelveTime(v.datetime),
    open: v.open,
    high: v.high,
    low: v.low,
    close: v.close,
  }));
  return normalizeCandles(rows.filter((r) => r.time != null), symbol);
}

async function fetchFinnhubCandles({ apiKey, symbol, timeframe }) {
  const key = apiKey?.trim() || process.env.FINNHUB_API_KEY || '';
  if (!key) {
    throw new Error('Clé Finnhub manquante (gratuite sur finnhub.io).');
  }

  const fhSymbol = SYMBOL_TO_FINNHUB[symbol];
  if (!fhSymbol) {
    throw new Error(`Symbole ${symbol} non mappé pour Finnhub.`);
  }

  const resolution = TIMEFRAME_TO_FINNHUB[timeframe] ?? '15';
  const to = Math.floor(Date.now() / 1000);
  const intervalSec = { '1': 60, '5': 300, '15': 900, '60': 3600, D: 86400 }[resolution] ?? 900;
  const from = to - intervalSec * 300;

  const url = new URL('https://finnhub.io/api/v1/forex/candle');
  url.searchParams.set('symbol', fhSymbol);
  url.searchParams.set('resolution', resolution);
  url.searchParams.set('from', String(from));
  url.searchParams.set('to', String(to));
  url.searchParams.set('token', key);

  const response = await fetch(url.toString());
  const json = await response.json();
  if (json.s !== 'ok' || !json.t?.length) {
    throw new Error(json.error ?? 'Finnhub : pas de bougies (quota ou symbole).');
  }

  const rows = json.t.map((time, i) => ({
    time,
    open: json.o[i],
    high: json.h[i],
    low: json.l[i],
    close: json.c[i],
  }));
  return normalizeCandles(rows, symbol);
}

export async function fetchLiveCandles(payload) {
  const { provider, apiKey, symbol, timeframe } = payload;
  if (provider === 'finnhub') {
    return fetchFinnhubCandles({ apiKey, symbol, timeframe });
  }
  return fetchTwelveDataCandles({ apiKey, symbol, timeframe });
}

export async function testMarketConnection(payload) {
  const candles = await fetchLiveCandles({ ...payload, symbol: payload.symbol ?? 'XAUUSD', timeframe: '15m' });
  if (!candles.length) {
    throw new Error('Connexion OK mais aucune bougie reçue.');
  }
  return {
    provider: payload.provider ?? 'twelve_data',
    candleCount: candles.length,
    lastClose: candles[candles.length - 1].close,
    lastTime: candles[candles.length - 1].time,
  };
}
