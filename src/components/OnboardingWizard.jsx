import { useEffect, useMemo, useState } from 'react';
import {
  Brain,
  ChevronLeft,
  ChevronRight,
  Flame,
  Shield,
  Sparkles,
  Zap,
} from 'lucide-react';
import { DEFAULT_GEMINI_SETTINGS_ID } from '../lib/geminiModels.js';
import { DEFAULT_WGF_PROGRAM_ID, limitsForProgram } from '../lib/wgfPrograms.js';
import WgfProgramPanel from './WgfProgramPanel.jsx';
import {
  getElectronEnvironmentHint,
  isElectronBridgeAvailable,
  isNexaTraderDesktopShell,
  loginWithGoogleIpc,
  waitForElectronBridge,
} from '../lib/electronBridge.js';

const STEPS = ['Découverte', 'Profil', 'Configuration'];

const FEATURES = [
  {
    icon: Flame,
    title: 'Analyse des mèches',
    desc: 'Détection des rejections et sweeps de liquidité via Web Worker 60 FPS.',
  },
  {
    icon: Shield,
    title: 'PropGuard Ultra',
    desc: 'Compliance WGF : drawdown journalier 5 %, total 10 %, anti-tilt intégré.',
  },
  {
    icon: Sparkles,
    title: 'IA Gemini',
    desc: 'Scoring de confiance et recommandations BUY / SELL / SKIP en local-first.',
  },
  {
    icon: Zap,
    title: 'Kill Switch',
    desc: 'Arrêt d’urgence : clôture immédiate et pause du challenge.',
  },
];

const AI_PROVIDERS = [
  { id: DEFAULT_GEMINI_SETTINGS_ID, label: 'Google Gemini Flash (gratuit)' },
  { id: 'claude', label: 'Anthropic Claude' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'ollama', label: 'Ollama (local)' },
];

const INDICATOR_OPTIONS = [
  { id: 'wicks', label: 'Mèches & liquidité' },
  { id: 'propguard', label: 'PropGuard' },
  { id: 'ai', label: 'Score IA' },
  { id: 'structure', label: 'Structure HH/HL' },
];

