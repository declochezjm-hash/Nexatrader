import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import WickWorker from '../workers/wickWorker.js?worker';
import { fetchActiveChallenge, fetchAppSettings, fetchRecentTrades } from '../lib/db.js';
import { ensureActiveChallenge } from '../lib/challengeBootstrap.js';
import {
  resetChallengeWithCapital,
  updateActiveChallengeLimits,
} from '../lib/challengeSettings.js';
import { canOpenTrade, resolveSession } from '../engine/propGuard.js';
import { executeKillSwitch as runKillSwitch } from '../lib/executeKillSwitch.js';
import { resumeAfterKillSwitch as runResumeAfterKillSwitch } from '../lib/resumeAfterKillSwitch.js';
import { executeOpenOrder, refreshEquityState } from '../lib/orderExecution.js';
import { processMarketTick as runTradeMonitor } from '../engine/tradeMonitor.js';
import { processWickSignal, isActionableWickSignal } from '../lib/aiPipeline.js';
import { TUTORIAL_STORAGE_KEY } from '../lib/tutorialContent.js';
import { normalizeGeminiSettingsId } from '../lib/geminiModels.js';
import { assertDbWriteOk } from '../lib/settingsPersist.js';

const IMPORT_STORAGE_KEY = 'nexatrader_imported_candles_v1';
const IMPORT_MAX_CANDLES = 1500;

function trimImportedSeries(payload) {
  if (!payload?.candles?.length) return payload;
  if (payload.candles.length <= IMPORT_MAX_CANDLES) return payload;
  return { ...payload, candles: payload.candles.slice(-IMPORT_MAX_CANDLES) };
}

const AI_DEFAULTS = {
  confidence: 0,
  signal: 'SKIP',
  advice: 'En attente d’un pattern mèche (H / SS)…',
  source: 'local',
};

const TradingContext = createContext(null);

