/** World and simulation tuning — adjust here as the sim grows. */
export const WORLD_WIDTH = 1200
export const WORLD_HEIGHT = 800

export const TICKS_PER_SECOND = 30

export const INITIAL_PLANTS = 300
export const INITIAL_HERBIVORES = 40
export const MAX_PLANTS = 500
export const PLANT_SPAWN_CHANCE = 0.035
/** Chance per tick to seed a random plant when the map is completely bare. */
export const PLANT_WIND_SPAWN_CHANCE = 0.12
export const PLANT_LOW_COUNT_BOOST = 30

/** Fraction of birth mutations that are large jumps (most are small nudges). */
export const LARGE_MUTATION_CHANCE = 0.0025

/** Chance per check to reintroduce a hall-of-fame pathogen strain mid-run. */
export const PATHOGEN_CHAMPION_SPAWN_CHANCE = 0.14
/** How often champion pathogen reintroduction is considered (every ~2 min at 30 tps). */
export const PATHOGEN_CHAMPION_CHECK_INTERVAL = TICKS_PER_SECOND * 120

/** Initial herbivores are variants of one founder — keeps early mating viable. */
export const FOUNDER_GENE_SPREAD = 10
export const FOUNDER_GENE_JITTER_CHANCE = 0.4
export const FOUNDER_PREFERENCE_NOISE = 12
