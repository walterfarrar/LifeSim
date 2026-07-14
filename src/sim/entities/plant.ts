import { DROWN_PLANT_DAMAGE, DROWN_TREE_DAMAGE_SCALE, PLANT_WATER_PER_ENERGY, SOIL_CELL_WATER_CAPACITY } from '../config'
import { cloneDNA } from '../dna'
import { energyFromPlantBiomass } from '../energyEconomy'
import { normalizePlantGenes } from '../genomeNormalize'
import { mutatePlant } from '../mutation'
import { applyPlantKindClimate, isPlantDormant, plantSeasonalGrowthScale, plantSeasonalReproductionScale, plantSeasonalSpreadScale } from '../plantClimate'
import { createRandomPlantDNA, plantKindFromDna, plantKindLabelFromDna } from '../plantKinds'
import { expressPlant } from '../phenotype'
import type { Rng } from '../rng'
import type { SeasonName } from '../seasons'
import { wrapPosition } from '../toroidal'
import type { Creature, Plant, Vec2 } from '../types'
import { getWorldBounds } from '../worldBounds'
import { moistureGrowthFactor, type SoilAccess } from '../soilMoisture'
import { waterUnitsForGrowth, clampTissueWaterOverflow, consumeSoilWaterForGrowth, plantTissueWaterCapacity } from '../plantWaterUptake'
import { releaseTranspiredWater, type AtmospherePool } from '../transpiration'
import { temperatureGrowthFactor } from '../temperature'
import { capEnergy, capHydration, creatureTraits } from './creature'

let nextPlantId = 1

export function resetPlantIds(): void {
  nextPlantId = 1
}

export function plantTraits(plant: Plant) {
  return expressPlant(plant.dna)
}

export function plantLineageLabel(plant: Plant): string {
  return plantKindLabelFromDna(plant.dna)
}

export function finalizePlantDna(dna: Plant['dna']): Plant['dna'] {
  const genes = normalizePlantGenes(Array.from(dna))
  const out = new Uint8Array(genes.length)
  for (let i = 0; i < genes.length; i++) {
    out[i] = genes[i]
  }
  applyPlantKindClimate(out, plantKindFromDna(out))
  return out
}

function plantMargin(bounds = getWorldBounds()): number {
  return Math.min(40, Math.max(20, Math.min(bounds.width, bounds.height) * 0.02))
}

function startingEnergy(rng: Rng, maxEnergy: number, dna: Plant['dna']): number {
  const kind = plantKindFromDna(dna)
  if (kind === 'tree') {
    return rng.range(18, maxEnergy * 0.32)
  }
  if (kind === 'bush') {
    return rng.range(16, maxEnergy * 0.55)
  }
  return rng.range(12, maxEnergy * 0.62)
}

export function createPlant(
  rng: Rng,
  position?: Vec2,
  parentDna?: Plant['dna'],
  initialEnergy?: number,
): Plant {
  const dna = parentDna
    ? finalizePlantDna(mutatePlant(cloneDNA(parentDna), rng))
    : finalizePlantDna(createRandomPlantDNA(rng))
  return buildPlant(rng, dna, position, initialEnergy)
}

/** Spawn an exact genome — used when re-seeding the all-time plant champion. */
export function createPlantWithDna(
  rng: Rng,
  dna: Plant['dna'],
  position?: Vec2,
  initialEnergy?: number,
): Plant {
  return buildPlant(rng, finalizePlantDna(dna), position, initialEnergy)
}

function buildPlant(
  rng: Rng,
  dna: Plant['dna'],
  position?: Vec2,
  initialEnergy?: number,
): Plant {
  const bounds = getWorldBounds()
  const margin = plantMargin(bounds)
  const traits = expressPlant(dna)
  return {
    kind: 'plant',
    id: nextPlantId++,
    x: position?.x ?? rng.range(margin, bounds.width - margin),
    y: position?.y ?? rng.range(margin, bounds.height - margin),
    dna,
    energy: initialEnergy ?? startingEnergy(rng, traits.maxEnergy, dna),
    water: 0,
    age: 0,
    droughtTicks: 0,
  }
}

