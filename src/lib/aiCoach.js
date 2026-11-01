import { DEFAULT_GEMINI_SETTINGS_ID } from './geminiModels.js';
import { invokeGemini, resolveGeminiAuth } from '../engine/aiService.js';
import { formatGeminiUserMessage } from './geminiErrors.js';
import { TUTORIAL_STEPS } from './tutorialContent.js';

const COACH_WELCOME =
  'Bonjour — je suis le coach NexaTrader. Posez une question sur l’app (graphique, PropGuard, IA) ou demandez un avis sur votre contexte de marché actuel.';

const LOCAL_FAQ = [
  {
    keys: ['gemini', 'clé', 'cle', 'api', 'google', 'oauth'],
    answer:
      'Paramètres → clé gratuite sur aistudio.google.com/apikey, ou OAuth Google (Client ID en Avancé). Sans clé, le score IA utilise la mémoire SQLite locale.',
  },
  {
    keys: ['tracé', 'trace', 'rectangle', 'tendance', 'ligne', 'dessin'],
    answer:
      'Colonne gauche : outils de tracé. Sélection (flèche) : cliquer un tracé, glisser pour déplacer, Suppr pour effacer. Horizontal = 1 clic ; tendance/rectangle = 2 clics.',
  },
  {
    keys: ['kill', 'switch', 'pause'],
    answer:
      'Kill Switch (Ctrl+Shift+K) clôture les positions et met le challenge en pause. « Reprendre le trading » dans le panneau droit réactive le flux.',
  },
  {
    keys: ['bloqu', 'propguard', 'exécution', 'execution'],
    answer:
      'Lisez la liste orange sous ACHAT/VENTE : drawdown WGF, spread, session NAS100, anti-tilt ou Kill Switch. Corrigez le risque % ou attendez la session.',
  },
  {
    keys: ['zoom', 'pause direct', 'suivre', 'graphique'],
    answer:
      'Molette = zoom · glisser = déplacer · Pause direct fige le flux · Reprendre le direct relance · Suivre colle à la dernière bougie · Vue longue = plus d’historique.',
  },
];

function tutorialDigest() {
  return TUTORIAL_STEPS.map((s) => `- ${s.title}: ${s.body.join(' ')}`).join('\n');
}

export function coachWelcomeMessage() {
  return COACH_WELCOME;
}

function localCoachReply(question) {
  const q = question.toLowerCase();
  for (const entry of LOCAL_FAQ) {
    if (entry.keys.some((k) => q.includes(k))) {
      return { text: entry.answer, source: 'local' };
    }
  }
  return {
    text:
      'Je fonctionne hors ligne pour l’instant. Ajoutez une clé Gemini dans Paramètres pour des réponses personnalisées, ou ouvrez le Tutoriel (barre du haut). Questions fréquentes : tracés, PropGuard, Kill Switch, clé API.',
    source: 'local',
  };
}

function buildSessionContext(ctx) {
  const lines = [
    `Actif: ${ctx.symbol} · UT: ${ctx.timeframe}`,
    `Prix: ${ctx.marketPrice ?? '—'} · Spread sim: ${ctx.currentSpread ?? '—'}`,
    `Challenge: ${ctx.challengeStatus ?? '—'} · Équité: ${ctx.equity ?? '—'}`,
    `Score IA: ${ctx.aiSignal ?? 'SKIP'} (${ctx.aiConfidence ?? 0}%) — ${ctx.aiAdvice ?? ''}`,
    `Kill Switch: ${ctx.killSwitchActive ? 'actif' : 'inactif'} · Session tradable: ${ctx.inSession ? 'oui' : 'non'}`,
    `PropGuard bloque ordre: ${ctx.propBlocked ? 'oui' : 'non'}${ctx.propReasons?.length ? ` (${ctx.propReasons.join('; ')})` : ''}`,
  ];
  if (ctx.latestPattern) {
    lines.push(`Dernier pattern graphique: ${ctx.latestPattern}`);
  }
  return lines.join('\n');
}

function buildCoachPrompt(sessionContext, history, userMessage) {
  const transcript = history
    .slice(-8)
    .map((m) => `${m.role === 'user' ? 'Utilisateur' : 'Coach'}: ${m.text}`)
    .join('\n');

  return `
Tu es le coach NexaTrader — assistant pédagogique et trading (simulation prop firm WGF).
Réponds en français, clair et concis (3–8 phrases max sauf si l’utilisateur demande un guide détaillé).
Ne promets jamais de gains. Rappelle que BUY/SELL/ SKIP IA n’est pas un ordre automatique sauf Auto-Pilot activé.
Si la question est hors trading/app, redirige poliment vers NexaTrader.

Référence application :
${tutorialDigest()}

Contexte live utilisateur :
${sessionContext}

Conversation récente :
${transcript || '(début)'}

Question :
${userMessage}
`.trim();
}

/**
 * @param {string} userMessage
 * @param {Array<{ role: 'user'|'assistant', text: string }>} history
 * @param {object} sessionContext
 * @param {object} settings
 */
export async function askCoach(userMessage, history, sessionContext, settings = {}) {
  const trimmed = userMessage.trim();
  if (!trimmed) {
    return { text: 'Écrivez votre question ci-dessous.', source: 'local' };
  }

  const provider = settings.ai_provider ?? DEFAULT_GEMINI_SETTINGS_ID;
  const { accessToken, apiKey } = resolveGeminiAuth(settings);
  const sessionBlock = buildSessionContext(sessionContext);

  if ((!accessToken && !apiKey) || !String(provider).startsWith('gemini')) {
    return localCoachReply(trimmed);
  }

  try {
    const prompt = buildCoachPrompt(sessionBlock, history, trimmed);
    const raw = await invokeGemini(apiKey, accessToken, prompt, provider, {
      temperature: 0.45,
    });
    const text = String(raw ?? '')
      .trim()
      .replace(/^```[\s\S]*?\n/, '')
      .replace(/```$/, '')
      .slice(0, 2400);
    if (!text) {
      return localCoachReply(trimmed);
    }
    return { text, source: 'gemini' };
  } catch (error) {
    const fallback = localCoachReply(trimmed);
    fallback.text = `${fallback.text}\n\n(${formatGeminiUserMessage(error)})`;
    return fallback;
  }
}

export const COACH_QUICK_PROMPTS = [
  '/help — commandes slash',
  'Comment utiliser le graphique et les tracés ?',
  'Pourquoi PropGuard bloque mon ordre ?',
  'Comment configurer Gemini ?',
];
