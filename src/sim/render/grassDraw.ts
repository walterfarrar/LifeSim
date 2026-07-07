import type { GrassCoverSnapshot } from '../grassCover'

/** Green turf overlay — drawn on soil, beneath the surface-water layer. */
export function drawGrassCover(
  ctx: CanvasRenderingContext2D,
  grass: GrassCoverSnapshot,
  _worldWidth: number,
  _worldHeight: number,
): void {
  const { cols, rows, cellW, cellH, tint } = grass

  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const base = (cy * cols + cx) * 4
      const alpha = tint[base + 3]
      if (alpha <= 0) continue

      const x = cx * cellW
      const y = cy * cellH
      const w = cellW
      const h = cellH
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
  cellW: number,
  cellH: number,
): void {
  const x = col * cellW
  const y = row * cellH
  const w = cellW
  const h = cellH
  if (w <= 0 || h <= 0) return
  ctx.strokeStyle = 'rgba(140, 220, 120, 0.95)'
  ctx.lineWidth = 2.5
  ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3)
}
