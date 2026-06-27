import type { HerbivoreTraits, PlantTraits } from './genes'
import { plantTraits } from './entities/plant'
import type { Plant } from './types'

/** How much of a bite gets through plant defenses (0–1). */
export function plantBiteEffectiveness(
  creature: Pick<HerbivoreTraits, 'plantHardinessBreak'>,
  plant: Pick<PlantTraits, 'hardiness'>,
): number {
  const ratio = creature.plantHardinessBreak / (plant.hardiness + 0.18)
  return Math.max(0.05, Math.min(1, ratio))
}

/** Higher = better food target; -1 = skip (too tough for this forager's taste). */
export function scorePlantFoodTarget(
  traits: Pick<HerbivoreTraits, 'plantHardinessBreak' | 'plantForageSelectivity'>,
  plant: Pick<PlantTraits, 'hardiness'>,
  dist: number,
  seekRange: number,
): number {
  const effectiveness = plantBiteEffectiveness(traits, plant)
  const selectivity = traits.plantForageSelectivity
  const minEffectiveness = 0.05 + selectivity * 0.14

  if (effectiveness < minEffectiveness) return -1

  const distFactor = Math.max(0.001, 1 - dist / seekRange)
  return Math.pow(effectiveness, selectivity) * Math.pow(distFactor, 1 - selectivity)
}

export function findBestPlantTarget(
  traits: HerbivoreTraits,
  plants: readonly Plant[],
  distTo: (plant: Plant) => number,
  seekRange: number,
  skipIds?: ReadonlySet<number>,
): Plant | null {
  let best: Plant | null = null
  let bestScore = -1

  for (const plant of plants) {
    if (skipIds?.has(plant.id)) continue
    const dist = distTo(plant)
    if (dist >= seekRange) continue

    const score = scorePlantFoodTarget(traits, plantTraits(plant), dist, seekRange)
    if (score < 0 || score <= bestScore) continue

    bestScore = score
    best = plant
  }

  return best
}
