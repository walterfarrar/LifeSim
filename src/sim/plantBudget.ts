import type { DNA } from './dna'
import { PlantGene, type PlantGeneIndex } from './genes'
import type { Rng } from './rng'

/** Gameplay traits that share a fixed point pool — raising one lowers the others. */
export const PLANT_BUDGET_GENES: readonly PlantGeneIndex[] = [
  PlantGene.MaxEnergy,
  PlantGene.GrowthRate,
  PlantGene.SpreadMin,
  PlantGene.SpreadMax,
  PlantGene.Maturation,
  PlantGene.Reproduction,
  PlantGene.BaseRadius,
  PlantGene.Hardiness,
] as const

/** Sum of all budget-gene values (8 genes × 127 ≈ former independent midpoints). */
export const PLANT_BUDGET_TOTAL = PLANT_BUDGET_GENES.length * 127

export const PLANT_BUDGET_MIN = 20
export const PLANT_BUDGET_MAX = 200

const BUDGET_GENE_SET = new Set<number>(PLANT_BUDGET_GENES)

export function isPlantBudgetGene(index: number): boolean {
  return BUDGET_GENE_SET.has(index)
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

/** Randomly split the shared pool across budget genes (each gets at least PLANT_BUDGET_MIN). */
function randomBudgetAllocation(rng: Rng): number[] {
  const count = PLANT_BUDGET_GENES.length
  const reserved = PLANT_BUDGET_MIN * count
  const remaining = PLANT_BUDGET_TOTAL - reserved
  const weights = Array.from({ length: count }, () => rng.range(0.05, 1))
  const weightSum = weights.reduce((acc, w) => acc + w, 0)

  const values = weights.map((w) => PLANT_BUDGET_MIN + Math.floor((w / weightSum) * remaining))
  rebalanceBudgetValues(values, rng)
  return values
}

function equalBudgetAllocation(): number[] {
  const count = PLANT_BUDGET_GENES.length
  const values = Array.from({ length: count }, () => Math.floor(PLANT_BUDGET_TOTAL / count))
  rebalanceBudgetValues(values)
  return values
}

/** Nudge values so they sum to PLANT_BUDGET_TOTAL while respecting min/max. */
function rebalanceBudgetValues(values: number[], rng?: Rng): void {
  for (let i = 0; i < values.length; i++) {
    values[i] = Math.max(PLANT_BUDGET_MIN, Math.min(PLANT_BUDGET_MAX, values[i]))
  }

  let guard = 0
  let slot = 0
  while (guard++ < 4096) {
    const sum = values.reduce((acc, v) => acc + v, 0)
    const delta = PLANT_BUDGET_TOTAL - sum
    if (delta === 0) return

    if (delta > 0) {
      const candidates = values
        .map((value, index) => ({ index, headroom: PLANT_BUDGET_MAX - value }))
        .filter((entry) => entry.headroom > 0)
      if (candidates.length === 0) return
      const pick = rng ? rng.pick(candidates) : candidates[slot % candidates.length]
      values[pick.index] += 1
      slot += 1
      continue
    }

    const candidates = values
      .map((value, index) => ({ index, slack: value - PLANT_BUDGET_MIN }))
      .filter((entry) => entry.slack > 0)
    if (candidates.length === 0) return
    const pick = rng ? rng.pick(candidates) : candidates[slot % candidates.length]
    values[pick.index] -= 1
    slot += 1
  }
}

/** Scale or redistribute budget genes so their sum matches PLANT_BUDGET_TOTAL. */
export function normalizePlantBudget(dna: DNA): void {
  const values = PLANT_BUDGET_GENES.map((gene) => dna[gene])
  const sum = values.reduce((acc, v) => acc + v, 0)

  if (sum <= 0) {
    const fresh = equalBudgetAllocation()
    PLANT_BUDGET_GENES.forEach((gene, index) => {
      dna[gene] = fresh[index]
    })
    return
  }

  if (sum !== PLANT_BUDGET_TOTAL) {
    const scaled = values.map((value) => (value / sum) * PLANT_BUDGET_TOTAL)
    for (let i = 0; i < values.length; i++) {
      values[i] = Math.round(scaled[i])
    }
  }

  rebalanceBudgetValues(values)

  PLANT_BUDGET_GENES.forEach((gene, index) => {
    dna[gene] = clampByte(values[index])
  })
}

export function createRandomPlantDNA(rng: Rng): DNA {
  const dna = new Uint8Array(15)
  for (let i = 0; i < dna.length; i++) {
    if (!isPlantBudgetGene(i)) {
      dna[i] = rng.int(0, 255)
    }
  }

  const allocation = randomBudgetAllocation(rng)
  PLANT_BUDGET_GENES.forEach((gene, index) => {
    dna[gene] = allocation[index]
  })

  return dna
}

/** Move points from one budget gene to another — total pool stays fixed. */
export function transferPlantBudget(dna: DNA, rng: Rng, maxAmount: number): boolean {
  const amount = Math.max(1, rng.int(1, maxAmount))
  const fromSlot = rng.int(0, PLANT_BUDGET_GENES.length - 1)
  let toSlot = rng.int(0, PLANT_BUDGET_GENES.length - 1)
  if (toSlot === fromSlot) {
    toSlot = (toSlot + 1) % PLANT_BUDGET_GENES.length
  }

  const fromGene = PLANT_BUDGET_GENES[fromSlot]
  const toGene = PLANT_BUDGET_GENES[toSlot]
  const transferable = Math.min(
    amount,
    dna[fromGene] - PLANT_BUDGET_MIN,
    PLANT_BUDGET_MAX - dna[toGene],
  )
  if (transferable <= 0) return false

  dna[fromGene] -= transferable
  dna[toGene] += transferable
  return true
}
