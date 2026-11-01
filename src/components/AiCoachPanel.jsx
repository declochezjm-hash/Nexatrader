import { memo, useEffect, useRef, useState } from 'react';
import { Bot, MessageCircle, Send, Sparkles, X } from 'lucide-react';
import { useTrading } from '../context/TradingContext.jsx';
import { COACH_QUICK_PROMPTS } from '../lib/aiCoach.js';

function MessageBubble({ role, text, source }) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[92%] rounded-2xl px-3 py-2 text-[12px] leading-relaxed ${
          isUser
            ? 'bg-sky-600/25 text-sky-50 ring-1 ring-sky-500/30'
            : 'bg-slate-800/90 text-slate-200 ring-1 ring-slate-700/80'
        }`}
      >
        {!isUser && source === 'local' && (
          <span className="mb-1 block text-[9px] uppercase tracking-wide text-slate-500">
            Mode local
          </span>
        )}
        {!isUser && source === 'gemini' && (
          <span className="mb-1 block text-[9px] uppercase tracking-wide text-violet-400/80">
            Gemini
          </span>
        )}
        <p className="whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  );
}

function AiCoachPanelInner() {
  const {
    coachOpen,
    setCoachOpen,
    coachMessages,
    coachBusy,
    sendCoachMessage,
    clearCoachChat,
  } = useTrading();
  const [draft, setDraft] = useState('');
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (coachOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [coachOpen]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [coachMessages, coachBusy]);

  async function submit(text) {
    const msg = text?.trim() ?? draft.trim();
    if (!msg || coachBusy) return;
    setDraft('');
    await sendCoachMessage(msg);
  }

  if (!coachOpen) {
    return (
      <button
        type="button"
        onClick={() => setCoachOpen(true)}
        className="fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full border border-violet-500/40 bg-violet-600/20 px-4 py-2.5 text-sm font-medium text-violet-100 shadow-lg shadow-violet-950/40 backdrop-blur hover:border-violet-400/60 hover:bg-violet-600/30"
        title="Coach IA — conseils trading et aide app"
      >
        <MessageCircle className="h-5 w-5" />
        Coach IA
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 flex h-[min(520px,calc(100vh-6rem))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-700/90 bg-slate-950/95 shadow-2xl shadow-black/50 backdrop-blur-md">
      <header className="flex shrink-0 items-center justify-between border-b border-slate-800 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/20 text-violet-300">
            <Bot className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-100">Coach NexaTrader</p>
            <p className="text-[10px] text-slate-500">Aide app · contexte marché · discipline</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => clearCoachChat()}
            className="rounded-md px-2 py-1 text-[10px] text-slate-500 hover:bg-slate-800 hover:text-slate-300"
          >
            Effacer
          </button>
          <button
            type="button"
            onClick={() => setCoachOpen(false)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Fermer le coach"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {coachMessages.map((m) => (
          <MessageBubble key={m.id} role={m.role} text={m.text} source={m.source} />
        ))}
        {coachBusy && (
          <p className="text-center text-[11px] text-slate-500">
            <Sparkles className="mr-1 inline h-3 w-3 animate-pulse" />
            Réflexion…
          </p>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-800 px-3 py-2">
        <div className="mb-2 flex flex-wrap gap-1">
          {COACH_QUICK_PROMPTS.map((q) => (
            <button
              key={q}
              type="button"
              disabled={coachBusy}
              onClick={() => void submit(q)}
              className="rounded-full border border-slate-700 bg-slate-900/80 px-2 py-0.5 text-[10px] text-slate-400 hover:border-violet-500/40 hover:text-violet-200 disabled:opacity-40"
            >
              {q.length > 36 ? `${q.slice(0, 34)}…` : q}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Question ou /help · /pause · /zoom +"
            disabled={coachBusy}
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:border-violet-500/50 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={coachBusy || !draft.trim()}
            className="flex shrink-0 items-center justify-center rounded-lg bg-violet-600/80 px-3 text-white hover:bg-violet-500 disabled:opacity-40"
            aria-label="Envoyer"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

export default memo(AiCoachPanelInner);
