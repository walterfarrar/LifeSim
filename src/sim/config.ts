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
/** Sim-years before the first herbivore group appears at world start. */
export const CREATURE_FIRST_SPAWN_DELAY_YEARS = 50
/** Sim-years between each founder group introduction (and between post-cycle extinction checks). */
export const CREATURE_GROUP_SPAWN_INTERVAL_YEARS = 50
export const MAX_PLANTS = 1600
export const MAX_GRASS_PLANTS = 1200
export const MAX_BUSH_PLANTS = 200
export const MAX_TREE_PLANTS = 200
export const MIN_PLANT_KIND_CAP = 0
export const MAX_PLANT_KIND_CAP = 4000
/** Rare wind-borne seed when a plant lineage is extinct (simulation constant). */
export const PLANT_KIND_EXTINCT_RESEED_CHANCE = 0.1
/** Wind-borne seed when every plant on the map is gone. */
export const PLANT_EXTINCT_WIND_RESEED_CHANCE = 0.22

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

/** Main basin radius in pixels at world gen (pond width). */
export const POND_BASE_RADIUS = 110
/** Default max standing depth at pond center (water units). */
export const POND_DEFAULT_MAX_DEPTH = 62
export const POND_MIN_MAX_DEPTH = 12
export const POND_MAX_MAX_DEPTH = 120
export const POND_MIN_BASE_RADIUS = 40
export const POND_MAX_BASE_RADIUS = 500
/** @deprecated Legacy label — use surface water grid instead of a pond entity. */
export const POND_INITIAL_WATER = 12_000
/** Scales pond, soil, and creature sweat evaporation (lower = wetter world). */
export const SURFACE_EVAPORATION_SCALE = 0.48
/** Base pond evaporation per tick at reference temperature and humidity. */
export const POND_EVAP_BASE = 0.12

/** Soil moisture grid — one value per cell covering the whole map. */
export const SOIL_CELL_SIZE = 64
export const SOIL_MAX_MOISTURE = 1
/** Water units stored at full saturation (moisture = 1). */
export const SOIL_CELL_WATER_CAPACITY = 40
/** Starting moisture in every soil cell on reset. */
export const SOIL_BASELINE_MOISTURE = 0.28
/** Base moisture-fraction evaporation per cell per tick at reference temp/humidity. */
export const SOIL_EVAP_BASE = 0.001
/** Average soil moisture above which evaporation ramps up to prevent a permanent marsh. */
export const SOIL_SATURATED_MOISTURE = 0.82
/** Extra evaporation multiplier at full saturation (scaled from SOIL_SATURATED_MOISTURE). */
export const SOIL_SATURATED_EVAP_BOOST = 7
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
/** Pond water moved into the shore soil gradient at reset (legacy — infiltration replaces this). */
export const INIT_POND_SHORE_TRANSFER = 0.12

