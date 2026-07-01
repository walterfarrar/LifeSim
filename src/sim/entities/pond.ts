import { markPendingDeathCause } from '../deathCause'
import {
  POND_BASE_RADIUS,
  POND_INITIAL_WATER,
  DROWN_CREATURE_DAMAGE,
  DROWN_PLANT_DAMAGE,
} from '../config'
import type { Rng } from '../rng'
import { toroidalDelta, wrapPosition } from '../toroidal'
import type { Creature, Pond, Vec2 } from '../types'
import { getWorldBounds } from '../worldBounds'
import { creatureTraits } from './creature'

let nextPondId = 1

export function resetPondIds(): void {
  nextPondId = 1
}

/** Starting water volume scaled with pond area (reference = default base radius). */
export function pondInitialWaterForRadius(baseRadius: number): number {
  const scale = (baseRadius / POND_BASE_RADIUS) ** 2
  return Math.round(POND_INITIAL_WATER * scale)
}

/** One pond placed at a random toroidal location when the world starts. */
export function createPond(rng: Rng, baseRadius = POND_BASE_RADIUS): Pond {
  const bounds = getWorldBounds()
  const margin = Math.min(120, Math.max(60, Math.min(bounds.width, bounds.height) * 0.06))
  const position = wrapPosition({
    x: rng.range(margin, bounds.width - margin),
    y: rng.range(margin, bounds.height - margin),
  })

  return {
    kind: 'pond',
    id: nextPondId++,
    x: position.x,
    y: position.y,
    water: 0,
    maxWater: 1,
    baseRadius,
  }
}

export function pondRadius(pond: Pond): number {
  if (pond.water <= 0) return 0
  const fill = pond.water / pond.maxWater
  return Math.max(8, pond.baseRadius * Math.sqrt(fill))
}

export function isPondDrinkable(pond: Pond): boolean {
  return pond.water > 0.5
}

/** True when the entity's body overlaps deep pond water (not just the muddy shore). */
export function isEntitySubmergedInPond(pond: Pond, entity: Vec2, entityRadius: number): boolean {
  if (!isPondDrinkable(pond)) return false
  const radius = pondRadius(pond)
  const { dx, dy } = toroidalDelta(entity, pond)
  const dist = Math.hypot(dx, dy)
  return dist + entityRadius * 0.45 < radius
}

/** Shore point outside the water, on the line from pond center toward `from`. */
export function pondApproachTarget(from: Vec2, pond: Pond, margin: number): Vec2 {
  const radius = pondRadius(pond)
  const { dx, dy } = toroidalDelta(from, pond)
  const dist = Math.hypot(dx, dy)
  if (dist < 1e-3) {
    return wrapPosition({ x: pond.x + radius + margin, y: pond.y })
  }
  const nx = dx / dist
  const ny = dy / dist
  const shoreDist = radius + margin
  return wrapPosition({
    x: pond.x + nx * shoreDist,
    y: pond.y + ny * shoreDist,
  })
}

export function applyCreatureDrowning(creature: Creature, pond: Pond): void {
  const traits = creatureTraits(creature)
  if (!isEntitySubmergedInPond(pond, creature, traits.radius)) return
  creature.energy -= DROWN_CREATURE_DAMAGE
  markPendingDeathCause(creature, 'drowning')
}

export function applyPlantDrowning(plant: Vec2 & { energy: number }, pond: Pond, plantRadius: number): void {
  if (!isEntitySubmergedInPond(pond, plant, plantRadius)) return
  plant.energy = Math.max(0, plant.energy - DROWN_PLANT_DAMAGE)
}

export function tryDrinkFromPond(creature: Creature, pond: Pond, pondDrinking: number): number {
  if (pondDrinking <= 0) return 0
  if (!isPondDrinkable(pond)) return 0

  const traits = creatureTraits(creature)
  const { dx, dy } = toroidalDelta(creature, pond)
  const dist = Math.hypot(dx, dy)
  const reach = pondRadius(pond) + traits.radius + traits.forageReach * 0.35
  if (dist > reach) return 0

  const room = traits.maxHydration - creature.hydration
  if (room <= 0) return 0

  const sip = Math.min(traits.biteAmount * 0.6 * pondDrinking, pond.water, room)
  if (sip <= 0) return 0

  pond.water -= sip
  return sip
}
