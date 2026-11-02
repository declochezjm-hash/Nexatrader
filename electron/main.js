import { app, BrowserWindow, ipcMain, nativeTheme, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDotEnv } from './loadEnv.js';
import {
  initDatabase,
  getDatabase,
  closeDatabase,
  isDatabaseReady,
  ensureDatabaseSchema,
  getDatabaseStatus,
  atomicCloseTradeWithPattern,
} from './database.js';
import { callGeminiGenerateContent, hasGeminiApiKeyInEnv } from './geminiBridge.js';
import { loginWithGoogle, refreshGoogleAccessTokenIfNeeded, isGoogleOAuthConfigured } from './googleAuth.js';
import { fetchLiveCandles, testMarketConnection } from './marketDataBridge.js';
import { fetchFinnhubEconomicCalendar } from './economicCalendarBridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadDotEnv(path.join(__dirname, '..'));

const isDev = process.env.NODE_ENV === 'development';
const DEV_SERVER_URL = 'http://localhost:5173';
const DESKTOP_USER_AGENT_TOKEN = 'NexaTraderDesktop/0.1.0';

/** @type {BrowserWindow | null} */
let mainWindow = null;

const READONLY_SQL = /^\s*(SELECT|WITH|PRAGMA)\b/i;

function assertSafeSql(sql) {
  if (typeof sql !== 'string' || sql.trim().length === 0) {
    throw new Error('Requête SQL invalide.');
  }
}

function dbUnavailableResponse() {
  const status = getDatabaseStatus();
  return {
    ok: false,
    code: 'DB_UNAVAILABLE',
    error: status.error ?? 'SQLite indisponible.',
  };
}

function wrapDbHandler(handler) {
  return async (...args) => {
    try {
      if (!isDatabaseReady()) {
        return dbUnavailableResponse();
      }
      const data = await handler(...args);
      return { ok: true, data };
    } catch (error) {
      return {
        ok: false,
        code: 'DB_ERROR',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };
}

function registerDatabaseIpc() {
  ipcMain.handle(
    'db:status',
    wrapDbHandler(async () => {
      ensureDatabaseSchema();
      return getDatabaseStatus();
    }),
  );

  ipcMain.handle(
    'db:query',
    wrapDbHandler(async (_event, { sql, params = [] }) => {
      assertSafeSql(sql);
      if (!READONLY_SQL.test(sql)) {
        throw new Error('db:query accepte uniquement SELECT / WITH / PRAGMA.');
      }
      const stmt = getDatabase().prepare(sql);
      return stmt.all(...params);
    }),
  );

  ipcMain.handle(
    'db:get',
    wrapDbHandler(async (_event, { sql, params = [] }) => {
      assertSafeSql(sql);
      if (!READONLY_SQL.test(sql)) {
        throw new Error('db:get accepte uniquement SELECT / WITH / PRAGMA.');
      }
      const stmt = getDatabase().prepare(sql);
      return stmt.get(...params) ?? null;
    }),
  );

  ipcMain.handle(
    'db:run',
    wrapDbHandler(async (_event, { sql, params = [] }) => {
      assertSafeSql(sql);
      if (READONLY_SQL.test(sql)) {
        throw new Error('db:run n’accepte pas les requêtes en lecture seule.');
      }
      const stmt = getDatabase().prepare(sql);
      const result = stmt.run(...params);
      return {
        changes: result.changes,
        lastInsertRowid: Number(result.lastInsertRowid),
      };
    }),
  );

  ipcMain.handle(
    'db:atomicCloseTrade',
    wrapDbHandler(async (_event, payload) => atomicCloseTradeWithPattern(payload ?? {})),
  );
}

function registerAppIpc() {
  ipcMain.handle('app:getVersion', () => app.getVersion());
  ipcMain.handle('app:getPlatform', () => process.platform);
  ipcMain.handle('app:openExternal', async (_event, url) => {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      throw new Error('URL externe invalide.');
    }
    await shell.openExternal(url);
    return { ok: true };
  });
}

function registerAuthIpc() {
  ipcMain.handle('auth:googleOAuthConfigured', () => ({
    ok: true,
    data: { configured: isGoogleOAuthConfigured() },
  }));

  ipcMain.handle('auth:googleLogin', async () => {
    try {
      if (!isDatabaseReady()) {
        return dbUnavailableResponse();
      }
      const result = await loginWithGoogle();
      return { ok: true, data: result };
    } catch (error) {
      return {
        ok: false,
        code: 'AUTH_ERROR',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}

function registerMarketIpc() {
  ipcMain.handle('market:fetchCandles', async (_event, payload) => {
    try {
      const candles = await fetchLiveCandles(payload ?? {});
      return { ok: true, data: { candles } };
    } catch (error) {
      return {
        ok: false,
        code: 'MARKET_ERROR',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle('market:testConnection', async (_event, payload) => {
    try {
      const data = await testMarketConnection(payload ?? {});
      return { ok: true, data };
    } catch (error) {
      return {
        ok: false,
        code: 'MARKET_ERROR',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}

function registerCalendarIpc() {
  ipcMain.handle('calendar:fetch', async (_event, payload) => {
    try {
      const { apiKey, from, to } = payload ?? {};
      const result = await fetchFinnhubEconomicCalendar(apiKey, from, to);
      return result;
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}

function registerAiIpc() {
  ipcMain.handle('ai:geminiEnvStatus', () => ({
    ok: true,
    data: { hasEnvKey: hasGeminiApiKeyInEnv() },
  }));

  ipcMain.handle('ai:gemini', async (_event, { apiKey, accessToken, prompt, aiProvider }) => {
    try {
      let token = accessToken?.trim() || null;
      if (!token) {
        token = await refreshGoogleAccessTokenIfNeeded();
      }

      const text = await callGeminiGenerateContent({
        apiKey,
        accessToken: token,
        prompt,
        aiProvider,
      });
      return { ok: true, data: { text } };
    } catch (error) {
      return {
        ok: false,
        code: 'AI_ERROR',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}

function createMainWindow() {
  nativeTheme.themeSource = 'dark';

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    title: 'NexaTrader — Desktop',
    backgroundColor: '#0f1419',
    show: false,
    webPreferences: {
      preload: path.resolve(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // Sandbox désactivé : le preload doit exposer contextBridge de façon fiable avec Vite (localhost).
      sandbox: false,
      webSecurity: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error('[NexaTrader] Échec preload:', preloadPath, error);
  });

  const baseUserAgent = mainWindow.webContents.getUserAgent();
  if (!baseUserAgent.includes('NexaTraderDesktop')) {
    mainWindow.webContents.setUserAgent(`${baseUserAgent} ${DESKTOP_USER_AGENT_TOKEN}`);
  }

  const preloadPath = path.resolve(__dirname, 'preload.cjs');
  if (isDev) {
    console.log('[NexaTrader] Preload:', preloadPath);
  }

  if (isDev) {
    mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  const dbBoot = initDatabase();
  if (!dbBoot.ok) {
    console.error('[NexaTrader] SQLite non disponible:', dbBoot.error);
  }

  registerDatabaseIpc();
  registerAppIpc();
  registerAuthIpc();
  registerAiIpc();
  registerMarketIpc();
  registerCalendarIpc();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  closeDatabase();
});
