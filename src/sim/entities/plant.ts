import { cloneDNA } from '../dna'
import { mutatePlant } from '../mutation'
import { createRandomPlantDNA, normalizePlantBudget } from '../plantBudget'
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

function plantMargin(bounds = getWorldBounds()): number {
  return Math.min(40, Math.max(20, Math.min(bounds.width, bounds.height) * 0.02))
}

function startingEnergy(rng: Rng, maxEnergy: number): number {
  return rng.range(8, maxEnergy * 0.6)
}

export function createPlant(
  rng: Rng,
  position?: Vec2,
  parentDna?: Plant['dna'],
  initialEnergy?: number,
): Plant {
  const dna = parentDna ? mutatePlant(cloneDNA(parentDna), rng) : createRandomPlantDNA(rng)
  return buildPlant(rng, dna, position, initialEnergy)
}

/** Spawn an exact genome — used when re-seeding the all-time plant champion. */
export function createPlantWithDna(
  rng: Rng,
  dna: Plant['dna'],
  position?: Vec2,
  initialEnergy?: number,
): Plant {
  const normalized = cloneDNA(dna)
  normalizePlantBudget(normalized)
  return buildPlant(rng, normalized, position, initialEnergy)
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
  const reach = maturity * 0.75 + energyRatio * 0.25

  return {
    min: traits.spreadMin + reach * 25,
    max: traits.spreadMax + reach * traits.spreadAgeBonus,
  }
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
