/**
 * Vérifie la réponse db.run / db.get côté renderer.
 * @param {unknown} result
 * @param {string} action
 */
export function assertDbWriteOk(result, action = 'Enregistrement') {
  if (result == null) {
    throw new Error(`${action} impossible — base SQLite sans réponse.`);
  }
  if (result.error) {
    const msg = String(result.error);
    if (msg.includes('no such column')) {
      throw new Error(
        `${msg} — Fermez NexaTrader, relancez npm run dev (migration SQLite), puis réessayez Enregistrer.`,
      );
    }
    throw new Error(msg);
  }
  if (typeof result.changes === 'number' && result.changes < 1) {
    throw new Error(
      `${action} : aucune ligne modifiée. Relancez NexaTrader — Desktop ou vérifiez SQLite.`,
    );
  }
}
