import { geminiApiModelsToTry } from '../src/lib/geminiModels.js';

export function resolveGeminiApiKey(apiKey) {
  const k = (apiKey ?? '').trim();
  if (k && k !== 'google_oauth') return k;
  return (
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ??
    process.env.GOOGLE_API_KEY ??
    ''
  ).trim();
}

export function hasGeminiApiKeyInEnv() {
  return Boolean(resolveGeminiApiKey(''));
}

function isModelNotFoundError(status, errText) {
  if (status === 404) return true;
  const t = String(errText).toLowerCase();
  return t.includes('not found') || t.includes('is not supported for generatecontent');
}

/** Modèles Flash disponibles pour cette clé (API ListModels). */
async function discoverGenerativeFlashModels(apiKey) {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();
    return (data.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => String(m.name ?? '').replace(/^models\//, ''))
      .filter((name) => name && /flash/i.test(name))
      .slice(0, 12);
  } catch {
    return [];
  }
}

async function generateOnce({ model, apiKey, accessToken, prompt, resolvedKey, hasToken }) {
  let url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const headers = { 'Content-Type': 'application/json' };

  if (hasToken) {
    headers.Authorization = `Bearer ${accessToken.trim()}`;
  } else {
    url += `?key=${encodeURIComponent(resolvedKey)}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    const err = new Error(`Gemini HTTP ${response.status}: ${errText.slice(0, 240)}`);
    err.status = response.status;
    err.body = errText;
    throw err;
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Réponse Gemini vide.');
  }
  return { text, model };
}

/**
 * Appel Gemini côté processus principal (évite CORS renderer).
 * @param {{ apiKey?: string, accessToken?: string, prompt: string, aiProvider?: string }} payload
 */
export async function callGeminiGenerateContent({
  apiKey,
  accessToken,
  prompt,
  aiProvider,
}) {
  if (typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('Prompt Gemini invalide.');
  }

  const hasToken = Boolean(accessToken?.trim());
  const resolvedKey = resolveGeminiApiKey(apiKey);
  const hasKey = Boolean(resolvedKey);

  if (!hasToken && !hasKey) {
    throw new Error(
      'Clé Gemini absente. Connectez-vous sur aistudio.google.com/apikey avec votre e-mail Google, créez une clé gratuite, puis collez-la dans Paramètres.',
    );
  }

  const models = geminiApiModelsToTry(aiProvider);
  let lastError = null;

  for (const model of models) {
    try {
      const result = await generateOnce({
        model,
        apiKey,
        accessToken,
        prompt,
        resolvedKey,
        hasToken,
      });
      return result.text;
    } catch (error) {
      lastError = error;
      if (error?.status && isModelNotFoundError(error.status, error.body ?? error.message)) {
        continue;
      }
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  if (hasKey && !hasToken) {
    const discovered = await discoverGenerativeFlashModels(resolvedKey);
    for (const model of discovered) {
      if (models.includes(model)) continue;
      try {
        const result = await generateOnce({
          model,
          apiKey,
          accessToken,
          prompt,
          resolvedKey,
          hasToken,
        });
        return result.text;
      } catch (error) {
        lastError = error;
        if (error?.status && isModelNotFoundError(error.status, error.body ?? error.message)) {
          continue;
        }
        throw error instanceof Error ? error : new Error(String(error));
      }
    }
  }

  throw (
    lastError ??
    new Error(
      'Aucun modèle Gemini disponible pour votre clé. Vérifiez AI Studio ou réessayez plus tard.',
    )
  );
}
