import type { DNA } from './dna'
import type { Infection, Pathogen } from './disease/pathogen'
import type { CreatureShape } from './genes'

export type Vec2 = { x: number; y: number }

/** Extend with 'carnivore' | 'omnivore' etc. as the sim grows. */
export type Species = 'herbivore'

export type Sex = 'male' | 'female'

/** Exclusive behavioral mode — drives movement, eating, and mating. */
export type CreatureMode = 'hungry' | 'horny' | 'sleepy'

export type EntityKind = 'plant' | 'creature' | 'corpse'

export interface Plant {
  kind: 'plant'
  id: number
  x: number
  y: number
  dna: DNA
  energy: number
  age: number
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
}

export type SimEntity = Plant | Creature | Corpse

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
}

export interface WorldSnapshot {
  plants: readonly Plant[]
  corpses: readonly Corpse[]
  creatures: readonly Creature[]
  pathogens: readonly Pathogen[]
  stats: WorldStats
}
