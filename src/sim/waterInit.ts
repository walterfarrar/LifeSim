import {
  INIT_WATER_AIR_FRACTION,
  INIT_WATER_SOIL_FRACTION,
  PLANT_WATER_PER_ENERGY,
  SOIL_CELL_WATER_CAPACITY,
} from './config'
import { toroidalDistance } from './toroidal'
import type { Creature } from './types'
import type { Atmosphere } from './waterCycle'
import type { AtmospherePool } from './transpiration'
import type { SoilMoisture } from './soilMoisture'
import type { SoilAccess } from './soilMoisture'
import type { TerrainWater } from './terrainWater'

/** Pull water units from soil then the local air cell — does not create water. */
export function pullWaterFromPools(
  x: number,
  y: number,
  need: number,
  soil: SoilAccess,
  atmosphere: AtmospherePool,
): number {
  if (need <= 0) return 0
  const taken = soil.consume(x, y, need / SOIL_CELL_WATER_CAPACITY)
  let funded = taken * SOIL_CELL_WATER_CAPACITY
  if (funded < need) {
    funded += atmosphere.drawFrom(x, y, need - funded)
  }
  return funded
}

/** Account for water bound in spawn biomass by sourcing it from soil/air pools. */
export function fundInitialPlantStructuralWater(
  plant: { x: number; y: number; energy: number },
  soil: SoilAccess,
  atmosphere: AtmospherePool,
): void {
  const need = plant.energy * PLANT_WATER_PER_ENERGY
  if (need <= 0) return
  const funded = pullWaterFromPools(plant.x, plant.y, need, soil, atmosphere)
  if (funded < need) {
    plant.energy *= funded / need
  }
}

/** Split total water across surface pools, soil, and air. */
export function distributeInitialWorldWater(
  totalWater: number,
  soil: SoilMoisture,
  terrain: TerrainWater,
  atmosphere: Atmosphere,
): void {
  const soilShare = totalWater * INIT_WATER_SOIL_FRACTION
  const airShare = totalWater * INIT_WATER_AIR_FRACTION

  // Air and soil take their shares (each capped per cell); everything else — the pond share plus
  // whatever air/soil couldn't hold — floods the surface, filling valleys into lakes. This lets
  // the full requested water budget always fit: the land floods to hold the remainder.
  const airOverflow = atmosphere.fillUniform(airShare)
  const soilOverflow = soil.fillWithWaterUnits(soilShare)
  const surfaceUnits = totalWater - (airShare - airOverflow) - (soilShare - soilOverflow)
  terrain.floodToVolume(surfaceUnits)
}

function nearestSurfaceWater(creature: Creature, terrain: TerrainWater): { x: number; y: number } | null {
  const target = terrain.findBestSurfaceTarget(creature.x, creature.y, 600)
  return target ? { x: target.x, y: target.y } : null
}

/** Fund spawn hydration from air, then nearest standing water. */
export function fundInitialCreatureHydration(
  creatures: readonly Creature[],
  terrain: TerrainWater,
  atmosphere: Atmosphere,
): void {
  for (const creature of creatures) {
    const target = creature.hydration
    let funded = 0

    funded += atmosphere.drawFrom(creature.x, creature.y, target - funded)

    if (funded < target) {
      const waterCell = nearestSurfaceWater(creature, terrain)
      if (waterCell) {
        const stillNeed = target - funded
        const fromSurface = terrain.consumeAt(waterCell.x, waterCell.y, stillNeed)
        funded += fromSurface
      }
    }

    creature.hydration = funded
  }
}

/** @deprecated kept for distance checks in memory resolution */
export function surfaceWaterDistance(creature: Creature, terrain: TerrainWater): number {
  const target = terrain.findBestSurfaceTarget(creature.x, creature.y, 800)
  if (!target) return Infinity
  return toroidalDistance(creature, target)
}
