import OnboardingWizard from './components/OnboardingWizard.jsx';
import Toolbar from './components/Toolbar.jsx';
import PropDashboard from './components/PropDashboard.jsx';
import DrawingToolbar from './components/DrawingToolbar.jsx';
import ChartContainer from './components/ChartContainer.jsx';
import TradeJournal from './components/TradeJournal.jsx';
import ResizableWorkspace from './components/ResizableWorkspace.jsx';
import Analytics from './components/Analytics.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import TutorialPanel from './components/TutorialPanel.jsx';
import PreTradeChecklistModal from './components/PreTradeChecklistModal.jsx';
import ProactiveAlerts from './components/ProactiveAlerts.jsx';
import WgfPurchasedWizard from './components/WgfPurchasedWizard.jsx';
import AiCoachPanel from './components/AiCoachPanel.jsx';
import { TradingProvider, useTrading } from './context/TradingContext.jsx';

function MainShell() {
  const {
    booting,
    bootError,
    showOnboarding,
    showWgfPurchasedWizard,
    setShowWgfPurchasedWizard,
    completeWgfPurchasedWizard,
    guardianMode,
    completeOnboarding,
    analyticsOpen,
    setAnalyticsOpen,
  } = useTrading();

  if (booting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-slate-400">
        Chargement de NexaTrader…
      </div>
    );
  }

  if (bootError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 p-6 text-center">
        <p className="text-sm font-medium text-rose-300">Échec du démarrage</p>
        <p className="max-w-md text-xs text-slate-400">{bootError}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-500"
        >
          Recharger
        </button>
      </div>
    );
  }

  return (
    <>
      {showOnboarding && <OnboardingWizard onComplete={completeOnboarding} />}
      {showWgfPurchasedWizard ? (
        <WgfPurchasedWizard
          onComplete={(p) => void completeWgfPurchasedWizard(p)}
          onSkip={() => setShowWgfPurchasedWizard(false)}
        />
      ) : null}
      <div
        className={`flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-100 ${
          guardianMode ? 'guardian-mode' : ''
        }`}
      >
        <Toolbar />
        <div className="flex min-h-0 flex-1">
          <DrawingToolbar />
          <ResizableWorkspace
            chart={<ChartContainer />}
            sidebar={<PropDashboard />}
            bottom={
              analyticsOpen ? (
                <Analytics onClose={() => setAnalyticsOpen(false)} />
              ) : (
                <TradeJournal />
              )
            }
          />
        </div>
      </div>
      <SettingsModal />
      <TutorialPanel />
      <ProactiveAlerts />
      <AiCoachPanel />
      <PreTradeChecklistModal />
    </>
  );
}

export default function App() {
  return (
    <TradingProvider>
      <MainShell />
    </TradingProvider>
  );
}
