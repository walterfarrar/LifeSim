import { validFounderGenomeIds } from './founderGenomes'
import {
  clampWorldHeight,
  clampWorldWidth,
} from './worldBounds'
import {
  cloneSettings,
  DEFAULT_SIM_SETTINGS,
  MAX_CREATURE_GROUPS,
  type SimSettings,
} from './simSettings'

const STORAGE_KEY = 'lifesim-settings'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function sanitizeGroupFounders(raw: unknown, validIds: Set<string>): string[] {
  const arr = Array.isArray(raw) ? raw : []
  return Array.from({ length: MAX_CREATURE_GROUPS }, (_, i) => {
    const id = String(arr[i] ?? '').trim()
    return id && validIds.has(id) ? id : ''
  })
}

function sanitizeSettings(raw: Partial<SimSettings>): SimSettings {
  const base = DEFAULT_SIM_SETTINGS
  const validGenomeIds = validFounderGenomeIds()
  return {
    worldWidth: clampWorldWidth(Number(raw.worldWidth ?? base.worldWidth)),
    worldHeight: clampWorldHeight(Number(raw.worldHeight ?? base.worldHeight)),
    creatureGroups: clamp(Math.round(raw.creatureGroups ?? base.creatureGroups), 1, 8),
    herbivoresPerGroup: clamp(Math.round(raw.herbivoresPerGroup ?? base.herbivoresPerGroup), 2, 80),
    initialPlants: clamp(Math.round(raw.initialPlants ?? base.initialPlants), 0, 2000),
    maxPlants: clamp(Math.round(raw.maxPlants ?? base.maxPlants), 50, 5000),
    founderGeneSpread: clamp(Math.round(raw.founderGeneSpread ?? base.founderGeneSpread), 1, 40),
    founderJitterChance: clamp(Number(raw.founderJitterChance ?? base.founderJitterChance), 0, 1),
    founderPreferenceNoise: clamp(Math.round(raw.founderPreferenceNoise ?? base.founderPreferenceNoise), 0, 40),
    groupFounders: sanitizeGroupFounders(raw.groupFounders, validGenomeIds),
    respawnBestPlantSpecies: raw.respawnBestPlantSpecies !== false,
    plantFounderId: '',
    respawnBestPathogen: raw.respawnBestPathogen !== false,
    pathogenChampionSpawnChance: clamp(
      Number(raw.pathogenChampionSpawnChance ?? base.pathogenChampionSpawnChance),
      0,
      1,
    ),
    pathogenFounderId: '',
  }
}

export function loadSimSettings(): SimSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return cloneSettings(DEFAULT_SIM_SETTINGS)
    return sanitizeSettings(JSON.parse(stored) as Partial<SimSettings>)
  } catch {
    return cloneSettings(DEFAULT_SIM_SETTINGS)
  }
}

export function saveSimSettings(settings: SimSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeSettings(settings)))
  } catch {
    // ignore quota / private mode errors
  }
}
