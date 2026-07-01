import {
  INIT_POND_SHORE_TRANSFER,
  INIT_WATER_AIR_FRACTION,
  INIT_WATER_POND_FRACTION,
  INIT_WATER_SOIL_FRACTION,
} from './config'
import { toroidalDistance } from './toroidal'
import type { Creature, Pond } from './types'
import type { Atmosphere } from './waterCycle'
import type { SoilMoisture } from './soilMoisture'

/** Split total water across pond, soil, and air; wet the shore from the pond budget. */
export function distributeInitialWorldWater(
  totalWater: number,
  soil: SoilMoisture,
  ponds: readonly Pond[],
  atmosphere: Atmosphere,
): void {
  const pondShare = totalWater * INIT_WATER_POND_FRACTION
  const soilShare = totalWater * INIT_WATER_SOIL_FRACTION
  const airShare = totalWater * INIT_WATER_AIR_FRACTION

  const pondWaterEach = pondShare / Math.max(ponds.length, 1)
  for (const pond of ponds) {
    pond.water = pondWaterEach
    pond.maxWater = pondWaterEach
  }

  const soilOverflow = soil.fillWithWaterUnits(soilShare)
  atmosphere.vapor = airShare + soilOverflow
  atmosphere.raining = false
  atmosphere.armedForRain = true

  for (const pond of ponds) {
    const shoreBudget = pond.water * INIT_POND_SHORE_TRANSFER
    if (shoreBudget > 0) {
      soil.transferFromPond(pond, shoreBudget)
    }
  }
}

function nearestPond(creature: Creature, ponds: readonly Pond[]): Pond | null {
  let best: Pond | null = null
  let bestDist = Infinity
  for (const pond of ponds) {
    if (pond.water <= 0.5) continue
    const dist = toroidalDistance(creature, pond)
    if (dist < bestDist) {
      bestDist = dist
      best = pond
    }
  }
  return best
}

/** Fund spawn hydration from air, then nearest pond — does not create water. */
export function fundInitialCreatureHydration(
  creatures: readonly Creature[],
  ponds: readonly Pond[],
  atmosphere: Atmosphere,
): void {
  for (const creature of creatures) {
    const target = creature.hydration
    let funded = 0

    const fromAir = Math.min(target - funded, atmosphere.vapor)
    atmosphere.vapor -= fromAir
    funded += fromAir

    if (funded < target) {
      const pond = nearestPond(creature, ponds)
      if (pond) {
        const stillNeed = target - funded
        const fromPond = Math.min(stillNeed, pond.water - 0.5)
        pond.water -= fromPond
        funded += fromPond
      }
    }

    creature.hydration = funded
  }
}
