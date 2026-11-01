export const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    title: 'Bienvenue sur NexaTrader',
    body: [
      'NexaTrader simule un compte prop firm (WGF) sur XAUUSD et NAS100 — paper trading, PropGuard et journal SQLite.',
      'Utilisez la fenêtre « NexaTrader — Desktop » (npm run dev), pas seulement Firefox sur localhost:5173 (pas de SQLite ni IPC).',
      'Barre du haut : actif, unité de temps, Coach IA, Tutoriel, Analytics, Paramètres.',
    ],
  },
  {
    id: 'layout',
    title: 'Organisation de l’écran',
    body: [
      'Gauche : outils de tracé (sélection, tendance, horizontal, rectangle) — sauvegardés en SQLite.',
      'Centre : graphique, zoom, Pause direct / Reprendre le direct, import CSV, tracés SL/BE.',
      'Droite : PropGuard — jauges WGF, score IA, score discipline, plan de lot, ACHAT/VENTE, Kill Switch.',
      'Bas : journal des trades, replay de session, notes vocales, lien Analytics.',
      'Bouton flottant ou barre : Coach IA (aide app + contexte marché).',
    ],
  },
  {
    id: 'chart',
    title: 'Graphique & tracés',
    body: [
      'Molette : zoom · glisser : déplacer · « Zoom marché » : gros plan · « Vue longue » : plus d’historique.',
      'Pause direct fige le flux ; Reprendre le direct relance les ticks simulés.',
      'Tracés : horizontal = 1 clic ; tendance / rectangle = 2 clics.',
      'Mode sélection (flèche) : cliquer un tracé, glisser pour déplacer, poignées pour ajuster, Suppr pour effacer.',
      'Lignes SL (orange) et BE (bleu) : glisser sur le graphique avant de passer un ordre.',
      'Marqueurs H / SS : signaux mèches du worker.',
    ],
  },
  {
    id: 'plan',
    title: 'Plan capturé → ordre',
    body: [
      '« Capturer » fige entrée, SL et lot à l’écran — ce n’est pas un ordre, seulement une aide à la lecture.',
      'Mode « Lecture » (panneau droit) ralentit score IA et lot pendant que vous analysez.',
      'Si ACHAT/VENTE sont grisés : lisez le message (souvent Kill Switch) → « Reprendre le trading ».',
      'Cliquez VENTE ou ACHAT → checklist pré-ordre (SL, risque %, lecture du score IA) → Confirmer.',
      'Case « Ne plus afficher » dans la checklist : ordres directs (réactivable dans Paramètres).',
    ],
  },
  {
    id: 'trade',
    title: 'Paramètres trading & challenge',
    body: [
      'Paramètres → Challenge prop : capital, objectif +8 %, pertes 5 % / 10 %, nouveau challenge.',
      'Risque par trade (%) : utilisé pour le calcul automatique du lot (PropGuard).',
      'Mode paper : entraînement hors session US et spread simulé élevé toléré.',
      'Auto-Pilot : peut ouvrir un ordre si score IA ≥ 80 % (à activer seulement si vous maîtrisez le risque).',
      'Badge orange « Exécution bloquée » : drawdown, spread, session, anti-tilt — corrigez avant de forcer.',
    ],
  },
  {
    id: 'ai',
    title: 'IA, Coach & Gemini',
    body: [
      'Score BUY / SELL / SKIP : aide à la décision, pas un ordre garanti (sauf Auto-Pilot).',
      'Clé gratuite : Paramètres → Google AI Studio → Tester → Enregistrer. Erreur 429 = quota : attendre 1–2 min.',
      'Sans clé : analyse locale + mémoire SQLite (fallback affiché sur la carte IA).',
      'Coach IA : questions app, PropGuard, commandes /help, /pause, /zoom +, /resume-jour.',
      'Résumé journalier IA : bilan des trades du jour dans le panneau PropGuard.',
    ],
  },
  {
    id: 'journal',
    title: 'Journal, replay & discipline',
    body: [
      'Journal SQLite : liste des trades ; Analytics pour statistiques détaillées.',
      'Replay session (barre du journal) : rejouer l’historique bougie par bougie ; carré = quitter.',
      'Journal vocal : dictée (Chrome/Edge) + Enregistrer → notes en base.',
      'Score discipline WGF : note /100 + conseils (risque, pertes consécutives, drawdown).',
      'Alertes en haut à gauche si PropGuard bloque ou drawdown proche des limites.',
    ],
  },
  {
    id: 'safety',
    title: 'Sécurité prop firm',
    body: [
      'Jauges : drawdown journalier ~5 % max, drawdown total ~10 % max (selon Paramètres challenge).',
      'Kill Switch (Ctrl+Shift+K ou bouton rouge) : clôture les positions et pause le trading.',
      '« Reprendre le trading » réactive ACHAT/VENTE — ne le faites que lorsque vous êtes prêt.',
      'Anti-tilt après pertes consécutives : respectez la pause avant de reprendre.',
    ],
  },
];