export default function OnboardingWizard({ onComplete }) {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState('ready');
  const [aiProvider, setAiProvider] = useState(DEFAULT_GEMINI_SETTINGS_ID);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleClientId, setGoogleClientId] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [showOAuthAdvanced, setShowOAuthAdvanced] = useState(false);
  const [electronReady, setElectronReady] = useState(isElectronBridgeAvailable());
  const [capital, setCapital] = useState('100000');
  const [wgfProgramId, setWgfProgramId] = useState(DEFAULT_WGF_PROGRAM_ID);
  const [riskPercent, setRiskPercent] = useState('1');
  const [indicators, setIndicators] = useState(['wicks', 'propguard', 'ai']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isCustom = profile === 'custom';

  const progress = useMemo(() => ((step + 1) / STEPS.length) * 100, [step]);

  useEffect(() => {
    let cancelled = false;
    waitForElectronBridge().then((ready) => {
      if (!cancelled) setElectronReady(ready);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!electronReady) return;
    let cancelled = false;
    (async () => {
      const db = window.nexaTrader?.db;
      if (!db?.get) return;
      const row = await db.get(
        'SELECT google_account_email, api_key, google_access_token, google_oauth_client_id FROM app_settings WHERE id = 1',
      );
      if (cancelled || !row) return;
      if (row.google_oauth_client_id) {
        setGoogleClientId(row.google_oauth_client_id);
      }
      if (row.google_account_email || row.google_access_token || row.api_key === 'google_oauth') {
        setGoogleConnected(true);
        setGoogleEmail(row.google_account_email ?? 'Compte Google');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [electronReady]);

  function toggleIndicator(id) {
    setIndicators((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function persistGoogleClientId() {
    const db = window.nexaTrader?.db;
    if (!db?.run || !googleClientId.trim()) return;
    await db.run(`UPDATE app_settings SET google_oauth_client_id = ? WHERE id = 1`, [
      googleClientId.trim(),
    ]);
  }

  async function handleGoogleLogin() {
    setError('');
    setGoogleLoading(true);
    try {
      const ready = electronReady || (await waitForElectronBridge(5000));
      setElectronReady(ready);
      if (!ready) {
        throw new Error(getElectronEnvironmentHint() ?? 'Connexion Google indisponible ici.');
      }
      const trimmed = googleClientId.trim();
      if (trimmed) {
        await persistGoogleClientId();
      }
      const res = await loginWithGoogleIpc();
      if (res?.ok === false) {
        throw new Error(res.error ?? 'Connexion Google échouée.');
      }
      setGoogleEmail(res.data?.email ?? 'Compte Google');
      setGoogleConnected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion Google échouée.');
    } finally {
      setGoogleLoading(false);
    }
  }

  async function finish() {
    setError('');
    const balance = Number(capital);
    const risk = Number(riskPercent);
    if (!Number.isFinite(balance) || balance <= 0) {
      setError('Capital invalide.');
      return;
    }
    if (!Number.isFinite(risk) || risk <= 0 || risk > 5) {
      setError('Le risque doit être entre 0.1 % et 5 %.');
      return;
    }

    setSaving(true);
    try {
      if (googleClientId.trim()) {
        await persistGoogleClientId();
      }
      const limits = limitsForProgram(wgfProgramId);
      await onComplete({
        isQuickSetup: profile === 'ready',
        aiProvider,
        apiKey: googleConnected ? 'google_oauth' : geminiApiKey.trim(),
        initialBalance: balance,
        riskPercent: profile === 'ready' ? 1 : risk,
        enabledIndicators: (profile === 'ready'
          ? ['wicks', 'propguard', 'ai']
          : indicators
        ).join(','),
        wgfProgramId,
        profitTargetPercent: limits.profit_target_percent,
        maxDailyLossPercent: limits.max_daily_loss_percent,
        maxOverallLossPercent: limits.max_overall_loss_percent,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de l’enregistrement.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-6 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl shadow-black/40">
        <header className="border-b border-slate-800 px-8 py-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-emerald-400">
                NexaTrader — Assistant
              </p>
              <h2 className="mt-1 text-xl font-semibold text-slate-100">
                {STEPS[step]}
              </h2>
            </div>
            <span className="text-sm text-slate-500">
              Étape {step + 1} / {STEPS.length}
            </span>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </header>

        <div className="max-h-[60vh] overflow-y-auto px-8 py-6">
          {step === 0 && (
            <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <article
                  key={title}
                  className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
                >
                  <Icon className="mb-3 h-6 w-6 text-emerald-400" aria-hidden />
                  <h3 className="font-medium text-slate-100">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-400">{desc}</p>
                </article>
              ))}
            </div>
            <p className="rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-xs text-sky-200/90">
              Après le lancement, un tutoriel pas à pas et des conseils trading seront disponibles
              via le bouton <strong className="font-medium">Hub WGF</strong> en haut de l’écran.
            </p>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setProfile('ready')}
                className={`rounded-xl border p-5 text-left transition ${
                  profile === 'ready'
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-slate-800 bg-slate-950/50 hover:border-slate-600'
                }`}
              >
                <Shield className="h-6 w-6 text-emerald-400" />
                <h3 className="mt-3 font-semibold text-slate-100">Prêt à Trader</h3>
                <p className="mt-2 text-sm text-slate-400">
                  Paramètres WGF optimisés : risque 1 %, mèches + PropGuard + IA activés.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setProfile('custom')}
                className={`rounded-xl border p-5 text-left transition ${
                  profile === 'custom'
                    ? 'border-sky-500 bg-sky-500/10'
                    : 'border-slate-800 bg-slate-950/50 hover:border-slate-600'
                }`}
              >
                <Brain className="h-6 w-6 text-sky-400" />
                <h3 className="mt-3 font-semibold text-slate-100">Personnalisé</h3>
                <p className="mt-2 text-sm text-slate-400">
                  Choisissez l’IA, les indicateurs et le pourcentage de risque.
                </p>
              </button>

              {isCustom && (
                <div className="sm:col-span-2 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <p className="mb-3 text-sm font-medium text-slate-300">Indicateurs</p>
                  <div className="flex flex-wrap gap-2">
                    {INDICATOR_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => toggleIndicator(opt.id)}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          indicators.includes(opt.id)
                            ? 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/50'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <label className="mt-4 block text-sm text-slate-400">
                    Risque par trade (%)
                    <input
                      type="number"
                      min="0.1"
                      max="5"
                      step="0.1"
                      value={riskPercent}
                      onChange={(e) => setRiskPercent(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                    />
                  </label>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <label className="block text-sm text-slate-400">
                Fournisseur IA
                <select
                  value={aiProvider}
                  onChange={(e) => setAiProvider(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                >
                  {AI_PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              {aiProvider.startsWith('gemini') ? (
                <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-3">
                  <p className="text-sm text-slate-200">Gemini avec votre e-mail Google</p>
                  <p className="text-xs text-slate-400">
                    Ouvrez AI Studio, connectez-vous avec Gmail, créez une clé API gratuite et
                    collez-la — ou connectez-vous plus tard dans Paramètres.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      window.nexaTrader?.app?.openExternal?.('https://aistudio.google.com/apikey')
                    }
                    className="w-full rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-500"
                  >
                    Ouvrir Google AI Studio
                  </button>
                  <label className="block text-xs text-slate-400">
                    Clé API Gemini (optionnel)
                    <input
                      type="password"
                      value={geminiApiKey}
                      onChange={(e) => setGeminiApiKey(e.target.value)}
                      placeholder="AIza…"
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </label>
                  <button
                    type="button"
                    className="text-[10px] text-slate-500 underline"
                    onClick={() => setShowOAuthAdvanced((v) => !v)}
                  >
                    {showOAuthAdvanced ? 'Masquer' : 'Client ID OAuth avancé'}
                  </button>
                  {showOAuthAdvanced && (
                    <label className="block text-xs text-slate-400">
                      Client ID OAuth (Application de bureau)
                      <input
                        type="text"
                        value={googleClientId}
                        onChange={(e) => setGoogleClientId(e.target.value)}
                        placeholder="….apps.googleusercontent.com"
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </label>
                  )}
                  {googleConnected && (
                    <p className="text-xs text-emerald-400">
                      Connecté : {googleEmail}. Vous pouvez lancer NexaTrader.
                    </p>
                  )}
                </div>
              ) : (
                <p className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-slate-500">
                  Connexion Google requise uniquement pour Gemini. Les autres fournisseurs seront
                  configurés ultérieurement.
                </p>
              )}
              <label className="block text-sm text-slate-400">
                Capital du challenge (USD)
                <input
                  type="number"
                  min="1000"
                  step="1000"
                  value={capital}
                  onChange={(e) => setCapital(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                />
              </label>
              <WgfProgramPanel programId={wgfProgramId} onProgramChange={setWgfProgramId} compact />
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {error}
            </p>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-slate-800 px-8 py-4">
          <button
            type="button"
            disabled={step === 0 || saving}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-slate-400 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Retour
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              Continuer
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={finish}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              {saving ? 'Enregistrement…' : 'Lancer NexaTrader'}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
