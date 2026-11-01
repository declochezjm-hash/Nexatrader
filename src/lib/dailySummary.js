import { invokeGemini, resolveGeminiAuth } from '../engine/aiService.js';
import { DEFAULT_GEMINI_SETTINGS_ID } from './geminiModels.js';
import { formatGeminiUserMessage } from './geminiErrors.js';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function filterTradesToday(trades) {
  const day = todayIsoDate();
  return (trades ?? []).filter((t) => {
    const created = String(t.created_at ?? '').slice(0, 10);
    return created === day && String(t.status).toLowerCase() === 'closed';
  });
}

function buildLocalDailySummary(tradesToday, challenge) {
  if (!tradesToday.length) {
    return {
      text:
        'Aucun trade clôturé aujourd’hui. Concentrez-vous sur la qualité des signaux H/SS et respectez votre risque %.',
      source: 'local',
    };
  }

  const wins = tradesToday.filter((t) => (t.pnl ?? 0) > 0).length;
  const losses = tradesToday.filter((t) => (t.pnl ?? 0) < 0).length;
  const pnlSum = tradesToday.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const equity = challenge?.current_equity ?? challenge?.initial_balance ?? 0;

  return {
    text:
      `Journal du ${todayIsoDate()} : ${tradesToday.length} trade(s), ${wins} gain(s), ${losses} perte(s), PnL net ${pnlSum.toFixed(2)} $. ` +
      `Équité challenge ~${equity.toLocaleString('fr-FR')}. ` +
      (losses >= 2
        ? 'Leçon : ralentissez après deux pertes (anti-tilt PropGuard).'
        : 'Leçon : continuez avec le même risque % fixe.'),
    source: 'local',
  };
}

/**
 * @param {object} params
 * @param {Array} params.trades
 * @param {object|null} params.challenge
 * @param {object} params.settings
 */
export async function generateDailySummary({ trades, challenge, settings }) {
  const tradesToday = filterTradesToday(trades);
  const local = buildLocalDailySummary(tradesToday, challenge);

  const provider = settings?.ai_provider ?? DEFAULT_GEMINI_SETTINGS_ID;
  const { accessToken, apiKey } = resolveGeminiAuth(settings ?? {});
  if ((!accessToken && !apiKey) || !String(provider).startsWith('gemini')) {
    return local;
  }

  const stats = tradesToday.map((t) => ({
    symbol: t.symbol,
    type: t.type,
    pnl: t.pnl,
    risk: t.risk_percent,
  }));

  const prompt = `
Tu es coach NexaTrader. Rédige un résumé journalier en français (5–8 phrases).
Données :
- Date : ${todayIsoDate()}
- Trades clôturés : ${JSON.stringify(stats)}
- Équité challenge : ${challenge?.current_equity ?? 'N/A'}
- Statut : ${challenge?.status ?? 'N/A'}
Inclure : bilan chiffré, une leçon discipline, un rappel PropGuard. Pas de promesse de gains.
`.trim();

  try {
    const raw = await invokeGemini(apiKey, accessToken, prompt, provider, { temperature: 0.35 });
    const text = String(raw ?? '').trim().slice(0, 2000);
    if (!text) return local;
    return { text, source: 'gemini' };
  } catch (error) {
    return {
      text: `${local.text}\n\n(${formatGeminiUserMessage(error)})`,
      source: 'local',
    };
  }
}

export { filterTradesToday, todayIsoDate };
