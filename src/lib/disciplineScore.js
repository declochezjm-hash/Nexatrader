/**
 * Score discipline WGF 0–100 (pédagogique, pas une note officielle prop firm).
 */
export function computeWgfDisciplineScore({
  challenge,
  trades = [],
  killSwitchActive = false,
  propBlocked = false,
}) {
  const closed = trades.filter((t) =>
    ['closed', 'emergency_closed'].includes(String(t.status).toLowerCase()),
  );
  const open = trades.filter((t) => ['open', 'pending'].includes(String(t.status).toLowerCase()));

  let score = 72;
  const tips = [];

  const maxRisk = Math.max(0, ...trades.map((t) => t.risk_percent ?? 0));
  if (maxRisk > 2) {
    score -= 15;
    tips.push('Réduire le risque % (idéal ≤ 1–2 %).');
  } else if (maxRisk <= 1.2) {
    score += 8;
  }

  const losses = closed.filter((t) => (t.pnl ?? 0) < 0);
  const wins = closed.filter((t) => (t.pnl ?? 0) > 0);
  if (closed.length >= 3) {
    const wr = (wins.length / closed.length) * 100;
    if (wr >= 55) score += 6;
    if (wr < 40) {
      score -= 8;
      tips.push('Win rate faible — privilégier SKIP IA et signaux H/SS.');
    }
  }

  const consecutive = challenge?.consecutive_losses ?? 0;
  if (consecutive >= 2) {
    score -= 12;
    tips.push('Enchaînement de pertes — respecter l’anti-tilt.');
  } else if (consecutive === 0 && closed.length >= 2) {
    score += 5;
  }

  if (challenge?.anti_tilt_until) {
    score -= 10;
    tips.push('Pause anti-tilt active — ne forcez pas les clics.');
  }

  if (killSwitchActive) {
    score -= 5;
    tips.push('Kill Switch actif — reprenez seulement si plan clair.');
  }

  if (open.length > 2) {
    score -= 10;
    tips.push('Trop de positions ouvertes simultanément.');
  }

  const initial = challenge?.initial_balance ?? 0;
  const equity = challenge?.current_equity ?? initial;
  if (initial > 0) {
    const dd = Math.max(0, ((initial - equity) / initial) * 100);
    const maxOverall = challenge?.max_overall_loss_percent ?? 10;
    if (dd > maxOverall * 0.5) {
      score -= 10;
      tips.push('Drawdown élevé — priorité préservation du capital.');
    }
  }

  if (propBlocked && !killSwitchActive) {
    score -= 4;
    tips.push('PropGuard bloque — corriger spread / session avant d’insister.');
  }

  if (!tips.length) {
    tips.push('Continuez : risque fixe, plan capturé, respect des règles WGF.');
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let grade = 'C';
  if (score >= 85) grade = 'A';
  else if (score >= 70) grade = 'B';
  else if (score >= 55) grade = 'C';
  else grade = 'D';

  return { score, grade, tips: tips.slice(0, 4) };
}
