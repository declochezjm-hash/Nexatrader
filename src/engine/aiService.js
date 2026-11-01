import { DEFAULT_GEMINI_SETTINGS_ID, geminiApiModelsToTry } from '../lib/geminiModels.js';
import { formatGeminiUserMessage, isGeminiQuotaError } from '../lib/geminiErrors.js';

const JSON_SCHEMA_HINT = `{
  "confidenceScore": 85,
  "recommendation": "BUY",
  "advice": "Phrase synthétique."
}`;

function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeRecommendation(value, fallbackDirection = 'SKIP') {
  const v = String(value ?? '').toUpperCase();
  if (v === 'BUY' || v === 'SELL' || v === 'SKIP') return v;
  if (fallbackDirection === 'BUY' || fallbackDirection === 'SELL') return fallbackDirection;
  return 'SKIP';
}

function parseGeminiJson(text) {
  const trimmed = text.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('JSON Gemini introuvable.');
  }
  return JSON.parse(trimmed.slice(start, end + 1));
}

function buildPrompt(candleData, historicalStats) {
  return `
Tu es l'analyste IA de NexaTrader (PropGuard Ultra). Réponds UNIQUEMENT en JSON valide, sans markdown.

Schéma strict :
${JSON_SCHEMA_HINT}

Contexte marché :
- Actif : ${candleData.symbol}
- Pattern : ${candleData.patternType}
- Ratio mèche haute : ${candleData.upperWickRatio}
- Ratio mèche basse : ${candleData.lowerWickRatio}
- Liquidity sweep : ${candleData.isLiquiditySweep ? 'oui' : 'non'}
- Heure UTC : ${candleData.tradeHour}
- Jour (0=dim) : ${candleData.tradeDayOfWeek}
- Direction technique suggérée : ${candleData.suggestedDirection ?? 'NEUTRE'}

Historique SQLite (scope ${historicalStats.scope}) :
- Win rate : ${historicalStats.winRate ?? 'N/A'}%
- Échantillon : ${historicalStats.sampleSize} (W:${historicalStats.wins} / L:${historicalStats.losses})

Règles :
- confidenceScore entier 0-100
- recommendation BUY | SELL | SKIP (SKIP si données faibles ou risque élevé)
- advice : une phrase en français, max 120 caractères
`.trim();
}

function fallbackAnalysis(candleData, historicalStats) {
  const base = historicalStats.winRate ?? 52;
  const sweepBoost = candleData.isLiquiditySweep ? 6 : 0;
  const samplePenalty = historicalStats.sampleSize < 5 ? 12 : 0;
  const confidenceScore = clampScore(base + sweepBoost - samplePenalty);

  let recommendation = 'SKIP';
  if (confidenceScore >= 58 && candleData.suggestedDirection === 'BUY') recommendation = 'BUY';
  if (confidenceScore >= 58 && candleData.suggestedDirection === 'SELL') recommendation = 'SELL';

  const advice =
    historicalStats.sampleSize > 0
      ? `Mémoire locale : ${historicalStats.winRate}% sur ${historicalStats.sampleSize} cas similaires.`
      : 'Peu de données historiques — prudence recommandée.';

  return {
    confidenceScore,
    recommendation,
    advice,
    source: 'sqlite',
  };
}

async function invokeGemini(apiKey, accessToken, prompt, aiProvider, options = {}) {
  if (typeof window !== 'undefined' && window.nexaTrader?.ai?.gemini) {
    const res = await window.nexaTrader.ai.gemini({
      apiKey,
      accessToken,
      prompt,
      aiProvider,
    });
    if (res?.ok === false) {
      throw new Error(res.error ?? 'Appel Gemini échoué.');
    }
    return res?.data?.text ?? res?.text;
  }

  const models = geminiApiModelsToTry(aiProvider);
  let lastError = null;
  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: options.contents ?? [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: options.temperature ?? 0.2,
          ...(options.responseMimeType
            ? { responseMimeType: options.responseMimeType }
            : {}),
        },
      }),
    });
    if (!response.ok) {
      const errText = await response.text();
      if (isGeminiQuotaError(response.status, errText)) {
        throw new Error(formatGeminiUserMessage({ status: response.status, body: errText }));
      }
      lastError = new Error(`Gemini HTTP ${response.status}: ${errText.slice(0, 200)}`);
      if (response.status === 404 || errText.toLowerCase().includes('not found')) {
        continue;
      }
      throw lastError;
    }
    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text;
  }
  throw lastError ?? new Error('Modèle Gemini introuvable.');
}

function resolveGeminiAuth(settings = {}) {
  const accessToken = settings.google_access_token?.trim() || null;
  let apiKey =
    settings.api_key && settings.api_key !== 'google_oauth' ? settings.api_key.trim() : null;
  return { accessToken, apiKey };
}

/**
 * @param {object} candleData
 * @param {object} historicalStats
 * @param {{ ai_provider?: string, api_key?: string }} [settings]
 */
export async function analyzePattern(candleData, historicalStats, settings = {}) {
  const provider = settings.ai_provider ?? DEFAULT_GEMINI_SETTINGS_ID;
  const { accessToken, apiKey } = resolveGeminiAuth(settings);

  if ((!accessToken && !apiKey) || !provider.startsWith('gemini')) {
    return fallbackAnalysis(candleData, historicalStats);
  }

  try {
    const prompt = buildPrompt(candleData, historicalStats);
    const raw = await invokeGemini(apiKey, accessToken, prompt, provider, {
      responseMimeType: 'application/json',
    });
    const parsed = parseGeminiJson(raw);

    return {
      confidenceScore: clampScore(parsed.confidenceScore),
      recommendation: normalizeRecommendation(parsed.recommendation, candleData.suggestedDirection),
      advice: String(parsed.advice ?? '').slice(0, 160) || 'Analyse Gemini indisponible.',
      source: 'gemini',
    };
  } catch {
    return fallbackAnalysis(candleData, historicalStats);
  }
}

export { resolveGeminiAuth, invokeGemini };

export function toAiInsight(analysis) {
  return {
    confidence: analysis.confidenceScore,
    signal: analysis.recommendation,
    advice: analysis.advice,
    source: analysis.source,
  };
}

/**
 * Micro-requête de validation de clé Gemini.
 */
export async function testGeminiConnection(settingsOrKey) {
  const settings =
    typeof settingsOrKey === 'string' ? { api_key: settingsOrKey } : settingsOrKey ?? {};
  const { accessToken, apiKey } = resolveGeminiAuth(settings);

  if (!accessToken && !apiKey) {
    return {
      ok: false,
      message:
        'Collez votre clé API Gemini (gratuite) : ouvrez aistudio.google.com/apikey, connectez-vous avec votre e-mail Google, créez une clé, copiez-la dans Paramètres puis Enregistrer.',
    };
  }

  const prompt = `Réponds UNIQUEMENT en JSON : {"status":"ok","message":"connected"}`;
  const trimmedKey = apiKey?.trim() ?? apiKey;

  try {
    const raw = await invokeGemini(trimmedKey, accessToken, prompt, settings.ai_provider, {
      responseMimeType: 'application/json',
    });
    parseGeminiJson(raw);
    return { ok: true, message: 'Connexion Gemini opérationnelle (modèles Flash).' };
  } catch (error) {
    return {
      ok: false,
      message: formatGeminiUserMessage(error),
    };
  }
}