export function TradingProvider({ children }) {
  const [booting, setBooting] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [settings, setSettings] = useState(null);
  const [challenge, setChallenge] = useState(null);
  const [trades, setTrades] = useState([]);

  const [symbol, setSymbol] = useState('XAUUSD');
  const [timeframe, setTimeframe] = useState('15m');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [dbStatus, setDbStatus] = useState('connecting');
  const [workerStatus, setWorkerStatus] = useState('connecting');

  const [marketPrice, setMarketPrice] = useState(null);
  const [currentSpread, setCurrentSpread] = useState(0.2);
  const [activeStopLoss, setActiveStopLoss] = useState(null);
  const [inSession, setInSession] = useState(true);
  const [killSwitchActive, setKillSwitchActive] = useState(false);
  const [aiInsight, setAiInsight] = useState(AI_DEFAULTS);
  const [chartBridge, setChartBridge] = useState(null);
  const [chartReady, setChartReady] = useState(false);
  const [latestChartSignal, setLatestChartSignal] = useState(null);
  const [drawingTool, setDrawingTool] = useState(null);
  const [drawings, setDrawings] = useState([]);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [importedSeries, setImportedSeriesState] = useState(null);

  const workerRef = useRef(null);
  const analyzePendingRef = useRef(new Map());
  const analyzeSeqRef = useRef(0);
  const lastPatternSnapshotRef = useRef(null);
  const patternByTradeRef = useRef(new Map());
  const lastAutoPilotKeyRef = useRef('');
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const tutorialAutoTriggeredRef = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(IMPORT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.candles?.length) {
          setImportedSeriesState(trimImportedSeries(parsed));
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const setImportedSeries = useCallback((payload) => {
    const next = payload ? trimImportedSeries(payload) : null;
    setImportedSeriesState(next);
    try {
      if (next) {
        localStorage.setItem(IMPORT_STORAGE_KEY, JSON.stringify(next));
      } else {
        localStorage.removeItem(IMPORT_STORAGE_KEY);
      }
    } catch {
      /* quota */
    }
  }, []);

  const clearImportedSeries = useCallback(() => {
    setImportedSeries(null);
  }, [setImportedSeries]);

  const refreshChallenge = useCallback(async () => {
    const settingsRow = await fetchAppSettings();
    await ensureActiveChallenge(settingsRow);
    const row = await fetchActiveChallenge();
    if (row) {
      const synced = await refreshEquityState(row);
      setChallenge(synced ?? row);
      return synced ?? row;
    }
    setChallenge(null);
    return null;
  }, []);

  const refreshTrades = useCallback(async () => {
    const rows = await fetchRecentTrades();
    setTrades(rows);
  }, []);

  const reloadApp = useCallback(async () => {
    let dbConnected = false;
    if (window.nexaTrader?.db?.status) {
      const statusRes = await window.nexaTrader.db.status();
      dbConnected = statusRes?.ok !== false && statusRes?.data?.ready === true;
    } else if (window.nexaTrader?.db) {
      dbConnected = true;
    }

    const appSettings = await fetchAppSettings();
    setSettings(appSettings);
    setDbStatus(
      dbConnected && !appSettings._offline ? 'connected' : 'offline',
    );
    setShowOnboarding(Number(appSettings.first_launch_completed) !== 1);
    await refreshChallenge();
    await refreshTrades();
  }, [refreshChallenge, refreshTrades]);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      await reloadApp();
      if (cancelled) return;

      try {
        const worker = new WickWorker();
        workerRef.current = worker;

        worker.onmessage = (event) => {
          const data = event.data ?? {};
          if (data.type === 'PONG') {
            setWorkerStatus('ready');
            return;
          }

          if (data.type === 'ANALYZE_CANDLES_RESULT') {
            const pending = analyzePendingRef.current.get(data.requestId);
            if (pending) {
              analyzePendingRef.current.delete(data.requestId);
              if (data.ok) pending.resolve(data.result);
              else pending.reject(new Error(data.error ?? 'Analyse échouée'));
            }

            if (data.ok && data.result?.latestSignal) {
              setLatestChartSignal(data.result.latestSignal);
            }
            return;
          }

          if (data.type === 'ERROR') {
            const pending = analyzePendingRef.current.get(data.requestId);
            if (pending) {
              analyzePendingRef.current.delete(data.requestId);
              pending.reject(new Error(data.error ?? 'Erreur worker'));
            }
          }
        };

        worker.onerror = () => setWorkerStatus('error');
        worker.postMessage({ type: 'PING', requestId: 'boot' });
      } catch {
        setWorkerStatus('error');
      }

      setBooting(false);
    }

    boot();

    return () => {
      cancelled = true;
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [reloadApp]);

  useEffect(() => {
    if (booting || showOnboarding) return;
    if (Number(settingsRef.current?.first_launch_completed) !== 1) return;
    if (tutorialAutoTriggeredRef.current) return;

    try {
      if (localStorage.getItem(TUTORIAL_STORAGE_KEY) === '1') {
        tutorialAutoTriggeredRef.current = true;
        return;
      }
      localStorage.setItem(TUTORIAL_STORAGE_KEY, '1');
    } catch {
      /* stockage local indisponible */
    }

    tutorialAutoTriggeredRef.current = true;
    setTutorialOpen(true);
  }, [booting, showOnboarding, settings?.first_launch_completed]);

  const runAiPipeline = useCallback(async (result, assetSymbol) => {
    const sig = result?.latestSignal;
    if (!sig) return result;

    setLatestChartSignal(sig);

    if (!isActionableWickSignal(sig)) {
      setAiInsight({
        confidence: 35,
        signal: 'SKIP',
        advice: 'Pattern non actionable — attente Hammer / Shooting Star.',
        source: 'local',
      });
      return result;
    }

    const processed = await processWickSignal({
      signal: sig,
      symbol: assetSymbol,
      settings: settingsRef.current,
    });

    if (!processed) return result;

    setAiInsight(processed.insight);
    lastPatternSnapshotRef.current = processed.patternSnapshot;

    const autoPilot = Number(settingsRef.current?.auto_pilot) === 1;
    const { confidence, signal: rec } = processed.insight;

    if (
      autoPilot &&
      confidence >= 80 &&
      (rec === 'BUY' || rec === 'SELL') &&
      processed.signalKey !== lastAutoPilotKeyRef.current
    ) {
      lastAutoPilotKeyRef.current = processed.signalKey;
      const openResult = await executeOpenOrder({
        symbol: assetSymbol,
        side: rec,
        challenge,
        settings: settingsRef.current,
        marketPrice: sig.entry,
        stopLossPrice: sig.stopLoss,
        takeProfitPrice: sig.breakEven,
        currentSpread,
        inSession,
        killSwitchActive,
      });

      if (openResult.ok && openResult.tradeId && lastPatternSnapshotRef.current) {
        patternByTradeRef.current.set(openResult.tradeId, lastPatternSnapshotRef.current);
      }
      if (openResult.ok) {
        await refreshTrades();
        await refreshChallenge();
      }
    }

    return result;
  }, [challenge, currentSpread, inSession, killSwitchActive, refreshChallenge, refreshTrades]);

  const analyzeCandles = useCallback(
    async (candles, assetSymbol) => {
      const worker = workerRef.current;
      if (!worker) {
        return Promise.reject(new Error('Worker indisponible'));
      }

      const requestId = `analyze-${++analyzeSeqRef.current}`;
      const result = await new Promise((resolve, reject) => {
        analyzePendingRef.current.set(requestId, { resolve, reject });
        worker.postMessage({
          type: 'ANALYZE_CANDLES',
          requestId,
          payload: {
            candles,
            symbol: assetSymbol,
            detectClusters: assetSymbol === 'NAS100',
            clusterWindow: 10,
          },
        });
      });

      await runAiPipeline(result, assetSymbol);
      return result;
    },
    [runAiPipeline],
  );

  useEffect(() => {
    setInSession(resolveSession(symbol, Math.floor(Date.now() / 1000)));
  }, [symbol, timeframe, marketPrice]);

  const propGuard = useMemo(
    () =>
      canOpenTrade({
        symbol,
        currentSpread,
        challenge,
        inSession,
        killSwitchActive,
        paperTrading:
          settings?.paper_trading == null || Number(settings?.paper_trading) === 1,
      }),
    [symbol, currentSpread, challenge, inSession, killSwitchActive, settings?.paper_trading],
  );

  const completeOnboarding = useCallback(
    async (payload) => {
      const db = window.nexaTrader?.db;
      if (!db) {
        throw new Error('SQLite indisponible.');
      }

      await db.run(
        `UPDATE app_settings SET
          ai_provider = ?,
          api_key = ?,
          is_quick_setup = ?,
          default_risk_percent = ?,
          enabled_indicators = ?,
          first_launch_completed = 1
         WHERE id = 1`,
        [
          payload.aiProvider,
          payload.apiKey ?? '',
          payload.isQuickSetup ? 1 : 0,
          payload.riskPercent,
          payload.enabledIndicators,
        ],
      );

      await db.run(
        `UPDATE local_challenge SET status = 'archived'
         WHERE status = 'active'`,
      );

      await db.run(
        `INSERT INTO local_challenge (
          status, initial_balance, current_equity, starting_daily_balance,
          profit_target_percent, max_daily_loss_percent, max_overall_loss_percent,
          consecutive_losses, failure_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
        [
          'active',
          payload.initialBalance,
          payload.initialBalance,
          payload.initialBalance,
          payload.profitTargetPercent,
          payload.maxDailyLossPercent,
          payload.maxOverallLossPercent,
        ],
      );

      setShowOnboarding(false);
      await reloadApp();
    },
    [reloadApp],
  );

  const updateSettings = useCallback(
    async (partial) => {
      const db = window.nexaTrader?.db;
      if (!db) {
        throw new Error(
          'SQLite indisponible. Ouvrez la fenêtre « NexaTrader — Desktop » (npm run dev), pas l’aperçu navigateur.',
        );
      }

      const aiProvider = normalizeGeminiSettingsId(
        partial.aiProvider ?? settings?.ai_provider,
      );

      const next = {
        ai_provider: aiProvider,
        api_key: partial.apiKey !== undefined ? partial.apiKey : settings?.api_key ?? '',
        default_risk_percent: partial.riskPercent ?? settings?.default_risk_percent,
        enabled_indicators: partial.enabledIndicators ?? settings?.enabled_indicators,
        auto_pilot:
          partial.autoPilot != null ? (partial.autoPilot ? 1 : 0) : settings?.auto_pilot,
        google_oauth_client_id:
          partial.googleOAuthClientId !== undefined
            ? partial.googleOAuthClientId
            : settings?.google_oauth_client_id,
        paper_trading:
          partial.paperTrading != null ? (partial.paperTrading ? 1 : 0) : settings?.paper_trading,
        market_provider:
          partial.marketProvider !== undefined
            ? partial.marketProvider
            : settings?.market_provider ?? 'simulated',
        market_api_key:
          partial.marketApiKey !== undefined
            ? partial.marketApiKey
            : settings?.market_api_key ?? '',
      };

      const result = await db.run(
        `UPDATE app_settings SET
          ai_provider = ?,
          api_key = ?,
          default_risk_percent = ?,
          enabled_indicators = ?,
          auto_pilot = ?,
          google_oauth_client_id = ?,
          paper_trading = ?,
          market_provider = ?,
          market_api_key = ?
         WHERE id = 1`,
        [
          next.ai_provider,
          next.api_key,
          next.default_risk_percent,
          next.enabled_indicators,
          next.auto_pilot ?? 0,
          next.google_oauth_client_id ?? '',
          next.paper_trading ?? 1,
          next.market_provider ?? 'simulated',
          next.market_api_key ?? '',
        ],
      );
      assertDbWriteOk(result, 'Enregistrement des paramètres');
      await reloadApp();
    },
    [reloadApp, settings],
  );

  const updateChallengeSettings = useCallback(
    async (payload) => {
      await updateActiveChallengeLimits(payload);
      await refreshChallenge();
    },
    [refreshChallenge],
  );

  const resetChallenge = useCallback(
    async (payload) => {
      await resetChallengeWithCapital(payload);
      await refreshChallenge();
      await refreshTrades();
    },
    [refreshChallenge, refreshTrades],
  );

  const placeOrder = useCallback(
    async (side) => {
      const result = await executeOpenOrder({
        symbol,
        side,
        challenge,
        settings,
        marketPrice: marketPrice ?? latestChartSignal?.entry,
        stopLossPrice: activeStopLoss ?? latestChartSignal?.stopLoss,
        takeProfitPrice: latestChartSignal?.breakEven,
        currentSpread,
        inSession,
        killSwitchActive,
      });

      if (!result.ok) {
        return result;
      }

      if (result.tradeId && lastPatternSnapshotRef.current) {
        patternByTradeRef.current.set(result.tradeId, lastPatternSnapshotRef.current);
      }

      await refreshTrades();
      await refreshChallenge();
      return result;
    },
    [
      activeStopLoss,
      challenge,
      currentSpread,
      inSession,
      killSwitchActive,
      latestChartSignal,
      marketPrice,
      refreshChallenge,
      refreshTrades,
      settings,
      symbol,
    ],
  );

  const executeKillSwitch = useCallback(async () => {
    setKillSwitchActive(true);
    setAiInsight({ confidence: 0, signal: 'SKIP', advice: 'Kill Switch — analyse suspendue.', source: 'local' });

    const db = window.nexaTrader?.db;
    let prices = {
      [symbol]: marketPrice ?? latestChartSignal?.entry ?? 0,
    };
    if (db) {
      const open = await db.query(
        `SELECT DISTINCT symbol FROM trades WHERE status IN ('open', 'pending')`,
      );
      for (const row of open) {
        prices[row.symbol] = row.symbol === symbol ? prices[symbol] : prices[row.symbol] ?? 0;
      }
    }

    await runKillSwitch({
      marketPricesBySymbol: prices,
      patternByTradeId: Object.fromEntries(patternByTradeRef.current),
      fallbackPattern: lastPatternSnapshotRef.current,
    });
    patternByTradeRef.current.clear();
    await refreshChallenge();
    await refreshTrades();
  }, [latestChartSignal, marketPrice, refreshChallenge, refreshTrades, symbol]);

  const resumeKillSwitch = useCallback(async () => {
    const row = await runResumeAfterKillSwitch();
    setKillSwitchActive(false);
    setChallenge(row);
    setAiInsight(AI_DEFAULTS);
    await refreshChallenge();
    await refreshTrades();
  }, [refreshChallenge, refreshTrades]);

  useEffect(() => {
    if (challenge?.status === 'paused') {
      setKillSwitchActive(true);
    }
  }, [challenge?.id, challenge?.status]);

  const processMarketTick = useCallback(
    async (candle) => {
      if (!candle || killSwitchActive) return null;

      const result = await runTradeMonitor({
        symbol,
        candle,
        challenge,
        patternByTradeId: Object.fromEntries(patternByTradeRef.current),
        fallbackPattern: lastPatternSnapshotRef.current,
      });

      if (result.challenge) {
        setChallenge(result.challenge);
      }

      const be = result.breakEvenUpdates?.[result.breakEvenUpdates.length - 1];
      if (be?.stopLoss != null) {
        setActiveStopLoss(be.stopLoss);
      }

      const closed = result.events?.filter((e) => e.type === 'SL_HIT' || e.type === 'TP_HIT');
      if (closed?.length) {
        for (const event of closed) {
          patternByTradeRef.current.delete(event.tradeId);
        }
        await refreshTrades();
        await refreshChallenge();
      }

      return result;
    },
    [challenge, killSwitchActive, refreshChallenge, refreshTrades, symbol],
  );

  useEffect(() => {
    const timer = setInterval(() => {
      refreshChallenge();
    }, 30000);
    return () => clearInterval(timer);
  }, [refreshChallenge]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        executeKillSwitch();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [executeKillSwitch]);

  const value = useMemo(
    () => ({
      booting,
      showOnboarding,
      settings,
      challenge,
      trades,
      symbol,
      setSymbol,
      timeframe,
      setTimeframe,
      settingsOpen,
      setSettingsOpen,
      dbStatus,
      workerStatus,
      propGuard,
      aiInsight,
      setAiInsight,
      completeOnboarding,
      updateSettings,
      updateChallengeSettings,
      resetChallenge,
      placeOrder,
      executeKillSwitch,
      resumeKillSwitch,
      killSwitchActive,
      marketPrice,
      setMarketPrice,
      currentSpread,
      setCurrentSpread,
      activeStopLoss,
      setActiveStopLoss,
      reloadApp,
      chartBridge,
      setChartBridge,
      chartReady,
      setChartReady,
      analyzeCandles,
      latestChartSignal,
      setLatestChartSignal,
      setInSession,
      drawingTool,
      setDrawingTool,
      drawings,
      setDrawings,
      analyticsOpen,
      setAnalyticsOpen,
      tutorialOpen,
      setTutorialOpen,
      processMarketTick,
      importedSeries,
      setImportedSeries,
      clearImportedSeries,
    }),
    [
      booting,
      showOnboarding,
      settings,
      challenge,
      trades,
      symbol,
      timeframe,
      settingsOpen,
      dbStatus,
      workerStatus,
      propGuard,
      aiInsight,
      completeOnboarding,
      updateSettings,
      updateChallengeSettings,
      resetChallenge,
      placeOrder,
      executeKillSwitch,
      resumeKillSwitch,
      killSwitchActive,
      marketPrice,
      currentSpread,
      activeStopLoss,
      reloadApp,
      chartBridge,
      chartReady,
      analyzeCandles,
      latestChartSignal,
      drawingTool,
      drawings,
      analyticsOpen,
      tutorialOpen,
      processMarketTick,
      importedSeries,
      setImportedSeries,
      clearImportedSeries,
    ],
  );

  return <TradingContext.Provider value={value}>{children}</TradingContext.Provider>;
}

export function useTrading() {
  const ctx = useContext(TradingContext);
  if (!ctx) {
    throw new Error('useTrading doit être utilisé dans TradingProvider.');
  }
  return ctx;
}
