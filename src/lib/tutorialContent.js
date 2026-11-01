export const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    title: 'Bienvenue sur NexaTrader',
    body: [
      'NexaTrader simule un compte prop firm (WGF) avec or (XAUUSD) et Nasdaq (NAS100).',
      'Utilisez la fenêtre desktop « NexaTrader — Desktop » lancée par npm run dev — pas l’aperçu navigateur de Cursor.',
    ],
  },
  {
    id: 'layout',
    title: 'Organisation de l’écran',
    body: [
      'Barre du haut : actif, unité de temps, Analytics, Paramètres et Tutoriel.',
      'Colonne gauche : outils de tracé (lignes, rectangles) enregistrés en SQLite.',
      'Centre : graphique avec zoom (− / +), Réinitialiser et Suivre le flux.',
      'Colonne droite : PropGuard, score IA, boutons ACHAT / VENTE et Kill Switch.',
      'Bas : journal des trades et export Analytics.',
    ],
  },
  {
    id: 'chart',
    title: 'Graphique & tracés',
    body: [
      'Molette : zoom horizontal · Clic maintenu : déplacer la vue · Bouton « Zoom marché » : gros plan.',
      '« Pause direct » fige les prix pour zoomer / simuler ; « Reprendre le direct » relance le flux et le suivi.',
      '« Vue longue » : plus de bougies à l’écran · Historique simulé ~480 barres.',
      'Outil horizontal : 1 clic sur le prix. Tendance / rectangle : 2 clics.',
      'Flèche (sélection) : revenir au mode normal ; glisser les lignes SL / BE orange et bleue.',
      'Marqueurs H (hammer) et SS (shooting star) : signaux mèches détectés par le worker.',
    ],
  },
  {
    id: 'trade',
    title: 'Passer un ordre',
    body: [
      'Paramètres → section Challenge prop : capital, objectif +8 %, pertes 5 % / 10 %, nouveau challenge.',
      'PropGuard calcule la taille de lot selon votre risque % et la distance au stop.',
      'ACHAT / VENTE ouvrent un trade simulé si les règles sont respectées.',
      'Mode paper (Paramètres) : entraînement hors session US et spread simulé élevé autorisé.',
      'Si « Exécution bloquée », lisez la liste orange : drawdown, Kill Switch, etc.',
    ],
  },
  {
    id: 'ai',
    title: 'IA & Google',
    body: [
      'Le score Gemini indique BUY / SELL / SKIP — ce n’est pas un ordre automatique sauf Auto-Pilot (≥ 80 %).',
      'Connexion Google : Client ID OAuth dans Paramètres → Avancé, ou clé gratuite sur aistudio.google.com/apikey (même compte Google / e-mail).',
      'Sans Google, l’app fonctionne avec analyse locale et mémoire de patterns SQLite.',
    ],
  },
  {
    id: 'safety',
    title: 'Sécurité prop firm',
    body: [
      'Limites WGF : ~5 % perte journalière, ~10 % drawdown total (jauges à droite).',
      'Kill Switch (Ctrl+Shift+K) : clôture tout et met le challenge en pause. Bouton « Reprendre le trading » pour réactiver.',
      'Anti-tilt : pause après enchaînement de pertes — respectez-la avant de reprendre.',
    ],
  },
];

export const TRADING_TIPS = [
  {
    category: 'Discipline',
    title: 'Risque fixe',
    text: 'Restez à 0,5–1 % par trade sur un challenge ; NexaTrader calcule le lot pour vous.',
  },
  {
    category: 'Discipline',
    title: 'Ne chasez pas',
    text: 'Si le score IA est SKIP ou PropGuard bloque, attendez un nouveau signal H/SS plutôt que forcer un clic.',
  },
  {
    category: 'Or (XAUUSD)',
    title: 'Spread & sessions',
    text: 'L’or réagit aux annonces US ; évitez les minutes autour des NFP/FOMC (badge annonce si mode strict).',
  },
  {
    category: 'Nasdaq (NAS100)',
    title: 'Session cash',
    text: 'En mode strict, NAS100 n’est tradable qu’en session US (9h30–16h NY). En paper, entraînez-vous librement.',
  },
  {
    category: 'Graphique',
    title: 'Zoom stable',
    text: 'Désactivez « Suivre » pour analyser l’historique ; réactivez-le pour coller à la dernière bougie simulée.',
  },
  {
    category: 'Prop firm',
    title: 'Objectif +8 %',
    text: 'Visez la régularité : petits gains avec stops respectés plutôt que sur-leverage sur un signal.',
  },
  {
    category: 'Technique',
    title: 'Stops visibles',
    text: 'Placez ou ajustez le SL sur le graphique avant ACHAT/VENTE ; le BE 1.5R se recalcule en glissant le SL.',
  },
  {
    category: 'Dépannage',
    title: 'Boutons grisés',
    text: 'Vérifiez mode paper, challenge actif, Kill Switch off, et ouvrez le Tutoriel depuis la barre du haut.',
  },
];

export const TUTORIAL_STORAGE_KEY = 'nexatrader_tutorial_auto_shown';
