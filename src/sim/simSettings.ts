import {
  DEFAULT_WORLD_HEIGHT,
  DEFAULT_WORLD_WIDTH,
  FOUNDER_GENE_JITTER_CHANCE,
  FOUNDER_GENE_SPREAD,
  INITIAL_HERBIVORES,
  PATHOGEN_CHAMPION_SPAWN_CHANCE,
  POND_BASE_RADIUS,
  POND_DEFAULT_MAX_DEPTH,
  CREATURE_FIRST_SPAWN_DELAY_YEARS,
  CREATURE_GROUP_SPAWN_INTERVAL_YEARS,
  DAY_LENGTH_SECONDS,
  DAYS_PER_SEASON_YEAR,
  scaledDefaultTotalWater,
  scaledInitialPlants,
  scaledMaxPlantsByKind,
} from './config'

export const MAX_CREATURE_GROUPS = 8

export type SimSettings = {
  worldWidth: number
  worldHeight: number
  creatureGroups: number
  herbivoresPerGroup: number
  /** Sim-years before the first founder group appears. */
  creatureFirstSpawnDelayYears: number
  /** Sim-years between each founder group introduction. */
  creatureGroupSpawnIntervalYears: number
  initialPlants: number
  maxGrassPlants: number
  maxBushPlants: number
  maxTreePlants: number
  founderGeneSpread: number
  founderJitterChance: number
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
  /** Pond width in pixels (half-width of the main basin at world gen). */
  pondBaseRadius: number
  /** Max standing water depth at the pond center in water units. */
  pondMaxDepth: number
  /** Total water units in the closed cycle at reset (pond, soil, air, living). */
  totalWater: number
  /** Real-time seconds for one full day–night cycle at 1× speed (equinox length). */
  dayLengthSeconds: number
  /** How many day–night cycles make one season year. */
  daysPerSeasonYear: number
  /** When true, an evolved neural brain drives creature movement; false = legacy goal-seeking AI. */
  brainControlEnabled: boolean
}

export type FounderSettings = Pick<
  SimSettings,
  'founderGeneSpread' | 'founderJitterChance'
>

export const DEFAULT_SIM_SETTINGS: SimSettings = {
  worldWidth: DEFAULT_WORLD_WIDTH,
  worldHeight: DEFAULT_WORLD_HEIGHT,
  creatureGroups: 3,
  herbivoresPerGroup: Math.max(4, Math.floor(INITIAL_HERBIVORES / 3)),
  creatureFirstSpawnDelayYears: CREATURE_FIRST_SPAWN_DELAY_YEARS,
  creatureGroupSpawnIntervalYears: CREATURE_GROUP_SPAWN_INTERVAL_YEARS,
  initialPlants: scaledInitialPlants(DEFAULT_WORLD_WIDTH, DEFAULT_WORLD_HEIGHT),
  ...scaledMaxPlantsByKind(DEFAULT_WORLD_WIDTH, DEFAULT_WORLD_HEIGHT),
  founderGeneSpread: FOUNDER_GENE_SPREAD,
  founderJitterChance: FOUNDER_GENE_JITTER_CHANCE,
  groupFounders: Array.from({ length: MAX_CREATURE_GROUPS }, () => ''),
  respawnBestPlantSpecies: true,
  plantFounderId: '',
  respawnBestPathogen: true,
  pathogenChampionSpawnChance: PATHOGEN_CHAMPION_SPAWN_CHANCE,
  pathogenFounderId: '',
  pondBaseRadius: POND_BASE_RADIUS,
  pondMaxDepth: POND_DEFAULT_MAX_DEPTH,
  totalWater: scaledDefaultTotalWater(DEFAULT_WORLD_WIDTH, DEFAULT_WORLD_HEIGHT),
  dayLengthSeconds: DAY_LENGTH_SECONDS,
  daysPerSeasonYear: DAYS_PER_SEASON_YEAR,
  brainControlEnabled: true,
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
