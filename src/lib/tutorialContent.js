/**
 * Contenu tutoriel NexaTrader — aligné sur la stack WGF & innovations (2026).
 * Chaque étape peut définir : subtitle, icon (clé lucide), accent, tags, callout.
 */

export const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    title: 'Centre de référence NexaTrader',
    subtitle: 'Simulation prop firm institutionnelle',
    icon: 'sparkles',
    accent: 'emerald',
    tags: ['Desktop', 'SQLite', 'WGF'],
    body: [
      'NexaTrader est votre laboratoire We Get Funded : programmes 1 Step / 2 Step / Funded, PropGuard Ultra, journal d’audit et exports de dossier.',
      'Lancez toujours la fenêtre « NexaTrader — Desktop » (npm run dev) — seule elle expose SQLite, IPC marché et calendrier Finnhub.',
      'Barre supérieure : actifs, timeframes, Focus (Guardian), Hub WGF, Analytics, Paramètres.',
    ],
    callout: 'Objectif : devenir votre référence avant de trader un vrai compte WGF.',
  },
  {
    id: 'layout',
    title: 'Workspace pro',
    subtitle: 'Cartographie de l’écran',
    icon: 'layout',
    accent: 'sky',
    tags: ['UI', 'Productivité'],
    body: [
      'Gauche : tracés persistés (tendance, horizontal, rectangle) — sélection pour éditer / Suppr.',
      'Centre : graphique Lightweight Charts, pause direct, import CSV, lignes SL & BE draggables.',
      'Droite : PropGuard Ultra — jauges WGF, readiness /100, what-if, replay compliance, Twin trade context.',
      'Bas : journal Trades | Audit WGF (exports CSV/PDF dossier) | replay session bougies.',
      'Coach IA (flottant) : contexte marché + slash commands — masqué en mode Focus.',
    ],
  },
  {
    id: 'wgf',
    title: 'Moteur WGF complet',
    subtitle: 'Programmes & règles officielles simulées',
    icon: 'shield',
    accent: 'emerald',
    tags: ['WGF', 'Phases', 'EOD'],
    body: [
      'Paramètres → Challenge prop : profils WGF (1 Step EOD, 2 Step P1/P2, Funded, Instant) + mode strict vs conservateur.',
      'Reset journalier 00:00 GMT, plancher EOD 1 Step, objectif %, consistency, jours actifs GMT.',
      'One Day Pass (1 Step) : 1 jour min. et consistency off — option dans Paramètres + audit SQLite.',
      'Statuts challenge : active, paused, passed, failed — passage de phase après validation compliance.',
      'Panneau readiness : score /100 + préparation par programme (même historique, limites différentes).',
    ],
    callout: 'Simulateur what-if : testez un PnL hypothétique + comparaison multi-programmes sans écrire en base.',
  },
  {
    id: 'plan',
    title: 'Plan → Twin trade → ordre',
    subtitle: 'Exécution disciplinée',
    icon: 'gitCompare',
    accent: 'violet',
    tags: ['Twin trade', 'Checklist'],
    body: [
      'Capturer fige entrée / SL / contexte IA — ce n’est pas un ordre.',
      'Checklist pré-ordre : le plan est enregistré (Twin trade) et comparé à l’exécution dans la fiche trade.',
      'Mode Lecture : fige lot et score IA pendant l’analyse.',
      'Boutons grisés : lisez PropGuard (Kill Switch, spread, session, anti-tilt) → corrigez puis Reprendre.',
      'Score discipline /100 + heatmap Analytics (jours × heures GMT) pour visualiser vos habitudes.',
    ],
  },
  {
    id: 'chart',
    title: 'Graphique & signaux',
    subtitle: 'Worker 60 FPS',
    icon: 'candlestick',
    accent: 'amber',
    tags: ['XAUUSD', 'NAS100'],
    body: [
      'Molette zoom · drag pan · Zoom marché / Vue longue.',
      'Marqueurs H / SS : mèches or & sweeps Nasdaq via Web Worker.',
      'Replay session (journal) : rejouer les bougies ; PropGuard Replay : rejouer DD après chaque trade clôturé.',
      'Alertes intelligentes (haut gauche) : drawdown, blocages, règles WGF, annonces économiques proches.',
    ],
  },
  {
    id: 'journal',
    title: 'Journal, audit & exports',
    subtitle: 'Traçabilité institutionnelle',
    icon: 'scroll',
    accent: 'sky',
    tags: ['Audit', 'Export'],
    body: [
      'Onglet Trades : replay, fiche, graphique, modification SQLite.',
      'Onglet Audit WGF : pass, fail, reset GMT, EOD, Kill Switch, One Day Pass, changements programme.',
      'Exports CSV dossier complet + HTML imprimable en PDF (métadonnées, readiness, trades, audit).',
      'Analytics : métriques, drill-down, heatmap discipline, export CSV trades.',
    ],
  },
  {
    id: 'ai',
    title: 'IA, Coach & calendrier',
    subtitle: 'Décision augmentée',
    icon: 'brain',
    accent: 'violet',
    tags: ['Gemini', 'Finnhub'],
    body: [
      'Gemini 2.5 Flash : clé AI Studio → Tester → Enregistrer (429 = quota, fallback SQLite).',
      'Coach : /help, /pause, /zoom, résumé journalier PropGuard.',
      'Calendrier économique réel : clé Finnhub + provider live → fusion PropGuard ; sinon NFP/CPI/FOMC simulés.',
      'Mode Focus (Guardian) : masque distractions — idéal session challenge.',
    ],
  },
  {
    id: 'social',
    title: 'Parcours & communauté locale',
    subtitle: 'Optionnel, 100 % offline',
    icon: 'users',
    accent: 'pink',
    tags: ['Social local', 'Onboarding WGF'],
    body: [
      'Paramètres → « J’ai acheté WGF » : wizard capital, programme, PropGuard strict.',
      'Challenge social local (case à cocher) : records personnels, meilleur jour vs historique — sans réseau.',
      'Onboarding initial : profil Prêt à trader vs Personnalisé — complétez la checklist Paramétrage du tutoriel.',
    ],
  },
  {
    id: 'safety',
    title: 'Sécurité & Kill Switch',
    subtitle: 'Non négociable',
    icon: 'alertTriangle',
    accent: 'rose',
    tags: ['PropGuard', 'Risk'],
    body: [
      'Drawdown jour / total ou marge EOD selon programme — jauges + alertes à 80 %.',
      'Kill Switch Ctrl+Shift+K : clôture d’urgence + pause — Reprendre uniquement si plan clair.',
      'Anti-tilt après pertes consécutives : respectez la fenêtre avant de recliquer.',
      'Paper trading : entraînement ; mode WGF strict aligné FAQ pour préparer la vraie évaluation.',
    ],
  },
];

