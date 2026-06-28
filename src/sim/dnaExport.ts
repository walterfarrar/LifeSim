import { HERBIVORE_GENE_COUNT } from './genes'
import { cloneDNA, type DNA } from './dna'
import { normalizeHerbivoreGenes } from './genomeNormalize'
import type { Creature } from './types'

export type SavedGenome = {
  id: string
  name: string
  savedAt: string
  geneCount: number
  genes: number[]
  sex: Creature['sex']
  sourceCreatureId: number
  ageTicks: number
  energy: number
}

const LIBRARY_KEY = 'lifesim-saved-dna'

export function dnaToGeneArray(dna: DNA): number[] {
  return Array.from(dna)
}

export function geneArrayToDna(genes: number[]): DNA {
  const normalized = normalizeHerbivoreGenes(genes)
  const dna = new Uint8Array(normalized.length)
  for (let i = 0; i < normalized.length; i++) {
    dna[i] = normalized[i]
  }
  return dna
}

export function creatureToSavedGenome(creature: Creature, name?: string): SavedGenome {
  return {
    id: `genome-${Date.now()}-${creature.id}`,
    name: name?.trim() || `Champion #${creature.id}`,
    savedAt: new Date().toISOString(),
    geneCount: creature.dna.length,
    genes: dnaToGeneArray(creature.dna),
    sex: creature.sex,
    sourceCreatureId: creature.id,
    ageTicks: creature.age,
    energy: creature.energy,
  }
}

export function savedGenomeToDna(saved: SavedGenome): DNA {
  if (saved.genes.length === 0 || saved.genes.length > HERBIVORE_GENE_COUNT) {
    throw new Error(`Expected 1–${HERBIVORE_GENE_COUNT} genes, got ${saved.genes.length}`)
  }
  return cloneDNA(geneArrayToDna(saved.genes))
}

export function parseSavedGenome(json: string): SavedGenome {
  const raw = JSON.parse(json) as Partial<SavedGenome>
  if (!Array.isArray(raw.genes) || raw.genes.length === 0) {
    throw new Error('Invalid genome: missing genes array')
  }
  return {
    id: String(raw.id ?? `genome-${Date.now()}`),
    name: String(raw.name ?? 'Saved creature'),
    savedAt: String(raw.savedAt ?? new Date().toISOString()),
    geneCount: raw.genes.length,
    genes: raw.genes.map((g) => Number(g)),
    sex: raw.sex === 'female' ? 'female' : 'male',
    sourceCreatureId: Number(raw.sourceCreatureId ?? 0),
    ageTicks: Number(raw.ageTicks ?? 0),
    energy: Number(raw.energy ?? 0),
  }
}

export function serializeSavedGenome(saved: SavedGenome): string {
  return JSON.stringify(saved, null, 2)
}

export function getSavedGenomeById(id: string): SavedGenome | undefined {
  return loadSavedGenomeLibrary().find((item) => item.id === id)
}

export function loadSavedGenomeLibrary(): SavedGenome[] {
  try {
    const stored = localStorage.getItem(LIBRARY_KEY)
    if (!stored) return []
    const parsed = JSON.parse(stored) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) => parseSavedGenome(JSON.stringify(item)))
  } catch {
    return []
  }
}

export function saveToGenomeLibrary(saved: SavedGenome): SavedGenome[] {
  const library = loadSavedGenomeLibrary()
  const next = [saved, ...library.filter((item) => item.id !== saved.id)].slice(0, 24)
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(next))
  return next
}

export function removeFromGenomeLibrary(id: string): SavedGenome[] {
  const next = loadSavedGenomeLibrary().filter((item) => item.id !== id)
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(next))
  return next
}

export async function copyGenomeToClipboard(saved: SavedGenome): Promise<void> {
  await navigator.clipboard.writeText(serializeSavedGenome(saved))
}

export function downloadGenomeFile(saved: SavedGenome): void {
  const blob = new Blob([serializeSavedGenome(saved)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const slug = saved.name.replace(/[^\w\-]+/g, '-').replace(/^-|-$/g, '') || 'creature'
  anchor.href = url
  anchor.download = `${slug}-dna.json`
  anchor.click()
  URL.revokeObjectURL(url)
}
