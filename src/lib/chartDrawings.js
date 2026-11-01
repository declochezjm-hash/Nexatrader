import { getDb } from './db.js';

export async function fetchChartDrawings(symbol) {
  const db = getDb();
  if (!db) return [];
  const rows = await db.query(
    `SELECT id, symbol, drawing_type, coordinates, created_at
     FROM chart_drawings
     WHERE symbol = ?
     ORDER BY id ASC`,
    [symbol],
  );
  return rows.map((row) => ({
    id: row.id,
    symbol: row.symbol,
    type: row.drawing_type,
    coordinates: JSON.parse(row.coordinates),
    createdAt: row.created_at,
  }));
}

export async function saveChartDrawing(symbol, drawingType, coordinates) {
  const db = getDb();
  if (!db) return null;
  const result = await db.run(
    `INSERT INTO chart_drawings (symbol, drawing_type, coordinates)
     VALUES (?, ?, ?)`,
    [symbol, drawingType, JSON.stringify(coordinates)],
  );
  return result.lastInsertRowid;
}

export async function updateChartDrawing(id, drawing) {
  const db = getDb();
  if (!db) return;
  await db.run(`UPDATE chart_drawings SET coordinates = ? WHERE id = ?`, [
    JSON.stringify(drawing.coordinates),
    id,
  ]);
}

export async function deleteChartDrawing(id) {
  const db = getDb();
  if (!db) return;
  await db.run(`DELETE FROM chart_drawings WHERE id = ?`, [id]);
}
