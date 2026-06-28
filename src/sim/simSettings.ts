import {
  FOUNDER_GENE_JITTER_CHANCE,
  FOUNDER_GENE_SPREAD,
  FOUNDER_PREFERENCE_NOISE,
  INITIAL_HERBIVORES,
  INITIAL_PLANTS,
  MAX_PLANTS,
  PLANT_LOW_COUNT_BOOST,
  PLANT_SPAWN_CHANCE,
  PLANT_WIND_SPAWN_CHANCE,
} from './config'

export const MAX_CREATURE_GROUPS = 8

export type SimSettings = {
  creatureGroups: number
  herbivoresPerGroup: number
  initialPlants: number
  maxPlants: number
  plantSpawnChance: number
  plantWindSpawnChance: number
  plantLowCountBoost: number
  founderGeneSpread: number
  founderJitterChance: number
  founderPreferenceNoise: number
  /** Saved genome id per group slot; empty string = random founder DNA. */
  groupFounders: string[]
  /** Re-seed at least one plant from the saved best species on each reset. */
  respawnBestPlantSpecies: boolean
  /** Saved plant genome id; empty = use auto plant champion. */
  plantFounderId: string
}

export type FounderSettings = Pick<
  SimSettings,
  'founderGeneSpread' | 'founderJitterChance' | 'founderPreferenceNoise'
>

export const DEFAULT_SIM_SETTINGS: SimSettings = {
  creatureGroups: 3,
  herbivoresPerGroup: Math.max(4, Math.floor(INITIAL_HERBIVORES / 3)),
  initialPlants: INITIAL_PLANTS,
  maxPlants: MAX_PLANTS,
  plantSpawnChance: PLANT_SPAWN_CHANCE,
  plantWindSpawnChance: PLANT_WIND_SPAWN_CHANCE,
  plantLowCountBoost: PLANT_LOW_COUNT_BOOST,
  founderGeneSpread: FOUNDER_GENE_SPREAD,
  founderJitterChance: FOUNDER_GENE_JITTER_CHANCE,
  founderPreferenceNoise: FOUNDER_PREFERENCE_NOISE,
  groupFounders: Array.from({ length: MAX_CREATURE_GROUPS }, () => ''),
  respawnBestPlantSpecies: true,
  plantFounderId: '',
}

export function totalStartingHerbivores(settings: SimSettings): number {
  return settings.creatureGroups * settings.herbivoresPerGroup
}

export function settingsRunKey(settings: SimSettings): string {
  return JSON.stringify(settings)
}

export function cloneSettings(settings: SimSettings): SimSettings {
  return { ...settings, groupFounders: [...settings.groupFounders] }
}
