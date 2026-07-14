import { creatureTraits } from './entities/creature'
import type { Creature } from './types'
import type { TerrainWater } from './terrainWater'

export type CreatureDeathCause =
  | 'oldAge'
  | 'thirst'
  | 'starvation'
  | 'drowning'
  | 'disease'
  | 'predation'
  | 'combat'

export const DEATH_CAUSE_LABELS: Record<CreatureDeathCause, string> = {
  oldAge: 'Old age',
  thirst: 'Dehydration',
  starvation: 'Starvation',
  drowning: 'Drowning',
  disease: 'Disease',
  predation: 'Predation',
  combat: 'Combat',
}

export type DeathCauseCounts = Record<CreatureDeathCause, number>

export function createEmptyDeathCauseCounts(): DeathCauseCounts {
  return {
    oldAge: 0,
    thirst: 0,
    starvation: 0,
    drowning: 0,
    disease: 0,
    predation: 0,
    combat: 0,
  }
}

export function markPendingDeathCause(creature: Creature, cause: CreatureDeathCause): void {
  if (creature.energy <= 0) {
    creature.pendingDeathCause = cause
  }
}

export function classifyDeathCause(creature: Creature, terrain: TerrainWater): CreatureDeathCause {
  if (creature.pendingDeathCause) return creature.pendingDeathCause

  const traits = creatureTraits(creature)
  if (creature.hydration <= 0) return 'thirst'

  if (creature.energy <= 0) {
    if (terrain.isSubmerged(creature.x, creature.y, traits.radius)) return 'drowning'
    if (creature.infection && creature.infection.severity >= 0.22) return 'disease'
    return 'starvation'
  }

  return 'starvation'
}

export function topDeathCauses(
  counts: DeathCauseCounts,
  limit = 3,
): { cause: CreatureDeathCause; label: string; count: number }[] {
  return (Object.keys(counts) as CreatureDeathCause[])
    .map((cause) => ({ cause, label: DEATH_CAUSE_LABELS[cause], count: counts[cause] }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit)
}
