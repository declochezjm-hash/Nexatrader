/**
 * Import CSV / JSON OHLC pour le graphique.
 * Colonnes acceptées : time|date|timestamp, open, high, low, close
 */

function parseTimeValue(raw) {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (Number.isFinite(n)) {
    if (n > 1e12) return Math.floor(n / 1000);
    if (n > 1e9) return Math.floor(n);
  }
  const d = new Date(String(raw).trim().replace(' ', 'T'));
  const ms = d.getTime();
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / 1000);
}

function rowToCandle(row, symbol) {
  const time = parseTimeValue(row.time ?? row.date ?? row.timestamp ?? row.datetime);
  const open = Number(row.open ?? row.o);
  const high = Number(row.high ?? row.h);
  const low = Number(row.low ?? row.l);
  const close = Number(row.close ?? row.c);
  if (time == null || ![open, high, low, close].every(Number.isFinite)) return null;
  return { time, open, high, low, close, symbol };
}

function parseCsv(text, symbol) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const sep = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase());
  const candles = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(sep);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx]?.trim();
    });
    const c = rowToCandle(row, symbol);
    if (c) candles.push(c);
  }

  candles.sort((a, b) => a.time - b.time);
  return candles;
}

function parseJson(text, symbol) {
  const data = JSON.parse(text);
  const arr = Array.isArray(data) ? data : data.candles ?? data.data ?? [];
  const candles = [];
  for (const item of arr) {
    const c = rowToCandle(item, symbol);
    if (c) candles.push(c);
  }
  candles.sort((a, b) => a.time - b.time);
  return candles;
}

export function parseCandleFile(text, filename, symbol) {
  const lower = (filename ?? '').toLowerCase();
  if (lower.endsWith('.json')) {
    return parseJson(text, symbol);
  }
  return parseCsv(text, symbol);
}

export const SAMPLE_CSV = `time,open,high,low,close
1730000000,2650.5,2652.1,2649.2,2651.0
1730000900,2651.0,2653.4,2650.8,2652.2
1730001800,2652.2,2654.0,2651.5,2653.1
`;

export function downloadSampleCsv() {
  const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'nexatrader-exemple-bougies.csv';
  a.click();
  URL.revokeObjectURL(url);
}
