import { PLANT_GENE_COUNT } from './genes'
import { cloneDNA, type DNA } from './dna'
import { normalizePlantGenes } from './genomeNormalize'
import type { Plant } from './types'

export type SavedPlantGenome = {
  id: string
  name: string
  savedAt: string
  geneCount: number
  genes: number[]
  sourcePlantId: number
  ageTicks: number
  energy: number
}

const LIBRARY_KEY = 'lifesim-saved-plant-dna'

export function plantToSavedGenome(plant: Plant, name?: string): SavedPlantGenome {
  return {
    id: `plant-genome-${Date.now()}-${plant.id}`,
    name: name?.trim() || `Plant species #${plant.id}`,
    savedAt: new Date().toISOString(),
    geneCount: plant.dna.length,
    genes: Array.from(plant.dna),
    sourcePlantId: plant.id,
    ageTicks: plant.age,
    energy: plant.energy,
  }
}

export function geneArrayToPlantDna(genes: number[]): DNA {
  const normalized = normalizePlantGenes(genes)
  const dna = new Uint8Array(normalized.length)
  for (let i = 0; i < normalized.length; i++) {
    dna[i] = normalized[i]
  }
  return dna
}

export function savedPlantGenomeToDna(saved: SavedPlantGenome): DNA {
  if (saved.genes.length === 0 || saved.genes.length > PLANT_GENE_COUNT) {
    throw new Error(`Expected 1–${PLANT_GENE_COUNT} plant genes, got ${saved.genes.length}`)
  }
  return cloneDNA(geneArrayToPlantDna(saved.genes))
}

export function parseSavedPlantGenome(json: string): SavedPlantGenome {
  const raw = JSON.parse(json) as Partial<SavedPlantGenome>
  if (!Array.isArray(raw.genes) || raw.genes.length === 0) {
    throw new Error('Invalid plant genome: missing genes array')
  }
  return {
    id: String(raw.id ?? `plant-genome-${Date.now()}`),
    name: String(raw.name ?? 'Saved plant'),
    savedAt: String(raw.savedAt ?? new Date().toISOString()),
    geneCount: raw.genes.length,
    genes: raw.genes.map((g) => Number(g)),
    sourcePlantId: Number(raw.sourcePlantId ?? 0),
    ageTicks: Number(raw.ageTicks ?? 0),
    energy: Number(raw.energy ?? 0),
  }
}

export function loadSavedPlantGenomeLibrary(): SavedPlantGenome[] {
  try {
    const stored = localStorage.getItem(LIBRARY_KEY)
    if (!stored) return []
    const parsed = JSON.parse(stored) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) => parseSavedPlantGenome(JSON.stringify(item)))
  } catch {
    return []
  }
}

export function saveToPlantGenomeLibrary(saved: SavedPlantGenome): SavedPlantGenome[] {
  const library = loadSavedPlantGenomeLibrary()
  const next = [saved, ...library.filter((item) => item.id !== saved.id)].slice(0, 24)
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(next))
  return next
}

export function getSavedPlantGenomeById(id: string): SavedPlantGenome | undefined {
  return loadSavedPlantGenomeLibrary().find((item) => item.id === id)
}
