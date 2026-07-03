import {
  computeSurfaceWaterAppearance,
  elevationBasinFactor,
  type TerrainWaterSnapshot,
} from '../terrainWater'

/** Subtle height shading on the soil layer so basins read as depressions. */
export function drawTerrainHeight(
  ctx: CanvasRenderingContext2D,
  terrain: TerrainWaterSnapshot,
  worldWidth: number,
  worldHeight: number,
): void {
  const { cols, rows, cellSize, height } = terrain

  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const idx = cy * cols + cx
      const low = elevationBasinFactor(height[idx])
      if (low < 0.08) continue

      const x = cx * cellSize
      const y = cy * cellSize
      const w = Math.min(cellSize, worldWidth - x)
      const h = Math.min(cellSize, worldHeight - y)
      if (w <= 0 || h <= 0) continue

      const alpha = low * 0.14
      ctx.fillStyle = `rgba(38, 28, 18, ${alpha.toFixed(3)})`
      ctx.fillRect(x, y, w, h)
    }
  }
}

/** Standing surface water — drawn above grass; opacity from standing depth. */
export function drawTerrainWater(
  ctx: CanvasRenderingContext2D,
  terrain: TerrainWaterSnapshot,
  worldWidth: number,
  worldHeight: number,
): void {
  const { cols, rows, cellSize, surfaceWater, maxSurfaceWater } = terrain

  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const idx = cy * cols + cx
      const appearance = computeSurfaceWaterAppearance(
        surfaceWater[idx],
        maxSurfaceWater[idx],
      )
      if (!appearance) continue

      const x = cx * cellSize
      const y = cy * cellSize
      const w = Math.min(cellSize, worldWidth - x)
      const h = Math.min(cellSize, worldHeight - y)
      if (w <= 0 || h <= 0) continue

      const { r, g, b, alpha, fill } = appearance
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`
      ctx.fillRect(x, y, w, h)

      if (fill > 0.55 && surfaceWater[idx] > 4) {
        ctx.strokeStyle = `rgba(170, 220, 255, ${(0.08 + fill * 0.16).toFixed(3)})`
        ctx.lineWidth = 1
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
      }
    }
  }
}
