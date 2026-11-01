import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useTrading } from '../context/TradingContext.jsx';
import { testGeminiConnection } from '../engine/aiService.js';
import GoogleSignInButton from './GoogleSignInButton.jsx';
import { loginWithGoogleIpc, waitForElectronBridge, getElectronEnvironmentHint } from '../lib/electronBridge.js';
import { testMarketConnectionFromMain } from '../lib/marketDataClient.js';
import { DEFAULT_GEMINI_SETTINGS_ID, normalizeGeminiSettingsId } from '../lib/geminiModels.js';
import { WGF_READY_DEFAULTS } from '../lib/db.js';

const MARKET_PROVIDERS = [
  { id: 'simulated', label: 'Simulation locale (gratuit, sans clé)' },
  { id: 'twelve_data', label: 'Twelve Data — live (clé gratuite)' },
  { id: 'finnhub', label: 'Finnhub — live (clé gratuite)' },
];

const AI_PROVIDERS = [
  { id: DEFAULT_GEMINI_SETTINGS_ID, label: 'Google Gemini 2.5 Flash (recommandé)' },
  { id: 'gemini-flash-latest', label: 'Google Gemini Flash (latest)' },
  { id: 'gemini-2.0-flash', label: 'Google Gemini 2.0 Flash' },
  { id: 'claude', label: 'Claude' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'ollama', label: 'Ollama' },
];

