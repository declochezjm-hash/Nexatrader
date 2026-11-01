import { DEFAULT_GEMINI_SETTINGS_ID } from './geminiModels.js';

const DEFAULT_SETTINGS = {
  id: 1,
  ai_provider: DEFAULT_GEMINI_SETTINGS_ID,
  api_key: '',
  is_quick_setup: 0,
  first_launch_completed: 0,
  default_risk_percent: 1,
  enabled_indicators: 'wicks,propguard,ai',
  auto_pilot: 0,
  paper_trading: 1,
};

export function getDb() {
  if (typeof window !== 'undefined' && window.nexaTrader?.db) {
    return window.nexaTrader.db;
  }
  return null;
}

export async function fetchAppSettings() {
  const db = getDb();
  if (!db) {
    return { ...DEFAULT_SETTINGS, _offline: true };
  }

  if (db.status) {
    const status = await db.status();
    if (status?.ok === false || status?.data?.ready === false) {
      return { ...DEFAULT_SETTINGS, _offline: true, _dbError: status?.data?.error ?? status?.error };
    }
  }

  const row = await db.get('SELECT * FROM app_settings WHERE id = 1');
  return row ?? { ...DEFAULT_SETTINGS };
}

export async function fetchActiveChallenge() {
  const db = getDb();
  if (!db) {
    return null;
  }
  return db.get(
    `SELECT * FROM local_challenge
     WHERE status IN ('active', 'paused')
     ORDER BY id DESC
     LIMIT 1`,
  );
}

export async function fetchRecentTrades(limit = 50) {
  const db = getDb();
  if (!db) {
    return [];
  }
  return db.query(
    `SELECT id, symbol, type, lot_size, risk_percent, pnl, status, created_at
     FROM trades
     ORDER BY id DESC
     LIMIT ?`,
    [limit],
  );
}

export const WGF_READY_DEFAULTS = {
  profit_target_percent: 8,
  max_daily_loss_percent: 5,
  max_overall_loss_percent: 10,
};
