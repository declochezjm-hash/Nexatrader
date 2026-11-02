const CLOSED = new Set(['closed', 'emergency_closed']);

/**
 * Heatmap discipline : agrégation PnL et nombre de trades par jour GMT × tranche horaire UTC.
 * @param {Array<object>} trades
 */
export function buildDisciplineHeatmap(trades = []) {
  /** @type {Map<string, { count: number, pnl: number, wins: number }>} */
  const cells = new Map();

  for (const t of trades) {
    if (!CLOSED.has(String(t.status ?? '').toLowerCase())) continue;
    const d = new Date(t.created_at ?? '');
    if (Number.isNaN(d.getTime())) continue;
    const day = d.getUTCDay();
    const hour = d.getUTCHours();
    const key = `${day}-${hour}`;
    const prev = cells.get(key) ?? { count: 0, pnl: 0, wins: 0 };
    const pnl = Number(t.pnl ?? 0);
    cells.set(key, {
      count: prev.count + 1,
      pnl: prev.pnl + pnl,
      wins: prev.wins + (pnl > 0 ? 1 : 0),
    });
  }

  const dayLabels = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  /** @type {Array<{ day: number, dayLabel: string, hour: number, count: number, pnl: number, intensity: number }>} */
  const grid = [];

  for (let day = 0; day < 7; day += 1) {
    for (let hour = 0; hour < 24; hour += 1) {
      const key = `${day}-${hour}`;
      const cell = cells.get(key) ?? { count: 0, pnl: 0, wins: 0 };
      const winRate = cell.count > 0 ? cell.wins / cell.count : 0.5;
      const intensity =
        cell.count === 0
          ? 0
          : Math.max(0, Math.min(1, (winRate * 0.6 + (cell.pnl > 0 ? 0.4 : 0)) * Math.min(1, cell.count / 3)));

      grid.push({
        day,
        dayLabel: dayLabels[day],
        hour,
        count: cell.count,
        pnl: Number(cell.pnl.toFixed(2)),
        intensity: Number(intensity.toFixed(2)),
      });
    }
  }

  return { grid, dayLabels };
}
