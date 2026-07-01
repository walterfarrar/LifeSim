import type { DNA } from './dna'
import { PlantGene, PLANT_GENE_COUNT } from './genes'
import {
  PLANT_BUDGET_GENES,
  allocatePlantBudget,
  normalizePlantBudget,
} from './plantBudget'
import { applyPlantKindClimate } from './plantClimate'
import type { Rng } from './rng'

export type PlantKind = 'grass' | 'bush' | 'tree'

/** Stored in PlantGene.Kind — stable across generations. */
export const PLANT_KIND_GENE: Record<PlantKind, number> = {
  grass: 42,
  bush: 128,
  tree: 216,
}

/** Per-lineage gameplay multipliers applied when traits are expressed. */
export const PLANT_KIND_TRAIT_SCALE: Record<
  PlantKind,
  {
    maxEnergy: number
    growthRate: number
    spread: number
    reproduction: number
    maturation: number
    radius: number
    radiusEnergy: number
    lifespan: number
  }
> = {
  grass: {
    maxEnergy: 0.78,
    growthRate: 1.35,
    spread: 2.1,
    reproduction: 2.4,
    maturation: 0.32,
    radius: 0.38,
    radiusEnergy: 0.32,
    lifespan: 4.2,
  },
  bush: {
    maxEnergy: 1.18,
    growthRate: 1.05,
    spread: 1.12,
    reproduction: 1.28,
    maturation: 0.82,
    radius: 1.15,
    radiusEnergy: 1.05,
    lifespan: 3.4,
  },
  tree: {
    maxEnergy: 2.4,
    growthRate: 1.1,
    spread: 0.68,
    reproduction: 0.62,
    maturation: 1.05,
    radius: 2.1,
    radiusEnergy: 5.2,
    lifespan: 4.5,
  },
}

/** Total budget-gene points available to each lineage (8 shared traits). */
export const PLANT_KIND_BUDGET_TOTAL: Record<PlantKind, number> = {
  grass: 1080,
  bush: 1320,
  tree: 2160,
}

export const PLANT_KIND_LABEL: Record<PlantKind, string> = {
  grass: 'Grass',
  bush: 'Deciduous',
  tree: 'Conifer',
}

const PLANT_KIND_ORDER: readonly PlantKind[] = ['grass', 'bush', 'tree']

/** Relative budget weights per PLANT_BUDGET_GENES slot — templates only, offspring mutate freely. */
const PLANT_KIND_BUDGET_WEIGHTS: Record<PlantKind, readonly number[]> = {
  grass: [0.55, 2.5, 2.8, 3.0, 0.45, 3.0, 0.35, 1.05, 0.12],
  bush: [1.1, 1.05, 1.0, 1.05, 0.85, 1.15, 1.45, 1.25, 0.45],
  tree: [2.4, 0.85, 0.38, 0.42, 1.1, 0.38, 3.4, 1.35, 0.42],
}

const PLANT_KIND_COSMETICS: Record<
  PlantKind,
  Partial<Record<(typeof PlantGene)[keyof typeof PlantGene], number>>
> = {
  grass: {
    [PlantGene.GreenHue]: 98,
    [PlantGene.Saturation]: 155,
    [PlantGene.Lightness]: 195,
    [PlantGene.LeafLobes]: 18,
    [PlantGene.LeafPointiness]: 210,
    [PlantGene.MutationRate]: 52,
    [PlantGene.MutationAmount]: 45,
  },
  bush: {
    [PlantGene.GreenHue]: 78,
    [PlantGene.Saturation]: 128,
    [PlantGene.Lightness]: 128,
    [PlantGene.LeafLobes]: 72,
    [PlantGene.LeafPointiness]: 45,
    [PlantGene.MutationRate]: 42,
    [PlantGene.MutationAmount]: 45,
  },
  tree: {
    [PlantGene.GreenHue]: 48,
    [PlantGene.Saturation]: 72,
    [PlantGene.Lightness]: 38,
    [PlantGene.LeafLobes]: 140,
    [PlantGene.LeafPointiness]: 28,
    [PlantGene.MutationRate]: 36,
    [PlantGene.MutationAmount]: 38,
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
  const dna = new Uint8Array(PLANT_GENE_COUNT)
  dna[PlantGene.Kind] = PLANT_KIND_GENE[kind]

  const cosmetics = PLANT_KIND_COSMETICS[kind]
  for (const [geneKey, value] of Object.entries(cosmetics)) {
    const gene = Number(geneKey)
    dna[gene] = jitterGene(rng, value)
  }

  applyPlantKindClimate(dna, kind)

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
  applyPlantKindClimate(dna, kind)
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
