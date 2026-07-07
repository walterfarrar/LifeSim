export type WorldRect = { x: number; y: number; w: number; h: number }

function wrapFloat(value: number, span: number): number {
  return ((value % span) + span) % span
}

/**
 * World-space rectangles for one air cell, split only where it crosses the world edge.
 * The air grid period equals the world (cols·cellW == worldWidth), so a cell spilling past the
 * right/bottom edge wraps to the opposite side with no overlap and no gap.
 */
export function airCellWorldRects(
  col: number,
  row: number,
  cellW: number,
  cellH: number,
  offsetX: number,
  offsetY: number,
  worldWidth: number,
  worldHeight: number,
): WorldRect[] {
  const startX = wrapFloat(col * cellW + offsetX, worldWidth)
  const startY = wrapFloat(row * cellH + offsetY, worldHeight)
  const xBands = splitAtEdge(startX, cellW, worldWidth)
  const yBands = splitAtEdge(startY, cellH, worldHeight)
  const rects: WorldRect[] = []

  for (const xb of xBands) {
    for (const yb of yBands) {
      rects.push({ x: xb.start, y: yb.start, w: xb.len, h: yb.len })
    }
  }

  return rects
}

function splitAtEdge(start: number, len: number, worldSize: number): { start: number; len: number }[] {
  if (start + len <= worldSize) return [{ start, len }]
  return [
    { start, len: worldSize - start },
    { start: 0, len: start + len - worldSize },
  ]
}

export function airCellAtWorld(
  x: number,
  y: number,
  cellW: number,
  cellH: number,
  offsetX: number,
  offsetY: number,
  cols: number,
  rows: number,
  worldWidth: number,
  worldHeight: number,
): { col: number; row: number; index: number } {
  const ax = wrapFloat(x - offsetX, worldWidth)
  const ay = wrapFloat(y - offsetY, worldHeight)
  const col = Math.min(cols - 1, Math.max(0, Math.floor(ax / cellW)))
  const row = Math.min(rows - 1, Math.max(0, Math.floor(ay / cellH)))
  return { col, row, index: row * cols + col }
}
