import type { AirGridSnapshot } from '../types'
import { airCellWorldRects } from './airGridLayout'

/** Opacity of a fully saturated (100% humidity) cloud cell. */
const MAX_CLOUD_ALPHA = 0.6
/** Linear humidity boost added on top of the quadratic ramp. */
const CLOUD_ALPHA_LINEAR = 0.09
/** Below this humidity a cell is treated as clear sky and skipped. */
const MIN_VISIBLE_HUMIDITY = 0.05

/**
 * Draw the moving air-moisture grid as a translucent white cloud layer. Each cell's opacity
 * scales with its humidity (vapor / capacity). The air grid spans a torus slightly larger than
 * the world; cells are split at edges so wraps are seamless with no overlap.
 */
export function drawAirHumidity(
  ctx: CanvasRenderingContext2D,
  air: AirGridSnapshot,
  worldWidth: number,
  worldHeight: number,
): void {
  const { cols, rows, cellW, cellH, vapor, cellCapacity, offsetX, offsetY } = air
  if (cellCapacity <= 0) return

  ctx.save()
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const humidity = Math.min(1, vapor[row * cols + col] / cellCapacity)
      if (humidity < MIN_VISIBLE_HUMIDITY) continue

      const alpha = Math.min(
        MAX_CLOUD_ALPHA,
        humidity * humidity * MAX_CLOUD_ALPHA + humidity * CLOUD_ALPHA_LINEAR,
      )
      ctx.fillStyle = `rgba(246, 249, 255, ${alpha.toFixed(3)})`

      const rects = airCellWorldRects(
        col,
        row,
        cellW,
        cellH,
        offsetX,
        offsetY,
        worldWidth,
        worldHeight,
      )
      for (const rect of rects) {
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
      }
    }
  }
  ctx.restore()
}