/** Spread range grows as the parent plant ages — colonies push outward over time. */
/** Free tissue-water capacity — scales from 0 (tiny) to {@link PLANT_MAX_TISSUE_WATER} at full size. */
export function plantMaxStoredWater(plant: Plant): number {
  const traits = plantTraits(plant)
  return plantTissueWaterCapacity(plant.energy, traits.maxEnergy)
}

/** Pull growth reserve from local soil on spawn (overflow transpires). */
export function absorbPlantWaterFromSoil(
  plant: Plant,
  soil: SoilAccess,
  atmosphere: AtmospherePool,
): void {
  const reserveCap = plantMaxStoredWater(plant)
  if (reserveCap <= 0 || plant.water >= reserveCap) return

  const need = reserveCap - plant.water
  const taken = soil.consume(plant.x, plant.y, need / SOIL_CELL_WATER_CAPACITY)
  const waterUnits = taken * SOIL_CELL_WATER_CAPACITY
  const stored = Math.min(waterUnits, reserveCap - plant.water)
  plant.water += stored
  releaseTranspiredWater(atmosphere, soil, plant.x, plant.y, waterUnits - stored)
}

export function transferPlantSeedWater(
  parent: Plant,
  child: Plant,
  seedCost: number,
  atmosphere: AtmospherePool,
): void {
  const seedWater = Math.min(parent.water, seedCost * PLANT_WATER_PER_ENERGY)
  parent.water = Math.max(0, parent.water - seedWater)
  child.water = seedWater * 0.95
  atmosphere.vent(parent.x, parent.y, seedWater * 0.05)
}

export function plantSpreadRange(parent: Plant, season: SeasonName): { min: number; max: number } {
  const traits = plantTraits(parent)
  const kind = plantKindFromDna(parent.dna)
  const maturity = Math.min(1, parent.age / traits.maturationAge)
  const energyRatio = Math.min(1, parent.energy / traits.maxEnergy)
  const reach = maturity * 0.7 + energyRatio * 0.3
  const spreadScale = (0.45 + reach * 0.55) * plantSeasonalSpreadScale(kind, season)

  return {
    min: traits.spreadMin * spreadScale + reach * 30,
    max: traits.spreadMax * spreadScale + reach * traits.spreadAgeBonus,
  }
}

/** Per-tick chance a parent produces a seedling — driven by reproduction & spread genes. */
export function plantReproductionChance(parent: Plant, season: SeasonName): number {
  const traits = plantTraits(parent)
  const kind = plantKindFromDna(parent.dna)
  const seasonal = plantSeasonalReproductionScale(kind, season)
  if (seasonal <= 0) return 0

  const maturity = Math.min(1, parent.age / traits.maturationAge)
  const energyRatio = Math.min(1, parent.energy / traits.maxEnergy)
  const readiness = maturity * 0.58 + energyRatio * 0.42
  const spreadDrive = 0.55 + Math.min(1, traits.spreadMax / 140) * 0.45
  return Math.min(1, readiness * traits.reproductionRate * spreadDrive * 0.034 * seasonal)
}

/** How many reproduction rolls the population gets this tick (scales with count & avg reproduction). */
export function plantPopulationSpawnAttempts(plants: readonly Plant[], season: SeasonName): number {
  if (plants.length === 0) return 0

  let reproductionSum = 0
  let grassCount = 0
  for (const plant of plants) {
    reproductionSum += plantTraits(plant).reproductionRate
    if (plantKindFromDna(plant.dna) === 'grass') grassCount += 1
  }
  const avgReproduction = reproductionSum / plants.length
  const base = Math.max(1, Math.round(Math.sqrt(plants.length) / 3.5))
  let cap = 18
  if (season === 'summer' && grassCount / plants.length > 0.35) {
    cap = 36
  } else if (season === 'spring' && grassCount / plants.length > 0.35) {
    cap = 26
  }
  return Math.max(1, Math.min(cap, Math.round(base * (0.6 + avgReproduction * 0.35))))
}

/** Prefer parents with higher reproduction and spread genes. */
export function pickPlantForReproduction(rng: Rng, plants: readonly Plant[]): Plant {
  let totalWeight = 0
  const weights: number[] = []

  for (const plant of plants) {
    const traits = plantTraits(plant)
    const weight = traits.reproductionRate * (0.35 + traits.spreadMax / 180)
    weights.push(weight)
    totalWeight += weight
  }

  if (totalWeight <= 0) {
    return plants[rng.int(0, plants.length - 1)]
  }

  let roll = rng.range(0, totalWeight)
  for (let i = 0; i < plants.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return plants[i]
  }

  return plants[plants.length - 1]
}

