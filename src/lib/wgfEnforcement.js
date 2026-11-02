/**
 * Étape 6 — PropGuard : règles WGF réelles vs entraînement conservateur (news, session, spread).
 */

export const WGF_ENFORCEMENT_OFFICIAL = 'official';
export const WGF_ENFORCEMENT_CONSERVATIVE = 'conservative';

export const WGF_ENFORCEMENT_OPTIONS = [
  {
    id: WGF_ENFORCEMENT_OFFICIAL,
    label: 'WGF officiel (strict simulation)',
    shortLabel: 'WGF strict',
    description:
      'Aligné FAQ WGF : news, overnight et session NAS100 hors cash ne bloquent pas l’entrée (badges informatifs). Les limites DD / objectif / consistency restent actives.',
  },
  {
    id: WGF_ENFORCEMENT_CONSERVATIVE,
    label: 'Entraînement conservateur',
    shortLabel: 'Conservateur',
    description:
      'Blocage PropGuard sur annonces ±15 min, NAS100 hors session US et spread simulé élevé — pour s’entraîner plus prudemment que le minimum WGF.',
  },
];

/**
 * @param {object|null|undefined} settings
 * @returns {'official' | 'conservative'}
 */
export function resolveWgfEnforcementMode(settings) {
  const raw = settings?.wgf_enforcement_mode;
  if (raw === WGF_ENFORCEMENT_OFFICIAL || raw === WGF_ENFORCEMENT_CONSERVATIVE) {
    return raw;
  }
  const paper = settings?.paper_trading == null || Number(settings.paper_trading) === 1;
  return paper ? WGF_ENFORCEMENT_OFFICIAL : WGF_ENFORCEMENT_CONSERVATIVE;
}

/**
 * @param {string|null|undefined} mode
 */
export function isWgfOfficialEnforcement(mode) {
  return mode === WGF_ENFORCEMENT_OFFICIAL;
}

/**
 * @param {object|null|undefined} settings
 */
export function describeWgfEnforcement(settings) {
  const mode = resolveWgfEnforcementMode(settings);
  return WGF_ENFORCEMENT_OPTIONS.find((o) => o.id === mode) ?? WGF_ENFORCEMENT_OPTIONS[1];
}
