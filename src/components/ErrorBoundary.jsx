import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[NexaTrader] Erreur interface:', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 p-6 text-center text-slate-200">
          <p className="text-lg font-semibold text-rose-300">NexaTrader — erreur d’affichage</p>
          <p className="max-w-lg text-sm text-slate-400">
            {this.state.error?.message ?? String(this.state.error)}
          </p>
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
    return this.props.children;
  }
}
