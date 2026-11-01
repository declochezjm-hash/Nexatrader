/**
 * Analyse comparative : décision prise vs indices disponibles (SL, IA session).
 * @param {object} trade
 * @param {{ aiSignal?: string, aiConfidence?: number, patternDirection?: string }} ctx
 */
export function compareTradeDecision(trade, ctx = {}) {
  const actual = trade?.type === 'SELL' ? 'SELL' : 'BUY';
  const reasons = [];
  const tags = [];

  let structuralSide = null;
  if (trade?.entry_price != null && trade?.stop_loss != null) {
    structuralSide = trade.stop_loss < trade.entry_price ? 'BUY' : 'SELL';
    if (structuralSide === actual) {
      reasons.push(`Le stop loss est cohérent avec un ${actual} (SL ${structuralSide === 'BUY' ? 'sous' : 'au-dessus'} l’entrée).`);
      tags.push({ id: 'sl', tone: 'ok', label: 'SL cohérent' });
    } else {
      reasons.push(
        `Incohérence SL : pour un ${actual}, le SL devrait être ${structuralSide === 'BUY' ? 'sous' : 'au-dessus'} l’entrée — vérifiez le graphique.`,
      );
      tags.push({ id: 'sl', tone: 'bad', label: 'SL incohérent' });
    }
  } else {
    reasons.push('Entrée ou SL manquant — comparaison structurelle limitée.');
  }

  const aiSignal = ctx.aiSignal ?? 'SKIP';
  const aiConf = ctx.aiConfidence ?? 0;
  if (aiSignal !== 'SKIP' && aiConf >= 50) {
    if (aiSignal === actual) {
      reasons.push(`Score IA actuel ${aiSignal} (${aiConf} %) — aligné avec le sens du trade.`);
      tags.push({ id: 'ai', tone: 'ok', label: 'IA alignée' });
    } else {
      reasons.push(
        `Score IA actuel ${aiSignal} (${aiConf} %) — différent de votre ${actual} (contexte session, pas historique exact).`,
      );
      tags.push({ id: 'ai', tone: 'warn', label: 'IA divergente' });
    }
  }

  if (ctx.patternDirection) {
    if (ctx.patternDirection === actual) {
      reasons.push(`Dernier signal chart (${ctx.patternDirection}) concordait avec ${actual}.`);
    } else {
      reasons.push(`Dernier signal chart (${ctx.patternDirection}) suggérait plutôt l’autre sens.`);
    }
  }

  const pnl = Number(trade?.pnl ?? 0);
  let outcomeLabel = 'Résultat neutre';
  if (pnl > 0) outcomeLabel = 'Trade gagnant';
  else if (pnl < 0) outcomeLabel = 'Trade perdant';

  let disciplineScore = 100;
  if (structuralSide && structuralSide !== actual) disciplineScore -= 35;
  if (aiSignal !== 'SKIP' && aiConf >= 70 && aiSignal !== actual) disciplineScore -= 25;
  if (pnl < 0) disciplineScore -= 10;
  disciplineScore = Math.max(0, Math.min(100, disciplineScore));

  return {
    actualSide: actual,
    structuralSide,
    aiSignal,
    aiConfidence: aiConf,
    reasons,
    tags,
    outcomeLabel,
    pnl,
    disciplineScore,
    summary:
      structuralSide && structuralSide !== actual
        ? 'Décision à revisiter (SL vs sens).'
        : aiSignal !== 'SKIP' && aiConf >= 70 && aiSignal !== actual
          ? 'Trade contraire à l’IA — assumez le risque.'
          : 'Décision globalement cohérente avec le plan affiché.',
  };
}
