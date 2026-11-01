import { fetchActiveChallenge, getDb } from './db.js';
import { syncChallengeEquity } from './challengeEquity.js';

const ALLOWED_SYMBOLS = new Set(['XAUUSD', 'NAS100']);
const ALLOWED_TYPES = new Set(['BUY', 'SELL']);
const ALLOWED_STATUS = new Set(['open', 'closed', 'pending', 'emergency_closed']);

const EDITABLE_FIELDS = [
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
];

export async function fetchTradeDetail(tradeId) {
  const db = getDb();
  if (!db || !tradeId) return null;
  return db.get(`SELECT * FROM trades WHERE id = ?`, [tradeId]);
}

function normalizePatch(patch) {
  const out = {};
  if (patch.symbol != null) {
    const s = String(patch.symbol).toUpperCase();
    if (!ALLOWED_SYMBOLS.has(s)) throw new Error('Symbole invalide (XAUUSD ou NAS100).');
    out.symbol = s;
  }
  if (patch.type != null) {
    const t = String(patch.type).toUpperCase();
    if (!ALLOWED_TYPES.has(t)) throw new Error('Type invalide (BUY ou SELL).');
    out.type = t;
  }
  if (patch.status != null) {
    const st = String(patch.status).toLowerCase();
    if (!ALLOWED_STATUS.has(st)) throw new Error('Statut invalide.');
    out.status = st;
  }
  for (const key of ['lot_size', 'risk_percent', 'entry_price', 'exit_price', 'stop_loss', 'take_profit', 'pnl']) {
    if (patch[key] === '' || patch[key] == null) continue;
    const n = Number(patch[key]);
    if (!Number.isFinite(n)) throw new Error(`Valeur numérique invalide : ${key}`);
    out[key] = n;
  }
  return out;
}

async function afterTradeMutation() {
  const challenge = await fetchActiveChallenge();
  if (challenge) {
    await syncChallengeEquity(challenge);
  }
}

export async function updateTradeRecord(tradeId, patch) {
  const db = getDb();
  if (!db) throw new Error('SQLite indisponible.');
  const normalized = normalizePatch(patch);
  const keys = Object.keys(normalized).filter((k) => EDITABLE_FIELDS.includes(k));
  if (!keys.length) return fetchTradeDetail(tradeId);

  const sets = keys.map((k) => `${k} = ?`).join(', ');
  const params = keys.map((k) => normalized[k]);
  params.push(tradeId);

  await db.run(`UPDATE trades SET ${sets} WHERE id = ?`, params);
  await afterTradeMutation();
  return fetchTradeDetail(tradeId);
}

export async function deleteTradeRecord(tradeId) {
  const db = getDb();
  if (!db) throw new Error('SQLite indisponible.');
  const row = await fetchTradeDetail(tradeId);
  if (!row) throw new Error('Trade introuvable.');

  try {
    await db.run(`DELETE FROM journal_notes WHERE trade_id = ?`, [tradeId]);
  } catch {
    /* colonne optionnelle */
  }
  await db.run(`DELETE FROM trades WHERE id = ?`, [tradeId]);
  await afterTradeMutation();
  return { ok: true, deletedId: tradeId };
}