/** Spawn a new plant within spread distance of an existing one (toroidal wrap). */
export function createPlantNear(rng: Rng, parent: Plant, season: SeasonName, initialEnergy?: number): Plant {
  const { min, max } = plantSpreadRange(parent, season)
  const angle = rng.range(0, Math.PI * 2)
  const dist = rng.range(min, max)
  const position = wrapPosition({
    x: parent.x + Math.cos(angle) * dist,
    y: parent.y + Math.sin(angle) * dist,
  })
  return createPlant(rng, position, parent.dna, initialEnergy)
}

export function applyPlantTemperature(plant: Plant, temperature: number, season: SeasonName): void {
  if (isPlantDormant(plant.dna, season, temperature)) return

  const traits = plantTraits(plant)
  const delta = Math.abs(temperature - traits.idealTemp)

  // Lethal only beyond survival limits — off-ideal temps slow growth, they do not drain energy.
  if (delta >= traits.tempSurvivalHalfWidth) {
    plant.energy = 0
  }
}

/** Plants age every tick regardless of growth conditions. */
export function applyPlantAging(plant: Plant): void {
  plant.age += 1
}

export function applyPlantOldAge(plant: Plant): void {
  const traits = plantTraits(plant)
  if (plant.age >= traits.maxAge) {
    plant.energy = 0
  }
}

/** Minimum moisture-growth factor before drought stress begins. */
function droughtSafeMoistureFactor(kind: ReturnType<typeof plantKindFromDna>): number {
  switch (kind) {
    case 'grass':
      return 0.14
    case 'bush':
      return 0.17
    case 'tree':
      return 0.34
    default:
      return 0.28
  }
}

/**
 * Prolonged dry soil drains stored biomass. Dormant plants (winter grass/bushes) do not transpire.
 * Hardiness and lineage affect drought tolerance.
 */
export function applyPlantDrought(
  plant: Plant,
  soil: SoilAccess,
  season: SeasonName,
  temperature: number,
): number {
  if (isPlantDormant(plant.dna, season, temperature)) {
    plant.droughtTicks = 0
    return 0
  }

  const traits = plantTraits(plant)
  const kind = plantKindFromDna(plant.dna)
  const moisture = soil.sample(plant.x, plant.y)
  const moistureFactor = moistureGrowthFactor(moisture, traits.moistureNeed)
  const safeMoisture = droughtSafeMoistureFactor(kind)

  if (moistureFactor >= safeMoisture) {
    plant.droughtTicks = 0
    return 0
  }

  plant.droughtTicks += 1
  const ramp = 1 + Math.min(3, plant.droughtTicks / 75)
  const severity =
    moistureFactor < safeMoisture * 0.35
      ? 1
      : (safeMoisture - moistureFactor) / Math.max(0.05, safeMoisture * 0.65)
  const droughtTolerance =
    0.25 +
    traits.hardiness * 0.5 +
    (kind === 'tree' ? 0.48 : 0) +
    (kind === 'grass' ? 0.22 : 0) +
    (kind === 'bush' ? 0.14 : 0)
  const thirst = 0.55 + traits.moistureNeed * 0.45
  const kindDrainScale = kind === 'grass' ? 0.48 : kind === 'bush' ? 0.62 : 0.48
  const drain =
    severity *
    ramp *
    (0.14 + thirst * 0.2) *
    Math.max(0.15, 1.05 - droughtTolerance) *
    kindDrainScale

  const released = drain * PLANT_WATER_PER_ENERGY
  const beforeEnergy = plant.energy
  plant.energy = Math.max(0, plant.energy - drain)
  if (beforeEnergy > 0 && plant.water > 0) {
    const tissueLost = plant.water * (Math.min(drain, beforeEnergy) / beforeEnergy)
    plant.water = Math.max(0, plant.water - tissueLost)
    return released + tissueLost
  }
  return released
}