/** Catalogue « référence » — cartes innovation (tab dédié). */
export const TUTORIAL_FEATURE_CATALOG = [
  {
    id: 'whatif',
    title: 'What-if multi-programmes',
    desc: 'Projette PnL et compare pass/fail sur tous les profils WGF.',
    accent: 'violet',
  },
  {
    id: 'pg-replay',
    title: 'PropGuard Replay',
    desc: 'Timeline équité & drawdown après chaque trade clôturé.',
    accent: 'amber',
  },
  {
    id: 'prep',
    title: 'Préparation /100',
    desc: 'Score readiness par programme sur le même historique.',
    accent: 'sky',
  },
  {
    id: 'twin',
    title: 'Twin trade',
    desc: 'Plan capturé vs exécution — score d’alignement.',
    accent: 'violet',
  },
  {
    id: 'guardian',
    title: 'Guardian Focus',
    desc: 'Interface épurée pour sessions challenge.',
    accent: 'violet',
  },
  {
    id: 'heatmap',
    title: 'Heatmap discipline',
    desc: 'Performance par jour GMT et tranche horaire.',
    accent: 'emerald',
  },
  {
    id: 'alerts',
    title: 'Alertes intelligentes',
    desc: 'PropGuard + WGF + annonces économiques.',
    accent: 'amber',
  },
  {
    id: 'audit',
    title: 'Audit & exports',
    desc: 'Journal WGF + dossier CSV / PDF.',
    accent: 'sky',
  },
  {
    id: 'odp',
    title: 'One Day Pass',
    desc: 'Règles 1 Step WGF avec option ODP.',
    accent: 'emerald',
  },
  {
    id: 'calendar',
    title: 'Calendrier Finnhub',
    desc: 'Annonces US live ou simulation.',
    accent: 'sky',
  },
];

