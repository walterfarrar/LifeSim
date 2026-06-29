import {
  DEFAULT_CLOSE_MATE_LENIENCY_GENE,
  DEFAULT_COHESION_GENE,
  DEFAULT_COURTSHIP_EAGERNESS_GENE,
  HERBIVORE_GENE_COUNT,
  PLANT_GENE_COUNT,
  PATHOGEN_GENE_COUNT,
  HerbivoreGene,
} from './genes'
import { normalizeHerbivoreBudget } from './herbivoreBudget'
import { normalizePlantBudget } from './plantBudget'

/** Pad or trim saved genomes so older champions still load; enforce trait budget. */
export function normalizeHerbivoreGenes(genes: number[]): number[] {
  const out = genes.slice(0, HERBIVORE_GENE_COUNT).map((g) => Math.max(0, Math.min(255, Math.round(g))))
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
  const dna = new Uint8Array(out)
  normalizeHerbivoreBudget(dna)
  return Array.from(dna)
}

/** Pad or trim saved plant genomes and enforce the shared trait budget. */
export function normalizePlantGenes(genes: number[]): number[] {
  const out = genes.slice(0, PLANT_GENE_COUNT).map((g) => Math.max(0, Math.min(255, Math.round(g))))
  while (out.length < PLANT_GENE_COUNT) {
    out.push(127)
  }
  const dna = new Uint8Array(out)
  normalizePlantBudget(dna)
  return Array.from(dna)
}

/** Pad or trim saved pathogen genomes. */
export function normalizePathogenGenes(genes: number[]): number[] {
  const out = genes.slice(0, PATHOGEN_GENE_COUNT).map((g) => Math.max(0, Math.min(255, Math.round(g))))
  while (out.length < PATHOGEN_GENE_COUNT) {
    out.push(127)
  }
  return out
}
