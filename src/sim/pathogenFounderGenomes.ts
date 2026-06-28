import type { DNA } from './dna'
import {
  AUTO_PATHOGEN_CHAMPION_GENOME_ID,
  loadAutoPathogenChampionRecord,
  loadPathogenChampionHall,
  type AutoPathogenChampionRecord,
} from './pathogenAutoChampion'
import { savedPathogenGenomeToDna, type SavedPathogenGenome } from './pathogenDnaExport'
import type { Rng } from './rng'
import type { SimSettings } from './simSettings'

/** Weight top-ranked hall entries when reintroducing during play. */
const HALL_SPAWN_WEIGHTS = [0.45, 0.25, 0.15, 0.1, 0.05]

export function getPathogenFounderGenomeById(id: string): SavedPathogenGenome | undefined {
  if (id === AUTO_PATHOGEN_CHAMPION_GENOME_ID) {
    return loadAutoPathogenChampionRecord()?.genome
  }
  return loadPathogenChampionHall().find((entry) => entry.genome.id === id)?.genome
}

/** Exact champion DNA for reset — null if disabled or no hall yet. */
export function resolvePathogenChampionDna(settings: SimSettings): DNA | null {
  if (!settings.respawnBestPathogen) return null

  const id = settings.pathogenFounderId.trim() || AUTO_PATHOGEN_CHAMPION_GENOME_ID
  const saved = getPathogenFounderGenomeById(id)
  if (!saved) return null

  try {
    return savedPathogenGenomeToDna(saved)
  } catch {
    return null
  }
}

export function pickPathogenChampionEntry(rng: Rng): AutoPathogenChampionRecord | null {
  const hall = loadPathogenChampionHall()
  if (hall.length === 0) return null

  const candidates = hall.slice(0, 5)
  const totalWeight = candidates.reduce(
    (sum, _, index) => sum + (HALL_SPAWN_WEIGHTS[index] ?? 0.05),
    0,
  )
  let roll = rng.next() * totalWeight

  for (let index = 0; index < candidates.length; index++) {
    roll -= HALL_SPAWN_WEIGHTS[index] ?? 0.05
    if (roll <= 0) return candidates[index]
  }

  return candidates[0]
}

/** DNA from a weighted hall pick — used for mid-run reintroduction. */
export function pickPathogenChampionDna(rng: Rng): DNA | null {
  const entry = pickPathogenChampionEntry(rng)
  if (!entry) return null
  try {
    return savedPathogenGenomeToDna(entry.genome)
  } catch {
    return null
  }
}
