import { getDb } from './db.js';

const MAX_MESSAGES = 40;

export async function loadCoachHistory() {
  const db = getDb();
  if (!db) return [];
  const rows = await db.query(
    `SELECT id, role, text, source, created_at AS createdAt
     FROM coach_messages
     ORDER BY id ASC
     LIMIT ?`,
    [MAX_MESSAGES],
  );
  return rows.map((r) => ({
    id: String(r.id),
    role: r.role,
    text: r.text,
    source: r.source ?? 'local',
  }));
}

export async function replaceCoachHistory(messages) {
  const db = getDb();
  if (!db) return;
  const trimmed = messages.slice(-MAX_MESSAGES);
  await db.run(`DELETE FROM coach_messages`);
  for (const m of trimmed) {
    await db.run(
      `INSERT INTO coach_messages (role, text, source) VALUES (?, ?, ?)`,
      [m.role, m.text, m.source ?? 'local'],
    );
  }
}

export async function clearCoachHistoryDb() {
  const db = getDb();
  if (!db) return;
  await db.run(`DELETE FROM coach_messages`);
}
