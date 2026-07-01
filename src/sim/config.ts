/** World and simulation tuning — adjust here as the sim grows. */
export const DEFAULT_WORLD_WIDTH = 2200
export const DEFAULT_WORLD_HEIGHT = 1500
export const MIN_WORLD_WIDTH = 800
export const MAX_WORLD_WIDTH = 4000
export const MIN_WORLD_HEIGHT = 600
export const MAX_WORLD_HEIGHT = 3000

/** @deprecated Use settings.worldWidth or getWorldBounds().width */
export const WORLD_WIDTH = DEFAULT_WORLD_WIDTH
/** @deprecated Use settings.worldHeight or getWorldBounds().height */
export const WORLD_HEIGHT = DEFAULT_WORLD_HEIGHT

export const TICKS_PER_SECOND = 30

export const INITIAL_PLANTS = 650
export const INITIAL_HERBIVORES = 40
export const MAX_PLANTS = 1600
export const MAX_GRASS_PLANTS = 1200
export const MAX_BUSH_PLANTS = 200
export const MAX_TREE_PLANTS = 200
export const MIN_PLANT_KIND_CAP = 0
export const MAX_PLANT_KIND_CAP = 4000
/** Rare wind-borne seed when the map has zero plants (simulation constant, not a setting). */
export const PLANT_EXTINCT_WIND_RESEED_CHANCE = 0.15

export const REFERENCE_WORLD_AREA = DEFAULT_WORLD_WIDTH * DEFAULT_WORLD_HEIGHT

/** Scale plant population caps with map area (reference = default 2200×1500). */
export function scaledMaxPlants(width: number, height: number): number {
  const scale = (width * height) / REFERENCE_WORLD_AREA
  return Math.round(Math.min(5000, Math.max(MAX_PLANTS, MAX_PLANTS * scale)))
}

function scaledPlantKindCap(base: number, width: number, height: number): number {
  const scale = (width * height) / REFERENCE_WORLD_AREA
  return Math.round(
    Math.min(MAX_PLANT_KIND_CAP, Math.max(MIN_PLANT_KIND_CAP, base * Math.max(1, scale))),
  )
}

export function scaledMaxPlantsByKind(
  width: number,
  height: number,
): { maxGrassPlants: number; maxBushPlants: number; maxTreePlants: number } {
  return {
    maxGrassPlants: scaledPlantKindCap(MAX_GRASS_PLANTS, width, height),
    maxBushPlants: scaledPlantKindCap(MAX_BUSH_PLANTS, width, height),
    maxTreePlants: scaledPlantKindCap(MAX_TREE_PLANTS, width, height),
  }
}

/** Split a legacy single max-plants setting into per-kind caps. */
export function splitLegacyMaxPlants(total: number): {
  maxGrassPlants: number
  maxBushPlants: number
  maxTreePlants: number
} {
  const maxGrassPlants = Math.round(total * 0.75)
  const maxBushPlants = Math.round(total * 0.125)
  const maxTreePlants = Math.max(MIN_PLANT_KIND_CAP, total - maxGrassPlants - maxBushPlants)
  return { maxGrassPlants, maxBushPlants, maxTreePlants }
}

export function scaledInitialPlants(width: number, height: number): number {
  const scale = (width * height) / REFERENCE_WORLD_AREA
  return Math.round(Math.min(2500, Math.max(INITIAL_PLANTS, INITIAL_PLANTS * scale)))
}

/** Fraction of birth mutations that are large jumps (most are small nudges). */
export const LARGE_MUTATION_CHANCE = 0.0025

/** Chance per check to reintroduce a hall-of-fame pathogen strain mid-run. */
export const PATHOGEN_CHAMPION_SPAWN_CHANCE = 0.14
/** How often champion pathogen reintroduction is considered (every ~2 min at 30 tps). */
export const PATHOGEN_CHAMPION_CHECK_INTERVAL = TICKS_PER_SECOND * 120

/** Initial herbivores are variants of one founder — keeps early mating viable. */
export const FOUNDER_GENE_SPREAD = 10
export const FOUNDER_GENE_JITTER_CHANCE = 0.4

/** Single map pond — starting volume and geometry. */
export const POND_INITIAL_WATER = 12_000
export const POND_BASE_RADIUS = 95
/** Scales pond, soil, and creature sweat evaporation (lower = wetter world). */
export const SURFACE_EVAPORATION_SCALE = 0.48
/** Base pond evaporation per tick at reference temperature and humidity. */
export const POND_EVAP_BASE = 0.12

