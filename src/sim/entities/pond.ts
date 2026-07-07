import { DROWN_CREATURE_DAMAGE, DROWN_PLANT_DAMAGE } from '../config'
import type { Creature, Vec2 } from '../types'
import type { TerrainWater } from '../terrainWater'
import { creatureTraits } from './creature'

export function isPondDrinkable(terrain: TerrainWater): boolean {
  return terrain.hasStandingWater()
}

export function applyCreatureDrowning(creature: Creature, terrain: TerrainWater): void {
  const traits = creatureTraits(creature)
  if (!terrain.isSubmerged(creature.x, creature.y, traits.radius)) return
  creature.energy -= DROWN_CREATURE_DAMAGE
  if (creature.energy <= 0) {
    creature.pendingDeathCause = 'drowning'
  }
}

export function applyPlantDrowning(
  plant: Vec2 & { energy: number },
  terrain: TerrainWater,
  plantRadius: number,
  damage = DROWN_PLANT_DAMAGE,
): void {
  if (!terrain.isSubmerged(plant.x, plant.y, plantRadius)) return
  plant.energy = Math.max(0, plant.energy - damage)
}

export function tryDrinkFromSurface(
  creature: Creature,
  terrain: TerrainWater,
  pondDrinking: number,
): number {
  if (pondDrinking <= 0) return 0
  const traits = creatureTraits(creature)
  return terrain.tryDrinkFromSurface(creature, pondDrinking, traits)
}

export function pondApproachTarget(
  from: Vec2,
  waterCenter: Vec2,
  terrain: TerrainWater,
  margin: number,
): Vec2 {
  return terrain.shoreApproachTarget(from, waterCenter, margin)
}
