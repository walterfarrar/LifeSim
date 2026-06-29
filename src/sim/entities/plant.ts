import { cloneDNA } from '../dna'
import { mutatePlant } from '../mutation'
import { createRandomPlantDNA, plantKindLabelFromDna } from '../plantKinds'
import { normalizePlantGenes } from '../genomeNormalize'
import { expressPlant } from '../phenotype'
import type { Rng } from '../rng'
import type { Plant, Vec2 } from '../types'
import { getWorldBounds } from '../worldBounds'

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

function finalizePlantDna(dna: Plant['dna']): Plant['dna'] {
  const genes = normalizePlantGenes(Array.from(dna))
  const out = new Uint8Array(genes.length)
  for (let i = 0; i < genes.length; i++) {
    out[i] = genes[i]
  }
  return out
}

function plantMargin(bounds = getWorldBounds()): number {
  return Math.min(40, Math.max(20, Math.min(bounds.width, bounds.height) * 0.02))
}

function startingEnergy(rng: Rng, maxEnergy: number): number {
  return rng.range(5, maxEnergy * 0.38)
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
    energy: initialEnergy ?? startingEnergy(rng, traits.maxEnergy),
    age: 0,
  }
}

/** Spread range grows as the parent plant ages — colonies push outward over time. */
export function plantSpreadRange(parent: Plant): { min: number; max: number } {
  const traits = plantTraits(parent)
  const maturity = Math.min(1, parent.age / traits.maturationAge)
  const energyRatio = Math.min(1, parent.energy / traits.maxEnergy)
  const reach = maturity * 0.7 + energyRatio * 0.3
  const spreadScale = 0.45 + reach * 0.55

  return {
    min: traits.spreadMin * spreadScale + reach * 30,
    max: traits.spreadMax * spreadScale + reach * traits.spreadAgeBonus,
  }
}

/** Per-tick chance a parent produces a seedling — driven by reproduction & spread genes. */
export function plantReproductionChance(parent: Plant): number {
  const traits = plantTraits(parent)
  const maturity = Math.min(1, parent.age / traits.maturationAge)
  const energyRatio = Math.min(1, parent.energy / traits.maxEnergy)
  const readiness = maturity * 0.58 + energyRatio * 0.42
  const spreadDrive = 0.55 + Math.min(1, traits.spreadMax / 140) * 0.45
  return Math.min(1, readiness * traits.reproductionRate * spreadDrive * 0.034)
}

/** How many reproduction rolls the population gets this tick (scales with count & avg reproduction). */
export function plantPopulationSpawnAttempts(plants: readonly Plant[]): number {
  if (plants.length === 0) return 0

  let reproductionSum = 0
  for (const plant of plants) {
    reproductionSum += plantTraits(plant).reproductionRate
  }
  const avgReproduction = reproductionSum / plants.length
  const base = Math.max(1, Math.round(Math.sqrt(plants.length) / 3.5))
  return Math.max(1, Math.min(18, Math.round(base * (0.6 + avgReproduction * 0.35))))
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

/** Spawn a new plant within spread distance of an existing one. */
export function createPlantNear(rng: Rng, parent: Plant, initialEnergy?: number): Plant {
  const bounds = getWorldBounds()
  const margin = plantMargin(bounds)
  const spawn = (position: Vec2) =>
    createPlant(rng, position, parent.dna, initialEnergy)

  const { min, max } = plantSpreadRange(parent)
  for (let attempt = 0; attempt < 10; attempt++) {
    const angle = rng.range(0, Math.PI * 2)
    const dist = rng.range(min, max)
    const x = parent.x + Math.cos(angle) * dist
    const y = parent.y + Math.sin(angle) * dist
    if (x >= margin && x <= bounds.width - margin && y >= margin && y <= bounds.height - margin) {
      return spawn({ x, y })
    }
  }

  const angle = rng.range(0, Math.PI * 2)
  const dist = rng.range(min, max)
  const x = clamp(parent.x + Math.cos(angle) * dist, margin, bounds.width - margin)
  const y = clamp(parent.y + Math.sin(angle) * dist, margin, bounds.height - margin)
  return spawn({ x, y })
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function growPlant(plant: Plant): void {
  const traits = plantTraits(plant)
  plant.age += 1
  if (plant.energy < traits.maxEnergy) {
    plant.energy = Math.min(traits.maxEnergy, plant.energy + traits.growthRate)
  }
}

export function bitePlant(plant: Plant, amount: number): number {
  const eaten = Math.min(plant.energy, amount)
  plant.energy -= eaten
  return eaten
}

export function isPlantEdible(plant: Plant): boolean {
  return plant.energy > 0.5
}

export function plantRadius(plant: Plant): number {
  const traits = plantTraits(plant)
  const energyRatio = Math.min(1, plant.energy / traits.maxEnergy)
  return traits.baseRadius + energyRatio * traits.radiusEnergyScale
}