/** Soil moisture grid — one value per cell covering the whole map. */
export const SOIL_CELL_SIZE = 64
export const SOIL_MAX_MOISTURE = 1
/** Water units stored at full saturation (moisture = 1). */
export const SOIL_CELL_WATER_CAPACITY = 48
/** Starting moisture in every soil cell on reset. */
export const SOIL_BASELINE_MOISTURE = 0.28
/** Base moisture-fraction evaporation per cell per tick at reference temp/humidity. */
export const SOIL_EVAP_BASE = 0.00015
/** Michaelis half-saturation for growth scaling (lower = thirstier plants). */
export const SOIL_MOISTURE_HALF_SAT = 0.14
/** Minimum local moisture to attempt plant reproduction. */
export const SOIL_REPRO_MIN_MOISTURE = 0.06

/** Closed water cycle — total world water budget and initial pool split. */
export const DEFAULT_TOTAL_WATER = 32_000
export const MIN_TOTAL_WATER = 2_000
export const MAX_TOTAL_WATER = 250_000
/** Fraction of total water placed in the pond at reset (shore wetting moves some to soil). */
export const INIT_WATER_POND_FRACTION = 0.35
export const INIT_WATER_SOIL_FRACTION = 0.57
export const INIT_WATER_AIR_FRACTION = 0.08
/** Pond water moved into the shore soil gradient at reset (conserved, not created). */
export const INIT_POND_SHORE_TRANSFER = 0.12

export function scaledDefaultTotalWater(width: number, height: number): number {
  const scale = (width * height) / REFERENCE_WORLD_AREA
  return Math.round(DEFAULT_TOTAL_WATER * scale)
}

/** Closed water cycle — atmospheric vapor pool and rain threshold. */
export const ATMOSPHERE_VAPOR_CAPACITY = 8_000
export const ATMOSPHERE_INITIAL_VAPOR = 900
/** Relative humidity (0–1) at which rain begins. */
export const RAIN_START_HUMIDITY = 0.9
/** Relative humidity (0–1) at which rain stops. */
export const RAIN_STOP_HUMIDITY = 0.1
/** Humidity must drop below this before another storm can begin. */
export const RAIN_ARM_HUMIDITY = 0.72
/** Fraction of vapor above the stop level precipitated each tick while raining. */
export const RAIN_PRECIP_FRACTION = 0.055
/** Minimum water units precipitated per tick while raining. */
export const RAIN_PRECIP_BASE = 14
export const RAIN_SOIL_FRACTION = 0.52
export const RAIN_POND_FRACTION = 0.48
/** Fraction of plant biomass energy stored as retrievable tissue water. */
export const PLANT_WATER_PER_ENERGY = 0.26
/** Water released to soil vs air when a creature or plant dies. */
export const DEATH_WATER_TO_SOIL = 0.55
export const DEATH_WATER_TO_AIR = 0.45

/** Water transferred from pond to nearby soil per tick (moisture-fraction units). */
export const POND_SEEP_RATE = 0.22
/** How far moisture wicks into soil beyond the pond's water edge (world units). */
export const POND_SEEP_REACH = 480
/** Lateral moisture spread between neighboring soil cells per tick. */
export const SOIL_LATERAL_DIFFUSION = 0.022

/** Energy drained per tick when a creature is submerged in the pond. */
export const DROWN_CREATURE_DAMAGE = 3.4
/** Energy drained per tick when a plant is submerged in the pond. */
export const DROWN_PLANT_DAMAGE = 9

/** Default real-time seconds for one full day–night cycle at 1× sim speed. */
export const DAY_LENGTH_SECONDS = 24
export const MIN_DAY_LENGTH_SECONDS = 6
export const MAX_DAY_LENGTH_SECONDS = 180
/** Day length swing at solstice vs equinox (0.38 → ±38% from base). */
export const SEASON_DAY_LENGTH_SWING = 0.38
/** Day–night cycles per season year (spring → summer → autumn → winter). */
export const DAYS_PER_SEASON_YEAR = 8
export const MIN_DAYS_PER_SEASON_YEAR = 4
export const MAX_DAYS_PER_SEASON_YEAR = 24

/** Seasonal mean temperature swing (°C) around SEASON_TEMP_BASE. */
export const SEASON_TEMP_BASE = 14
export const SEASON_TEMP_AMPLITUDE = 14
/** Day–night temperature swing (°C) at noon/midnight. */
export const DAY_TEMP_SWING = 7
