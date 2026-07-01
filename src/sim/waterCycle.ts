import {
  ATMOSPHERE_INITIAL_VAPOR,
  ATMOSPHERE_VAPOR_CAPACITY,
  DEFAULT_WORLD_HEIGHT,
  DEFAULT_WORLD_WIDTH,
  DEATH_WATER_TO_AIR,
  DEATH_WATER_TO_SOIL,
  POND_EVAP_BASE,
  SURFACE_EVAPORATION_SCALE,
  RAIN_ARM_HUMIDITY,
  RAIN_POND_FRACTION,
  RAIN_PRECIP_BASE,
  RAIN_PRECIP_FRACTION,
  RAIN_SOIL_FRACTION,
  RAIN_START_HUMIDITY,
  RAIN_STOP_HUMIDITY,
  REFERENCE_WORLD_AREA,
  SOIL_CELL_WATER_CAPACITY,
  SOIL_EVAP_BASE,
} from './config'
import type { Creature, Plant, Pond } from './types'
import type { SoilMoisture } from './soilMoisture'

/** Atmospheric vapor pool — rain runs while humidity is high until it falls to the stop level. */
export class Atmosphere {
  vapor = 0
  raining = false
  armedForRain = true

  reset(initialVapor = scaledInitialVapor(DEFAULT_WORLD_WIDTH, DEFAULT_WORLD_HEIGHT)): void {
    this.vapor = initialVapor
    this.raining = false
    this.armedForRain = true
  }

  get humidity(): number {
    return Math.min(1.5, Math.max(0, this.vapor / ATMOSPHERE_VAPOR_CAPACITY))
  }

  get isRaining(): boolean {
    return this.raining
  }
}

export function scaledInitialVapor(width: number, height: number): number {
  const area = width * height
  return ATMOSPHERE_INITIAL_VAPOR * (area / REFERENCE_WORLD_AREA)
}

/** Evaporation / sweat multiplier from temperature and relative humidity (0–1+). */
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

export function measureTotalWater(
  ponds: readonly Pond[],
  soil: SoilMoisture,
  creatures: readonly Creature[],
  plants: readonly Plant[],
  atmosphere: Atmosphere,
): number {
  let total = atmosphere.vapor
  for (const pond of ponds) total += pond.water
  total += soil.totalWater()
  for (const creature of creatures) total += creature.hydration
  for (const plant of plants) total += plantStoredWater(plant)
  return total
}

export function evaporatePondsToAir(
  ponds: readonly Pond[],
  atmosphere: Atmosphere,
  tempC: number,
): void {
  if (atmosphere.raining) return
  const evapMult = surfaceEvaporationRate(tempC, atmosphere.humidity, false)
  for (const pond of ponds) {
    if (pond.water <= 0) continue
    const fill = pond.water / Math.max(pond.maxWater, 1)
    const rate = POND_EVAP_BASE * evapMult * (0.35 + 0.65 * Math.sqrt(fill))
    const evap = Math.min(pond.water, rate)
    pond.water -= evap
    atmosphere.vapor += evap
  }
}

export function evaporateSoilToAir(
  soil: SoilMoisture,
  atmosphere: Atmosphere,
  tempC: number,
): void {
  if (atmosphere.raining) return
  const evapMult = surfaceEvaporationRate(tempC, atmosphere.humidity, false)
  const baseRate = SOIL_EVAP_BASE * SOIL_CELL_WATER_CAPACITY * evapMult
  atmosphere.vapor += soil.evaporateToAtmosphere(baseRate)
}

/** Match the stats-panel humidity display so rain stops when the UI reads ~10%. */
export function shouldStopRain(atmosphere: Atmosphere): boolean {
  const humidity = atmosphere.humidity
  const stopVapor = ATMOSPHERE_VAPOR_CAPACITY * RAIN_STOP_HUMIDITY
  if (Math.round(humidity * 100) <= Math.round(RAIN_STOP_HUMIDITY * 100)) return true
  if (atmosphere.vapor <= stopVapor + ATMOSPHERE_VAPOR_CAPACITY * 0.008) return true
  return false
}

