const HANDLE_RADIUS = 8;
const LINE_HIT_PX = 7;

function distPointToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) {
    return Math.hypot(px - x1, py - y1);
  }
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

function projectDrawingToScreen(drawing, chart, series) {
  if (drawing.type === 'horizontal' && drawing.coordinates?.price != null) {
    const y = series.priceToCoordinate(drawing.coordinates.price);
    return y == null ? null : { y };
  }
  if (
    (drawing.type === 'trendline' || drawing.type === 'rectangle') &&
    drawing.coordinates?.p1 &&
    drawing.coordinates?.p2
  ) {
    const x1 = chart.timeScale().timeToCoordinate(drawing.coordinates.p1.time);
    const y1 = series.priceToCoordinate(drawing.coordinates.p1.price);
    const x2 = chart.timeScale().timeToCoordinate(drawing.coordinates.p2.time);
    const y2 = series.priceToCoordinate(drawing.coordinates.p2.price);
    if ([x1, y1, x2, y2].some((v) => v == null)) return null;
    return { x1, y1, x2, y2 };
  }
  return null;
}

/**
 * @returns {{ id: string|number, handle: 'p1'|'p2'|'body'|'line' } | null}
 */
export function hitTestDrawings(drawings, x, y, chart, series) {
  let best = null;
  let bestDist = Infinity;

  for (let i = drawings.length - 1; i >= 0; i -= 1) {
    const d = drawings[i];
    const proj = projectDrawingToScreen(d, chart, series);
    if (!proj) continue;

    if (d.type === 'horizontal' && proj.y != null) {
      const dist = Math.abs(y - proj.y);
      if (dist < LINE_HIT_PX && dist < bestDist) {
        bestDist = dist;
        best = { id: d.id, handle: 'line' };
      }
      continue;
    }

    if (proj.x1 != null) {
      const d1 = Math.hypot(x - proj.x1, y - proj.y1);
      const d2 = Math.hypot(x - proj.x2, y - proj.y2);
      if (d1 <= HANDLE_RADIUS && d1 < bestDist) {
        bestDist = d1;
        best = { id: d.id, handle: 'p1' };
        continue;
      }
      if (d2 <= HANDLE_RADIUS && d2 < bestDist) {
        bestDist = d2;
        best = { id: d.id, handle: 'p2' };
        continue;
      }

      if (d.type === 'rectangle') {
        const minX = Math.min(proj.x1, proj.x2);
        const maxX = Math.max(proj.x1, proj.x2);
        const minY = Math.min(proj.y1, proj.y2);
        const maxY = Math.max(proj.y1, proj.y2);
        const onEdge =
          x >= minX - LINE_HIT_PX &&
          x <= maxX + LINE_HIT_PX &&
          y >= minY - LINE_HIT_PX &&
          y <= maxY + LINE_HIT_PX;
        if (onEdge) {
          const edgeDist = Math.min(
            Math.abs(x - minX),
            Math.abs(x - maxX),
            Math.abs(y - minY),
            Math.abs(y - maxY),
          );
          if (edgeDist < bestDist) {
            bestDist = edgeDist;
            best = { id: d.id, handle: 'body' };
          }
        }
      } else {
        const dist = distPointToSegment(x, y, proj.x1, proj.y1, proj.x2, proj.y2);
        if (dist < LINE_HIT_PX && dist < bestDist) {
          bestDist = dist;
          best = { id: d.id, handle: 'body' };
        }
      }
    }
  }

  return best;
}

export function applyDrawingDrag({
  drawing,
  handle,
  startPointer,
  currentPointer,
  chart,
  series,
  snapshot,
}) {
  const next = {
    ...drawing,
    coordinates: JSON.parse(JSON.stringify(snapshot)),
  };

  if (drawing.type === 'horizontal') {
    const startPrice = snapshot.price;
    const startY = series.priceToCoordinate(startPrice);
    const curY = currentPointer.y;
    if (startY == null) return next;
    const deltaY = curY - startPointer.y;
    const newY = startY + deltaY;
    const price = series.coordinateToPrice(newY);
    if (price != null) {
      next.coordinates.price = Number(Number(price).toFixed(2));
    }
    return next;
  }

  const mapPoint = (pt, deltaX, deltaY) => {
    const x0 = chart.timeScale().timeToCoordinate(pt.time);
    const y0 = series.priceToCoordinate(pt.price);
    if (x0 == null || y0 == null) return pt;
    const time = chart.timeScale().coordinateToTime(x0 + deltaX);
    const price = series.coordinateToPrice(y0 + deltaY);
    if (time == null || price == null) return pt;
    return { time, price: Number(Number(price).toFixed(2)) };
  };

  const deltaX = currentPointer.x - startPointer.x;
  const deltaY = currentPointer.y - startPointer.y;

  if (handle === 'p1') {
    next.coordinates.p1 = mapPoint(snapshot.p1, deltaX, deltaY);
    return next;
  }
  if (handle === 'p2') {
    next.coordinates.p2 = mapPoint(snapshot.p2, deltaX, deltaY);
    return next;
  }

  next.coordinates.p1 = mapPoint(snapshot.p1, deltaX, deltaY);
  next.coordinates.p2 = mapPoint(snapshot.p2, deltaX, deltaY);
  return next;
}

export { HANDLE_RADIUS };
