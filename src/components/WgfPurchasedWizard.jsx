import { useState } from 'react';
import { ChevronLeft, ChevronRight, ShoppingBag } from 'lucide-react';
import { DEFAULT_WGF_PROGRAM_ID } from '../lib/wgfPrograms.js';

const STEPS = ['Bienvenue', 'Capital WGF', 'Programme', 'PropGuard'];

export default function WgfPurchasedWizard({ onComplete, onSkip }) {
  const [step, setStep] = useState(0);
  const [capital, setCapital] = useState('100000');
  const [programId, setProgramId] = useState(DEFAULT_WGF_PROGRAM_ID);

  async function finish() {
    await onComplete({
      initialBalance: Number(capital),
      programId,
    });
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-emerald-500/30 bg-slate-900 p-6 shadow-xl">
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
          <ShoppingBag className="h-4 w-4" />
          Parcours « J&apos;ai acheté WGF »
        </p>
        <p className="mt-1 text-[11px] text-slate-500">
          Étape {step + 1}/{STEPS.length} · {STEPS[step]}
        </p>

        {step === 0 && (
          <p className="mt-4 text-sm leading-relaxed text-slate-300">
            Vous avez un compte We Get Funded : NexaTrader aligne PropGuard, les phases et le journal
            d&apos;audit sur les règles WGF. Ce parcours configure capital et programme simulés.
          </p>
        )}
        {step === 1 && (
          <label className="mt-4 block text-xs text-slate-400">
            Taille du compte WGF (USD)
            <input
              type="number"
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
          </label>
        )}
        {step === 2 && (
          <label className="mt-4 block text-xs text-slate-400">
            Programme à simuler
            <select
              value={programId}
              onChange={(e) => setProgramId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            >
              <option value="wgf_1step_eval">WGF 1 Step</option>
              <option value="wgf_2step_phase1">WGF 2 Step · Phase 1</option>
              <option value="wgf_2step_phase2">WGF 2 Step · Phase 2</option>
              <option value="wgf_funded">Funded</option>
              <option value="wgf_instant">Instant</option>
            </select>
          </label>
        )}
        {step === 3 && (
          <ul className="mt-4 list-inside list-disc space-y-1 text-sm text-slate-300">
            <li>Mode PropGuard « WGF strict » recommandé</li>
            <li>Journal Audit WGF + exports CSV/PDF</li>
            <li>One Day Pass disponible sur 1 Step</li>
          </ul>
        )}

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={onSkip}
            className="text-[11px] text-slate-500 hover:text-slate-300"
          >
            Plus tard
          </button>
          <div className="flex gap-2">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="inline-flex items-center rounded-lg border border-slate-600 px-3 py-1.5 text-xs"
              >
                <ChevronLeft className="h-3 w-3" /> Retour
              </button>
            ) : null}
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-1.5 text-xs text-white"
              >
                Suivant <ChevronRight className="h-3 w-3" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void finish()}
                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white"
              >
                Appliquer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