export default function SettingsModal() {
  const {
    settingsOpen,
    setSettingsOpen,
    settings,
    challenge,
    updateSettings,
    updateChallengeSettings,
    resetChallenge,
    reloadApp,
  } = useTrading();
  const [aiProvider, setAiProvider] = useState(DEFAULT_GEMINI_SETTINGS_ID);
  const [riskPercent, setRiskPercent] = useState('1');
  const [autoPilot, setAutoPilot] = useState(false);
  const [paperTrading, setPaperTrading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleClientId, setGoogleClientId] = useState('');
  const [testingAi, setTestingAi] = useState(false);
  const [aiTestMessage, setAiTestMessage] = useState('');
  const [aiTestOk, setAiTestOk] = useState(null);
  const [challengeCapital, setChallengeCapital] = useState('100000');
  const [profitTarget, setProfitTarget] = useState('8');
  const [maxDaily, setMaxDaily] = useState('5');
  const [maxOverall, setMaxOverall] = useState('10');
  const [challengeMsg, setChallengeMsg] = useState('');
  const [challengeBusy, setChallengeBusy] = useState(false);
  const [marketProvider, setMarketProvider] = useState('simulated');
  const [marketApiKey, setMarketApiKey] = useState('');
  const [testingMarket, setTestingMarket] = useState(false);
  const [marketTestMessage, setMarketTestMessage] = useState('');
  const [marketTestOk, setMarketTestOk] = useState(null);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [showOAuthAdvanced, setShowOAuthAdvanced] = useState(false);
  const [oauthPreconfigured, setOauthPreconfigured] = useState(false);
  const [geminiEnvKey, setGeminiEnvKey] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveOk, setSaveOk] = useState(null);

  const settingsHydratedRef = useRef(false);
  const challengeHydratedRef = useRef(false);

  useEffect(() => {
    if (!settingsOpen) {
      settingsHydratedRef.current = false;
      challengeHydratedRef.current = false;
      return;
    }
    if (!settings || settingsHydratedRef.current) return;
    settingsHydratedRef.current = true;

    setAiProvider(normalizeGeminiSettingsId(settings.ai_provider));
    setRiskPercent(String(settings.default_risk_percent ?? 1));
    setAutoPilot(Number(settings.auto_pilot) === 1);
    setPaperTrading(settings.paper_trading == null || Number(settings.paper_trading) === 1);
    setGoogleEmail(settings.google_account_email ?? '');
    setGoogleClientId(settings.google_oauth_client_id ?? '');
    setMarketProvider(settings.market_provider ?? 'simulated');
    setMarketApiKey(settings.market_api_key ?? '');
    const storedKey = settings.api_key;
    setGeminiApiKey(storedKey && storedKey !== 'google_oauth' ? storedKey : '');
    setShowOAuthAdvanced(Boolean(settings.google_oauth_client_id?.trim()));
  }, [settingsOpen, settings]);

  useEffect(() => {
    if (!settingsOpen || !challenge || challengeHydratedRef.current) return;
    challengeHydratedRef.current = true;
    setChallengeCapital(String(challenge.initial_balance ?? 100000));
    setProfitTarget(String(challenge.profit_target_percent ?? WGF_READY_DEFAULTS.profit_target_percent));
    setMaxDaily(String(challenge.max_daily_loss_percent ?? WGF_READY_DEFAULTS.max_daily_loss_percent));
    setMaxOverall(
      String(challenge.max_overall_loss_percent ?? WGF_READY_DEFAULTS.max_overall_loss_percent),
    );
    setChallengeMsg('');
  }, [settingsOpen, challenge]);

  useEffect(() => {
    if (!settingsOpen) return;
    let cancelled = false;
    (async () => {
      const res = await window.nexaTrader?.auth?.isGoogleOAuthConfigured?.();
      const envRes = await window.nexaTrader?.ai?.geminiEnvStatus?.();
      if (!cancelled) {
        setOauthPreconfigured(res?.data?.configured === true);
        setGeminiEnvKey(envRes?.data?.hasEnvKey === true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [settingsOpen]);

  if (!settingsOpen) return null;

  const googleConnected =
    Boolean(settings?.google_access_token) || settings?.api_key === 'google_oauth';

  const geminiKeyStored =
    Boolean(settings?.api_key && settings.api_key !== 'google_oauth') ||
    Boolean(geminiApiKey.trim());

  function openGoogleAiStudio() {
    window.nexaTrader?.app?.openExternal?.('https://aistudio.google.com/apikey');
  }

  function buildSettingsPayload() {
    const keyTrim = geminiApiKey.trim();
    const apiKey = googleConnected
      ? 'google_oauth'
      : keyTrim || (settings?.api_key !== 'google_oauth' ? settings?.api_key ?? '' : '');

    return {
      aiProvider: normalizeGeminiSettingsId(aiProvider),
      apiKey,
      riskPercent: Number(riskPercent),
      autoPilot,
      googleOAuthClientId: googleClientId.trim(),
      paperTrading,
      marketProvider,
      marketApiKey: marketApiKey.trim() || settings?.market_api_key || '',
    };
  }

  async function persistGoogleClientIdIfNeeded() {
    const trimmed = googleClientId.trim();
    if (!trimmed || trimmed.includes('VOTRE_CLIENT_ID')) return;
    await updateSettings({ ...buildSettingsPayload(), googleOAuthClientId: trimmed });
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    setAiTestMessage('');
    try {
      const ready = await waitForElectronBridge(5000);
      if (!ready) {
        throw new Error(getElectronEnvironmentHint() ?? 'Connexion Google indisponible.');
      }
      if (googleClientId.trim()) {
        await persistGoogleClientIdIfNeeded();
      }
      const res = await loginWithGoogleIpc();
      if (res?.ok === false) {
        throw new Error(res.error ?? 'Connexion Google échouée.');
      }
      setGoogleEmail(res.data?.email ?? 'Compte Google');
      await reloadApp();
    } catch (error) {
      setAiTestOk(false);
      const base = error instanceof Error ? error.message : 'Connexion Google échouée.';
      setAiTestMessage(
        `${base} — Utilisez plutôt une clé API : bouton « Ouvrir Google AI Studio », connectez-vous avec votre e-mail Google, copiez la clé et collez-la ci-dessous.`,
      );
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleTestAiKey() {
    setTestingAi(true);
    setAiTestMessage('');
    setAiTestOk(null);
    try {
      const key = geminiApiKey.trim();
      if (!googleConnected && !key && !geminiEnvKey) {
        setAiTestOk(false);
        setAiTestMessage(
          'Étape manquante : ouvrez Google AI Studio, connectez-vous avec votre e-mail Google, créez une clé API gratuite, puis collez-la dans le champ ci-dessus.',
        );
        return;
      }
      const testSettings = {
        ...settings,
        api_key: googleConnected ? 'google_oauth' : key,
        google_access_token: settings?.google_access_token,
        ai_provider: normalizeGeminiSettingsId(aiProvider),
      };
      const result = await testGeminiConnection(testSettings);
      setAiTestMessage(
        result.ok
          ? `${result.message} Cliquez Enregistrer pour mémoriser la clé.`
          : result.message,
      );
      setAiTestOk(result.ok);
    } finally {
      setTestingAi(false);
    }
  }

  async function handleSaveGeminiKeyOnly() {
    const key = geminiApiKey.trim();
    if (!key && !googleConnected && !geminiEnvKey && !settings?.api_key) {
      setSaveOk(false);
      setSaveMsg('Collez d’abord votre clé API Gemini.');
      return;
    }
    setSaving(true);
    setSaveMsg('');
    try {
      await updateSettings(buildSettingsPayload());
      setSaveOk(true);
      setSaveMsg('Paramètres enregistrés dans SQLite.');
    } catch (err) {
      setSaveOk(false);
      setSaveMsg(err instanceof Error ? err.message : 'Échec enregistrement.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveChallengeLimits(e) {
    e.preventDefault();
    setChallengeBusy(true);
    setChallengeMsg('');
    try {
      await updateChallengeSettings({
        profitTargetPercent: Number(profitTarget),
        maxDailyLossPercent: Number(maxDaily),
        maxOverallLossPercent: Number(maxOverall),
      });
      setChallengeMsg('Limites WGF enregistrées sur le challenge actif.');
    } catch (err) {
      setChallengeMsg(err instanceof Error ? err.message : 'Échec enregistrement challenge.');
    } finally {
      setChallengeBusy(false);
    }
  }

  async function handleResetChallenge() {
    if (
      !window.confirm(
        'Créer un nouveau challenge ? Les trades restent dans le journal ; l’équité repart du capital saisi.',
      )
    ) {
      return;
    }
    setChallengeBusy(true);
    setChallengeMsg('');
    try {
      await resetChallenge({
        initialBalance: Number(challengeCapital),
        profitTargetPercent: Number(profitTarget),
        maxDailyLossPercent: Number(maxDaily),
        maxOverallLossPercent: Number(maxOverall),
      });
      setChallengeMsg('Nouveau challenge actif.');
    } catch (err) {
      setChallengeMsg(err instanceof Error ? err.message : 'Échec reset challenge.');
    } finally {
      setChallengeBusy(false);
    }
  }

  async function handleTestMarket() {
    setTestingMarket(true);
    setMarketTestMessage('');
    setMarketTestOk(null);
    try {
      if (marketProvider === 'simulated') {
        setMarketTestOk(true);
        setMarketTestMessage('Mode simulation — aucune clé requise.');
        return;
      }
      const ready = await waitForElectronBridge(3000);
      if (!ready) {
        throw new Error(getElectronEnvironmentHint() ?? 'Test live réservé à la fenêtre Electron.');
      }
      const data = await testMarketConnectionFromMain({
        provider: marketProvider,
        apiKey: marketApiKey.trim(),
        symbol: 'XAUUSD',
      });
      setMarketTestOk(true);
      setMarketTestMessage(
        `OK — ${data.candleCount} bougies, dernier close ${Number(data.lastClose).toFixed(2)}.`,
      );
    } catch (error) {
      setMarketTestOk(false);
      setMarketTestMessage(error instanceof Error ? error.message : 'Test marché échoué.');
    } finally {
      setTestingMarket(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg('');
    try {
      await updateSettings(buildSettingsPayload());
      setSaveOk(true);
      setSaveMsg('Paramètres enregistrés.');
      setSettingsOpen(false);
    } catch (err) {
      setSaveOk(false);
      setSaveMsg(err instanceof Error ? err.message : 'Échec enregistrement.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 id="settings-title" className="text-sm font-semibold text-slate-100">
            Paramètres
          </h2>
          <button
            type="button"
            onClick={() => setSettingsOpen(false)}
            className="rounded p-1 text-slate-400 hover:text-white"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSave} className="flex max-h-[85vh] flex-col">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <fieldset className="space-y-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-emerald-400">
              Challenge prop (WGF)
            </legend>
            {challenge ? (
              <p className="text-[10px] text-slate-400">
                Statut :{' '}
                <span className="text-slate-200">{challenge.status}</span> · Équité{' '}
                {Number(challenge.current_equity ?? 0).toLocaleString('fr-FR')} $ /{' '}
                {Number(challenge.initial_balance ?? 0).toLocaleString('fr-FR')} $
              </p>
            ) : (
              <p className="text-[10px] text-amber-300">Aucun challenge actif — créez-en un ci-dessous.</p>
            )}
            <label className="block text-xs text-slate-400">
              Capital initial (USD)
              <input
                type="number"
                min="1000"
                step="1000"
                value={challengeCapital}
                onChange={(e) => setChallengeCapital(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
            </label>
            <div className="grid grid-cols-3 gap-2">
              <label className="block text-[10px] text-slate-400">
                Objectif profit %
                <input
                  type="number"
                  min="1"
                  max="20"
                  step="0.5"
                  value={profitTarget}
                  onChange={(e) => setProfitTarget(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
                />
              </label>
              <label className="block text-[10px] text-slate-400">
                Perte jour max %
                <input
                  type="number"
                  min="1"
                  max="10"
                  step="0.5"
                  value={maxDaily}
                  onChange={(e) => setMaxDaily(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
                />
              </label>
              <label className="block text-[10px] text-slate-400">
                Drawdown max %
                <input
                  type="number"
                  min="1"
                  max="15"
                  step="0.5"
                  value={maxOverall}
                  onChange={(e) => setMaxOverall(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={challengeBusy}
                onClick={handleSaveChallengeLimits}
                className="rounded-lg border border-emerald-600/50 bg-emerald-600/20 px-3 py-1.5 text-[11px] text-emerald-200 hover:bg-emerald-600/30 disabled:opacity-50"
              >
                Enregistrer les limites
              </button>
              <button
                type="button"
                disabled={challengeBusy}
                onClick={handleResetChallenge}
                className="rounded-lg border border-slate-600 px-3 py-1.5 text-[11px] text-slate-300 hover:border-slate-400 disabled:opacity-50"
              >
                Nouveau challenge
              </button>
            </div>
            {challengeMsg && (
              <p className="text-[10px] text-slate-300">{challengeMsg}</p>
            )}
          </fieldset>

          <fieldset className="space-y-3 rounded-xl border border-sky-500/20 bg-sky-500/5 p-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-sky-400">
              Données marché
            </legend>
            <p className="text-[10px] leading-relaxed text-slate-500">
              Live gratuit avec inscription (quotas API). Sinon importez un CSV/JSON depuis le
              graphique (glisser-déposer ou bouton Importer).
            </p>
            <label className="block text-xs text-slate-400">
              Source des bougies
              <select
                value={marketProvider}
                onChange={(e) => setMarketProvider(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              >
                {MARKET_PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            {marketProvider !== 'simulated' && (
              <>
                <label className="block text-xs text-slate-400">
                  Clé API marché
                  <input
                    type="password"
                    value={marketApiKey}
                    onChange={(e) => setMarketApiKey(e.target.value)}
                    placeholder="Coller la clé du fournisseur"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                    autoComplete="off"
                  />
                </label>
                <p className="text-[10px] text-slate-500">
                  Twelve Data :{' '}
                  <button
                    type="button"
                    className="text-sky-400 underline"
                    onClick={() =>
                      window.nexaTrader?.app?.openExternal?.('https://twelvedata.com/register')
                    }
                  >
                    twelvedata.com
                  </button>{' '}
                  · Finnhub :{' '}
                  <button
                    type="button"
                    className="text-sky-400 underline"
                    onClick={() =>
                      window.nexaTrader?.app?.openExternal?.('https://finnhub.io/register')
                    }
                  >
                    finnhub.io
                  </button>
                </p>
                <button
                  type="button"
                  disabled={testingMarket}
                  onClick={handleTestMarket}
                  className="w-full rounded-lg border border-sky-600/40 bg-sky-600/15 px-3 py-2 text-[11px] text-sky-200 hover:border-sky-500 disabled:opacity-50"
                >
                  {testingMarket ? 'Test en cours…' : 'Tester la connexion live'}
                </button>
              </>
            )}
            {marketProvider === 'simulated' && (
              <button
                type="button"
                disabled={testingMarket}
                onClick={handleTestMarket}
                className="w-full rounded-lg border border-slate-600 px-3 py-2 text-[11px] text-slate-300 disabled:opacity-50"
              >
                Vérifier le mode simulation
              </button>
            )}
            {marketTestMessage && (
              <p className={`text-[11px] ${marketTestOk ? 'text-emerald-400' : 'text-amber-300'}`}>
                {marketTestMessage}
              </p>
            )}
          </fieldset>

          <label className="block text-xs text-slate-400">
            Fournisseur IA
            <select
              value={aiProvider}
              onChange={(e) => setAiProvider(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            >
              {AI_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          {aiProvider.startsWith('gemini') && (
            <fieldset className="space-y-3 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-violet-300">
                Gemini avec votre e-mail Google
              </legend>
              <p className="text-[11px] leading-relaxed text-slate-300">
                NexaTrader ne peut pas réutiliser la connexion du site gemini.google.com. Avec votre
                compte Google (Gmail), la méthode simple et gratuite est une{' '}
                <strong className="font-medium text-violet-200">clé API</strong> créée sur Google
                AI Studio — même identifiant, même compte.
              </p>
              <ol className="list-decimal space-y-1 pl-4 text-[10px] text-slate-400">
                <li>Cliquez « Ouvrir Google AI Studio » (navigateur).</li>
                <li>Connectez-vous avec votre adresse e-mail Google.</li>
                <li>Créez une clé API → Copier.</li>
                <li>Collez la clé ci-dessous → Tester → Enregistrer la clé.</li>
              </ol>
              <button
                type="button"
                onClick={openGoogleAiStudio}
                className="w-full rounded-lg bg-violet-600 px-3 py-2.5 text-xs font-medium text-white hover:bg-violet-500"
              >
                Ouvrir Google AI Studio
              </button>
              {geminiEnvKey && (
                <p className="text-[10px] text-emerald-400">
                  Une clé GEMINI_API_KEY est définie dans le fichier .env — vous pouvez tester sans
                  coller, ou Enregistrer pour confirmer les autres paramètres.
                </p>
              )}
              {(googleConnected || geminiKeyStored) && (
                <p className="text-[10px] text-emerald-400">
                  {googleConnected
                    ? `Gemini actif via Google : ${googleEmail || 'compte connecté'}`
                    : 'Gemini actif via clé API (pensez à Enregistrer si vous venez de coller la clé).'}
                </p>
              )}
              <label className="block text-xs text-slate-400">
                Clé API Gemini
                <input
                  type="password"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder="AIza… (collée depuis AI Studio)"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={testingAi}
                  onClick={handleTestAiKey}
                  className="flex-1 rounded-lg border border-slate-600 px-3 py-2 text-[11px] text-slate-200 hover:border-slate-400 disabled:opacity-40"
                >
                  {testingAi ? 'Test…' : 'Tester la connexion IA'}
                </button>
                <button
                  type="button"
                  disabled={saving || (!geminiApiKey.trim() && !googleConnected && !geminiEnvKey)}
                  onClick={handleSaveGeminiKeyOnly}
                  className="flex-1 rounded-lg border border-emerald-600/50 bg-emerald-600/20 px-3 py-2 text-[11px] text-emerald-200 hover:bg-emerald-600/30 disabled:opacity-40"
                >
                  Enregistrer la clé
                </button>
              </div>
              {oauthPreconfigured ? (
                <>
                  <div className="relative py-1 text-center text-[10px] text-slate-600">
                    <span className="bg-slate-900 px-2">OAuth (optionnel)</span>
                    <div className="absolute inset-x-0 top-1/2 -z-10 border-t border-slate-800" />
                  </div>
                  <GoogleSignInButton
                    onClick={handleGoogleLogin}
                    loading={googleLoading}
                    connectedEmail={googleConnected ? googleEmail : null}
                    label="Continuer avec Google"
                  />
                </>
              ) : (
                <p className="rounded-lg border border-slate-700/80 bg-slate-950/60 px-3 py-2 text-[10px] text-slate-500">
                  Le bouton « Continuer avec Google » nécessite un Client ID OAuth (développeur).
                  Avec un compte Google personnel, utilisez la clé AI Studio ci-dessus — c’est
                  l’équivalent pour NexaTrader.
                </p>
              )}
              <button
                type="button"
                className="text-[10px] text-slate-500 underline"
                onClick={() => setShowOAuthAdvanced((v) => !v)}
              >
                {showOAuthAdvanced ? 'Masquer' : 'Client ID OAuth (développeur)'}
              </button>
              {showOAuthAdvanced && (
                <>
                  <label className="block text-xs text-slate-400">
                    Client ID OAuth (application de bureau)
                    <input
                      type="text"
                      value={googleClientId}
                      onChange={(e) => setGoogleClientId(e.target.value)}
                      placeholder="xxxx.apps.googleusercontent.com"
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </label>
                  <p className="text-[10px] leading-relaxed text-slate-500">
                    Redirection autorisée :{' '}
                    <span className="text-slate-400">http://127.0.0.1:42813/callback</span>
                  </p>
                </>
              )}
            </fieldset>
          )}

          {aiTestMessage && (
            <p className={`text-[11px] ${aiTestOk ? 'text-emerald-400' : 'text-amber-300'}`}>
              {aiTestMessage}
            </p>
          )}

          <label className="block text-xs text-slate-400">
            Risque par trade (%)
            <input
              type="number"
              min="0.1"
              max="5"
              step="0.1"
              value={riskPercent}
              onChange={(e) => setRiskPercent(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={paperTrading}
              onChange={(e) => setPaperTrading(e.target.checked)}
              className="rounded border-slate-600 bg-slate-950"
            />
            Mode paper — autoriser trades hors session US et spread simulé élevé
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={autoPilot}
              onChange={(e) => setAutoPilot(e.target.checked)}
              className="rounded border-slate-600 bg-slate-950"
            />
            Auto-Pilot — préparer l&apos;ordre si score IA ≥ 80 %
          </label>
          </div>
          <div className="shrink-0 space-y-2 border-t border-slate-800 bg-slate-900 px-4 py-3">
            {saveMsg && (
              <p className={`text-[11px] ${saveOk ? 'text-emerald-400' : 'text-amber-300'}`}>
                {saveMsg}
              </p>
            )}
            <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              className="rounded-lg px-3 py-2 text-xs text-slate-400"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer tout'}
            </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