export const TRADING_TIPS = [
  {
    category: 'Discipline',
    title: 'Workflow plan → ordre',
    text: 'Capturer → vérifier SL → Reprendre le trading si pause → checklist → VENTE/ACHAT.',
  },
  {
    category: 'Discipline',
    title: 'Risque fixe',
    text: 'Restez à 0,5–1 % par trade sur un challenge ; le lot se recalcule seul.',
  },
  {
    category: 'Discipline',
    title: 'Mode Lecture',
    text: 'Activez « Lecture » sur PropGuard pour figer score et lot le temps de décider.',
  },
  {
    category: 'Discipline',
    title: 'Ne chasez pas',
    text: 'Score SKIP ou PropGuard rouge : attendez un nouveau signal H/SS.',
  },
  {
    category: 'Or (XAUUSD)',
    title: 'Spread & sessions',
    text: 'L’or réagit aux annonces US ; badge spread ou news en mode strict.',
  },
  {
    category: 'Nasdaq (NAS100)',
    title: 'Session cash',
    text: 'NAS100 strict = session US ; en paper, entraînement libre.',
  },
  {
    category: 'Graphique',
    title: 'Replay',
    text: 'Utilisez Replay dans le journal pour revoir une séquence sans stress du live.',
  },
  {
    category: 'Prop firm',
    title: 'Score discipline',
    text: 'Suivez la note WGF à droite : elle résume risque, pertes et drawdown.',
  },
  {
    category: 'IA',
    title: 'Quota Gemini',
    text: 'Trop de tests IA → erreur 429 ; l’app continue en mode SQLite local.',
  },
  {
    category: 'Dépannage',
    title: 'Boutons grisés',
    text: 'Kill Switch → Reprendre le trading. Sinon Paramètres : challenge actif, paper, risque.',
  },
];

/** Guide affiché dans Paramètres — ce qu’il reste à compléter. */
export const PARAMETRES_A_COMPLETER = [
  {
    id: 'challenge',
    title: 'Challenge prop (WGF)',
    done: (ctx) => Boolean(ctx.challenge?.id && ctx.challenge?.status === 'active'),
    help: 'Définissez capital et limites %, puis « Enregistrer les limites » ou « Nouveau challenge ».',
  },
  {
    id: 'market',
    title: 'Données marché',
    done: (ctx) => ctx.marketOk,
    help: 'Mode démo Twelve Data (sans clé) ou live Twelve Data / Finnhub + test connexion. Import CSV possible sur le graphique.',
  },
  {
    id: 'gemini',
    title: 'Clé Gemini (optionnel)',
    done: (ctx) => ctx.geminiOk,
    help: 'AI Studio → clé API → Tester → Enregistrer. Indispensable pour Coach et résumé IA complets.',
  },
  {
    id: 'risk',
    title: 'Risque & paper',
    done: (ctx) => ctx.riskOk,
    help: 'Réglez le risque % (0,5–2) et cochez paper si vous vous entraînez.',
  },
  {
    id: 'sl',
    title: 'Stop loss sur graphique',
    done: () => false,
    help: 'Avant le premier ordre : placez ou validez le SL (ligne orange) sur le chart.',
  },
];

export const TUTORIAL_STORAGE_KEY = 'nexatrader_tutorial_auto_shown';
