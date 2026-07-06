import type { AirGridSnapshot } from '../types'

/** Opacity of a fully saturated (100% humidity) cloud cell. */
const MAX_CLOUD_ALPHA = 0.8
/** Below this humidity a cell is treated as clear sky and skipped. */
const MIN_VISIBLE_HUMIDITY = 0.05

function wrapFloat(value: number, span: number): number {
  return ((value % span) + span) % span
}

/**
 * Draw the moving air-moisture grid as a translucent white cloud layer. Each cell's opacity
 * scales with its humidity (vapor / capacity), the whole field is shifted by the wind offset,
 * and cells are drawn with toroidal wrap so clouds seamlessly cross the map edges.
 */
export function drawAirHumidity(
  ctx: CanvasRenderingContext2D,
  air: AirGridSnapshot,
  worldWidth: number,
  worldHeight: number,
): void {
  const { cols, rows, cellSize, vapor, cellCapacity, offsetX, offsetY } = air
  if (cellCapacity <= 0) return

  ctx.save()
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const humidity = Math.min(1, vapor[row * cols + col] / cellCapacity)
      if (humidity < MIN_VISIBLE_HUMIDITY) continue

      // Quadratic ramp keeps thin haze faint while saturated cells read as solid cloud.
      const alpha = Math.min(MAX_CLOUD_ALPHA, humidity * humidity * MAX_CLOUD_ALPHA + humidity * 0.12)
      ctx.fillStyle = `rgba(246, 249, 255, ${alpha.toFixed(3)})`

      const baseX = wrapFloat(col * cellSize + offsetX, worldWidth)
      const baseY = wrapFloat(row * cellSize + offsetY, worldHeight)
      // Draw the wrapped copy too so a cell straddling an edge covers both sides (+1 hides seams).
      for (const px of [baseX, baseX - worldWidth]) {
        for (const py of [baseY, baseY - worldHeight]) {
          ctx.fillRect(px, py, cellSize + 1, cellSize + 1)
        }
      }
    }
  }
  ctx.restore()
}
