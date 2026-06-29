import { geneArrayToDna } from './dnaExport'
import type { SavedGenome } from './dnaExport'
import {
  DEFAULT_CLOSE_MATE_LENIENCY_GENE,
  DEFAULT_COHESION_GENE,
  DEFAULT_COURTSHIP_EAGERNESS_GENE,
  HERBIVORE_GENE_COUNT,
  HerbivoreGene,
} from './genes'
import {
  HERBIVORE_BUDGET_GENES,
  HERBIVORE_BUDGET_MAX,
  HERBIVORE_BUDGET_MIN,
  HERBIVORE_BUDGET_TOTAL,
  isHerbivoreBudgetGene,
  normalizeHerbivoreBudget,
} from './herbivoreBudget'
import { normalizeHerbivoreGenes } from './genomeNormalize'
import { expressSex } from './phenotype'

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

export function herbivoreBudgetSum(genes: readonly number[]): number {
  let sum = 0
  for (const gene of HERBIVORE_BUDGET_GENES) {
    sum += genes[gene] ?? 0
  }
  return sum
}

/** Set one budget gene and transfer points from/to siblings so the pool total stays fixed. */
export function setHerbivoreBudgetGeneValue(genes: number[], geneIndex: number, rawValue: number): number[] {
  if (!isHerbivoreBudgetGene(geneIndex)) {
    const next = genes.slice()
    next[geneIndex] = clampByte(rawValue)
    return next
  }

  const next = genes.slice()
  const target = Math.max(HERBIVORE_BUDGET_MIN, Math.min(HERBIVORE_BUDGET_MAX, Math.round(rawValue)))
  let delta = target - next[geneIndex]
  next[geneIndex] = target
  if (delta === 0) return next

  const others = HERBIVORE_BUDGET_GENES.filter((gene) => gene !== geneIndex)

  if (delta > 0) {
    while (delta > 0) {
      const donors = others
        .map((gene) => ({ gene, slack: next[gene] - HERBIVORE_BUDGET_MIN }))
        .filter((entry) => entry.slack > 0)
        .sort((a, b) => b.slack - a.slack)
      if (donors.length === 0) {
        next[geneIndex] -= delta
        break
      }
      let moved = 0
      for (const donor of donors) {
        if (delta <= 0) break
        const take = Math.min(donor.slack, delta)
        next[donor.gene] -= take
        delta -= take
        moved += take
      }
      if (moved === 0) break
    }
  } else {
    let give = -delta
    while (give > 0) {
      const receivers = others
        .map((gene) => ({ gene, headroom: HERBIVORE_BUDGET_MAX - next[gene] }))
        .filter((entry) => entry.headroom > 0)
        .sort((a, b) => b.headroom - a.headroom)
      if (receivers.length === 0) {
        next[geneIndex] += give
        break
      }
      let moved = 0
      for (const receiver of receivers) {
        if (give <= 0) break
        const add = Math.min(receiver.headroom, give)
        next[receiver.gene] += add
        give -= add
        moved += add
      }
      if (moved === 0) break
    }
  }

  return next
}

export function normalizeEditorGenes(genes: number[]): number[] {
  return normalizeHerbivoreGenes(genes)
}

export function editorGenesToDna(genes: number[]) {
  return geneArrayToDna(genes)
}

export function createDefaultEditorGenome(name = 'New creature'): SavedGenome {
  const genes = Array.from({ length: HERBIVORE_GENE_COUNT }, () => 127)
  genes[HerbivoreGene.CourtshipEagerness] = DEFAULT_COURTSHIP_EAGERNESS_GENE
  genes[HerbivoreGene.CloseMateLeniency] = DEFAULT_CLOSE_MATE_LENIENCY_GENE
  genes[HerbivoreGene.Cohesion] = DEFAULT_COHESION_GENE
  genes[HerbivoreGene.Hue] = 100
  genes[HerbivoreGene.Saturation] = 140
  genes[HerbivoreGene.SexExpression] = 200

  const dna = geneArrayToDna(genes)
  normalizeHerbivoreBudget(dna)
  const normalized = normalizeHerbivoreGenes(Array.from(dna))

  return {
    id: `genome-${Date.now()}`,
    name,
    savedAt: new Date().toISOString(),
    geneCount: normalized.length,
    genes: normalized,
    sex: expressSex(geneArrayToDna(normalized)),
    sourceCreatureId: 0,
    ageTicks: 0,
    energy: 0,
  }
}

export function cloneSavedGenome(genome: SavedGenome, overrides?: Partial<SavedGenome>): SavedGenome {
  return {
    ...genome,
    ...overrides,
    genes: [...(overrides?.genes ?? genome.genes)],
  }
}

export function savedGenomeFromGenes(
  base: Pick<SavedGenome, 'id' | 'name' | 'sourceCreatureId'>,
  genes: number[],
): SavedGenome {
  const normalized = normalizeEditorGenes(genes)
  const dna = editorGenesToDna(normalized)
  return {
    id: base.id,
    name: base.name,
    savedAt: new Date().toISOString(),
    geneCount: normalized.length,
    genes: normalized,
    sex: expressSex(dna),
    sourceCreatureId: base.sourceCreatureId,
    ageTicks: 0,
    energy: 0,
  }
}

export function setEditorGeneValue(genes: number[], geneIndex: number, value: number): number[] {
  if (isHerbivoreBudgetGene(geneIndex)) {
    return setHerbivoreBudgetGeneValue(genes, geneIndex, value)
  }
  const next = genes.slice()
  next[geneIndex] = clampByte(value)
  return next
}

export function setEditorSex(genes: number[], sex: SavedGenome['sex']): number[] {
  const next = genes.slice()
  next[HerbivoreGene.SexExpression] = sex === 'female' ? 220 : 35
  return next
}

export { HERBIVORE_BUDGET_GENES, HERBIVORE_BUDGET_TOTAL, HERBIVORE_BUDGET_MIN, HERBIVORE_BUDGET_MAX }
