import { getDb } from './db.js';

export async function fetchAllTrades() {
  const db = getDb();
  if (!db) return [];
  return db.query(
    `SELECT id, symbol, type, lot_size, risk_percent, entry_price, exit_price,
            stop_loss, take_profit, pnl, status, created_at
     FROM trades
     ORDER BY id ASC`,
  );
}

function closedTrades(trades) {
  return trades.filter((t) =>
    ['closed', 'emergency_closed'].includes(String(t.status).toLowerCase()),
  );
}

function winRate(list) {
  const closed = closedTrades(list);
  if (!closed.length) return 0;
  const wins = closed.filter((t) => (t.pnl ?? 0) > 0).length;
  return Number(((wins / closed.length) * 100).toFixed(1));
}

function profitFactor(list) {
  const closed = closedTrades(list);
  const gains = closed.filter((t) => (t.pnl ?? 0) > 0).reduce((s, t) => s + t.pnl, 0);
  const losses = Math.abs(
    closed.filter((t) => (t.pnl ?? 0) < 0).reduce((s, t) => s + t.pnl, 0),
  );
  if (losses === 0) return gains > 0 ? Infinity : 0;
  return Number((gains / losses).toFixed(2));
}

function averageRR(list) {
  const closed = closedTrades(list).filter(
    (t) => t.entry_price != null && t.stop_loss != null && t.exit_price != null,
  );
  if (!closed.length) return 0;

  const ratios = closed.map((t) => {
    const risk = Math.abs(t.entry_price - t.stop_loss) || 1;
    const reward =
      t.type === 'BUY'
        ? t.exit_price - t.entry_price
        : t.entry_price - t.exit_price;
    return reward / risk;
  });

  const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  return Number(avg.toFixed(2));
}

function hourlyDistribution(trades) {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    pnl: 0,
    trades: 0,
  }));

  for (const t of closedTrades(trades)) {
    const hour = t.created_at ? new Date(t.created_at).getUTCHours() : 0;
    buckets[hour].pnl += t.pnl ?? 0;
    buckets[hour].trades += 1;
  }

  return buckets.sort((a, b) => b.pnl - a.pnl);
}

/** Calcul synchrone à partir d’une liste trades (SQLite ou contexte). */
export function buildPerformanceMetrics(trades, challenge = null) {
  const closed = closedTrades(trades);
  const open = trades.filter((t) =>
    ['open', 'pending'].includes(String(t.status).toLowerCase()),
  );
  const xau = trades.filter((t) => t.symbol === 'XAUUSD');
  const nas = trades.filter((t) => t.symbol === 'NAS100');

  const totalPnl = closed.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const wins = closed.filter((t) => (t.pnl ?? 0) > 0).length;
  const losses = closed.filter((t) => (t.pnl ?? 0) < 0).length;

  return {
    totalTrades: trades.length,
    closedTrades: closed.length,
    openTrades: open.length,
    wins,
    losses,
    totalPnl: Number(totalPnl.toFixed(2)),
    winRateGlobal: winRate(trades),
    winRateXAUUSD: winRate(xau),
    winRateNAS100: winRate(nas),
    profitFactor: profitFactor(trades),
    averageRR: averageRR(trades),
    hourlyBuckets: hourlyDistribution(trades),
    trades,
    challengeEquity: challenge?.current_equity ?? null,
    challengeInitial: challenge?.initial_balance ?? null,
    computedAt: Date.now(),
  };
}

export async function computePerformanceMetrics(challenge = null) {
  const trades = await fetchAllTrades();
  return buildPerformanceMetrics(trades, challenge);
}

export function exportTradesJson(trades) {
  return JSON.stringify(trades, null, 2);
}

export function exportTradesCsv(trades) {
  if (!trades.length) return 'id,symbol,type,lot_size,risk_percent,entry_price,exit_price,pnl,status,created_at\n';
  const headers = [
    'id',
    'symbol',
    'type',
    'lot_size',
    'risk_percent',
    'entry_price',
    'exit_price',
    'stop_loss',
    'take_profit',
    'pnl',
    'status',
    'created_at',
  ];
  const lines = trades.map((t) =>
    headers.map((h) => JSON.stringify(t[h] ?? '')).join(','),
  );
  return `${headers.join(',')}\n${lines.join('\n')}`;
}

export function downloadTextFile(filename, content, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