export const TRADING_TIPS = [
  {
    category: 'Workflow',
    title: 'Référence WGF',
    text: 'Paramètres → programme WGF → what-if avant grosse journée → export audit en fin de phase.',
  },
  {
    category: 'Workflow',
    title: 'Twin trade',
    text: 'Toujours passer par la checklist pour tracer plan vs exécution dans la fiche trade.',
  },
  {
    category: 'Discipline',
    title: 'Mode Focus',
    text: 'Activez Focus en session evaluation ; désactivez pour configurer ou Analytics.',
  },
  {
    category: 'Discipline',
    title: 'Risque fixe',
    text: '0,5–1 % par trade ; le lot PropGuard suit votre SL graphique.',
  },
  {
    category: 'Discipline',
    title: 'Heatmap',
    text: 'Analytics : repérez vos heures GMT les plus rentables avant d’augmenter la fréquence.',
  },
  {
    category: 'Prop firm',
    title: 'Consistency',
    text: 'Surveillez le panneau compliance ; what-if avec « attribuer à aujourd’hui GMT ».',
  },
  {
    category: 'Prop firm',
    title: 'One Day Pass',
    text: '1 Step uniquement — désactive consistency ; activez seulement si vous simulez l’option WGF.',
  },
  {
    category: 'Or (XAUUSD)',
    title: 'News & spread',
    text: 'Mode conservateur bloque ±15 min annonces ; strict WGF = badges ambre pédagogiques.',
  },
  {
    category: 'Nasdaq (NAS100)',
    title: 'Session cash',
    text: 'Session US en conservateur ; paper pour répétition hors horaires.',
  },
  {
    category: 'IA',
    title: 'Quota Gemini',
    text: 'Erreur 429 : attendez 1–2 min — score local + mémoire patterns restent actifs.',
  },
  {
    category: 'Dépannage',
    title: 'Boutons grisés',
    text: 'Kill Switch → Reprendre · sinon drawdown, spread, anti-tilt (message PropGuard).',
  },
  {
    category: 'Dépannage',
    title: 'SQLite absent',
    text: 'Ouvrez Electron Desktop, pas l’aperçu navigateur seul.',
  },
];

export const PARAMETRES_A_COMPLETER = [
  {
    id: 'challenge',
    title: 'Programme WGF & challenge',
    done: (ctx) => Boolean(ctx.challenge?.id && ctx.challenge?.status === 'active'),
    help: 'Choisissez le profil WGF, capital, mode strict/conservateur, One Day Pass si 1 Step.',
  },
  {
    id: 'wgf-purchased',
    title: 'Parcours « J’ai acheté WGF »',
    done: (ctx) => Number(ctx.settings?.wgf_purchased_wizard_done) === 1,
    help: 'Paramètres → bouton du parcours pour aligner capital et PropGuard strict.',
  },
  {
    id: 'market',
    title: 'Données marché & calendrier',
    done: (ctx) => ctx.marketOk,
    help: 'Twelve Data démo/live ou Finnhub (clé gratuite) pour flux + calendrier économique réel.',
  },
  {
    id: 'gemini',
    title: 'Clé Gemini (optionnel)',
    done: (ctx) => ctx.geminiOk,
    help: 'AI Studio → clé → Tester → Enregistrer. Coach et résumé journalier enrichis.',
  },
  {
    id: 'risk',
    title: 'Risque, paper & social local',
    done: (ctx) => ctx.riskOk,
    help: 'Risque % 0,5–2 · paper ON pour entraînement · social local si vous suivez vos records.',
  },
  {
    id: 'sl',
    title: 'Stop loss sur graphique',
    done: () => false,
    help: 'Placez la ligne orange SL avant le premier ordre — Twin trade vérifie la cohérence.',
  },
];

export const TUTORIAL_STORAGE_KEY = 'nexatrader_tutorial_auto_shown';

export const TUTORIAL_SHORTCUTS = [
  { keys: 'Ctrl+Shift+K', label: 'Kill Switch global' },
  { keys: 'Ctrl+R', label: 'Recharger l’interface (après mise à jour)' },
  { keys: 'Suppr', label: 'Effacer tracé sélectionné' },
];
