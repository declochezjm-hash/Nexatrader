import { getWgfProgram, limitsForProgram, WGF_PROGRAM_LIST } from '../lib/wgfPrograms.js';

/**
 * @param {object} props
 * @param {string} props.programId
 * @param {(id: string) => void} [props.onProgramChange]
 * @param {boolean} [props.compact]
 * @param {boolean} [props.showApplyHint]
 */
export default function WgfProgramPanel({
  programId,
  onProgramChange,
  compact = false,
  showApplyHint = false,
}) {
  const program = getWgfProgram(programId);
  const limits = limitsForProgram(programId);

  return (
    <div className="space-y-3">
      <label className="block text-xs text-slate-400">
        Programme We Get Funded
        <select
          value={programId}
          onChange={(e) => onProgramChange?.(e.target.value)}
          disabled={!onProgramChange}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 disabled:opacity-80"
        >
          {WGF_PROGRAM_LIST.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      {!compact && (
        <div className="rounded-lg border border-slate-700/80 bg-slate-950/60 p-3 text-[11px] leading-relaxed text-slate-400">
          <p className="mb-2 font-medium text-slate-200">{program.shortLabel}</p>
          <p className="mb-2">{program.legalSummary}</p>
          <ul className="mb-2 list-inside list-disc space-y-0.5">
            {program.rulesBullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <p className="text-[10px] text-slate-500">
            Référence officielle :{' '}
            <a
              href={program.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sky-400 underline hover:text-sky-300"
            >
              wegetfunded.com
            </a>
            . NexaTrader simule localement — pas un compte WGF réel.
          </p>
        </div>
      )}

      <div
        className={`grid gap-2 text-[10px] text-slate-400 ${compact ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}
      >
        <div className="rounded border border-slate-800 px-2 py-1.5">
          <span className="block text-slate-500">Objectif</span>
          <span className="tabular-nums text-slate-200">
            {limits.profit_target_percent > 0 ? `${limits.profit_target_percent} %` : '—'}
          </span>
        </div>
        <div className="rounded border border-slate-800 px-2 py-1.5">
          <span className="block text-slate-500">Perte jour</span>
          <span className="tabular-nums text-slate-200">
            {limits.max_daily_loss_percent > 0 ? `${limits.max_daily_loss_percent} %` : 'EOD'}
          </span>
        </div>
        <div className="rounded border border-slate-800 px-2 py-1.5">
          <span className="block text-slate-500">Drawdown max</span>
          <span className="tabular-nums text-slate-200">{limits.max_overall_loss_percent} %</span>
        </div>
        {program.consistencyPercent != null && (
          <div className="rounded border border-slate-800 px-2 py-1.5">
            <span className="block text-slate-500">Consistency</span>
            <span className="tabular-nums text-slate-200">{program.consistencyPercent} %</span>
          </div>
        )}
      </div>

      {showApplyHint && onProgramChange && (
        <p className="text-[10px] text-emerald-300/90">
          Enregistrez ou créez un challenge pour appliquer ces limites sur le compte simulé.
        </p>
      )}
    </div>
  );
}
