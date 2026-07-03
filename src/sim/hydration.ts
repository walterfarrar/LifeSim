import { creatureTraits } from './entities/creature'
import { plantStoredWater } from './waterCycle'
import { toroidalDistance } from './toroidal'
import type { Creature, Plant } from './types'
import type { SurfaceWaterTarget, TerrainWater } from './terrainWater'

/** Nearest standing surface water within seek range. */
export function findBestSurfaceWaterTarget(
  creature: Creature,
  terrain: TerrainWater,
  seekRange: number,
): SurfaceWaterTarget | null {
  return terrain.findBestSurfaceTarget(creature.x, creature.y, seekRange)
}

/** @deprecated Use findBestSurfaceWaterTarget */
export const findBestPondTarget = findBestSurfaceWaterTarget

/** Nearest edible plant with tissue water, for thirsty foraging. */
export function findBestPlantWaterTarget(
  creature: Creature,
  plants: readonly Plant[],
  seekRange: number,
): Plant | null {
  let best: Plant | null = null
  let bestScore = -1

  for (const plant of plants) {
    if (plant.energy <= 0.5) continue
    const water = plantStoredWater(plant)
    if (water <= 0) continue
    const dist = toroidalDistance(creature, plant)
    if (dist >= seekRange) continue
    const score = water / (1 + dist / Math.max(seekRange, 1))
    if (score > bestScore) {
      bestScore = score
      best = plant
    }
  }

  return best
}

export function plantWaterScore(
  plant: Plant,
  dist: number,
  seekRange: number,
  forageWaterPreference: number,
): number {
  const water = plantStoredWater(plant)
  if (water <= 0 || plant.energy <= 0.5 || forageWaterPreference <= 0) return 0
  return (water * forageWaterPreference) / (1 + dist / Math.max(seekRange, 1))
}

export function surfaceWaterScore(dist: number, seekRange: number, pondDrinking: number): number {
  if (pondDrinking <= 0) return 0
  return pondDrinking / (1 + dist / Math.max(seekRange, 1))
}

export function pondWaterScore(
  creature: Creature,
  dist: number,
  seekRange: number,
): number {
  const traits = creatureTraits(creature)
  return surfaceWaterScore(dist, seekRange, traits.pondDrinking)
}
