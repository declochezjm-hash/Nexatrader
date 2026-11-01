const { contextBridge, ipcRenderer } = require('electron');

const ALLOWED_INVOKE_CHANNELS = new Set([
  'db:query',
  'db:run',
  'db:get',
  'db:status',
  'app:getVersion',
  'app:getPlatform',
  'app:openExternal',
  'ai:gemini',
  'auth:googleLogin',
  'auth:googleOAuthConfigured',
  'market:fetchCandles',
  'market:testConnection',
  'ai:geminiEnvStatus',
]);

const ALLOWED_ON_CHANNELS = new Set(['app:theme']);

function assertAllowedInvoke(channel) {
  if (!ALLOWED_INVOKE_CHANNELS.has(channel)) {
    throw new Error(`Canal IPC invoke non autorisé : ${channel}`);
  }
}

function assertAllowedOn(channel) {
  if (!ALLOWED_ON_CHANNELS.has(channel)) {
    throw new Error(`Canal IPC on non autorisé : ${channel}`);
  }
}

async function invokeSafe(channel, payload) {
  return ipcRenderer.invoke(channel, payload);
}

async function dbQuery(sql, params = []) {
  const res = await invokeSafe('db:query', { sql, params });
  if (res?.ok === false) {
    return [];
  }
  return res?.data ?? [];
}

async function dbGet(sql, params = []) {
  const res = await invokeSafe('db:get', { sql, params });
  if (res?.ok === false) {
    return null;
  }
  return res?.data ?? null;
}

async function dbRun(sql, params = []) {
  const res = await invokeSafe('db:run', { sql, params });
  if (res?.ok === false) {
    return {
      changes: 0,
      lastInsertRowid: 0,
      error: res.error,
      code: res.code,
    };
  }
  return res?.data ?? { changes: 0, lastInsertRowid: 0 };
}

contextBridge.exposeInMainWorld('__NEXATRADER_DESKTOP__', true);

contextBridge.exposeInMainWorld('nexaTrader', {
  runtime: {
    isElectron: true,
    appId: 'NexaTraderDesktop',
  },

  invoke(channel, ...args) {
    assertAllowedInvoke(channel);
    return ipcRenderer.invoke(channel, ...args);
  },

  on(channel, listener) {
    assertAllowedOn(channel);
    const subscription = (_event, ...payload) => listener(...payload);
    ipcRenderer.on(channel, subscription);
    return () => ipcRenderer.removeListener(channel, subscription);
  },

  db: {
    status: () => invokeSafe('db:status'),
    query: dbQuery,
    run: dbRun,
    get: dbGet,
  },

  auth: {
    loginWithGoogle: () => invokeSafe('auth:googleLogin'),
    isGoogleOAuthConfigured: () => invokeSafe('auth:googleOAuthConfigured'),
  },

  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
    openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  },

  ai: {
    gemini: (payload) => invokeSafe('ai:gemini', payload),
    geminiEnvStatus: () => invokeSafe('ai:geminiEnvStatus'),
  },

  market: {
    fetchCandles: (payload) => invokeSafe('market:fetchCandles', payload),
    testConnection: (payload) => invokeSafe('market:testConnection', payload),
  },
});
