import { HERBIVORE_GENE_COUNT } from './genes'
import { normalizeHerbivoreGenes } from './genomeNormalize'
import { savedGenomeToDna, loadSavedGenomeLibrary, type SavedGenome } from './dnaExport'
import {
  AUTO_CHAMPION_GENOME_ID,
  loadAutoChampionRecord,
} from './autoChampion'
import {
  getSampleFounderGenomeById,
  SAMPLE_FOUNDER_GENOMES,
} from './sampleFounderGenomes'
import type { DNA } from './dna'

export function getFounderGenomeById(id: string): SavedGenome | undefined {
  const sample = getSampleFounderGenomeById(id)
  if (sample) return sample
  if (id === AUTO_CHAMPION_GENOME_ID) {
    return loadAutoChampionRecord()?.genome
  }
  return loadSavedGenomeLibrary().find((genome) => genome.id === id)
}

export function listFounderGenomeChoices(): SavedGenome[] {
  const auto = loadAutoChampionRecord()?.genome
  const manual = loadSavedGenomeLibrary().filter((genome) => genome.id !== AUTO_CHAMPION_GENOME_ID)
  const sampleIds = new Set(SAMPLE_FOUNDER_GENOMES.map((genome) => genome.id))
  const extraManual = manual.filter((genome) => !sampleIds.has(genome.id))
  const samples = [...SAMPLE_FOUNDER_GENOMES]
  if (auto) {
    return [auto, ...samples, ...extraManual]
  }
  return [...samples, ...extraManual]
}

export function validFounderGenomeIds(): Set<string> {
  const ids = new Set([
    ...SAMPLE_FOUNDER_GENOMES.map((genome) => genome.id),
    ...loadSavedGenomeLibrary().map((genome) => genome.id),
  ])
  if (loadAutoChampionRecord()) {
    ids.add(AUTO_CHAMPION_GENOME_ID)
  }
  return ids
}

/** Per-group founder DNA from saved library ids; null = use random founder for that group. */
export function resolveGroupFounderDnas(
  groupCount: number,
  groupFounderIds: string[],
): (DNA | null)[] {
  return Array.from({ length: groupCount }, (_, index) => {
    const id = groupFounderIds[index]?.trim()
    if (!id) return null
    const saved = getFounderGenomeById(id)
    if (!saved || saved.genes.length === 0 || saved.genes.length > HERBIVORE_GENE_COUNT) return null
    try {
      return savedGenomeToDna({ ...saved, genes: normalizeHerbivoreGenes(saved.genes) })
    } catch {
      return null
    }
  })
}
