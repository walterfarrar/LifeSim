import { SOIL_CELL_WATER_CAPACITY } from '../config'
import type { SoilMoistureSnapshot } from '../soilMoisture'

/** Background soil moisture heatmap — drawn under ponds and plants. */
export function drawSoilMoisture(
  ctx: CanvasRenderingContext2D,
  soil: SoilMoistureSnapshot,
  worldWidth: number,
  worldHeight: number,
): void {
  const { cols, rows, cellSize, values, isRaining } = soil

  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const moisture = values[cy * cols + cx] / SOIL_CELL_WATER_CAPACITY
      if (moisture < 0.015) continue

      const x = cx * cellSize
      const y = cy * cellSize
      const w = Math.min(cellSize, worldWidth - x)
      const h = Math.min(cellSize, worldHeight - y)
      if (w <= 0 || h <= 0) continue

      const wet = Math.min(1, moisture)
      const r = Math.round(28 + (1 - wet) * 42)
      const g = Math.round(36 + wet * 58 + (isRaining ? 8 : 0))
      const b = Math.round(24 + wet * 72)
      const alpha = 0.08 + wet * 0.28

      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`
      ctx.fillRect(x, y, w, h)
    }
  }
}
