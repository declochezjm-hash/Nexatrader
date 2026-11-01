/** Modèles essayés dans l’ordre (404 → essai suivant). */
export const GEMINI_API_MODEL_FALLBACKS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-preview-05-20',
  'gemini-flash-latest',
  'gemini-2.0-flash',
  'gemini-1.5-flash-002',
  'gemini-1.5-flash-001',
];

export const DEFAULT_GEMINI_SETTINGS_ID = 'gemini-2.5-flash';

const PROVIDER_TO_PREFERRED_MODEL = {
  'gemini-2.5-flash': 'gemini-2.5-flash',
  'gemini-2.0-flash': 'gemini-2.0-flash',
  'gemini-flash-latest': 'gemini-flash-latest',
  'gemini-1.5-flash': 'gemini-2.5-flash',
};

/** Ancien id SQLite → modèle API courant. */
export function normalizeGeminiSettingsId(aiProvider) {
  if (!aiProvider || aiProvider === 'gemini-1.5-flash') {
    return DEFAULT_GEMINI_SETTINGS_ID;
  }
  return aiProvider;
}

/**
 * @param {string | undefined} aiProvider
 * @returns {string[]}
 */
export function geminiApiModelsToTry(aiProvider) {
  const normalized = normalizeGeminiSettingsId(aiProvider);
  const preferred = PROVIDER_TO_PREFERRED_MODEL[normalized] ?? normalized;
  const ordered = [preferred, ...GEMINI_API_MODEL_FALLBACKS];
  return [...new Set(ordered.filter(Boolean))];
}

export function geminiProviderLabel(aiProvider) {
  const id = normalizeGeminiSettingsId(aiProvider);
  if (id === 'gemini-flash-latest') return 'Gemini Flash (latest)';
  if (id.startsWith('gemini-2.5')) return 'Gemini 2.5 Flash';
  if (id.startsWith('gemini-2.0')) return 'Gemini 2.0 Flash';
  return 'Gemini Flash';
}
