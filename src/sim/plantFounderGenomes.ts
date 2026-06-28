import type { DNA } from './dna'
import {
  AUTO_PLANT_CHAMPION_GENOME_ID,
  loadAutoPlantChampionRecord,
} from './plantAutoChampion'
import { savedPlantGenomeToDna, type SavedPlantGenome } from './plantDnaExport'
import type { SimSettings } from './simSettings'

export function getPlantFounderGenomeById(id: string): SavedPlantGenome | undefined {
  if (id === AUTO_PLANT_CHAMPION_GENOME_ID) {
    return loadAutoPlantChampionRecord()?.genome
  }
  return undefined
}

export function listPlantFounderChoices(): SavedPlantGenome[] {
  const auto = loadAutoPlantChampionRecord()?.genome
  return auto ? [auto] : []
}

/** DNA for the champion plant guaranteed on reset, if enabled and a champion exists. */
export function resolvePlantChampionDna(settings: SimSettings): DNA | null {
  if (!settings.respawnBestPlantSpecies || settings.initialPlants <= 0) return null

  const id = settings.plantFounderId.trim() || AUTO_PLANT_CHAMPION_GENOME_ID
  const saved = getPlantFounderGenomeById(id)
  if (!saved) return null

  try {
    return savedPlantGenomeToDna(saved)
  } catch {
    return null
  }
}
