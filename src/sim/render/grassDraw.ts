import type { GrassCoverSnapshot } from '../grassCover'

/** Green turf overlay — drawn on soil, beneath the surface-water layer. */
export function drawGrassCover(
  ctx: CanvasRenderingContext2D,
  grass: GrassCoverSnapshot,
  worldWidth: number,
  worldHeight: number,
): void {
  const { cols, rows, cellSize, tint } = grass

  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const base = (cy * cols + cx) * 4
      const alpha = tint[base + 3]
      if (alpha <= 0) continue

      const x = cx * cellSize
      const y = cy * cellSize
      const w = Math.min(cellSize, worldWidth - x)
      const h = Math.min(cellSize, worldHeight - y)
      if (w <= 0 || h <= 0) continue

      ctx.fillStyle = `rgba(${tint[base]}, ${tint[base + 1]}, ${tint[base + 2]}, ${(alpha / 255).toFixed(3)})`
      ctx.fillRect(x, y, w, h)
    }
  }
}

export function drawGrassSelection(
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  cellSize: number,
  worldWidth: number,
  worldHeight: number,
): void {
  const x = col * cellSize
  const y = row * cellSize
  const w = Math.min(cellSize, worldWidth - x)
  const h = Math.min(cellSize, worldHeight - y)
  if (w <= 0 || h <= 0) return
  ctx.strokeStyle = 'rgba(140, 220, 120, 0.95)'
  ctx.lineWidth = 2.5
  ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3)
}
