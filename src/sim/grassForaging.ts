import {
  GRASS_FOOD_PREFERENCE,
  GRASS_GRAZE_BITE_SCALE,
  GRASS_GRAZE_MAX_PER_CELL_PER_TICK,
  GRASS_MIN_LIVE_ENERGY,
  PLANT_WATER_PER_ENERGY,
} from './config'
import { capEnergy, capHydration, creatureTraits } from './entities/creature'
import { plantBiteEffectiveness } from './foraging'
import { energyFromGrassBiomass } from './energyEconomy'
import { expressPlant } from './phenotype'
import { toroidalDelta } from './toroidal'
import type { HerbivoreTraits } from './genes'
import type { Creature } from './types'
import type { GrassCover } from './grassCover'
import type { AtmospherePool } from './transpiration'

export function isGrassGrazeCapped(
  index: number,
  grazeCounts: ReadonlyMap<number, number>,
  maxPerCell = GRASS_GRAZE_MAX_PER_CELL_PER_TICK,
): boolean {
  return (grazeCounts.get(index) ?? 0) >= maxPerCell
}

export function grassTraitsAt(grass: GrassCover, index: number) {
  const dna = grass.dnaByCell[index]
  if (!dna) return null
  return expressPlant(dna)
}

export function scoreGrassFoodTarget(
  traits: Pick<
    HerbivoreTraits,
    'plantHardinessBreak' | 'plantForageSelectivity' | 'forageWaterPreference'
  >,
  grass: GrassCover,
  index: number,
  dist: number,
  seekRange: number,
): number {
  const plantTraits = grassTraitsAt(grass, index)
  if (!plantTraits || !grass.isEdibleGrass(index)) return -1
  const effectiveness = plantBiteEffectiveness(traits, plantTraits)
  const selectivity = traits.plantForageSelectivity
  const minEffectiveness = 0.05 + selectivity * 0.14
  if (effectiveness < minEffectiveness) return -1
  const distFactor = Math.max(0.001, 1 - dist / seekRange)
  const grassPreference =
    GRASS_FOOD_PREFERENCE + traits.forageWaterPreference * (1 - GRASS_FOOD_PREFERENCE)
  return (
    Math.pow(effectiveness, selectivity) *
    Math.pow(distFactor, 1 - selectivity) *
    grassPreference
  )
}

export function findBestGrassTarget(
  creature: Creature,
  traits: HerbivoreTraits,
  grass: GrassCover,
  seekRange: number,
  skipCells?: ReadonlySet<number>,
  grazeCounts?: ReadonlyMap<number, number>,
): number | null {
  const cx = Math.floor(creature.x / grass.cellW)
  const cy = Math.floor(creature.y / grass.cellH)
  const cellReach = Math.ceil(seekRange / Math.min(grass.cellW, grass.cellH)) + 1

  let bestIdx: number | null = null
  let bestScore = -1

  for (let dr = -cellReach; dr <= cellReach; dr++) {
    for (let dc = -cellReach; dc <= cellReach; dc++) {
      const col = ((cx + dc) % grass.cols + grass.cols) % grass.cols
      const row = ((cy + dr) % grass.rows + grass.rows) % grass.rows
      const idx = row * grass.cols + col
      if (skipCells?.has(idx)) continue
      if (grazeCounts && isGrassGrazeCapped(idx, grazeCounts)) continue
      if (!grass.isEdibleGrass(idx)) continue

      const center = grass.cellCenter(idx)
      const { dx, dy } = toroidalDelta(creature, center)
      const dist = Math.hypot(dx, dy)
      if (dist >= seekRange) continue

      const score = scoreGrassFoodTarget(traits, grass, idx, dist, seekRange)
      if (score < 0 || score <= bestScore) continue
      bestScore = score
      bestIdx = idx
    }
  }

  return bestIdx
}

export function tryEatGrass(creature: Creature, grass: GrassCover, index: number): number {
  if (!grass.isEdibleGrass(index)) return 0
  const plantTraits = grassTraitsAt(grass, index)
  if (!plantTraits) return 0

  const center = grass.cellCenter(index)
  const { dx, dy } = toroidalDelta(creature, center)
  const dist = Math.hypot(dx, dy)
  const traits = creatureTraits(creature)
  const reach = traits.radius + traits.forageReach
  if (dist > reach) return 0

  const effectiveness = plantBiteEffectiveness(traits, plantTraits)
  const bite = traits.biteAmount * effectiveness * GRASS_GRAZE_BITE_SCALE
  const maxRemovable = Math.max(0, grass.energy[index] - GRASS_MIN_LIVE_ENERGY)
  return Math.min(bite, maxRemovable)
}

