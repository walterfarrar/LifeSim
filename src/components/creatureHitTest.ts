import { creatureTraits, toroidalDistance } from '../sim/entities/creature'
import { toroidalDisplayOffsets } from '../sim/toroidal'
import type { Creature } from '../sim/types'

export function pickCreatureAt(
  creatures: readonly Creature[],
  x: number,
  y: number,
  worldWidth: number,
  worldHeight: number,
): Creature | null {
  let best: Creature | null = null
  let bestDist = Infinity

  for (const creature of creatures) {
    const traits = creatureTraits(creature)
    const hitRadius = traits.radius + 6
    const margin = hitRadius + 4

    for (const { ox, oy } of toroidalDisplayOffsets(creature.x, creature.y, margin, worldWidth, worldHeight)) {
      const drawX = creature.x + ox
      const drawY = creature.y + oy
      const dist = Math.hypot(drawX - x, drawY - y)
      if (dist > hitRadius) continue

      const toroidalDist = toroidalDistance(creature, { x, y })
      if (toroidalDist <= hitRadius && toroidalDist < bestDist) {
        bestDist = toroidalDist
        best = creature
      }
    }
  }

  return best
}
