export function isGeminiQuotaError(status, body = '') {
  if (status === 429) return true;
  const t = String(body).toLowerCase();
  return t.includes('quota') || t.includes('rate limit') || t.includes('resource_exhausted');
}

export function formatGeminiUserMessage(error) {
  const status = error?.status ?? error?.cause?.status;
  const body = error?.body ?? error?.message ?? '';
  if (isGeminiQuotaError(status, body)) {
    return (
      'Quota Gemini dépassé (limite gratuite). Attendez 1–2 minutes avant un nouveau test, ' +
      'évitez les clics répétés sur « Tester », et consultez aistudio.google.com/apikey. ' +
      'NexaTrader continue avec l’analyse locale SQLite et le coach FAQ.'
    );
  }
  if (status === 403) {
    return 'Accès Gemini refusé (403). Vérifiez que la clé API est valide et active sur Google AI Studio.';
  }
  if (error instanceof Error && error.message) {
    if (error.message.includes('Gemini HTTP')) {
      return formatGeminiUserMessage({ status, body: error.message });
    }
    return error.message.slice(0, 320);
  }
  return 'Erreur Gemini inconnue.';
}
