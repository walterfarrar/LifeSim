import { SOIL_CELL_WATER_CAPACITY } from '../config'
import type { SoilMoistureSnapshot } from '../soilMoisture'

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Background soil moisture — light brown when dry, darker brown as moisture rises. */
export function drawSoilMoisture(
  ctx: CanvasRenderingContext2D,
  soil: SoilMoistureSnapshot,
  worldWidth: number,
  worldHeight: number,
): void {
  const { cols, rows, cellSize, values } = soil

  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const moisture = values[cy * cols + cx] / SOIL_CELL_WATER_CAPACITY
      const wet = Math.min(1, Math.max(0, moisture))

      const x = cx * cellSize
      const y = cy * cellSize
      const w = Math.min(cellSize, worldWidth - x)
      const h = Math.min(cellSize, worldHeight - y)
      if (w <= 0 || h <= 0) continue

      const r = Math.round(lerp(186, 54, wet))
      const g = Math.round(lerp(150, 34, wet))
      const b = Math.round(lerp(98, 18, wet))
      const alpha = lerp(0.78, 0.96, wet)

      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`
      ctx.fillRect(x, y, w, h)
    }
  }
}
