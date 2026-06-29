import type { DNA } from './dna'
import { PlantGene } from './genes'
import {
  PLANT_BUDGET_GENES,
  allocatePlantBudget,
  normalizePlantBudget,
} from './plantBudget'
import type { Rng } from './rng'

export type PlantKind = 'grass' | 'bush' | 'tree'

/** Stored in PlantGene.Kind — stable across generations. */
export const PLANT_KIND_GENE: Record<PlantKind, number> = {
  grass: 42,
  bush: 128,
  tree: 216,
}

/** Total budget-gene points available to each lineage (8 shared traits). */
export const PLANT_KIND_BUDGET_TOTAL: Record<PlantKind, number> = {
  grass: 960,
  bush: 1280,
  tree: 1720,
}

export const PLANT_KIND_LABEL: Record<PlantKind, string> = {
  grass: 'Grass',
  bush: 'Bush',
  tree: 'Tree',
}

const PLANT_KIND_ORDER: readonly PlantKind[] = ['grass', 'bush', 'tree']

/** Relative budget weights per PLANT_BUDGET_GENES slot — templates only, offspring mutate freely. */
const PLANT_KIND_BUDGET_WEIGHTS: Record<PlantKind, readonly number[]> = {
  grass: [0.35, 2.2, 1.8, 2.0, 0.55, 2.1, 0.25, 0.2],
  bush: [1, 1, 1, 1, 1, 1, 1, 1],
  tree: [2.2, 0.35, 0.45, 0.5, 0.75, 0.3, 1.7, 2.1],
}

const PLANT_KIND_COSMETICS: Record<
  PlantKind,
  Partial<Record<(typeof PlantGene)[keyof typeof PlantGene], number>>
> = {
  grass: {
    [PlantGene.GreenHue]: 98,
    [PlantGene.Saturation]: 145,
    [PlantGene.Lightness]: 185,
    [PlantGene.LeafLobes]: 28,
    [PlantGene.LeafPointiness]: 55,
    [PlantGene.MutationRate]: 48,
    [PlantGene.MutationAmount]: 42,
  },
  bush: {
    [PlantGene.GreenHue]: 78,
    [PlantGene.Saturation]: 118,
    [PlantGene.Lightness]: 118,
    [PlantGene.LeafLobes]: 105,
    [PlantGene.LeafPointiness]: 95,
    [PlantGene.MutationRate]: 42,
    [PlantGene.MutationAmount]: 45,
  },
  tree: {
    [PlantGene.GreenHue]: 52,
    [PlantGene.Saturation]: 88,
    [PlantGene.Lightness]: 48,
    [PlantGene.LeafLobes]: 165,
    [PlantGene.LeafPointiness]: 35,
    [PlantGene.MutationRate]: 38,
    [PlantGene.MutationAmount]: 40,
  },
}

export function plantKindFromGeneValue(value: number): PlantKind {
  if (value < 85) return 'grass'
  if (value < 172) return 'bush'
  return 'tree'
}

export function plantKindFromDna(dna: DNA): PlantKind {
  if (dna.length <= PlantGene.Kind) return 'bush'
  return plantKindFromGeneValue(dna[PlantGene.Kind])
}

export function plantBudgetTotalForKind(kind: PlantKind): number {
  return PLANT_KIND_BUDGET_TOTAL[kind]
}

export function plantBudgetTotalForDna(dna: DNA): number {
  return plantBudgetTotalForKind(plantKindFromDna(dna))
}

export function plantKindLabel(kind: PlantKind): string {
  return PLANT_KIND_LABEL[kind]
}

export function plantKindLabelFromDna(dna: DNA): string {
  return plantKindLabel(plantKindFromDna(dna))
}

export function pickRandomPlantKind(rng: Rng): PlantKind {
  const roll = rng.range(0, 1)
  if (roll < 0.55) return 'grass'
  if (roll < 0.85) return 'bush'
  return 'tree'
}

function jitterGene(rng: Rng, value: number, spread = 18): number {
  return Math.max(0, Math.min(255, Math.round(value + rng.int(-spread, spread))))
}

/** Founder DNA for a lineage — budget split favors the archetype but can mutate anywhere in-pool. */
export function createPlantKindDna(kind: PlantKind, rng: Rng): DNA {
  const dna = new Uint8Array(16)
  dna[PlantGene.Kind] = PLANT_KIND_GENE[kind]

  const cosmetics = PLANT_KIND_COSMETICS[kind]
  for (const [geneKey, value] of Object.entries(cosmetics)) {
    const gene = Number(geneKey)
    dna[gene] = jitterGene(rng, value)
  }

  const allocation = allocatePlantBudget(
    rng,
    plantBudgetTotalForKind(kind),
    PLANT_KIND_BUDGET_WEIGHTS[kind],
  )
  PLANT_BUDGET_GENES.forEach((gene, index) => {
    dna[gene] = allocation[index]
  })

  normalizePlantBudget(dna)
  dna[PlantGene.Kind] = PLANT_KIND_GENE[kind]
  return dna
}

export function createRandomPlantDNA(rng: Rng): DNA {
  return createPlantKindDna(pickRandomPlantKind(rng), rng)
}

export function countPlantsByKind(plants: readonly { dna: DNA }[]): Record<PlantKind, number> {
  const counts: Record<PlantKind, number> = { grass: 0, bush: 0, tree: 0 }
  for (const plant of plants) {
    counts[plantKindFromDna(plant.dna)] += 1
  }
  return counts
}

export function allPlantKinds(): readonly PlantKind[] {
  return PLANT_KIND_ORDER
}
