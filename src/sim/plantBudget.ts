import type { DNA } from './dna'
import { PlantGene, type PlantGeneIndex } from './genes'
import { plantBudgetTotalForDna } from './plantKinds'
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

/** Bush budget — default reference total (8 genes × 160). */
export const PLANT_BUDGET_TOTAL = PLANT_BUDGET_GENES.length * 160

export const PLANT_BUDGET_MIN = 20
export const PLANT_BUDGET_MAX = 220

const BUDGET_GENE_SET = new Set<number>(PLANT_BUDGET_GENES)

export function isPlantBudgetGene(index: number): boolean {
  return BUDGET_GENE_SET.has(index)
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

/** Randomly split a point pool across budget genes (each gets at least PLANT_BUDGET_MIN). */
export function allocatePlantBudget(
  rng: Rng,
  total: number,
  weights?: readonly number[],
): number[] {
  const count = PLANT_BUDGET_GENES.length
  const reserved = PLANT_BUDGET_MIN * count
  const remaining = Math.max(0, total - reserved)
  const geneWeights =
    weights && weights.length === count
      ? weights
      : Array.from({ length: count }, () => 1)
  const weightSum = geneWeights.reduce((acc, weight) => acc + weight, 0)

  const values = geneWeights.map(
    (weight) => PLANT_BUDGET_MIN + Math.floor((weight / weightSum) * remaining),
  )
  rebalanceBudgetValues(values, total, rng)
  return values
}

function equalBudgetAllocation(total: number): number[] {
  const count = PLANT_BUDGET_GENES.length
  const values = Array.from({ length: count }, () => Math.floor(total / count))
  rebalanceBudgetValues(values, total)
  return values
}

/** Nudge values so they sum to `total` while respecting min/max. */
function rebalanceBudgetValues(values: number[], total: number, rng?: Rng): void {
  for (let i = 0; i < values.length; i++) {
    values[i] = Math.max(PLANT_BUDGET_MIN, Math.min(PLANT_BUDGET_MAX, values[i]))
  }

  let guard = 0
  let slot = 0
  while (guard++ < 4096) {
    const sum = values.reduce((acc, value) => acc + value, 0)
    const delta = total - sum
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

/** Scale or redistribute budget genes so their sum matches the lineage pool size. */
export function normalizePlantBudget(dna: DNA, total?: number): void {
  const budgetTotal = total ?? plantBudgetTotalForDna(dna)
  const values = PLANT_BUDGET_GENES.map((gene) => dna[gene])
  const sum = values.reduce((acc, value) => acc + value, 0)

  if (sum <= 0) {
    const fresh = equalBudgetAllocation(budgetTotal)
    PLANT_BUDGET_GENES.forEach((gene, index) => {
      dna[gene] = fresh[index]
    })
    return
  }

  if (sum !== budgetTotal) {
    const scaled = values.map((value) => (value / sum) * budgetTotal)
    for (let i = 0; i < values.length; i++) {
      values[i] = Math.round(scaled[i])
    }
  }

  rebalanceBudgetValues(values, budgetTotal)

  PLANT_BUDGET_GENES.forEach((gene, index) => {
    dna[gene] = clampByte(values[index])
  })
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
