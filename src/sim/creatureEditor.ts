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

/** Unspent budget points while editing (negative = over capacity). */
export function herbivoreBudgetRemaining(genes: readonly number[]): number {
  return HERBIVORE_BUDGET_TOTAL - herbivoreBudgetSum(genes)
}

export function isEditorBudgetValid(genes: readonly number[]): boolean {
  return herbivoreBudgetRemaining(genes) >= 0
}

/** Clamp and pad editor genes without rebalancing the shared budget pool. */
export function clampEditorGenes(genes: number[]): number[] {
  const out = genes.slice(0, HERBIVORE_GENE_COUNT).map((g) => clampByte(g))
  while (out.length < HERBIVORE_GENE_COUNT) {
    const index = out.length
    if (index === HerbivoreGene.CourtshipEagerness) {
      out.push(DEFAULT_COURTSHIP_EAGERNESS_GENE)
    } else if (index === HerbivoreGene.CloseMateLeniency) {
      out.push(DEFAULT_CLOSE_MATE_LENIENCY_GENE)
    } else if (index === HerbivoreGene.Cohesion) {
      out.push(DEFAULT_COHESION_GENE)
    } else {
      out.push(127)
    }
  }
  return out
}

/** Set one budget gene independently — pool remaining updates, no auto-transfer. */
export function setHerbivoreBudgetGeneValue(genes: number[], geneIndex: number, rawValue: number): number[] {
  const next = genes.slice()
  next[geneIndex] = Math.max(HERBIVORE_BUDGET_MIN, Math.min(HERBIVORE_BUDGET_MAX, Math.round(rawValue)))
  return next
}

export function normalizeEditorGenes(genes: number[]): number[] {
  return clampEditorGenes(genes)
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
