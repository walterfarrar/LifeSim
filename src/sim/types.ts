import type { CreatureMemory } from './creatureMemory'
import type { CreatureDeathCause } from './deathCause'
import type { DNA } from './dna'
import type { Infection, Pathogen } from './disease/pathogen'
import type { CreatureShape, HerbivoreTraits } from './genes'
import type { SoilMoistureSnapshot } from './soilMoisture'
import type { DeathCauseCounts } from './deathCause'
import type { SeasonName } from './seasons'

export type Vec2 = { x: number; y: number }

/** Extend with 'carnivore' | 'omnivore' etc. as the sim grows. */
export type Species = 'herbivore'

export type Sex = 'male' | 'female'

/** Exclusive behavioral mode — drives movement, eating, drinking, and mating. */
export type CreatureMode = 'hungry' | 'thirsty' | 'horny' | 'sleepy'

export type EntityKind = 'plant' | 'creature' | 'corpse'

export interface Plant {
  kind: 'plant'
  id: number
  x: number
  y: number
  dna: DNA
  energy: number
  /** Water units stored in live tissue — tracked separately from dry biomass energy. */
  water: number
  age: number
  /** Consecutive ticks without enough soil moisture — ramps drought damage. */
  droughtTicks: number
}

export interface Corpse {
  kind: 'corpse'
  id: number
  x: number
  y: number
  dna: DNA
  energy: number
  maxEnergy: number
  age: number
  hue: number
  saturation: number
  shape: CreatureShape
  radius: number
}

export interface Pond {
  kind: 'pond'
  id: number
  x: number
  y: number
  water: number
  maxWater: number
  baseRadius: number
}

export interface Creature {
  kind: 'creature'
  id: number
  species: Species
  sex: Sex
  mode: CreatureMode
  fatigue: number
  modeTicksInCurrent: number
  x: number
  y: number
  vx: number
  vy: number
  energy: number
  /** Hydration reservoir — separate from food energy; hits zero = death. */
  hydration: number
  age: number
  dna: DNA
  reproductionCooldown: number
  /** Ticks until birth; 0 when not pregnant. */
  pregnancyTicksRemaining: number
  pregnancyPartnerDna?: DNA
  pendingBirthEnergy: number
  wanderX: number
  wanderY: number
  wanderTicksRemaining: number
  attackCooldown: number
  /** 0–1 debuff from similar-parent births; permanent for life. */
  inbreedingLoad: number
  infection?: Infection
  /** Memoized expressed traits — dna and inbreedingLoad are immutable once alive. */
  traitsCache?: HerbivoreTraits
  /** inbreedingLoad the cache was built with; recompute if it changes. */
  traitsCacheLoad?: number
  /** Learned locations for water and food — not inherited, cleared on reset. */
  memories?: CreatureMemory[]
  /** Set when a specific harm source delivers the killing blow this tick. */
  pendingDeathCause?: CreatureDeathCause
}

export type SimEntity = Plant | Creature | Corpse | Pond

export interface WorldStats {
  tick: number
  plantCount: number
  herbivoreCount: number
  births: number
  deaths: number
  totalEnergy: number
  plantEnergy: number
  creatureEnergy: number
  corpseEnergy: number
  primaryProduction: number
  grassPlantCount: number
  bushPlantCount: number
  treePlantCount: number
  pondWater: number
  hasPond: boolean
  /** Total water units in atmospheric vapor. */
  airWater: number
  /** Total water units across all soil cells. */
  soilWater: number
  /** Total water stored in living creatures (hydration). */
  creatureWater: number
  /** Total water stored in living plants (biomass). */
  plantWater: number
  /** Sum of all water pools (pond + soil + air + creatures + plants). */
  totalWater: number
  /** Total water locked at world reset — use to spot conservation drift. */
  totalWaterBudget: number
  avgSoilMoisture: number
  /** Atmospheric vapor as fraction of capacity (relative humidity). */
  airHumidity: number
  isRaining: boolean
  /** 0–1 position in the current day (0.5 = noon). */
  dayPhase: number
  /** 0–1 photosynthetic sunlight this tick. */
  sunlight: number
  isNight: boolean
  season: SeasonName
  /** 0–1 position in the season year. */
  seasonPhase: number
  /** Current day length after seasonal adjustment (seconds). */
  effectiveDayLengthSeconds: number
  /** Ambient air temperature this tick (°C). */
  temperature: number
  deathCauseCounts: DeathCauseCounts
}

export interface WorldSnapshot {
  plants: readonly Plant[]
  corpses: readonly Corpse[]
  creatures: readonly Creature[]
  ponds: readonly Pond[]
  soil: SoilMoistureSnapshot
  pathogens: readonly Pathogen[]
  stats: WorldStats
}
