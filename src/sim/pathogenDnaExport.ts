import { cloneDNA, type DNA } from './dna'
import type { Pathogen } from './disease/pathogen'
import { PATHOGEN_GENE_COUNT } from './genes'
import { normalizePathogenGenes } from './genomeNormalize'

export type SavedPathogenGenome = {
  id: string
  name: string
  savedAt: string
  geneCount: number
  genes: number[]
  sourcePathogenId: number
  generation: number
}

export function pathogenToSavedGenome(pathogen: Pathogen, name?: string): SavedPathogenGenome {
  return {
    id: `pathogen-genome-${Date.now()}-${pathogen.id}`,
    name: name?.trim() || `Pathogen strain #${pathogen.id}`,
    savedAt: new Date().toISOString(),
    geneCount: pathogen.dna.length,
    genes: Array.from(pathogen.dna),
    sourcePathogenId: pathogen.id,
    generation: pathogen.generation,
  }
}

export function geneArrayToPathogenDna(genes: number[]): DNA {
  const normalized = normalizePathogenGenes(genes)
  const dna = new Uint8Array(normalized.length)
  for (let i = 0; i < normalized.length; i++) {
    dna[i] = normalized[i]
  }
  return dna
}

export function savedPathogenGenomeToDna(saved: SavedPathogenGenome): DNA {
  if (saved.genes.length === 0 || saved.genes.length > PATHOGEN_GENE_COUNT) {
    throw new Error(`Expected 1–${PATHOGEN_GENE_COUNT} pathogen genes, got ${saved.genes.length}`)
  }
  return cloneDNA(geneArrayToPathogenDna(saved.genes))
}
