import {
  canSeekMate,
  creatureTraits,
  effectiveAggressiveness,
  mateProximity,
  moveAwayFrom,
  moveToward,
  tryAttackCreature,
  toroidalDistance,
} from './entities/creature'
import { mutuallyAcceptMate } from './matePreference'
import type { Creature } from './types'

const ATTACK_AGGRESSION_THRESHOLD = 0.32

export type SpaceReaction =
  | { kind: 'none' }
  | { kind: 'flee'; intruder: Creature }
  | { kind: 'chase'; intruder: Creature }
  | { kind: 'attack'; intruder: Creature }

function isMatingCloseness(a: Creature, b: Creature): boolean {
  if (a.mode !== 'horny' || b.mode !== 'horny') return false
  if (a.sex === b.sex) return false
  if (!canSeekMate(a) && !canSeekMate(b)) return false

  const dist = toroidalDistance(a, b)
  const range = mateProximity(a, b)
  if (dist > range) return false

  return mutuallyAcceptMate(a, b, dist, range)
}

function findClosestIntruder(creature: Creature, others: readonly Creature[]): Creature | null {
  const traits = creatureTraits(creature)
  let intruder: Creature | null = null
  let closestDist = Infinity

  for (const other of others) {
    if (other.id === creature.id) continue
    const dist = toroidalDistance(creature, other)
    if (dist >= traits.personalSpace) continue
    if (isMatingCloseness(creature, other)) continue
    if (dist < closestDist) {
      closestDist = dist
      intruder = other
    }
  }

  return intruder
}

export function evaluateSpaceReaction(creature: Creature, others: readonly Creature[]): SpaceReaction {
  const intruder = findClosestIntruder(creature, others)
  if (!intruder) return { kind: 'none' }

  const traits = creatureTraits(creature)
  const dist = toroidalDistance(creature, intruder)
  const aggro = effectiveAggressiveness(creature)

  if (aggro >= ATTACK_AGGRESSION_THRESHOLD) {
    if (dist <= traits.attackRange) {
      return { kind: 'attack', intruder }
    }
    return { kind: 'chase', intruder }
  }

  return { kind: 'flee', intruder }
}

export function applySpaceReaction(creature: Creature, reaction: SpaceReaction): boolean {
  if (reaction.kind === 'none') return false

  const traits = creatureTraits(creature)

  switch (reaction.kind) {
    case 'flee':
      moveAwayFrom(creature, reaction.intruder, traits)
      return true
    case 'chase':
      moveToward(creature, reaction.intruder, traits)
      return true
    case 'attack':
      tryAttackCreature(creature, reaction.intruder)
      if (toroidalDistance(creature, reaction.intruder) > traits.stopDistance) {
        moveToward(creature, reaction.intruder, traits)
      } else {
        creature.vx = 0
        creature.vy = 0
      }
      return true
  }
}
