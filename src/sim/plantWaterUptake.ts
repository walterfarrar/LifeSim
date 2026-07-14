import {
  PLANT_LIVE_SOIL_UPTAKE_RATE,
  PLANT_LIVE_UPTAKE_DORMANT_SCALE,
  PLANT_MAX_TISSUE_WATER,
  PLANT_WATER_PER_ENERGY,
  SOIL_CELL_WATER_CAPACITY,
} from './config'
import { plantMaxStoredWater, plantTraits } from './entities/plant'
import { isPlantDormant } from './plantClimate'
import type { SoilAccess } from './soilMoisture'
import { releaseTranspiredWater, type AtmospherePool } from './transpiration'
import type { SeasonName } from './seasons'
import type { Plant } from './types'

export type PlantWaterUptakeInput = {
  x: number
  y: number
  energy: number
  maxEnergy: number
  water: number
  maxStoredWater: number
  moistureNeed: number
  soil: SoilAccess
  atmosphere: AtmospherePool
  dormant?: boolean
}

/**
 * Free tissue-water capacity: 0 when the plant is tiny, up to {@link PLANT_MAX_TISSUE_WATER} at
 * full size. Growing plants fill toward this cap; eating/death removes a pro-rata share.
 */
export function plantTissueWaterCapacity(energy: number, maxEnergy: number): number {
  if (energy <= 0 || maxEnergy <= 0) return 0
  return PLANT_MAX_TISSUE_WATER * Math.min(1, energy / maxEnergy)
}

/** @deprecated Use {@link plantTissueWaterCapacity}. */
export function plantGrowthReserveCapacity(energy: number, maxEnergy: number): number {
  return plantTissueWaterCapacity(energy, maxEnergy)
}

export function clampTissueWaterOverflow(
  water: number,
  energy: number,
  maxEnergy: number,
  atmosphere: AtmospherePool,
  soil: SoilAccess,
  position: { x: number; y: number },
): number {
  const cap = plantTissueWaterCapacity(energy, maxEnergy)
  if (water <= cap) return water
  const overflow = water - cap
  releaseTranspiredWater(atmosphere, soil, position.x, position.y, overflow)
  return cap
}

/** @deprecated Use {@link clampTissueWaterOverflow}. */
export function clampGrowthReserveOverflow(
  water: number,
  energy: number,
  maxEnergy: number,
  atmosphere: AtmospherePool,
  soil: SoilAccess,
  position: { x: number; y: number },
): number {
  return clampTissueWaterOverflow(water, energy, maxEnergy, atmosphere, soil, position)
}

/** Pull moisture from soil into tissue water; at capacity, excess transpires to air. */
export function uptakeSoilWaterIntoPlant(input: PlantWaterUptakeInput): number {
  const { x, y, energy, maxEnergy, water, maxStoredWater, moistureNeed, soil, atmosphere, dormant } =
    input
  if (energy <= 0.5 || maxStoredWater <= 0) return water

  const scale = dormant ? PLANT_LIVE_UPTAKE_DORMANT_SCALE : 1
  const sizeFactor = Math.max(0.12, Math.min(1, energy / Math.max(maxEnergy, 1)))
  const thirst = 0.42 + moistureNeed * 0.58
  const demandFrac = PLANT_LIVE_SOIL_UPTAKE_RATE * thirst * scale * sizeFactor
  const taken = soil.consume(x, y, demandFrac)
  const waterUnits = taken * SOIL_CELL_WATER_CAPACITY
  if (waterUnits <= 0) return water

  const room = Math.max(0, maxStoredWater - water)
  const stored = Math.min(waterUnits, room)
  releaseTranspiredWater(atmosphere, soil, x, y, waterUnits - stored)
  return water + stored
}

export function waterUnitsForGrowth(potentialEnergyGrowth: number): number {
  if (potentialEnergyGrowth <= 0) return 0
  return potentialEnergyGrowth * PLANT_WATER_PER_ENERGY
}

/** Draw growth water straight from soil (tissue water is a separate size-scaled store). */
export function consumeSoilWaterForGrowth(
  x: number,
  y: number,
  demandUnits: number,
  soil: SoilAccess,
): number {
  if (demandUnits <= 0) return 0
  const taken = soil.consume(x, y, demandUnits / SOIL_CELL_WATER_CAPACITY)
  return taken * SOIL_CELL_WATER_CAPACITY
}

/** Total hydric mass in a plant — tissue water plus water bound in biomass. */
export function plantHydricWater(plant: { energy: number; water: number }): number {
  return plant.water + plant.energy * PLANT_WATER_PER_ENERGY
}

export function tickWoodyPlantWaterUptake(
  plant: Plant,
  soil: SoilAccess,
  atmosphere: AtmospherePool,
  season: SeasonName,
  temperature: number,
): void {
  if (plant.energy <= 0.5) return
  const traits = plantTraits(plant)
  plant.water = uptakeSoilWaterIntoPlant({
    x: plant.x,
    y: plant.y,
    energy: plant.energy,
    maxEnergy: traits.maxEnergy,
    water: plant.water,
    maxStoredWater: plantMaxStoredWater(plant),
    moistureNeed: traits.moistureNeed,
    soil,
    atmosphere,
    dormant: isPlantDormant(plant.dna, season, temperature),
  })
}
