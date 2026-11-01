import Database from 'better-sqlite3';
import path from 'node:path';
import { app } from 'electron';
import fs from 'node:fs';

const DB_FILENAME = 'trading_local.db';

let db = null;
/** @type {Error | null} */
let dbInitError = null;

function getDbPath() {
  const userData = app.getPath('userData');
  fs.mkdirSync(userData, { recursive: true });
  return path.join(userData, DB_FILENAME);
}

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS ai_pattern_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    pattern_type TEXT NOT NULL,
    upper_wick_ratio REAL NOT NULL DEFAULT 0,
    lower_wick_ratio REAL NOT NULL DEFAULT 0,
    is_liquidity_sweep INTEGER NOT NULL DEFAULT 0,
    trade_hour INTEGER,
    trade_day_of_week INTEGER,
    market_trend TEXT,
    outcome TEXT,
    ai_confidence_score REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS local_challenge (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT NOT NULL DEFAULT 'inactive',
    initial_balance REAL NOT NULL DEFAULT 0,
    current_equity REAL NOT NULL DEFAULT 0,
    starting_daily_balance REAL NOT NULL DEFAULT 0,
    profit_target_percent REAL NOT NULL DEFAULT 0,
    max_daily_loss_percent REAL NOT NULL DEFAULT 0,
    max_overall_loss_percent REAL NOT NULL DEFAULT 0,
    consecutive_losses INTEGER NOT NULL DEFAULT 0,
    failure_reason TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    type TEXT NOT NULL,
    lot_size REAL NOT NULL,
    risk_percent REAL NOT NULL,
    entry_price REAL,
    exit_price REAL,
    stop_loss REAL,
    take_profit REAL,
    pnl REAL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS chart_drawings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    drawing_type TEXT NOT NULL,
    coordinates TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    ai_provider TEXT,
    api_key TEXT,
    is_quick_setup INTEGER NOT NULL DEFAULT 0,
    first_launch_completed INTEGER NOT NULL DEFAULT 0
  )`,
  `INSERT OR IGNORE INTO app_settings (id, is_quick_setup, first_launch_completed)
   VALUES (1, 0, 0)`,
];

export function isDatabaseReady() {
  return Boolean(db) && !dbInitError;
}

export function getDatabaseStatus() {
  return {
    ready: isDatabaseReady(),
    error: dbInitError?.message ?? null,
    path: isDatabaseReady() ? getDbPath() : null,
  };
}

/**
 * @returns {{ ok: boolean, error?: string, path?: string }}
 */
export function initDatabase() {
  if (db) {
    ensureDatabaseSchema();
    return { ok: true, path: getDbPath() };
  }

  dbInitError = null;

  try {
    const dbPath = getDbPath();
    db = new Database(dbPath);

    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    const migrate = db.transaction(() => {
      for (const sql of SCHEMA_STATEMENTS) {
        db.exec(sql);
      }
    });
    migrate();
    ensureDatabaseSchema();

    return { ok: true, path: dbPath };
  } catch (error) {
    dbInitError = error instanceof Error ? error : new Error(String(error));
    db = null;
    console.error('[NexaTrader SQLite] Échec initialisation:', dbInitError.message);
    return { ok: false, error: dbInitError.message };
  }
}

function runOptionalMigrations(database) {
  const columns = [
    { name: 'default_risk_percent', ddl: 'REAL NOT NULL DEFAULT 1.0' },
    { name: 'enabled_indicators', ddl: "TEXT NOT NULL DEFAULT 'wicks,propguard,ai'" },
    { name: 'auto_pilot', ddl: 'INTEGER NOT NULL DEFAULT 0' },
    { name: 'google_access_token', ddl: 'TEXT' },
    { name: 'google_refresh_token', ddl: 'TEXT' },
    { name: 'google_token_expires_at', ddl: 'TEXT' },
    { name: 'google_account_email', ddl: 'TEXT' },
    { name: 'google_oauth_client_id', ddl: 'TEXT' },
    { name: 'paper_trading', ddl: 'INTEGER NOT NULL DEFAULT 1' },
    { name: 'market_provider', ddl: "TEXT NOT NULL DEFAULT 'simulated'" },
    { name: 'market_api_key', ddl: 'TEXT' },
  ];
  const challengeColumns = [{ name: 'anti_tilt_until', ddl: 'TEXT' }];
  for (const col of columns) {
    const exists = database
      .prepare(`SELECT 1 FROM pragma_table_info('app_settings') WHERE name = ?`)
      .get(col.name);
    if (!exists) {
      database.exec(`ALTER TABLE app_settings ADD COLUMN ${col.name} ${col.ddl}`);
    }
  }
  for (const col of challengeColumns) {
    const exists = database
      .prepare(`SELECT 1 FROM pragma_table_info('local_challenge') WHERE name = ?`)
      .get(col.name);
    if (!exists) {
      database.exec(`ALTER TABLE local_challenge ADD COLUMN ${col.name} ${col.ddl}`);
    }
  }
}

export function ensureDatabaseSchema() {
  if (!db) return;
  runOptionalMigrations(db);
}

export function getDatabase() {
  if (!isDatabaseReady()) {
    throw new Error(dbInitError?.message ?? 'Base de données non initialisée.');
  }
  ensureDatabaseSchema();
  return db;
}

export function closeDatabase() {
  if (db) {
    try {
      db.close();
    } catch {
      /* ignore */
    }
    db = null;
  }
}
