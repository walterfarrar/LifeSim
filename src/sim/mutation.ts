import type { DNA } from './dna'
import { LARGE_MUTATION_CHANCE } from './config'
import { cloneDNA, geneValue } from './dna'
import { HerbivoreGene, PlantGene } from './genes'
import { isHerbivoreBudgetGene, transferHerbivoreBudget } from './herbivoreBudget'
import { isPlantBudgetGene, normalizePlantBudget, transferPlantBudget } from './plantBudget'
import { applyPlantKindClimate } from './plantClimate'
import { PLANT_KIND_GENE, plantKindFromDna } from './plantKinds'
import type { Rng } from './rng'

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function mutationParams(dna: DNA): {
  perGeneRate: number
  smallAmount: number
  largeAmount: number
} {
  const rateGene = geneValue(dna, HerbivoreGene.MutationRate)
  const amountGene = geneValue(dna, HerbivoreGene.MutationAmount)
  const smallAmount = 1 + Math.floor(amountGene * 7)
  return {
    perGeneRate: 0.00035 + rateGene * 0.0115,
    smallAmount,
    largeAmount: smallAmount + 3 + Math.floor(amountGene * 22),
  }
}

function nonZeroSmallDelta(rng: Rng, maxAmount: number): number {
  const bound = Math.max(1, maxAmount)
  let delta = rng.int(-bound, bound)
  if (delta === 0) {
    delta = rng.chance(0.5) ? 1 : -1
  }
  return delta
}

/**
 * Apply birth mutations using the offspring's own mutation genes.
 * Small nudges are the norm; large jumps are very rare.
 */
export function mutate(dna: DNA, rng: Rng): DNA {
  const next = cloneDNA(dna)
  const { perGeneRate, smallAmount, largeAmount } = mutationParams(next)

  for (let i = 0; i < next.length; i++) {
    if (isHerbivoreBudgetGene(i)) continue
    if (!rng.chance(perGeneRate)) continue

    const delta = rng.chance(LARGE_MUTATION_CHANCE)
      ? rng.int(-largeAmount, largeAmount)
      : nonZeroSmallDelta(rng, smallAmount)

    next[i] = clampByte(next[i] + delta)
  }

  if (rng.chance(perGeneRate)) {
    const amount = rng.chance(LARGE_MUTATION_CHANCE) ? largeAmount : smallAmount
    transferHerbivoreBudget(next, rng, amount)
  }

  return next
}

function plantMutationParams(dna: DNA): {
  perGeneRate: number
  smallAmount: number
  largeAmount: number
} {
  const rateGene = geneValue(dna, PlantGene.MutationRate)
  const amountGene = geneValue(dna, PlantGene.MutationAmount)
  const smallAmount = 1 + Math.floor(amountGene * 8)
  return {
    perGeneRate: 0.0008 + rateGene * 0.018,
    smallAmount,
    largeAmount: smallAmount + 3 + Math.floor(amountGene * 24),
  }
}

/** Asexual offspring mutations — parent mutation genes set the rate. Kind stays fixed. */
export function mutatePlant(dna: DNA, rng: Rng): DNA {
  const next = cloneDNA(dna)
  const parentKind = plantKindFromDna(dna)
  const kindGene = dna.length > PlantGene.Kind ? dna[PlantGene.Kind] : PLANT_KIND_GENE[parentKind]
  const { perGeneRate, smallAmount, largeAmount } = plantMutationParams(next)

  for (let i = 0; i < next.length; i++) {
    if (i === PlantGene.Kind) continue
    if (i === PlantGene.MoistureNeed) continue
    if (i === PlantGene.TempPreference) continue
    if (i === PlantGene.TempGrowthRange) continue
    if (i === PlantGene.TempSurvivalRange) continue
    if (isPlantBudgetGene(i)) continue
    if (!rng.chance(perGeneRate)) continue

    const delta = rng.chance(LARGE_MUTATION_CHANCE)
      ? rng.int(-largeAmount, largeAmount)
      : nonZeroSmallDelta(rng, smallAmount)

    next[i] = clampByte(next[i] + delta)
  }

  if (rng.chance(perGeneRate)) {
    const amount = rng.chance(LARGE_MUTATION_CHANCE) ? largeAmount : smallAmount
    transferPlantBudget(next, rng, amount)
  }

  next[PlantGene.Kind] = kindGene
  normalizePlantBudget(next)
  next[PlantGene.Kind] = kindGene
  applyPlantKindClimate(next, parentKind)
  return next
}
