import type { DNA } from './dna'
import { HerbivoreGene, HERBIVORE_GENE_COUNT, type HerbivoreGeneIndex } from './genes'
import type { Rng } from './rng'

/** Core gameplay traits that share a fixed point pool — raising one lowers the others. */
export const HERBIVORE_BUDGET_GENES: readonly HerbivoreGeneIndex[] = [
  HerbivoreGene.Speed,
  HerbivoreGene.Size,
  HerbivoreGene.Metabolism,
  HerbivoreGene.Vision,
  HerbivoreGene.ForageEfficiency,
  HerbivoreGene.MaxEnergy,
  HerbivoreGene.ReproThreshold,
  HerbivoreGene.MaxAge,
  HerbivoreGene.BitePower,
  HerbivoreGene.ForageReach,
  HerbivoreGene.SpaceTolerance,
  HerbivoreGene.Wanderlust,
  HerbivoreGene.Cohesion,
  HerbivoreGene.Aggressiveness,
  HerbivoreGene.DiseaseResistance,
  HerbivoreGene.MateRange,
] as const

export const HERBIVORE_BUDGET_TOTAL = HERBIVORE_BUDGET_GENES.length * 127

export const HERBIVORE_BUDGET_MIN = 20
export const HERBIVORE_BUDGET_MAX = 220

const BUDGET_GENE_SET = new Set<number>(HERBIVORE_BUDGET_GENES)

export function isHerbivoreBudgetGene(index: number): boolean {
  return BUDGET_GENE_SET.has(index)
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function randomBudgetAllocation(rng: Rng): number[] {
  const count = HERBIVORE_BUDGET_GENES.length
  const reserved = HERBIVORE_BUDGET_MIN * count
  const remaining = HERBIVORE_BUDGET_TOTAL - reserved
  const weights = Array.from({ length: count }, () => rng.range(0.05, 1))
  const weightSum = weights.reduce((acc, w) => acc + w, 0)

  const values = weights.map((w) => HERBIVORE_BUDGET_MIN + Math.floor((w / weightSum) * remaining))
  rebalanceBudgetValues(values, rng)
  return values
}

function equalBudgetAllocation(): number[] {
  const count = HERBIVORE_BUDGET_GENES.length
  const values = Array.from({ length: count }, () => Math.floor(HERBIVORE_BUDGET_TOTAL / count))
  rebalanceBudgetValues(values)
  return values
}

function rebalanceBudgetValues(values: number[], rng?: Rng): void {
  for (let i = 0; i < values.length; i++) {
    values[i] = Math.max(HERBIVORE_BUDGET_MIN, Math.min(HERBIVORE_BUDGET_MAX, values[i]))
  }

  let guard = 0
  let slot = 0
  while (guard++ < 8192) {
    const sum = values.reduce((acc, v) => acc + v, 0)
    const delta = HERBIVORE_BUDGET_TOTAL - sum
    if (delta === 0) return

    if (delta > 0) {
      const candidates = values
        .map((value, index) => ({ index, headroom: HERBIVORE_BUDGET_MAX - value }))
        .filter((entry) => entry.headroom > 0)
      if (candidates.length === 0) return
      const pick = rng ? rng.pick(candidates) : candidates[slot % candidates.length]
      values[pick.index] += 1
      slot += 1
      continue
    }

    const candidates = values
      .map((value, index) => ({ index, slack: value - HERBIVORE_BUDGET_MIN }))
      .filter((entry) => entry.slack > 0)
    if (candidates.length === 0) return
    const pick = rng ? rng.pick(candidates) : candidates[slot % candidates.length]
    values[pick.index] -= 1
    slot += 1
  }
}

export function normalizeHerbivoreBudget(dna: DNA): void {
  const values = HERBIVORE_BUDGET_GENES.map((gene) => dna[gene])
  const sum = values.reduce((acc, v) => acc + v, 0)

  if (sum <= 0) {
    const fresh = equalBudgetAllocation()
    HERBIVORE_BUDGET_GENES.forEach((gene, index) => {
      dna[gene] = fresh[index]
    })
    return
  }

  if (sum !== HERBIVORE_BUDGET_TOTAL) {
    const scaled = values.map((value) => (value / sum) * HERBIVORE_BUDGET_TOTAL)
    for (let i = 0; i < values.length; i++) {
      values[i] = Math.round(scaled[i])
    }
  }

  rebalanceBudgetValues(values)

  HERBIVORE_BUDGET_GENES.forEach((gene, index) => {
    dna[gene] = clampByte(values[index])
  })
}

export function createRandomHerbivoreDNA(rng: Rng): DNA {
  const dna = new Uint8Array(HERBIVORE_GENE_COUNT)
  for (let i = 0; i < dna.length; i++) {
    if (!isHerbivoreBudgetGene(i)) {
      dna[i] = rng.int(0, 255)
    }
  }

  const allocation = randomBudgetAllocation(rng)
  HERBIVORE_BUDGET_GENES.forEach((gene, index) => {
    dna[gene] = allocation[index]
  })

  return dna
}

export function transferHerbivoreBudget(dna: DNA, rng: Rng, maxAmount: number): boolean {
  const amount = Math.max(1, rng.int(1, maxAmount))
  const fromSlot = rng.int(0, HERBIVORE_BUDGET_GENES.length - 1)
  let toSlot = rng.int(0, HERBIVORE_BUDGET_GENES.length - 1)
  if (toSlot === fromSlot) {
    toSlot = (toSlot + 1) % HERBIVORE_BUDGET_GENES.length
  }

  const fromGene = HERBIVORE_BUDGET_GENES[fromSlot]
  const toGene = HERBIVORE_BUDGET_GENES[toSlot]
  const transferable = Math.min(
    amount,
    dna[fromGene] - HERBIVORE_BUDGET_MIN,
    HERBIVORE_BUDGET_MAX - dna[toGene],
  )
  if (transferable <= 0) return false

  dna[fromGene] -= transferable
  dna[toGene] += transferable
  return true
}
