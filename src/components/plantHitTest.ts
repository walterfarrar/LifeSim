import { plantRadius } from '../sim/entities/plant'
import { toroidalDisplayOffsets, toroidalDistance } from '../sim/toroidal'
import type { Plant } from '../sim/types'

export function pickPlantAt(
  plants: readonly Plant[],
  x: number,
  y: number,
  worldWidth: number,
  worldHeight: number,
): Plant | null {
  let best: Plant | null = null
  let bestDist = Infinity

  for (const plant of plants) {
    const hitRadius = plantRadius(plant) + 4
    const margin = hitRadius + 4

    for (const { ox, oy } of toroidalDisplayOffsets(plant.x, plant.y, margin, worldWidth, worldHeight)) {
      const drawX = plant.x + ox
      const drawY = plant.y + oy
      const dist = Math.hypot(drawX - x, drawY - y)
      if (dist > hitRadius) continue

      const toroidalDist = toroidalDistance(plant, { x, y })
      if (toroidalDist <= hitRadius && toroidalDist < bestDist) {
        bestDist = toroidalDist
        best = plant
      }
    }
  }

  return best
}
