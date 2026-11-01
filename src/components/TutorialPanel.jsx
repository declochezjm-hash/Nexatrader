import { useMemo, useState } from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  X,
} from 'lucide-react';
import { useTrading } from '../context/TradingContext.jsx';
import { TRADING_TIPS, TUTORIAL_STEPS } from '../lib/tutorialContent.js';

export default function TutorialPanel() {
  const { tutorialOpen, setTutorialOpen } = useTrading();
  const [tab, setTab] = useState('tutorial');
  const [stepIndex, setStepIndex] = useState(0);

  const step = TUTORIAL_STEPS[stepIndex];
  const tipsByCategory = useMemo(() => {
    const map = new Map();
    for (const tip of TRADING_TIPS) {
      const list = map.get(tip.category) ?? [];
      list.push(tip);
      map.set(tip.category, list);
    }
    return map;
  }, []);

  if (!tutorialOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-title"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-emerald-400">
              NexaTrader
            </p>
            <h2 id="tutorial-title" className="mt-1 text-lg font-semibold text-slate-100">
              Tutoriel & conseils
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setTutorialOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex gap-1 border-b border-slate-800 px-5 pt-2">
          <button
            type="button"
            onClick={() => setTab('tutorial')}
            className={`inline-flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-sm font-medium ${
              tab === 'tutorial'
                ? 'bg-slate-800 text-emerald-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            Tutoriel
          </button>
          <button
            type="button"
            onClick={() => setTab('tips')}
            className={`inline-flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-sm font-medium ${
              tab === 'tips'
                ? 'bg-slate-800 text-amber-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lightbulb className="h-4 w-4" />
            Conseils
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {tab === 'tutorial' && step && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  Étape {stepIndex + 1} / {TUTORIAL_STEPS.length}
                </span>
                <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{
                      width: `${((stepIndex + 1) / TUTORIAL_STEPS.length) * 100}%`,
                    }}
                  />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-slate-100">{step.title}</h3>
              <ul className="space-y-2 text-sm leading-relaxed text-slate-300">
                {step.body.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tab === 'tips' && (
            <div className="space-y-5">
              <p className="text-sm text-slate-400">
                Bonnes pratiques pour un challenge prop firm et une utilisation sereine de
                l’application.
              </p>
              {[...tipsByCategory.entries()].map(([category, tips]) => (
                <section key={category}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-sky-400">
                    {category}
                  </h3>
                  <ul className="space-y-2">
                    {tips.map((tip) => (
                      <li
                        key={tip.title}
                        className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"
                      >
                        <p className="text-sm font-medium text-slate-100">{tip.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-400">{tip.text}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-slate-800 px-5 py-3">
          {tab === 'tutorial' ? (
            <>
              <button
                type="button"
                disabled={stepIndex === 0}
                onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-slate-400 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                Précédent
              </button>
              {stepIndex < TUTORIAL_STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setStepIndex((i) => i + 1)}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                >
                  Suivant
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setTab('tips');
                    setStepIndex(0);
                  }}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                >
                  Voir les conseils
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => setTutorialOpen(false)}
              className="ml-auto rounded-lg bg-slate-700 px-4 py-2 text-sm text-slate-100 hover:bg-slate-600"
            >
              Fermer
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