export function forageGrassBite(
  creature: Creature,
  grass: GrassCover,
  index: number,
  amount: number,
  atmosphere: AtmospherePool,
): number {
  if (amount <= 0 || !grass.isEdibleGrass(index)) return 0

  const maxRemovable = Math.max(0, grass.energy[index] - GRASS_MIN_LIVE_ENERGY)
  const eaten = Math.min(amount, maxRemovable)
  if (eaten <= 0) return 0

  const reserveShare = grass.energy[index] > 0 ? (eaten / grass.energy[index]) * grass.water[index] : 0
  const structuralWater = eaten * PLANT_WATER_PER_ENERGY
  const totalWater = reserveShare + structuralWater
  grass.energy[index] -= eaten
  grass.water[index] = Math.max(0, grass.water[index] - reserveShare)

  const traits = creatureTraits(creature)
  const hydrationBefore = creature.hydration
  // Same as woody plants: all water liberated by the bite goes to the creature; only overflow vents.
  creature.hydration = capHydration(creature, creature.hydration + totalWater)
  const absorbed = creature.hydration - hydrationBefore
  const center = grass.cellCenter(index)
  atmosphere.vent(center.x, center.y, Math.max(0, totalWater - absorbed))

  const gained = energyFromGrassBiomass(eaten, traits.forageEfficiency)
  creature.energy = capEnergy(creature, creature.energy + gained)
  return eaten
}

/** Lick dew from turf without a full graze — weak hydration, last resort. */
export function trySipGrassDew(
  creature: Creature,
  grass: GrassCover,
  index: number,
  atmosphere: AtmospherePool,
): number {
  if (!grass.isLiveTurf(index) || grass.water[index] <= 0) return 0

  const center = grass.cellCenter(index)
  const { dx, dy } = toroidalDelta(creature, center)
  const dist = Math.hypot(dx, dy)
  const traits = creatureTraits(creature)
  const reach = traits.radius + traits.forageReach
  if (dist > reach) return 0

  const room = traits.maxHydration - creature.hydration
  if (room <= 0) return 0

  const rawSip = Math.min(
    traits.biteAmount * 0.05 * traits.forageWaterPreference,
    grass.water[index] * 0.18,
    room,
  )
  if (rawSip <= 0) return 0

  grass.water[index] = Math.max(0, grass.water[index] - rawSip)
  const hydrationBefore = creature.hydration
  creature.hydration = capHydration(creature, creature.hydration + rawSip)
  atmosphere.vent(center.x, center.y, Math.max(0, rawSip - (creature.hydration - hydrationBefore)))
  return rawSip
}

export function findBestGrassWaterTarget(
  creature: Creature,
  grass: GrassCover,
  seekRange: number,
): number | null {
  let bestIdx: number | null = null
  let bestScore = -1
  const cx = Math.floor(creature.x / grass.cellW)
  const cy = Math.floor(creature.y / grass.cellH)
  const cellReach = Math.ceil(seekRange / Math.min(grass.cellW, grass.cellH)) + 1

  for (let dr = -cellReach; dr <= cellReach; dr++) {
    for (let dc = -cellReach; dc <= cellReach; dc++) {
      const col = ((cx + dc) % grass.cols + grass.cols) % grass.cols
      const row = ((cy + dr) % grass.rows + grass.rows) % grass.rows
      const idx = row * grass.cols + col
      if (!grass.isLiveTurf(idx) || grass.water[idx] <= 0) continue
      const center = grass.cellCenter(idx)
      const { dx, dy } = toroidalDelta(creature, center)
      const dist = Math.hypot(dx, dy)
      if (dist >= seekRange) continue
      const score = grass.water[idx] / (1 + dist / Math.max(seekRange, 1))
      if (score > bestScore) {
        bestScore = score
        bestIdx = idx
      }
    }
  }

  return bestIdx
}

export function grassWaterScore(
  grass: GrassCover,
  index: number,
  dist: number,
  seekRange: number,
  forageWaterPreference: number,
): number {
  if (!grass.isLiveTurf(index) || grass.water[index] <= 0 || forageWaterPreference <= 0) return 0
  return (
    (grass.water[index] * forageWaterPreference) / (1 + dist / Math.max(seekRange, 1))
  )
}
