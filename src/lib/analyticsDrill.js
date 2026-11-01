const CLOSED = new Set(['closed', 'emergency_closed']);
const OPEN = new Set(['open', 'pending']);

export function isClosedTrade(t) {
  return CLOSED.has(String(t.status).toLowerCase());
}

export function filterTradesByDrill(trades, drillId) {
  if (!drillId || drillId === 'all') return [...trades];
  if (drillId === 'closed') return trades.filter(isClosedTrade);
  if (drillId === 'wins') return trades.filter((t) => isClosedTrade(t) && (t.pnl ?? 0) > 0);
  if (drillId === 'losses') return trades.filter((t) => isClosedTrade(t) && (t.pnl ?? 0) < 0);
  if (drillId === 'open') return trades.filter((t) => OPEN.has(String(t.status).toLowerCase()));
  if (drillId === 'xau') return trades.filter((t) => t.symbol === 'XAUUSD');
  if (drillId === 'nas') return trades.filter((t) => t.symbol === 'NAS100');
  if (drillId.startsWith('hour:')) {
    const hour = Number(drillId.slice(5));
    return trades.filter((t) => {
      if (!isClosedTrade(t)) return false;
      const h = t.created_at ? new Date(t.created_at).getUTCHours() : -1;
      return h === hour;
    });
  }
  return [...trades];
}

export const DRILL_PRESETS = {
  winRateGlobal: { id: 'closed', title: 'Trades clôturés', subtitle: 'Base du win rate global' },
  winRateXAUUSD: { id: 'xau', title: 'Trades XAUUSD', subtitle: 'Filtré or' },
  winRateNAS100: { id: 'nas', title: 'Trades NAS100', subtitle: 'Filtré Nasdaq' },
  profitFactor: { id: 'closed', title: 'Trades clôturés', subtitle: 'Gains vs pertes' },
  averageRR: { id: 'closed', title: 'Trades avec R:R', subtitle: 'Entrée, SL et sortie renseignés' },
  totalPnl: { id: 'closed', title: 'PnL net — détail', subtitle: 'Trades clôturés triés par PnL' },
  totalTrades: { id: 'all', title: 'Tous les trades', subtitle: 'Journal complet' },
  openTrades: { id: 'open', title: 'Positions ouvertes', subtitle: 'Statut open / pending' },
  wins: { id: 'wins', title: 'Trades gagnants', subtitle: 'PnL > 0' },
  losses: { id: 'losses', title: 'Trades perdants', subtitle: 'PnL < 0' },
};

export function drillFromHour(hour) {
  return {
    id: `hour:${hour}`,
    title: `Trades clôturés — ${String(hour).padStart(2, '0')}h UTC`,
    subtitle: 'Création du trade à cette heure',
  };
}

export function sortDrillTrades(trades, drillId) {
  const list = [...trades];
  if (drillId === 'totalPnl' || drillId === 'closed' || drillId?.startsWith('hour:')) {
    return list.sort((a, b) => (b.pnl ?? 0) - (a.pnl ?? 0));
  }
  return list.sort((a, b) => b.id - a.id);
}
