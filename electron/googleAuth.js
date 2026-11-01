import crypto from 'node:crypto';
import http from 'node:http';
import { shell } from 'electron';
import { getDatabase, isDatabaseReady } from './database.js';

const LOOPBACK_HOST = '127.0.0.1';
const LOOPBACK_PORT = 42813;
const REDIRECT_URI = `http://${LOOPBACK_HOST}:${LOOPBACK_PORT}/callback`;

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/generative-language',
].join(' ');

function isPlaceholderClientId(id) {
  if (!id || !id.trim()) return true;
  const t = id.trim();
  if (t.includes('VOTRE_CLIENT_ID')) return true;
  if (/123456789-xxxx\.apps\.googleusercontent\.com/i.test(t)) return true;
  return false;
}

function getOAuthClientIdFromDb() {
  if (!isDatabaseReady()) return '';
  const row = getDatabase()
    .prepare('SELECT google_oauth_client_id FROM app_settings WHERE id = 1')
    .get();
  return (row?.google_oauth_client_id ?? '').trim();
}

function getOAuthClientId() {
  const fromEnv = (
    process.env.NEXATRADER_GOOGLE_CLIENT_ID ??
    process.env.GOOGLE_CLIENT_ID ??
    ''
  ).trim();
  if (!isPlaceholderClientId(fromEnv)) return fromEnv;

  const fromDb = getOAuthClientIdFromDb();
  if (!isPlaceholderClientId(fromDb)) return fromDb;

  return fromEnv || fromDb;
}

/** Client ID OAuth utilisable (env ou SQLite). */
export function isGoogleOAuthConfigured() {
  return !isPlaceholderClientId(getOAuthClientId());
}

function base64UrlEncode(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function generatePkcePair() {
  const verifier = base64UrlEncode(crypto.randomBytes(32));
  const challenge = base64UrlEncode(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

function saveGoogleTokensToDb({ accessToken, refreshToken, expiresIn, email }) {
  if (!isDatabaseReady()) {
    throw new Error('SQLite indisponible — impossible d’enregistrer le jeton Google.');
  }

  const db = getDatabase();
  const expiresAt = new Date(Date.now() + Number(expiresIn ?? 3600) * 1000).toISOString();

  db.prepare(
    `UPDATE app_settings SET
      ai_provider = 'gemini-2.5-flash',
      api_key = 'google_oauth',
      google_access_token = ?,
      google_refresh_token = ?,
      google_token_expires_at = ?,
      google_account_email = ?
     WHERE id = 1`,
  ).run(accessToken, refreshToken ?? null, expiresAt, email ?? null);
}

async function exchangeCodeForTokens({ code, codeVerifier, clientId }) {
  const body = new URLSearchParams({
    client_id: clientId,
    code,
    code_verifier: codeVerifier,
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT_URI,
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Échange OAuth échoué (${response.status}): ${err.slice(0, 200)}`);
  }

  return response.json();
}

async function fetchGoogleEmail(accessToken) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  const data = await response.json();
  return data.email ?? null;
}

/**
 * OAuth 2.0 Desktop (loopback) — enregistre le jeton dans app_settings.
 */
export function loginWithGoogle() {
  const clientId = getOAuthClientId();
  if (isPlaceholderClientId(clientId)) {
    return Promise.reject(
      new Error(
        'Connexion Google indisponible sans Client ID OAuth. Ajoutez NEXATRADER_GOOGLE_CLIENT_ID dans le fichier .env à la racine du projet, ou collez un Client ID (application de bureau) dans Paramètres → Gemini → Avancé. Alternative : clé API gratuite sur aistudio.google.com/apikey.',
      ),
    );
  }

  const { verifier, challenge } = generatePkcePair();

  return new Promise((resolve, reject) => {
    let settled = false;

    const server = http.createServer(async (req, res) => {
      try {
        if (!req.url?.startsWith('/callback')) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }

        const url = new URL(req.url, `http://${LOOPBACK_HOST}:${LOOPBACK_PORT}`);
        const error = url.searchParams.get('error');
        const code = url.searchParams.get('code');

        if (error) {
          throw new Error(`OAuth refusé : ${error}`);
        }
        if (!code) {
          throw new Error('Code OAuth absent dans le callback.');
        }

        const tokens = await exchangeCodeForTokens({ code, codeVerifier: verifier, clientId });
        const email = await fetchGoogleEmail(tokens.access_token);

        saveGoogleTokensToDb({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresIn: tokens.expires_in,
          email,
        });

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(
          '<html><body style="font-family:sans-serif;background:#0f1419;color:#e2e8f0;padding:24px"><h2>NexaTrader</h2><p>Connexion Google réussie. Vous pouvez fermer cette fenêtre.</p></body></html>',
        );

        if (!settled) {
          settled = true;
          resolve({
            ok: true,
            email,
            expiresIn: tokens.expires_in,
            provider: 'gemini-2.5-flash',
          });
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Erreur de connexion Google.');
        if (!settled) {
          settled = true;
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        server.close();
      }
    });

    server.on('error', (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    });

    server.listen(LOOPBACK_PORT, LOOPBACK_HOST, () => {
      const authUrl = new URL(GOOGLE_AUTH_URL);
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', SCOPES);
      authUrl.searchParams.set('code_challenge', challenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');

      shell.openExternal(authUrl.toString());
    });

    setTimeout(() => {
      if (!settled) {
        settled = true;
        server.close();
        reject(new Error('Délai OAuth dépassé (120 s).'));
      }
    }, 120_000);
  });
}

export async function refreshGoogleAccessTokenIfNeeded() {
  if (!isDatabaseReady()) return null;

  const db = getDatabase();
  const row = db.prepare('SELECT * FROM app_settings WHERE id = 1').get();
  if (!row?.google_refresh_token) return row?.google_access_token ?? null;

  const expiresAt = row.google_token_expires_at
    ? new Date(row.google_token_expires_at).getTime()
    : 0;
  if (expiresAt > Date.now() + 60_000) {
    return row.google_access_token;
  }

  const clientId = getOAuthClientId();
  if (!clientId) return row.google_access_token;

  const body = new URLSearchParams({
    client_id: clientId,
    refresh_token: row.google_refresh_token,
    grant_type: 'refresh_token',
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) return row.google_access_token;

  const tokens = await response.json();
  saveGoogleTokensToDb({
    accessToken: tokens.access_token,
    refreshToken: row.google_refresh_token,
    expiresIn: tokens.expires_in,
    email: row.google_account_email,
  });

  return tokens.access_token;
}
