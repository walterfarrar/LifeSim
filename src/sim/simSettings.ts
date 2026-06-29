import {
  DEFAULT_WORLD_HEIGHT,
  DEFAULT_WORLD_WIDTH,
  FOUNDER_GENE_JITTER_CHANCE,
  FOUNDER_GENE_SPREAD,
  FOUNDER_PREFERENCE_NOISE,
  INITIAL_HERBIVORES,
  INITIAL_PLANTS,
  MAX_PLANTS,
  PATHOGEN_CHAMPION_SPAWN_CHANCE,
  PLANT_LOW_COUNT_BOOST,
  PLANT_SPAWN_CHANCE,
  PLANT_WIND_SPAWN_CHANCE,
} from './config'

export const MAX_CREATURE_GROUPS = 8

export type SimSettings = {
  worldWidth: number
  worldHeight: number
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
  /** Include the saved best pathogen in the pool at reset. */
  respawnBestPathogen: boolean
  /** Chance per check to reintroduce a hall pathogen mid-run (0–1). */
  pathogenChampionSpawnChance: number
  /** Saved pathogen genome id; empty = use auto pathogen champion. */
  pathogenFounderId: string
}

export type FounderSettings = Pick<
  SimSettings,
  'founderGeneSpread' | 'founderJitterChance' | 'founderPreferenceNoise'
>

export const DEFAULT_SIM_SETTINGS: SimSettings = {
  worldWidth: DEFAULT_WORLD_WIDTH,
  worldHeight: DEFAULT_WORLD_HEIGHT,
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
  respawnBestPathogen: true,
  pathogenChampionSpawnChance: PATHOGEN_CHAMPION_SPAWN_CHANCE,
  pathogenFounderId: '',
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
