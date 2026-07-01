import { toroidalDistance } from './toroidal'
import type { HerbivoreTraits } from './genes'
import type { Creature, Vec2 } from './types'

export type CreatureMemoryKind = 'water' | 'food'

export type CreatureMemory = {
  kind: CreatureMemoryKind
  x: number
  y: number
  /** 0–1; fades over time when memory gene is low. */
  strength: number
}

const MERGE_RADIUS = 48

function hasMemory(traits: HerbivoreTraits): boolean {
  return traits.memorySlots > 0
}

function ensureMemories(creature: Creature): CreatureMemory[] {
  if (!creature.memories) creature.memories = []
  return creature.memories
}

/** Drop stale memories each tick. */
export function decayCreatureMemories(creature: Creature, traits: HerbivoreTraits): void {
  if (!creature.memories?.length || !hasMemory(traits)) {
    creature.memories = []
    return
  }

  const decay = traits.memoryDecay
  creature.memories = creature.memories
    .map((memory) => ({ ...memory, strength: memory.strength - decay }))
    .filter((memory) => memory.strength > 0.035)
}

/** Remember a useful location; merges nearby entries of the same kind. */
export function recordCreatureMemory(
  creature: Creature,
  kind: CreatureMemoryKind,
  x: number,
  y: number,
  traits: HerbivoreTraits,
  strengthBoost = 1,
): void {
  if (!hasMemory(traits)) return

  const memories = ensureMemories(creature)
  const initialStrength = (0.32 + traits.memoryRecall * 0.58) * strengthBoost

  for (const memory of memories) {
    if (memory.kind !== kind) continue
    const dist = toroidalDistance(memory, { x, y })
    if (dist >= MERGE_RADIUS) continue

    memory.x = memory.x * 0.55 + x * 0.45
    memory.y = memory.y * 0.55 + y * 0.45
    memory.strength = Math.min(1, memory.strength + initialStrength * 0.42)
    return
  }

  if (memories.length >= traits.memorySlots) {
    let weakestIndex = 0
    for (let i = 1; i < memories.length; i++) {
      if (memories[i].strength < memories[weakestIndex].strength) weakestIndex = i
    }
    memories.splice(weakestIndex, 1)
  }

  memories.push({ kind, x, y, strength: Math.min(1, initialStrength) })
}

export function scoreMemoryGoal(
  creature: Creature,
  memory: CreatureMemory,
  seekRange: number,
  recall: number,
): number {
  const dist = toroidalDistance(creature, memory)
  return (memory.strength * recall) / (1 + dist / Math.max(seekRange * 0.4, 1))
}

/** Best remembered location of a kind within range, weighted by strength and distance. */
export function bestMemoryGoal(
  creature: Creature,
  kind: CreatureMemoryKind,
  traits: HerbivoreTraits,
  maxRange: number,
): (Vec2 & { score: number }) | null {
  if (!creature.memories?.length || !hasMemory(traits)) return null

  let best: (Vec2 & { score: number }) | null = null
  for (const memory of creature.memories) {
    if (memory.kind !== kind) continue
    const dist = toroidalDistance(creature, memory)
    if (dist > maxRange) continue
    const score = scoreMemoryGoal(creature, memory, maxRange, traits.memoryRecall)
    if (!best || score > best.score) {
      best = { x: memory.x, y: memory.y, score }
    }
  }
  return best
}
