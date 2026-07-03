import {
  ATMOSPHERE_INITIAL_VAPOR,
  ATMOSPHERE_VAPOR_CAPACITY,
  DEFAULT_WORLD_HEIGHT,
  DEFAULT_WORLD_WIDTH,
  DEATH_WATER_TO_AIR,
  DEATH_WATER_TO_SOIL,
  SURFACE_EVAPORATION_SCALE,
  RAIN_ARM_HUMIDITY,
  RAIN_PRECIP_BASE,
  RAIN_PRECIP_FRACTION,
  RAIN_START_HUMIDITY,
  RAIN_STOP_HUMIDITY,
  REFERENCE_WORLD_AREA,
  SOIL_CELL_WATER_CAPACITY,
  SOIL_EVAP_BASE,
  SOIL_SATURATED_EVAP_BOOST,
  SOIL_SATURATED_MOISTURE,
} from './config'
import type { SoilMoisture } from './soilMoisture'
import type { Creature, Plant } from './types'
import type { TerrainWater } from './terrainWater'
import { plantHydricWater } from './plantWaterUptake'
import { releaseTranspiredWater } from './transpiration'

export type { AtmospherePool } from './transpiration'

/** Atmospheric vapor pool — rain runs while humidity is high until it falls to the stop level. */
export class Atmosphere {
  vapor = 0
  raining = false
  armedForRain = true
  readonly vaporCapacity: number

  constructor(vaporCapacity = ATMOSPHERE_VAPOR_CAPACITY) {
    this.vaporCapacity = vaporCapacity
  }

  reset(initialVapor = scaledInitialVapor(DEFAULT_WORLD_WIDTH, DEFAULT_WORLD_HEIGHT)): void {
    this.vapor = initialVapor
    this.raining = false
    this.armedForRain = true
  }

  get humidity(): number {
    return Math.min(1, Math.max(0, this.vapor / this.vaporCapacity))
  }

  get isRaining(): boolean {
    return this.raining
  }
}

export function atmosphereExcessVapor(atmosphere: Atmosphere): number {
  const stopVapor = atmosphere.vaporCapacity * RAIN_STOP_HUMIDITY
  return Math.max(0, atmosphere.vapor - stopVapor)
}

export function scaledInitialVapor(width: number, height: number): number {
  const area = width * height
  return ATMOSPHERE_INITIAL_VAPOR * (area / REFERENCE_WORLD_AREA)
}

function rawSurfaceEvaporationRate(
  tempC: number,
  relativeHumidity: number,
  raining = false,
): number {
  const tempFactor = 0.45 + clamp((tempC + 5) / 38, 0, 1) * 0.95
  const dryness = Math.max(0, 1 - relativeHumidity * 0.98)
  let rate = tempFactor * dryness
  if (raining) return 0
  if (relativeHumidity >= RAIN_START_HUMIDITY) rate *= 0.08
  else if (relativeHumidity >= RAIN_ARM_HUMIDITY) rate *= 0.35
  return rate
}

export function surfaceEvaporationRate(
  tempC: number,
  relativeHumidity: number,
  raining = false,
): number {
  return rawSurfaceEvaporationRate(tempC, relativeHumidity, raining) * SURFACE_EVAPORATION_SCALE
}

const SWEAT_REFERENCE_RATE = rawSurfaceEvaporationRate(18, 0.55)

export function creatureSweatLoss(
  baseLoss: number,
  tempC: number,
  relativeHumidity: number,
  raining = false,
): number {
  const rate = surfaceEvaporationRate(tempC, relativeHumidity, raining)
  return baseLoss * (rate / SWEAT_REFERENCE_RATE)
}

export function plantStoredWater(plant: Plant): number {
  return Math.max(0, plant.water)
}

export function plantHydricMass(plant: Plant): number {
  return plantHydricWater(plant)
}

export function measureTotalWater(
  terrain: TerrainWater,
  soil: SoilMoisture,
  creatures: readonly Creature[],
  plants: readonly Plant[],
  atmosphere: Atmosphere,
  grassWater = 0,
): number {
  let total = atmosphere.vapor
  total += terrain.totalWater()
  total += soil.totalWater()
  for (const creature of creatures) total += creature.hydration
  for (const plant of plants) total += plantHydricWater(plant)
  total += grassWater
  return total
}

