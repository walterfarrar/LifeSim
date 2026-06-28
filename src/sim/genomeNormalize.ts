import {
  DEFAULT_CLOSE_MATE_LENIENCY_GENE,
  DEFAULT_COURTSHIP_EAGERNESS_GENE,
  HERBIVORE_GENE_COUNT,
  HerbivoreGene,
} from './genes'

/** Pad or trim saved genomes so older 50-gene champions still load. */
export function normalizeHerbivoreGenes(genes: number[]): number[] {
  const out = genes.slice(0, HERBIVORE_GENE_COUNT).map((g) => Math.max(0, Math.min(255, Math.round(g))))
  while (out.length < HERBIVORE_GENE_COUNT) {
    const index = out.length
    if (index === HerbivoreGene.CourtshipEagerness) {
      out.push(DEFAULT_COURTSHIP_EAGERNESS_GENE)
    } else if (index === HerbivoreGene.CloseMateLeniency) {
      out.push(DEFAULT_CLOSE_MATE_LENIENCY_GENE)
    } else {
      out.push(127)
    }
  }
  return out
}
