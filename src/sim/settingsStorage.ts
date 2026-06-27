import { validFounderGenomeIds } from './founderGenomes'
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
    creatureGroups: clamp(Math.round(raw.creatureGroups ?? base.creatureGroups), 1, 8),
    herbivoresPerGroup: clamp(Math.round(raw.herbivoresPerGroup ?? base.herbivoresPerGroup), 2, 80),
    initialPlants: clamp(Math.round(raw.initialPlants ?? base.initialPlants), 0, 2000),
    maxPlants: clamp(Math.round(raw.maxPlants ?? base.maxPlants), 50, 5000),
    plantSpawnChance: clamp(Number(raw.plantSpawnChance ?? base.plantSpawnChance), 0, 0.2),
    plantWindSpawnChance: clamp(Number(raw.plantWindSpawnChance ?? base.plantWindSpawnChance), 0, 0.5),
    plantLowCountBoost: clamp(Math.round(raw.plantLowCountBoost ?? base.plantLowCountBoost), 0, 200),
    founderGeneSpread: clamp(Math.round(raw.founderGeneSpread ?? base.founderGeneSpread), 1, 40),
    founderJitterChance: clamp(Number(raw.founderJitterChance ?? base.founderJitterChance), 0, 1),
    founderPreferenceNoise: clamp(Math.round(raw.founderPreferenceNoise ?? base.founderPreferenceNoise), 0, 40),
    groupFounders: sanitizeGroupFounders(raw.groupFounders, validGenomeIds),
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
