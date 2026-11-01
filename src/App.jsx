import OnboardingWizard from './components/OnboardingWizard.jsx';
import Toolbar from './components/Toolbar.jsx';
import PropDashboard from './components/PropDashboard.jsx';
import DrawingToolbar from './components/DrawingToolbar.jsx';
import ChartContainer from './components/ChartContainer.jsx';
import TradeJournal from './components/TradeJournal.jsx';
import Analytics from './components/Analytics.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import TutorialPanel from './components/TutorialPanel.jsx';
import { TradingProvider, useTrading } from './context/TradingContext.jsx';

function MainShell() {
  const { booting, showOnboarding, completeOnboarding, analyticsOpen, setAnalyticsOpen } =
    useTrading();

  if (booting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-slate-400">
        Chargement de NexaTrader…
      </div>
    );
  }

  return (
    <>
      {showOnboarding && <OnboardingWizard onComplete={completeOnboarding} />}
      <div className="flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
        <Toolbar />
        <div className="flex min-h-0 flex-1">
          <DrawingToolbar />
          <ChartContainer />
          <PropDashboard />
        </div>
        {analyticsOpen ? (
          <Analytics onClose={() => setAnalyticsOpen(false)} />
        ) : (
          <TradeJournal />
        )}
      </div>
      <SettingsModal />
      <TutorialPanel />
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
