import { validFounderGenomeIds } from './founderGenomes'
import {
  clampWorldHeight,
  clampWorldWidth,
} from './worldBounds'
import {
  MAX_DAY_LENGTH_SECONDS,
  MIN_DAY_LENGTH_SECONDS,
  MAX_DAYS_PER_SEASON_YEAR,
  MIN_DAYS_PER_SEASON_YEAR,
  MAX_CREATURE_FIRST_SPAWN_DELAY_YEARS,
  MAX_CREATURE_GROUP_SPAWN_INTERVAL_YEARS,
  MIN_CREATURE_FIRST_SPAWN_DELAY_YEARS,
  MIN_CREATURE_GROUP_SPAWN_INTERVAL_YEARS,
  MAX_PLANT_KIND_CAP,
  MIN_PLANT_KIND_CAP,
  MAX_TOTAL_WATER,
  MIN_TOTAL_WATER,
  POND_MAX_BASE_RADIUS,
  POND_MAX_MAX_DEPTH,
  POND_MIN_BASE_RADIUS,
  POND_MIN_MAX_DEPTH,
  splitLegacyMaxPlants,
} from './config'
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

function sanitizePlantKindCaps(
  raw: Partial<SimSettings> & { maxPlants?: number },
  base: SimSettings,
): Pick<SimSettings, 'maxGrassPlants' | 'maxBushPlants' | 'maxTreePlants'> {
  const clampCap = (value: number) =>
    clamp(Math.round(value), MIN_PLANT_KIND_CAP, MAX_PLANT_KIND_CAP)

  const hasPerKind =
    raw.maxGrassPlants !== undefined ||
    raw.maxBushPlants !== undefined ||
    raw.maxTreePlants !== undefined

  if (hasPerKind) {
    return {
      maxGrassPlants: clampCap(raw.maxGrassPlants ?? base.maxGrassPlants),
      maxBushPlants: clampCap(raw.maxBushPlants ?? base.maxBushPlants),
      maxTreePlants: clampCap(raw.maxTreePlants ?? base.maxTreePlants),
    }
  }

  const legacyTotal =
    typeof raw.maxPlants === 'number'
      ? raw.maxPlants
      : base.maxGrassPlants + base.maxBushPlants + base.maxTreePlants
  const split = splitLegacyMaxPlants(legacyTotal)
  return {
    maxGrassPlants: clampCap(split.maxGrassPlants),
    maxBushPlants: clampCap(split.maxBushPlants),
    maxTreePlants: clampCap(split.maxTreePlants),
  }
}

function sanitizeSettings(raw: Partial<SimSettings>): SimSettings {
  const base = DEFAULT_SIM_SETTINGS
  const validGenomeIds = validFounderGenomeIds()
  const plantCaps = sanitizePlantKindCaps(raw, base)
  return {
    worldWidth: clampWorldWidth(Number(raw.worldWidth ?? base.worldWidth)),
    worldHeight: clampWorldHeight(Number(raw.worldHeight ?? base.worldHeight)),
    creatureGroups: clamp(Math.round(raw.creatureGroups ?? base.creatureGroups), 1, 8),
    herbivoresPerGroup: clamp(Math.round(raw.herbivoresPerGroup ?? base.herbivoresPerGroup), 0, 80),
    creatureFirstSpawnDelayYears: clamp(
      Number(raw.creatureFirstSpawnDelayYears ?? base.creatureFirstSpawnDelayYears),
      MIN_CREATURE_FIRST_SPAWN_DELAY_YEARS,
      MAX_CREATURE_FIRST_SPAWN_DELAY_YEARS,
    ),
    creatureGroupSpawnIntervalYears: clamp(
      Number(raw.creatureGroupSpawnIntervalYears ?? base.creatureGroupSpawnIntervalYears),
      MIN_CREATURE_GROUP_SPAWN_INTERVAL_YEARS,
      MAX_CREATURE_GROUP_SPAWN_INTERVAL_YEARS,
    ),
    initialPlants: clamp(Math.round(raw.initialPlants ?? base.initialPlants), 0, 2000),
    ...plantCaps,
    founderGeneSpread: clamp(Math.round(raw.founderGeneSpread ?? base.founderGeneSpread), 1, 40),
    founderJitterChance: clamp(Number(raw.founderJitterChance ?? base.founderJitterChance), 0, 1),
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
    pondBaseRadius: clamp(
      Math.round(raw.pondBaseRadius ?? base.pondBaseRadius),
      POND_MIN_BASE_RADIUS,
      POND_MAX_BASE_RADIUS,
    ),
    pondMaxDepth: clamp(
      Math.round(raw.pondMaxDepth ?? base.pondMaxDepth),
      POND_MIN_MAX_DEPTH,
      POND_MAX_MAX_DEPTH,
    ),
    totalWater: clamp(Math.round(raw.totalWater ?? base.totalWater), MIN_TOTAL_WATER, MAX_TOTAL_WATER),
    dayLengthSeconds: clamp(
      Number(raw.dayLengthSeconds ?? base.dayLengthSeconds),
      MIN_DAY_LENGTH_SECONDS,
      MAX_DAY_LENGTH_SECONDS,
    ),
    daysPerSeasonYear: clamp(
      Math.round(raw.daysPerSeasonYear ?? base.daysPerSeasonYear),
      MIN_DAYS_PER_SEASON_YEAR,
      MAX_DAYS_PER_SEASON_YEAR,
    ),
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
