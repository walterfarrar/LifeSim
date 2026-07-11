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

/**
 * Fund spawn hydration by drawing real water from the pools: standing surface water first
 * (creatures drink from ponds), then local air and soil. No water is minted — if pools can't
 * supply a spawn, the newcomer arrives thirsty rather than inflating the total budget.
 */
export function fundInitialCreatureHydration(
  creatures: readonly Creature[],
  terrain: TerrainWater,
  atmosphere: Atmosphere,
  soil: SoilAccess,
): void {
  for (const creature of creatures) {
    const target = creature.hydration
    if (target <= 0) {
      creature.hydration = 0
      continue
    }
    let funded = 0

    // Keep pulling from the richest remaining surface cell until birth hydration is met
    // (or surface water is exhausted). A single cell often can't fund a whole founder group.
    for (let pulls = 0; pulls < 12 && funded < target; pulls++) {
      const waterCell = terrain.findBestSurfaceTargetGlobal(creature.x, creature.y)
      if (!waterCell) break
      const taken = terrain.consumeAt(waterCell.x, waterCell.y, target - funded)
      if (taken <= 0) break
      funded += taken
    }
    if (funded < target) {
      funded += pullWaterFromPools(creature.x, creature.y, target - funded, soil, atmosphere)
    }

    creature.hydration = Math.min(target, funded)
  }
}

/** @deprecated kept for distance checks in memory resolution */
export function surfaceWaterDistance(creature: Creature, terrain: TerrainWater): number {
  const target = terrain.findBestSurfaceTarget(creature.x, creature.y, 800)
  if (!target) return Infinity
  return toroidalDistance(creature, target)
}
