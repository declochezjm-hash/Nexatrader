/**
 * Commandes slash du coach — actions UI sans appel Gemini.
 * @returns {{ handled: boolean, reply?: string, action?: object }}
 */
export function parseCoachSlashCommand(raw) {
  const text = raw.trim();
  if (!text.startsWith('/')) {
    return { handled: false };
  }

  const [cmd, ...rest] = text.slice(1).split(/\s+/);
  const arg = rest.join(' ').trim();
  const c = cmd.toLowerCase();

  if (c === 'help' || c === 'aide') {
    return {
      handled: true,
      reply:
        'Commandes : /zoom + | /zoom - | /pause | /resume | /risk 1 | /settings | /tutoriel | /resume-jour',
    };
  }

  if (c === 'zoom') {
    if (arg === '+' || arg === 'in' || arg === 'avant') {
      return { handled: true, action: { type: 'ZOOM_IN' }, reply: 'Zoom avant appliqué sur le graphique.' };
    }
    if (arg === '-' || arg === 'out' || arg === 'arriere' || arg === 'arrière') {
      return { handled: true, action: { type: 'ZOOM_OUT' }, reply: 'Zoom arrière appliqué.' };
    }
    return {
      handled: true,
      reply: 'Usage : /zoom + ou /zoom -',
    };
  }

  if (c === 'pause' || c === 'pause-direct') {
    return {
      handled: true,
      action: { type: 'PAUSE_FEED' },
      reply: 'Flux direct mis en pause — vous pouvez zoomer librement.',
    };
  }

  if (c === 'resume' || c === 'reprendre' || c === 'direct') {
    return {
      handled: true,
      action: { type: 'RESUME_FEED' },
      reply: 'Flux direct repris avec suivi de la dernière bougie.',
    };
  }

  if (c === 'risk' || c === 'risque') {
    const pct = Number(arg.replace(',', '.'));
    if (!Number.isFinite(pct) || pct <= 0 || pct > 5) {
      return { handled: true, reply: 'Usage : /risk 1 (entre 0.1 et 5 %).' };
    }
    return {
      handled: true,
      action: { type: 'SET_RISK', riskPercent: pct },
      reply: `Risque par trade réglé à ${pct} % — enregistrez si besoin via Paramètres.`,
    };
  }

  if (c === 'settings' || c === 'parametres' || c === 'paramètres') {
    return {
      handled: true,
      action: { type: 'OPEN_SETTINGS' },
      reply: 'Ouverture des paramètres.',
    };
  }

  if (c === 'tutoriel' || c === 'tutorial') {
    return {
      handled: true,
      action: { type: 'OPEN_TUTORIAL' },
      reply: 'Tutoriel ouvert.',
    };
  }

  if (c === 'resume-jour' || c === 'journal') {
    return {
      handled: true,
      action: { type: 'DAILY_SUMMARY' },
      reply: 'Génération du résumé journalier…',
    };
  }

  return {
    handled: true,
    reply: `Commande « /${cmd} » inconnue. Tapez /help.`,
  };
}