/** Terrain surface-water layer (shares soil cell grid). Depths are in abstract water units. */
export const SURFACE_FLOW_RATE = 2.8
/** Lateral spill passes after a creature drinks — neighbors level into the tile. */
export const SURFACE_BALANCE_PASSES = 6
/** Stop transferring when neighbor water surfaces are within this distance. */
export const SURFACE_LEVEL_TOLERANCE = 0.05
export const SURFACE_INFILTRATION_RATE = 0.011
/** Slower soak into soil while it is raining (surface fills first). */
export const SURFACE_INFILTRATION_RAIN_MULT = 0.55
/** Each bucket gains this much per rain round when the budget allows (same for every tile). */
export const SURFACE_RAIN_FILL_PER_TILE = 1.4
/** Minimum basin capacity to count as a rain bucket (hilltops ≈ 0 are skipped). */
export const SURFACE_BUCKET_MIN_CAPACITY = 0.25
/** Small detail noise after hill/valley synthesis (not per-cell random terrain). */
export const TERRAIN_DETAIL_NOISE = 0.004
/** Baseline elevation before hills, valleys, and pond carve. */
export const TERRAIN_BASE_ELEVATION = 0.64
/** Number of large hill/valley features placed on the map. */
export const TERRAIN_HILL_COUNT_MIN = 4
export const TERRAIN_HILL_COUNT_MAX = 7
export const TERRAIN_HILL_AMPLITUDE = 0.065
export const TERRAIN_VALLEY_AMPLITUDE = 0.055
export const TERRAIN_FEATURE_RADIUS_MIN = 220
export const TERRAIN_FEATURE_RADIUS_MAX = 520
/** Gentle rolling hills overlaid on feature bumps. */
export const TERRAIN_ROLLING_AMPLITUDE = 0.016
export const TERRAIN_ROLLING_WAVELENGTH_MIN = 340
export const TERRAIN_ROLLING_WAVELENGTH_MAX = 620
/** Smoothing passes after height synthesis — higher = softer, more coherent terrain. */
export const TERRAIN_SMOOTH_PASSES = 3
/** Rolling-hill elevation span on non-pond tiles (valleys ≈ min, hilltops ≈ max). */
export const TERRAIN_ELEVATION_MIN = 0
export const TERRAIN_ELEVATION_MAX = 10
/** Map midpoint (elevation 5) = sea level; valleys read below, hilltops above. */
export const TERRAIN_ELEVATION_SEA_LEVEL = (TERRAIN_ELEVATION_MIN + TERRAIN_ELEVATION_MAX) / 2
/** Feet of height per internal elevation unit (~500 ft total hill range). */
export const TERRAIN_ELEVATION_FEET_PER_UNIT = 50
/** Pond carve subtracted from flow elevation (same units as elevation). */
export const TERRAIN_POND_CARVE_DEPTH = 2.8
/** Max standing depth on non-pond tiles — equals elevation span (lower ground holds more). */
export const SURFACE_PUDDLE_MAX_DEPTH = TERRAIN_ELEVATION_MAX
/** Max standing depth at the pond center — rim still blends to puddle depths (0–10). */
export const POND_CENTER_MAX_DEPTH = POND_DEFAULT_MAX_DEPTH
/** Pond outer radius as a multiple of basin radius (gradual shore). */
export const POND_OUTER_RADIUS_SCALE = 1.3
/** Curve shaping pond depth from rim (0) to center (1) — higher = flatter rim, steeper center. */
export const POND_DEPTH_PROFILE_POWER = 1.22
/** Uniform water loss per wet tile per tick (same rate for every bucket, any depth). */
export const SURFACE_EVAP_BASE = 0.06
/** Drown when water depth >= entity radius × this (body diameter). */
export const DROWN_DEPTH_BODY_SIZE_MULT = 2

export function scaledDefaultTotalWater(width: number, height: number): number {
  const scale = (width * height) / REFERENCE_WORLD_AREA
  return Math.round(DEFAULT_TOTAL_WATER * scale)
}

/** Reference vapor capacity at {@link DEFAULT_TOTAL_WATER}; scales with the water budget. */
export const ATMOSPHERE_VAPOR_CAPACITY = 8_000
export const ATMOSPHERE_INITIAL_VAPOR = 900

