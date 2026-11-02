import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Brain,
  CandlestickChart,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  ClipboardList,
  GitCompare,
  LayoutGrid,
  Lightbulb,
  ScrollText,
  Shield,
  Sparkles,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useTrading } from '../context/TradingContext.jsx';
import { isDemoMarketProvider, normalizeMarketProvider } from '../lib/marketFeedMode.js';
import {
  PARAMETRES_A_COMPLETER,
  TRADING_TIPS,
  TUTORIAL_FEATURE_CATALOG,
  TUTORIAL_SHORTCUTS,
  TUTORIAL_STEPS,
} from '../lib/tutorialContent.js';

const ICONS = {
  sparkles: Sparkles,
  layout: LayoutGrid,
  shield: Shield,
  gitCompare: GitCompare,
  candlestick: CandlestickChart,
  scroll: ScrollText,
  brain: Brain,
  users: Users,
  alertTriangle: AlertTriangle,
};

const ACCENT = {
  emerald: {
    ring: 'ring-emerald-500/30',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-300',
    bar: 'bg-emerald-500',
    pill: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  },
  sky: {
    ring: 'ring-sky-500/30',
    bg: 'bg-sky-500/10',
    text: 'text-sky-300',
    bar: 'bg-sky-500',
    pill: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
  },
  violet: {
    ring: 'ring-violet-500/30',
    bg: 'bg-violet-500/10',
    text: 'text-violet-300',
    bar: 'bg-violet-500',
    pill: 'border-violet-500/30 bg-violet-500/10 text-violet-200',
  },
  amber: {
    ring: 'ring-amber-500/30',
    bg: 'bg-amber-500/10',
    text: 'text-amber-300',
    bar: 'bg-amber-500',
    pill: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  },
  rose: {
    ring: 'ring-rose-500/30',
    bg: 'bg-rose-500/10',
    text: 'text-rose-300',
    bar: 'bg-rose-500',
    pill: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
  },
  pink: {
    ring: 'ring-pink-500/30',
    bg: 'bg-pink-500/10',
    text: 'text-pink-300',
    bar: 'bg-pink-500',
    pill: 'border-pink-500/30 bg-pink-500/10 text-pink-200',
  },
};

function accentFor(key) {
  return ACCENT[key] ?? ACCENT.emerald;
}

const TABS = [
  { id: 'tutorial', label: 'Parcours', icon: BookOpen },
  { id: 'features', label: 'Innovation', icon: Zap },
  { id: 'tips', label: 'Conseils', icon: Lightbulb },
  { id: 'setup', label: 'Setup', icon: ClipboardList },
];