export function growPlant(
  plant: Plant,
  soil: SoilAccess,
  sunlight: number,
  temperature: number,
  season: SeasonName,
  atmosphere: AtmospherePool,
): void {
  const traits = plantTraits(plant)
  const kind = plantKindFromDna(plant.dna)
  const dormant = isPlantDormant(plant.dna, season, temperature)

  if (plant.energy <= 0.5 || plant.energy >= traits.maxEnergy) return
  if (sunlight <= 0 || dormant) return

  const moisture = soil.sample(plant.x, plant.y)
  const moistureFactor = moistureGrowthFactor(moisture, traits.moistureNeed)
  if (moistureFactor <= 0) return

  const tempFactor = temperatureGrowthFactor(temperature, traits.idealTemp, traits.tempGrowthHalfWidth)
  if (tempFactor <= 0) return

  const seasonal = plantSeasonalGrowthScale(kind, season, dormant)
  const potentialGrowth = traits.growthRate * moistureFactor * sunlight * tempFactor * seasonal
  if (potentialGrowth <= 0) return

  // Demand only for growth that can actually fit — pulling for full potential then room-capping
  // used to destroy the unused soil water (closed-cycle leak).
  const room = Math.max(0, traits.maxEnergy - plant.energy)
  if (room <= 0) return
  const desiredGrowth = Math.min(room, potentialGrowth)
  const waterDemandUnits = waterUnitsForGrowth(desiredGrowth)
  const available = consumeSoilWaterForGrowth(plant.x, plant.y, waterDemandUnits, soil)
  if (available <= 0 || waterDemandUnits <= 0) return
  const growth = desiredGrowth * (available / waterDemandUnits)
  plant.energy += growth
  // Capacity rose with size; keep tissue under the new cap (does not consume tissue to grow).
  plant.water = clampTissueWaterOverflow(
    plant.water,
    plant.energy,
    traits.maxEnergy,
    atmosphere,
    soil,
    plant,
  )
}

export function bitePlant(plant: Plant, amount: number): { eaten: number; waterReleased: number } {
  const eaten = Math.min(plant.energy, amount)
  if (eaten <= 0) return { eaten: 0, waterReleased: 0 }
  const reserveShare = plant.energy > 0 ? (eaten / plant.energy) * plant.water : 0
  const structuralWater = eaten * PLANT_WATER_PER_ENERGY
  plant.energy -= eaten
  plant.water = Math.max(0, plant.water - reserveShare)
  return { eaten, waterReleased: reserveShare + structuralWater }
}

/** Bite a plant — creature gains digestible energy and tissue water (overflow returns to air). */
export function foragePlantBite(
  creature: Creature,
  plant: Plant,
  amount: number,
  atmosphere: AtmospherePool,
): number {
  const { eaten, waterReleased } = bitePlant(plant, amount)
  if (eaten <= 0) return 0

  const traits = creatureTraits(creature)
  const hydrationBefore = creature.hydration
  creature.hydration = capHydration(creature, creature.hydration + waterReleased)
  atmosphere.vent(plant.x, plant.y, Math.max(0, waterReleased - (creature.hydration - hydrationBefore)))

  const gained = energyFromPlantBiomass(eaten, traits.forageEfficiency)
  creature.energy = capEnergy(creature, creature.energy + gained)
  return eaten
}

export function isPlantEdible(plant: Plant): boolean {
  return plant.energy > 0.5
}

export function plantDrownDamage(plant: Plant): number {
  if (plantKindFromDna(plant.dna) === 'tree') {
    return DROWN_PLANT_DAMAGE * DROWN_TREE_DAMAGE_SCALE
  }
  return DROWN_PLANT_DAMAGE
}

export function plantRadius(plant: Plant): number {
  const traits = plantTraits(plant)
  const kind = plantKindFromDna(plant.dna)
  const energyRatio = Math.min(1, plant.energy / traits.maxEnergy)

  if (kind === 'tree') {
    const maturity = Math.min(1, plant.age / traits.maturationAge)
    // Mature conifers keep their height even when grazed; energy still adds girth.
    const sizeReach = Math.min(1, maturity * 0.92 + energyRatio * 0.55)
    return traits.baseRadius + sizeReach * traits.radiusEnergyScale
  }

  return traits.baseRadius + energyRatio * traits.radiusEnergyScale
}