/** Keep starting humidity ~32% when total water changes (8% of budget / scaled capacity). */
export function scaledAtmosphereVaporCapacity(totalWater: number): number {
  return ATMOSPHERE_VAPOR_CAPACITY * (totalWater / DEFAULT_TOTAL_WATER)
}
/** Relative humidity (0–1) at which rain begins. */
export const RAIN_START_HUMIDITY = 0.9
/** Relative humidity (0–1) at which rain stops (most vapor has precipitated out). */
export const RAIN_STOP_HUMIDITY = 0.2
/** Humidity must drop below this before another storm can begin. */
export const RAIN_ARM_HUMIDITY = 0.72
/** Fraction of vapor above the stop level precipitated each tick while raining. */
export const RAIN_PRECIP_FRACTION = 0.055
/** Minimum water units precipitated per tick while raining. */
export const RAIN_PRECIP_BASE = 14
/** While raining, only this fraction of plant transpiration goes back to air (rest to soil). */
export const RAIN_TRANSPIRATION_TO_AIR = 0.06
/** @deprecated Rain goes to surface first; soil is filled by infiltration only. */
export const RAIN_SOIL_FRACTION = 0
export const RAIN_POND_FRACTION = 1
/** Fraction of plant biomass energy stored as retrievable tissue water. */
export const PLANT_WATER_PER_ENERGY = 0.26
/** Living plants pull soil moisture every tick; overflow transpires to air at capacity. */
export const PLANT_LIVE_SOIL_UPTAKE_RATE = 0.0055
export const PLANT_LIVE_UPTAKE_DORMANT_SCALE = 0.14
/** Grass turf is grazed in small mouthfuls — fraction of a normal plant bite per tick. */
export const GRASS_GRAZE_BITE_SCALE = 0.058
/** Turf regrowth multiplier applied on top of plant DNA growth rate. */
export const GRASS_TURF_GROWTH_SCALE = 0.18
/** How many herbivores may graze the same grass cell in one tick (prevents pile-on clears). */
export const GRASS_GRAZE_MAX_PER_CELL_PER_TICK = 2
/** Digestible energy from grass biomass vs woody plants (filler browse, not a staple). */
export const GRASS_FOOD_EFFICIENCY = 0.36
/** Fraction of grass tissue water absorbed when grazing or sipping dew. */
export const GRASS_WATER_HYDRATION_EFFICIENCY = 0.14
/** Target-selection bias — grass is chosen only when little else is nearby. */
export const GRASS_FOOD_PREFERENCE = 0.22
/** @deprecated Grass water preference now comes from the WaterSource gene (forageWaterPreference). */
export const GRASS_WATER_PREFERENCE = 0.06
/** Turf DNA is cleared below this biomass; rendering fades out above it. */
export const GRASS_MIN_LIVE_ENERGY = 0.05
/** Minimum biomass to graze or count as a full food tile. */
export const GRASS_EDIBLE_ENERGY = 0.5
/** Cap on passive biomass loss per cell per tick (stress, drought, flood). */
export const GRASS_MAX_TICK_LOSS_FRACTION = 0.045
/** Turf crown height as a fraction of cell size (flood stress and rendering). */
export const GRASS_TURF_HEIGHT_FRAC = 0.22
/** Standing water below this fraction of crown height does not stress turf (rain film). */
export const GRASS_FLOOD_SUBMERGE_FREE_FRAC = 0.5
/** Flood damage multiplier while it is raining (thin surface layer is tolerated). */
export const GRASS_FLOOD_RAIN_STRESS_MULT = 0.35
/** Fraction of biomass lost per tick when fully flooded (shallow film uses GRASS_FLOOD_DRAIN_STRESS_MIN). */
export const GRASS_DROWN_DRAIN_FRACTION = 0.009
/** Minimum stress multiplier when turf is barely submerged past the crown. */
export const GRASS_FLOOD_DRAIN_STRESS_MIN = 0.1
/** Maximum stress multiplier when water fully covers and fills a depressed tile. */
export const GRASS_FLOOD_DRAIN_STRESS_MAX = 3.5
export const GRASS_DROUGHT_DRAIN_BASE = 0.0018
export const GRASS_DROUGHT_DRAIN_SCALE = 0.007
/** Fraction of turf biomass lost per tick when active but outside the growth temperature band. */
export const GRASS_COLD_DRAIN_BASE = 0.002
export const GRASS_COLD_DRAIN_SCALE = 0.008
/** Ticks of stress before extreme-temperature drain reaches full strength. */
export const GRASS_COLD_RAMP_TICKS = 240
/** Ticks beyond survival limits before lethal freeze/heat damage ramps up. */
export const GRASS_EXTREME_COLD_KILL_TICKS = 600
/** Max fraction of biomass lost per tick under prolonged lethal temperatures. */
export const GRASS_COLD_EXTREME_DRAIN = 0.035
/** Crown freeze while dormant but beyond survival — very slow unless extreme persists. */
export const GRASS_EXTREME_COLD_DRAIN = 0.002
/** Tree canopy shade on turf — radius multiplier and peak block at trunk center. */
export const TREE_CANOPY_SHADE_RADIUS_SCALE = 1.2
export const TREE_CANOPY_MAX_SHADE = 0.92
/** Conifers resist browsing — extra virtual hardiness and smaller bites. */
export const TREE_BITE_HARDINESS_OFFSET = 0.45
export const TREE_GRAZE_BITE_SCALE = 0.22
/** Drowning and drought resilience vs bushes. */
export const DROWN_TREE_DAMAGE_SCALE = 0.38
/** Water released to soil vs air when a creature or plant dies. */
export const DEATH_WATER_TO_SOIL = 0.1
export const DEATH_WATER_TO_AIR = 0.9

/** Water transferred from pond to nearby soil per tick (moisture-fraction units). */
export const POND_SEEP_RATE = 0.22
/** How far moisture wicks into soil beyond the pond's water edge (world units). */
export const POND_SEEP_REACH = 480
/** Lateral moisture spread between neighboring soil cells per tick. */
/** Fraction of neighbor moisture gap closed per tick (lower = wet spots linger longer). */
export const SOIL_LATERAL_DIFFUSION = 0.01

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
