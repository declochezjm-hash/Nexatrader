import { getDb } from './db.js';

export async function fetchJournalNotes(limit = 30) {
  const db = getDb();
  if (!db) return [];
  return db.query(
    `SELECT id, trade_id AS tradeId, note_text AS text, source, created_at AS createdAt
     FROM journal_notes
     ORDER BY id DESC
     LIMIT ?`,
    [limit],
  );
}

export async function saveJournalNote(text, { tradeId = null, source = 'text' } = {}) {
  const db = getDb();
  if (!db || !text?.trim()) return null;
  const result = await db.run(
    `INSERT INTO journal_notes (trade_id, note_text, source) VALUES (?, ?, ?)`,
    [tradeId, text.trim(), source],
  );
  return result.lastInsertRowid;
}