function runPrecipitation(
  atmosphere: Atmosphere,
  soil: SoilMoisture,
  ponds: readonly Pond[],
  worldWidth: number,
  worldHeight: number,
): number {
  const stopVapor = ATMOSPHERE_VAPOR_CAPACITY * RAIN_STOP_HUMIDITY
  const excess = atmosphere.vapor - stopVapor
  if (excess <= 0) return 0

  const areaScale = (worldWidth * worldHeight) / REFERENCE_WORLD_AREA
  const precip = Math.min(
    excess,
    Math.max(RAIN_PRECIP_BASE * areaScale, excess * RAIN_PRECIP_FRACTION),
  )

  const pondWant = precip * RAIN_POND_FRACTION
  let pondApplied = 0
  const pondShare = pondWant / Math.max(ponds.length, 1)
  for (const pond of ponds) {
    const room = pond.maxWater - pond.water
    if (room <= 0) continue
    const add = Math.min(room, pondShare)
    pond.water += add
    pondApplied += add
  }

  const soilWant = precip * RAIN_SOIL_FRACTION + (pondWant - pondApplied)
  const soilApplied = soil.receivePrecipitation(soilWant)
  atmosphere.vapor -= pondApplied + soilApplied
  return pondApplied + soilApplied
}

/**
 * One water-cycle step: rain first when active, evaporation only while dry,
 * then check whether a new storm should begin.
 */
export function tickWaterCycle(
  atmosphere: Atmosphere,
  soil: SoilMoisture,
  ponds: readonly Pond[],
  tempC: number,
  worldWidth: number,
  worldHeight: number,
): void {
  if (atmosphere.raining) {
    const applied = runPrecipitation(atmosphere, soil, ponds, worldWidth, worldHeight)
    if (shouldStopRain(atmosphere)) {
      atmosphere.raining = false
    } else if (applied < 0.5) {
      // Ground saturated — end the shower.
      atmosphere.raining = false
    }
    return
  }

  evaporatePondsToAir(ponds, atmosphere, tempC)
  evaporateSoilToAir(soil, atmosphere, tempC)

  if (atmosphere.humidity < RAIN_ARM_HUMIDITY) {
    atmosphere.armedForRain = true
  }

  if (atmosphere.armedForRain && atmosphere.humidity >= RAIN_START_HUMIDITY) {
    atmosphere.raining = true
    atmosphere.armedForRain = false
    runPrecipitation(atmosphere, soil, ponds, worldWidth, worldHeight)
    if (shouldStopRain(atmosphere)) {
      atmosphere.raining = false
    }
  }
}

/** @deprecated Use tickWaterCycle */
export function tickRain(
  atmosphere: Atmosphere,
  soil: SoilMoisture,
  ponds: readonly Pond[],
  worldWidth: number,
  worldHeight: number,
): void {
  tickWaterCycle(atmosphere, soil, ponds, 20, worldWidth, worldHeight)
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
  const water = plantStoredWater(plant)
  if (water <= 0) return

  const toSoil = water * DEATH_WATER_TO_SOIL
  const toAir = water * DEATH_WATER_TO_AIR
  const soilApplied = soil.depositWater(plant.x, plant.y, toSoil)
  atmosphere.vapor += toAir + (toSoil - soilApplied)
  plant.water = 0
}

/** Transpiration / drought stress — prefer local soil, overflow to air. Never destroys water. */
export function releasePlantTranspiration(
  waterUnits: number,
  plant: Plant,
  soil: SoilMoisture,
  atmosphere: Atmosphere,
): void {
  if (waterUnits <= 0) return
  const soilApplied = soil.depositWater(plant.x, plant.y, waterUnits)
  atmosphere.vapor += waterUnits - soilApplied
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
