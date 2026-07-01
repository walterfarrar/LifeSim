import { creatureTraits } from './entities/creature'
import { isPondDrinkable } from './entities/pond'
import { plantStoredWater } from './waterCycle'
import { toroidalDistance } from './toroidal'
import type { Creature, Plant, Pond } from './types'

/** Nearest drinkable pond within seek range. */
export function findBestPondTarget(
  creature: Creature,
  ponds: readonly Pond[],
  seekRange: number,
): Pond | null {
  let best: Pond | null = null
  let bestDist = Infinity

  for (const pond of ponds) {
    if (!isPondDrinkable(pond)) continue
    const dist = toroidalDistance(creature, pond)
    if (dist >= seekRange) continue
    if (dist < bestDist) {
      bestDist = dist
      best = pond
    }
  }

  return best
}

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

export function plantWaterScore(plant: Plant, dist: number, seekRange: number): number {
  const water = plantStoredWater(plant)
  if (water <= 0 || plant.energy <= 0.5) return 0
  return water / (1 + dist / Math.max(seekRange, 1))
}

export function pondWaterScore(
  creature: Creature,
  dist: number,
  seekRange: number,
): number {
  const traits = creatureTraits(creature)
  if (traits.pondDrinking <= 0) return 0
  return traits.pondDrinking / (1 + dist / Math.max(seekRange, 1))
}