export default function TutorialPanel() {
  const { tutorialOpen, setTutorialOpen, setSettingsOpen, settings, challenge } = useTrading();
  const [tab, setTab] = useState('tutorial');
  const [stepIndex, setStepIndex] = useState(0);

  const step = TUTORIAL_STEPS[stepIndex];
  const stepAccent = accentFor(step?.accent ?? 'emerald');
  const StepIcon = ICONS[step?.icon] ?? Sparkles;

  const parametresCtx = useMemo(
    () => ({
      challenge,
      settings,
      marketOk:
        isDemoMarketProvider(normalizeMarketProvider(settings?.market_provider)) ||
        Boolean(settings?.market_api_key?.trim()),
      geminiOk:
        Boolean(settings?.google_access_token) ||
        settings?.api_key === 'google_oauth' ||
        Boolean(settings?.api_key && settings.api_key !== 'google_oauth'),
      riskOk:
        Number(settings?.default_risk_percent ?? 1) >= 0.1 &&
        Number(settings?.default_risk_percent ?? 1) <= 5,
    }),
    [challenge, settings],
  );

  const setupProgress = useMemo(() => {
    const total = PARAMETRES_A_COMPLETER.length;
    const done = PARAMETRES_A_COMPLETER.filter((i) => i.done(parametresCtx)).length;
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [parametresCtx]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-md sm:p-6">
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 shadow-[0_24px_80px_rgba(0,0,0,0.55)] ring-1 ring-white/5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-title"
      >
        <header className="relative shrink-0 overflow-hidden border-b border-slate-800/90 px-6 py-5">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              background:
                'radial-gradient(ellipse 80% 120% at 100% 0%, rgba(16,185,129,0.15), transparent 55%), radial-gradient(ellipse 60% 80% at 0% 100%, rgba(56,189,248,0.08), transparent 50%)',
            }}
          />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-400/90">
                <Sparkles className="h-3.5 w-3.5" />
                NexaTrader Reference
              </p>
              <h2 id="tutorial-title" className="mt-1.5 text-xl font-semibold tracking-tight text-white sm:text-2xl">
                Hub formation & conformité WGF
              </h2>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-400">
                Parcours guidé, catalogue innovation et checklist de configuration — conçu pour une
                préparation prop firm de niveau institutionnel.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTutorialOpen(false)}
              className="rounded-xl border border-slate-700/80 bg-slate-800/50 p-2 text-slate-400 transition hover:border-slate-600 hover:text-white"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="relative mt-4 flex flex-wrap gap-1.5">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition ${
                    active
                      ? 'bg-slate-800 text-white shadow-inner ring-1 ring-white/10'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </nav>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          {tab === 'tutorial' && (
            <aside className="hidden shrink-0 border-b border-slate-800/80 bg-slate-950/40 lg:flex lg:w-56 lg:flex-col lg:border-b-0 lg:border-r">
              <p className="px-4 pt-4 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                Étapes
              </p>
              <ul className="flex-1 space-y-0.5 overflow-y-auto p-2">
                {TUTORIAL_STEPS.map((s, i) => {
                  const a = accentFor(s.accent);
                  const active = i === stepIndex;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setStepIndex(i)}
                        className={`w-full rounded-lg px-3 py-2 text-left text-[11px] transition ${
                          active
                            ? `${a.bg} ${a.text} ring-1 ${a.ring}`
                            : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                        }`}
                      >
                        <span className="font-medium">{i + 1}. {s.title}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="border-t border-slate-800/80 p-3">
                <p className="text-[9px] uppercase text-slate-600">Raccourcis</p>
                <ul className="mt-1 space-y-1">
                  {TUTORIAL_SHORTCUTS.map((sc) => (
                    <li key={sc.keys} className="flex justify-between text-[10px] text-slate-500">
                      <kbd className="rounded bg-slate-800 px-1 font-mono text-[9px] text-slate-300">
                        {sc.keys}
                      </kbd>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            {tab === 'tutorial' && step && (
              <article className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500 lg:hidden">
                    Étape {stepIndex + 1}/{TUTORIAL_STEPS.length}
                  </div>
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-800 lg:max-w-xs">
                    <div
                      className={`h-full transition-all duration-300 ${stepAccent.bar}`}
                      style={{ width: `${((stepIndex + 1) / TUTORIAL_STEPS.length) * 100}%` }}
                    />
                  </div>
                </div>

                <div className={`rounded-2xl border p-5 ring-1 ${stepAccent.pill} ${stepAccent.ring}`}>
                  <div className="flex flex-wrap items-start gap-4">
                    <span
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${stepAccent.bg} ring-1 ${stepAccent.ring}`}
                    >
                      <StepIcon className={`h-6 w-6 ${stepAccent.text}`} />
                    </span>
                    <div className="min-w-0 flex-1">
                      {step.subtitle ? (
                        <p className={`text-[10px] font-semibold uppercase tracking-wider ${stepAccent.text}`}>
                          {step.subtitle}
                        </p>
                      ) : null}
                      <h3 className="mt-0.5 text-xl font-semibold text-white">{step.title}</h3>
                      {step.tags?.length ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {step.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-md border border-slate-700/80 bg-slate-950/50 px-2 py-0.5 text-[10px] text-slate-400"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <ul className="grid gap-3 sm:grid-cols-1">
                  {step.body.map((line, idx) => (
                    <li
                      key={line}
                      className="flex gap-3 rounded-xl border border-slate-800/90 bg-slate-950/40 px-4 py-3 text-sm leading-relaxed text-slate-300"
                    >
                      <span
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold tabular-nums ${stepAccent.bg} ${stepAccent.text}`}
                      >
                        {idx + 1}
                      </span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>

                {step.callout ? (
                  <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-xs leading-relaxed text-emerald-100/90">
                    {step.callout}
                  </p>
                ) : null}
              </article>
            )}

            {tab === 'features' && (
              <div className="space-y-4">
                <p className="text-sm text-slate-400">
                  Les modules qui distinguent NexaTrader — votre référence simulation We Get Funded.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {TUTORIAL_FEATURE_CATALOG.map((f) => {
                    const a = accentFor(f.accent);
                    return (
                      <div
                        key={f.id}
                        className={`group rounded-xl border border-slate-800/90 bg-slate-950/50 p-4 transition hover:border-slate-600 hover:bg-slate-900/80`}
                      >
                        <p className={`text-[10px] font-semibold uppercase tracking-wide ${a.text}`}>
                          Innovation
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-100">{f.title}</p>
                        <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{f.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {tab === 'tips' && (
              <div className="space-y-6">
                <p className="text-sm text-slate-400">
                  Playbook discipline & prop firm — à relire avant chaque session.
                </p>
                {[...tipsByCategory.entries()].map(([category, tips]) => (
                  <section key={category}>
                    <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sky-400">
                      <span className="h-px flex-1 bg-gradient-to-r from-sky-500/40 to-transparent" />
                      {category}
                      <span className="h-px flex-1 bg-gradient-to-l from-sky-500/40 to-transparent" />
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {tips.map((tip) => (
                        <div
                          key={tip.title}
                          className="rounded-xl border border-slate-800/90 bg-gradient-to-br from-slate-950/80 to-slate-900/40 p-3.5"
                        >
                          <p className="text-sm font-medium text-slate-100">{tip.title}</p>
                          <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{tip.text}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}

            {tab === 'setup' && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                  <div
                    className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-slate-700"
                    style={{
                      background: `conic-gradient(rgb(16,185,129) ${setupProgress.pct}%, rgb(30,41,59) ${setupProgress.pct}%)`,
                    }}
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-sm font-bold tabular-nums text-emerald-300">
                      {setupProgress.pct}%
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-100">Configuration référence</p>
                    <p className="text-xs text-slate-500">
                      {setupProgress.done}/{setupProgress.total} points complétés — ouvrez Paramètres
                      pour finaliser.
                    </p>
                  </div>
                </div>

                <ul className="space-y-2">
                  {PARAMETRES_A_COMPLETER.map((item) => {
                    const complete = item.done(parametresCtx);
                    return (
                      <li
                        key={item.id}
                        className={`flex gap-3 rounded-xl border p-3.5 transition ${
                          complete
                            ? 'border-emerald-500/25 bg-emerald-500/5'
                            : 'border-slate-800 bg-slate-950/40'
                        }`}
                      >
                        {complete ? (
                          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                        ) : (
                          <Circle className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-slate-100">{item.title}</p>
                          <p className="mt-1 text-xs leading-relaxed text-slate-400">{item.help}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <button
                  type="button"
                  onClick={() => {
                    setTutorialOpen(false);
                    setSettingsOpen(true);
                  }}
                  className="w-full rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-950/30 hover:from-sky-500 hover:to-sky-400"
                >
                  Ouvrir Paramètres
                </button>
              </div>
            )}
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-between border-t border-slate-800/90 bg-slate-950/50 px-5 py-3 sm:px-6">
          {tab === 'tutorial' ? (
            <>
              <button
                type="button"
                disabled={stepIndex === 0}
                onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm text-slate-400 transition hover:bg-slate-800 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                Précédent
              </button>
              {stepIndex < TUTORIAL_STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setStepIndex((i) => i + 1)}
                  className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-950/40 hover:bg-emerald-500"
                >
                  Suivant
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setTab('features');
                    setStepIndex(0);
                  }}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
                >
                  Voir l’innovation →
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => setTutorialOpen(false)}
              className="ml-auto rounded-xl border border-slate-600 bg-slate-800 px-5 py-2.5 text-sm font-medium text-slate-100 hover:bg-slate-700"
            >
              Fermer
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