export function evaporateSoilToAir(
  soil: SoilMoisture,
  atmosphere: Atmosphere,
  tempC: number,
  terrain: TerrainWater,
): void {
  if (atmosphere.raining) return
  const evapMult = surfaceEvaporationRate(tempC, atmosphere.humidity, false)
  const avgMoisture = soil.averageMoisture()
  let swampMult = 1
  if (avgMoisture > SOIL_SATURATED_MOISTURE) {
    swampMult = 1 + (avgMoisture - SOIL_SATURATED_MOISTURE) * SOIL_SATURATED_EVAP_BOOST
  }
  const baseRate = SOIL_EVAP_BASE * SOIL_CELL_WATER_CAPACITY * evapMult * swampMult
  atmosphere.vapor += soil.evaporateToAtmosphere(baseRate, (idx) => terrain.surfaceWater[idx] <= 0.05)
}

export function shouldStopRain(atmosphere: Atmosphere): boolean {
  if (atmosphere.humidity <= RAIN_STOP_HUMIDITY) return true
  if (atmosphereExcessVapor(atmosphere) <= 0) return true
  return false
}

function runPrecipitation(
  atmosphere: Atmosphere,
  terrain: TerrainWater,
  worldWidth: number,
  worldHeight: number,
): number {
  const excess = atmosphereExcessVapor(atmosphere)
  if (excess <= 0) return 0

  const areaScale = (worldWidth * worldHeight) / REFERENCE_WORLD_AREA
  const baseMin = RAIN_PRECIP_BASE * areaScale
  const precip =
    excess <= baseMin
      ? excess
      : Math.min(excess, Math.max(baseMin, excess * RAIN_PRECIP_FRACTION))

  const surfaceApplied = terrain.receivePrecipitation(precip)
  atmosphere.vapor -= surfaceApplied
  return surfaceApplied
}

export function tickWaterCycle(
  atmosphere: Atmosphere,
  soil: SoilMoisture,
  terrain: TerrainWater,
  tempC: number,
  worldWidth: number,
  worldHeight: number,
): void {
  if (atmosphere.raining) {
    if (atmosphereExcessVapor(atmosphere) <= 0) {
      atmosphere.raining = false
      return
    }

    const applied = runPrecipitation(atmosphere, terrain, worldWidth, worldHeight)
    terrain.tickInfiltration(soil, true)
    if (shouldStopRain(atmosphere) || applied < 0.5) {
      atmosphere.raining = false
    }
    return
  }

  atmosphere.vapor += terrain.evaporateToAir(tempC, atmosphere.humidity, false)
  terrain.tickInfiltration(soil, false)
  evaporateSoilToAir(soil, atmosphere, tempC, terrain)

  if (atmosphere.humidity < RAIN_ARM_HUMIDITY) {
    atmosphere.armedForRain = true
  }

  if (atmosphere.armedForRain && atmosphere.humidity >= RAIN_START_HUMIDITY) {
    atmosphere.raining = true
    atmosphere.armedForRain = false
    runPrecipitation(atmosphere, terrain, worldWidth, worldHeight)
    terrain.tickInfiltration(soil, true)
    if (shouldStopRain(atmosphere)) {
      atmosphere.raining = false
    }
  }
}

export function releaseCreatureWater(
  creature: Creature,
  soil: SoilMoisture,
  atmosphere: Atmosphere,
): void {
  const water = creature.hydration
  if (water <= 0) return

  const toSoil = water * DEATH_WATER_TO_SOIL
  const toAir = water * DEATH_WATER_TO_AIR
  const soilApplied = soil.depositWater(creature.x, creature.y, toSoil)
  atmosphere.vapor += toAir + (toSoil - soilApplied)
  creature.hydration = 0
}

export function releasePlantWater(
  plant: Plant,
  soil: SoilMoisture,
  atmosphere: Atmosphere,
): void {
  const water = plantHydricWater(plant)
  if (water <= 0) return

  const toSoil = water * DEATH_WATER_TO_SOIL
  const toAir = water * DEATH_WATER_TO_AIR
  const soilApplied = soil.depositWater(plant.x, plant.y, toSoil)
  atmosphere.vapor += toAir + (toSoil - soilApplied)
  plant.water = 0
  plant.energy = 0
}

export function releasePlantTranspiration(
  waterUnits: number,
  plant: Plant,
  soil: SoilMoisture,
  atmosphere: Atmosphere,
): void {
  if (waterUnits <= 0) return
  releaseTranspiredWater(atmosphere, soil, plant.x, plant.y, waterUnits)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
