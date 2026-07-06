import {
  TERRAIN_ELEVATION_MAX,
  TERRAIN_ELEVATION_MIN,
  TERRAIN_ELEVATION_SEA_LEVEL,
} from '../config'
import type { TerrainWaterSnapshot } from '../terrainWater'

const ELEVATION_SPAN = TERRAIN_ELEVATION_MAX - TERRAIN_ELEVATION_MIN

/** Hypsometric stops: normalized ground height (0 = lowest, 1 = highest). */
export const ELEVATION_COLOR_STOPS: ReadonlyArray<{ t: number; r: number; g: number; b: number }> = [
  { t: 0, r: 18, g: 52, b: 128 },
  { t: 0.22, r: 34, g: 118, b: 88 },
  { t: 0.42, r: 118, g: 138, b: 58 },
  { t: 0.58, r: 168, g: 132, b: 72 },
  { t: 0.76, r: 132, g: 96, b: 58 },
  { t: 1, r: 228, g: 220, b: 198 },
]

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** RGB for normalized elevation 0 (lowest ground) … 1 (highest). */
export function elevationColorAtNormalized(t: number): { r: number; g: number; b: number } {
  const clamped = Math.min(1, Math.max(0, t))
  for (let i = 1; i < ELEVATION_COLOR_STOPS.length; i++) {
    const hi = ELEVATION_COLOR_STOPS[i]
    const lo = ELEVATION_COLOR_STOPS[i - 1]
    if (clamped <= hi.t) {
      const span = hi.t - lo.t
      const local = span > 0 ? (clamped - lo.t) / span : 0
      return {
        r: Math.round(lerp(lo.r, hi.r, local)),
        g: Math.round(lerp(lo.g, hi.g, local)),
        b: Math.round(lerp(lo.b, hi.b, local)),
      }
    }
  }
  const last = ELEVATION_COLOR_STOPS[ELEVATION_COLOR_STOPS.length - 1]
  return { r: last.r, g: last.g, b: last.b }
}

function colorAtNormalized(t: number): { r: number; g: number; b: number } {
  return elevationColorAtNormalized(t)
}

/**
 * Fixed terrain elevation map — ground height only (set at world generation, never changes).
 * Colors use the global min/max elevation scale, not water or dynamic re-normalization.
 */
export function drawElevationMap(
  ctx: CanvasRenderingContext2D,
  terrain: TerrainWaterSnapshot,
  worldWidth: number,
  worldHeight: number,
): void {
  const { cols, rows, cellSize, height } = terrain

  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const idx = cy * cols + cx
      const ground = height[idx]
      const norm = (ground - TERRAIN_ELEVATION_MIN) / ELEVATION_SPAN
      const { r, g, b } = colorAtNormalized(norm)

      const x = cx * cellSize
      const y = cy * cellSize
      const w = Math.min(cellSize, worldWidth - x)
      const h = Math.min(cellSize, worldHeight - y)
      if (w <= 0 || h <= 0) continue

      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
      ctx.fillRect(x, y, w, h)

      // Faint sea-level contour at mid-elevation reference.
      if (Math.abs(ground - TERRAIN_ELEVATION_SEA_LEVEL) < 0.35) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)'
        ctx.lineWidth = 1
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
      }
    }
  }
}
