import { creatureTraits } from './entities/creature'
import { dnaSimilarity } from './matePreference'
import { toroidalDistance, toroidalNearestPoint } from './toroidal'
import type { Creature } from './types'

/** Weighted center of nearby genetically similar creatures — null if none in range. */
export function findCohesionTarget(
  creature: Creature,
  others: readonly Creature[],
): { x: number; y: number } | null {
  const traits = creatureTraits(creature)
  if (traits.cohesion < 0.08) return null

  const range = traits.vision * (0.35 + traits.cohesion * 0.65)
  let sumX = 0
  let sumY = 0
  let sumW = 0

  for (const other of others) {
    if (other.id === creature.id) continue

    const dist = toroidalDistance(creature, other)
    if (dist > range) continue

    const similarity = dnaSimilarity(creature.dna, other.dna)
    if (similarity < 0.32) continue

    const proximity = 1 - dist / range
    const weight = similarity * similarity * proximity
    if (weight <= 0) continue

    const nearest = toroidalNearestPoint(creature, other)
    sumX += nearest.x * weight
    sumY += nearest.y * weight
    sumW += weight
  }

  if (sumW <= 0) return null
  return { x: sumX / sumW, y: sumY / sumW }
}
