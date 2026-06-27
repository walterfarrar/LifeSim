import {
  canSeekMate,
  creatureTraits,
  mateProximity,
  toroidalDelta,
  toroidalDistance,
} from './entities/creature'
import { dnaSimilarity, mutuallyAcceptMate } from './matePreference'
import type { Rng } from './rng'
import type { Corpse, Creature } from './types'
import type { DNA } from './dna'

/** 0–1 appetite for flesh with this DNA; identical kin → 0%. */
export function predateChanceFromDna(hunter: Creature, preyDna: DNA): number {
  const predilection = creatureTraits(hunter).cannibalPredilection
  if (predilection <= 0) return 0
  const dissimilarity = 1 - dnaSimilarity(hunter.dna, preyDna)
  return predilection * dissimilarity
}

/** 0–1 chance to eat prey this tick; scales with dissimilarity (identical kin → 0%). */
export function predateChance(hunter: Creature, prey: Creature): number {
  return predateChanceFromDna(hunter, prey.dna)
}

export function predateCorpseChance(hunter: Creature, corpse: Corpse): number {
  return predateChanceFromDna(hunter, corpse.dna)
}

function isMateCourtship(a: Creature, b: Creature): boolean {
  if (a.mode !== 'horny' || b.mode !== 'horny') return false
  if (a.sex === b.sex) return false
  if (!canSeekMate(a) && !canSeekMate(b)) return false

  const dist = toroidalDistance(a, b)
  const range = mateProximity(a, b)
  if (dist > range) return false

  return mutuallyAcceptMate(a, b, dist, range)
}

export function isValidPrey(hunter: Creature, prey: Creature): boolean {
  if (prey.id === hunter.id) return false
  if (prey.energy <= 0) return false
  if (isMateCourtship(hunter, prey)) return false
  return predateChance(hunter, prey) > 0
}

export function findBestPreyTarget(
  hunter: Creature,
  others: readonly Creature[],
  vision: number,
): Creature | null {
  const traits = creatureTraits(hunter)
  if (traits.cannibalPredilection < 0.02) return null

  let best: Creature | null = null
  let bestScore = 0

  for (const prey of others) {
    if (!isValidPrey(hunter, prey)) continue
    const dist = toroidalDistance(hunter, prey)
    if (dist >= vision) continue

    const chance = predateChance(hunter, prey)
    const score = chance * (1 - dist / vision)
    if (score > bestScore) {
      bestScore = score
      best = prey
    }
  }

  return best
}

export function shouldHuntCorpseOverPlant(
  hunter: Creature,
  corpse: Corpse,
  nearestPlantDist: number,
  corpseDist: number,
  vision: number,
): boolean {
  const chance = predateCorpseChance(hunter, corpse)
  if (chance < 0.05) return false
  if (nearestPlantDist === Infinity || nearestPlantDist > vision) return true
  return chance >= 0.18 && corpseDist <= nearestPlantDist
}

export function findBestCorpseTarget(
  hunter: Creature,
  corpses: readonly Corpse[],
  vision: number,
): Corpse | null {
  const traits = creatureTraits(hunter)
  if (traits.cannibalPredilection < 0.02) return null

  let best: Corpse | null = null
  let bestScore = 0

  for (const corpse of corpses) {
    if (corpse.energy <= 0.5) continue
    const dist = toroidalDistance(hunter, corpse)
    if (dist >= vision) continue

    const chance = predateCorpseChance(hunter, corpse)
    if (chance <= 0) continue
    const score = chance * (1 - dist / vision)
    if (score > bestScore) {
      bestScore = score
      best = corpse
    }
  }

  return best
}

export function tryEatCorpse(hunter: Creature, corpse: Corpse): number {
  const traits = creatureTraits(hunter)
  const { dx, dy } = toroidalDelta(hunter, corpse)
  const dist = Math.hypot(dx, dy)
  const reach = traits.radius + traits.forageReach
  if (dist > reach) return 0
  if (predateCorpseChance(hunter, corpse) <= 0) return 0

  const bite = Math.min(traits.biteAmount * traits.forageEfficiency, corpse.energy)
  return bite
}

export function shouldHuntPreyOverPlant(
  hunter: Creature,
  prey: Creature,
  nearestPlantDist: number,
  preyDist: number,
  vision: number,
): boolean {
  const chance = predateChance(hunter, prey)
  if (chance < 0.08) return false
  if (nearestPlantDist === Infinity || nearestPlantDist > vision) return true
  return chance >= 0.25 && preyDist <= nearestPlantDist
}

export function tryEatCreature(hunter: Creature, prey: Creature): number {
  const traits = creatureTraits(hunter)
  const { dx, dy } = toroidalDelta(hunter, prey)
  const dist = Math.hypot(dx, dy)
  const reach = traits.radius + traits.forageReach
  if (dist > reach) return 0

  const bite = Math.min(traits.biteAmount * traits.forageEfficiency, prey.energy)
  prey.energy -= bite
  return bite
}

export function attemptPredation(hunter: Creature, prey: Creature, rng: Rng): number {
  const chance = predateChance(hunter, prey)
  if (chance <= 0 || !rng.chance(chance)) return 0
  return tryEatCreature(hunter, prey)
}
