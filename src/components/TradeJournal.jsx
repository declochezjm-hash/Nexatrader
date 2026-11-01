import { useTrading } from '../context/TradingContext.jsx';

export default function TradeJournal() {
  const { trades, setAnalyticsOpen } = useTrading();

  return (
    <section className="flex h-44 shrink-0 flex-col border-t border-slate-800 bg-slate-950/90">
      <header className="flex items-center justify-between border-b border-slate-800/80 px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Journal SQLite
        </h3>
        <button
          type="button"
          onClick={() => setAnalyticsOpen(true)}
          className="text-[10px] text-sky-400 hover:text-sky-300"
        >
          Ouvrir Analytics →
        </button>
        <span className="text-[10px] text-slate-600">{trades.length} entrées</span>
      </header>
      <div className="flex-1 overflow-auto">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="sticky top-0 bg-slate-950 text-[10px] uppercase text-slate-500">
            <tr>
              <th className="px-3 py-1.5 font-medium">#</th>
              <th className="px-3 py-1.5 font-medium">Symbole</th>
              <th className="px-3 py-1.5 font-medium">Type</th>
              <th className="px-3 py-1.5 font-medium">Lot</th>
              <th className="px-3 py-1.5 font-medium">Risque</th>
              <th className="px-3 py-1.5 font-medium">PnL</th>
              <th className="px-3 py-1.5 font-medium">Statut</th>
              <th className="px-3 py-1.5 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-slate-600">
                  Aucun trade enregistré.
                </td>
              </tr>
            ) : (
              trades.map((t) => (
                <tr key={t.id} className="border-t border-slate-800/60 text-slate-300">
                  <td className="px-3 py-1.5 tabular-nums text-slate-500">{t.id}</td>
                  <td className="px-3 py-1.5">{t.symbol}</td>
                  <td
                    className={`px-3 py-1.5 font-medium ${
                      t.type === 'BUY' ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {t.type}
                  </td>
                  <td className="px-3 py-1.5 tabular-nums">{t.lot_size}</td>
                  <td className="px-3 py-1.5 tabular-nums">{t.risk_percent} %</td>
                  <td className="px-3 py-1.5 tabular-nums">{t.pnl ?? 0}</td>
                  <td className="px-3 py-1.5 text-slate-400">{t.status}</td>
                  <td className="px-3 py-1.5 text-slate-500">{t.created_at}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
