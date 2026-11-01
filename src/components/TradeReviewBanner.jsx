export default function TradeReviewBanner({ review, onClose, onOpenDetails }) {
  if (!review?.trade) return null;
  const { trade, comparison } = review;
  const c = comparison;

  return (
    <div className="pointer-events-auto absolute bottom-3 left-3 right-3 z-[4] max-h-[40vh] overflow-y-auto rounded-xl border border-sky-500/35 bg-slate-950/95 p-3 shadow-xl backdrop-blur-sm">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-sky-200">
            Revue trade #{trade.id} · {trade.type} {trade.symbol} @ {trade.entry_price ?? '—'}
          </p>
          <p className="text-[10px] text-slate-500">
            Graphique centré sur la bougie d’entrée · PnL {trade.pnl ?? 0}$ · {c?.outcomeLabel}
          </p>
        </div>
        <div className="flex gap-1">
          {onOpenDetails && (
            <button
              type="button"
              onClick={() => onOpenDetails(trade.id)}
              className="rounded-md border border-slate-600 px-2 py-0.5 text-[10px] text-slate-300 hover:border-sky-500/40"
            >
              Fiche détail
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-600 px-2 py-0.5 text-[10px] text-slate-400 hover:text-white"
          >
            Fermer
          </button>
        </div>
      </div>

      <p className="mb-2 text-[11px] font-medium text-slate-200">{c?.summary}</p>

      <div className="mb-2 flex flex-wrap gap-1">
        {c?.tags?.map((t) => (
          <span
            key={t.id}
            className={`rounded-full px-2 py-0.5 text-[9px] ${
              t.tone === 'ok'
                ? 'bg-emerald-500/15 text-emerald-300'
                : t.tone === 'bad'
                  ? 'bg-rose-500/15 text-rose-300'
                  : 'bg-amber-500/15 text-amber-200'
            }`}
          >
            {t.label}
          </span>
        ))}
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[9px] text-slate-400">
          Discipline {c?.disciplineScore}/100
        </span>
      </div>

      <div className="grid gap-2 text-[10px] md:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2">
          <p className="mb-1 font-medium uppercase text-slate-500">Votre décision</p>
          <p className="text-slate-200">
            {c?.actualSide} · lot {trade.lot_size} · SL {trade.stop_loss ?? '—'}
          </p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2">
          <p className="mb-1 font-medium uppercase text-slate-500">Indices comparatifs</p>
          <p className="text-slate-200">
            Structure SL → {c?.structuralSide ?? '—'} · IA {c?.aiSignal} ({c?.aiConfidence}%)
          </p>
        </div>
      </div>

      <ul className="mt-2 list-inside list-disc space-y-0.5 text-[10px] leading-snug text-slate-400">
        {c?.reasons?.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </div>
  );
}
