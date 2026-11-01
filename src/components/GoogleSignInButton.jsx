export default function GoogleSignInButton({ onClick, loading, connectedEmail, label }) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-600 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-100 disabled:opacity-60"
      >
        <svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden>
          <path
            fill="#FFC107"
            d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.083 36 24 36c-5.514 0-10-4.486-10-10s4.486-10 10-10c2.659 0 5.079 1.036 6.878 2.727l6.087-6.087C33.758 9.794 29.092 8 24 8 14.059 8 6 16.059 6 26s8.059 18 18 18 18-8.059 18-18c0-1.341-.138-2.651-.389-3.917z"
          />
          <path
            fill="#FF3D00"
            d="M6 14.691l6.664 5.176C14.656 16.108 19.021 12 24 12c2.659 0 5.079 1.036 6.878 2.727l6.087-6.087C33.758 9.794 29.092 8 24 8 14.059 8 6 16.059 6 26s8.059 18 18 18v-8c-5.083 0-9.346-3.343-10.854-7.943L6 14.691z"
          />
          <path
            fill="#4CAF50"
            d="M24 44c4.837 0 8.868-1.784 11.824-4.701l-5.757-4.752C28.082 35.91 26.137 36.667 24 36.667c-5.121 0-9.469-3.456-11.013-8.123l-6.664 5.176C8.941 39.926 15.941 44 24 44z"
          />
          <path
            fill="#1976D2"
            d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l5.757 4.752C42.396 35.613 44 30.138 44 24c0-1.341-.138-2.651-.389-3.917z"
          />
        </svg>
        {loading ? 'Connexion…' : label ?? 'Se connecter avec Google'}
      </button>
      {connectedEmail && (
        <p className="text-center text-[11px] text-emerald-400">Connecté : {connectedEmail}</p>
      )}
    </div>
  );
}
