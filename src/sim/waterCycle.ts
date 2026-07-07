import {
  AIR_CELL_SIZE,
  AIR_CELL_WATER_CAPACITY,
  AIR_FULL_HUMIDITY,
  AIR_GROUND_WET_SURFACE_DEPTH,
  AIR_PRECIP_GAP_RATE,
  AIR_PRECIP_MIN_UNITS,
  AIR_RAIN_OVER_FULL_SURFACE_CHANCE,
  AIR_RAIN_RANDOM_CHANCE,
  DEATH_WATER_TO_SOIL,
  SURFACE_EVAPORATION_SCALE,
  RAIN_ARM_HUMIDITY,
  RAIN_START_HUMIDITY,
  SOIL_CELL_WATER_CAPACITY,
  SOIL_EVAP_BASE,
  SOIL_SATURATED_EVAP_BOOST,
  SOIL_SATURATED_MOISTURE,
  WIND_DIR_DRIFT,
  WIND_MAX_SPEED,
  WIND_MIN_SPEED,
  WIND_SPEED_DRIFT,
} from './config'
import type { SoilMoisture } from './soilMoisture'
import type { AirGridSnapshot, Creature, Plant } from './types'
import type { TerrainWater } from './terrainWater'
import type { Rng } from './rng'
import { getWorldBounds } from './worldBounds'
import { plantHydricWater } from './plantWaterUptake'
import { releaseTranspiredWater } from './transpiration'

export type { AtmospherePool } from './transpiration'
export type { AirGridSnapshot } from './types'

/** Share of cloud cells that must be actively raining before the world reads as "raining". */
const AIR_RAIN_GLOBAL_FRACTION = 0.05

export type WindState = {
  /** Direction the air is moving toward, radians (0 = +x). */
  dir: number
  /** World px/tick drift speed. */
  speed: number
}

function wrapFloat(value: number, span: number): number {
  return ((value % span) + span) % span
}

function wrapIndex(value: number, count: number): number {
  return ((value % count) + count) % count
}

/**
 * Air moisture as a moving grid. The whole field drifts with wind and wraps at the map edges;
 * each cell holds up to {@link AIR_CELL_WATER_CAPACITY}. Humidity is per-cell (vapor / capacity),
 * and rain falls locally onto the ground beneath each saturated cloud cell.
 */
export class Atmosphere {
  readonly cols: number
  readonly rows: number
  readonly cellSize: number
  /** Render cell dimensions — cols·cellW == gridWidth == world, so wraps never overlap. */
  readonly cellW: number
  readonly cellH: number
  readonly cellCapacity = AIR_CELL_WATER_CAPACITY
  readonly gridWidth: number
  readonly gridHeight: number
  readonly vapor: Float32Array
  private readonly raining: Uint8Array
  private rainingCount = 0

  windDir = 0
  windSpeed = 0
  offsetX = 0
  offsetY = 0

  private terrain: TerrainWater | null = null
  private soil: SoilMoisture | null = null
  private rng: Rng | null = null

  constructor() {
    const bounds = getWorldBounds()
    this.cellSize = AIR_CELL_SIZE
    this.cols = Math.max(1, Math.ceil(bounds.width / this.cellSize))
    this.rows = Math.max(1, Math.ceil(bounds.height / this.cellSize))
    // Grid period is exactly the world; cells are slightly rectangular so they tile it perfectly
    // with no surplus strip to wrap back onto the first row/column.
    this.gridWidth = bounds.width
    this.gridHeight = bounds.height
    this.cellW = this.gridWidth / this.cols
    this.cellH = this.gridHeight / this.rows
    const n = this.cols * this.rows
    this.vapor = new Float32Array(n)
    this.raining = new Uint8Array(n)
  }

  /** Wire the overflow sinks (surface, then soil) and the wind RNG. */
  attach(terrain: TerrainWater, soil: SoilMoisture, rng: Rng): void {
    this.terrain = terrain
    this.soil = soil
    this.rng = rng
    this.initWind()
  }

  private initWind(): void {
    const rng = this.rng
    this.windDir = rng ? rng.range(0, Math.PI * 2) : 0
    this.windSpeed = rng ? rng.range(WIND_MIN_SPEED, WIND_MAX_SPEED) : WIND_MIN_SPEED
  }

  reset(): void {
    this.vapor.fill(0)
    this.raining.fill(0)
    this.rainingCount = 0
    this.offsetX = 0
    this.offsetY = 0
    this.initWind()
  }

  /** Spread water units evenly across cells up to capacity; returns the overflow that didn't fit. */
  fillUniform(units: number): number {
    const n = this.vapor.length
    if (n <= 0 || units <= 0) return Math.max(0, units)
    const perCell = units / n
    let stored = 0
    for (let i = 0; i < n; i++) {
      const amount = Math.min(this.cellCapacity, perCell)
      this.vapor[i] = amount
      stored += amount
    }
    return Math.max(0, units - stored)
  }

  get vaporCapacityTotal(): number {
    return this.vapor.length * this.cellCapacity
  }

  totalWater(): number {
    let sum = 0
    for (let i = 0; i < this.vapor.length; i++) sum += this.vapor[i]
    return sum
  }

  /** Average relative humidity across the whole sky (0–1). */
  get humidity(): number {
    const cap = this.vaporCapacityTotal
    if (cap <= 0) return 0
    return Math.min(1, Math.max(0, this.totalWater() / cap))
  }

  get isRaining(): boolean {
    return this.vapor.length > 0 && this.rainingCount / this.vapor.length >= AIR_RAIN_GLOBAL_FRACTION
  }

  get wind(): WindState {
    return { dir: this.windDir, speed: this.windSpeed }
  }

  /** Air cell currently sitting over a world position (accounts for wind offset). */
  cellIndexAtWorld(x: number, y: number): number {
    const ax = wrapFloat(x - this.offsetX, this.gridWidth)
    const ay = wrapFloat(y - this.offsetY, this.gridHeight)
    const col = Math.min(this.cols - 1, Math.max(0, Math.floor(ax / this.cellW)))
    const row = Math.min(this.rows - 1, Math.max(0, Math.floor(ay / this.cellH)))
    return row * this.cols + col
  }

  /** Soil/terrain cell centers whose footprint lies under this air cell (wind-shifted). */
  private groundCellsUnder(index: number, soil: SoilMoisture): { x: number; y: number }[] {
    const acol = index % this.cols
    const arow = Math.floor(index / this.cols)
    const baseX = wrapFloat(acol * this.cellW + this.offsetX, this.gridWidth)
    const baseY = wrapFloat(arow * this.cellH + this.offsetY, this.gridHeight)
    const spanC = Math.ceil(this.cellW / soil.cellSize) + 1
    const spanR = Math.ceil(this.cellH / soil.cellSize) + 1
    const soilColStart = Math.floor(baseX / soil.cellSize)
    const soilRowStart = Math.floor(baseY / soil.cellSize)
    const out: { x: number; y: number }[] = []

    for (let dr = 0; dr < spanR; dr++) {
      for (let dc = 0; dc < spanC; dc++) {
        const cx = wrapIndex(soilColStart + dc, soil.cols)
        const cy = wrapIndex(soilRowStart + dr, soil.rows)
        const x = (cx + 0.5) * soil.cellSize
        const y = (cy + 0.5) * soil.cellSize
        if (this.cellIndexAtWorld(x, y) === index) out.push({ x, y })
      }
    }

    return out
  }

  private groundWetnessAt(x: number, y: number, terrain: TerrainWater, soil: SoilMoisture): number {
    const surfaceDepth = terrain.sampleDepth(x, y)
    return surfaceDepth > AIR_GROUND_WET_SURFACE_DEPTH ? 1 : soil.sample(x, y)
  }

  private averageWetnessUnder(index: number, terrain: TerrainWater, soil: SoilMoisture): number {
    const cells = this.groundCellsUnder(index, soil)
    if (cells.length === 0) return 0
    let sum = 0
    for (const { x, y } of cells) sum += this.groundWetnessAt(x, y, terrain, soil)
    return sum / cells.length
  }

  /** Share of standing-water tiles beneath this cell that are at surface capacity. */
  private fractionFullSurfaceUnder(index: number, terrain: TerrainWater, soil: SoilMoisture): number {
    const cells = this.groundCellsUnder(index, soil)
    if (cells.length === 0) return 0
    let standingCount = 0
    let fullCount = 0
    for (const { x, y } of cells) {
      if (terrain.sampleDepth(x, y) <= AIR_GROUND_WET_SURFACE_DEPTH) continue
      standingCount++
      if (terrain.surfaceRoomAt(x, y) <= 0.05) fullCount++
    }
    if (standingCount === 0) return 0
    return fullCount / standingCount
  }

  /** Spread precipitation evenly across all ground tiles beneath an air cell. */
  private depositPrecipitation(
    want: number,
    index: number,
    terrain: TerrainWater,
    soil: SoilMoisture,
    forceOverflow: boolean,
  ): number {
    const cells = this.groundCellsUnder(index, soil)
    if (cells.length === 0 || want <= 0) return 0

    const perCell = want / cells.length
    let landed = 0

    for (const { x, y } of cells) {
      let cellLanded = soil.depositWater(x, y, perCell)
      let leftover = perCell - cellLanded
      if (leftover > 1e-6) {
        const room = terrain.surfaceRoomAt(x, y)
        const toSurface = Math.min(room, leftover)
        if (toSurface > 1e-6) {
          terrain.depositSurfaceAt(x, y, toSurface)
          cellLanded += toSurface
          leftover -= toSurface
        }
      }
      if (forceOverflow && leftover > 1e-6) {
        terrain.depositSurfaceAt(x, y, leftover)
        cellLanded += leftover
      }
      landed += cellLanded
    }

    return landed
  }

  /** Deposit vapor into the local cell up to capacity; returns how much was accepted. */
  acceptVaporAt(x: number, y: number, units: number): number {
    if (units <= 0) return 0
    const idx = this.cellIndexAtWorld(x, y)
    if (this.raining[idx]) return 0
    const room = this.cellCapacity - this.vapor[idx]
    if (room <= 0) return 0
    const accepted = Math.min(room, units)
    this.vapor[idx] += accepted
    return accepted
  }

  /**
   * Vent water into the sky at a world position. Fills the local air cell to capacity, then
   * routes any overflow to surface water, then soil. Guarantees conservation (a final sliver
   * that nothing can hold stays as transient supersaturation in the air cell).
   */
  vent(x: number, y: number, units: number): number {
    if (units <= 0) return 0
    const idx = this.cellIndexAtWorld(x, y)
    const room = Math.max(0, this.cellCapacity - this.vapor[idx])
    const toAir = Math.min(room, units)
    this.vapor[idx] += toAir
    let remaining = units - toAir

    if (remaining > 1e-9 && this.terrain) {
      remaining -= this.terrain.depositSurfaceAt(x, y, remaining)
    }
    if (remaining > 1e-9 && this.soil) {
      remaining -= this.soil.depositWater(x, y, remaining)
    }
    if (remaining > 1e-9) {
      this.vapor[idx] += remaining
    }
    return units
  }

  /** Pull up to `units` of vapor out of the local air cell; returns the amount taken. */
  drawFrom(x: number, y: number, units: number): number {
    if (units <= 0) return 0
    const idx = this.cellIndexAtWorld(x, y)
    const taken = Math.min(this.vapor[idx], units)
    this.vapor[idx] -= taken
    return taken
  }

  /** Drift the whole field by the wind vector (wrapping) and evolve wind by a slow random walk. */
  advect(dt = 1): void {
    const rng = this.rng
    if (rng) {
      this.windDir += (rng.next() - 0.5) * 2 * WIND_DIR_DRIFT * dt
      this.windSpeed += (rng.next() - 0.5) * 2 * WIND_SPEED_DRIFT * dt
      this.windSpeed = clamp(this.windSpeed, WIND_MIN_SPEED, WIND_MAX_SPEED)
    }
    const vx = Math.cos(this.windDir) * this.windSpeed * dt
    const vy = Math.sin(this.windDir) * this.windSpeed * dt
    this.offsetX = wrapFloat(this.offsetX + vx, this.gridWidth)
    this.offsetY = wrapFloat(this.offsetY + vy, this.gridHeight)
  }

  /**
   * Three cloud states per cell:
   * - **Filling** — vapor below capacity; absorbs from wet ground via evaporation (not raining).
   * - **Full** — at 100% humidity; holds until over drier ground or a random rain roll.
   * - **Raining** — latched at full; drains until empty across all ground tiles beneath.
   */
  tickRain(terrain: TerrainWater, soil: SoilMoisture): void {
    const cap = this.cellCapacity
    const emptyEpsilon = 1e-4
    const rng = this.rng
    let rainingCount = 0

    for (let i = 0; i < this.vapor.length; i++) {
      if (this.vapor[i] <= emptyEpsilon) {
        this.vapor[i] = 0
        this.raining[i] = 0
        continue
      }

      const humidity = this.vapor[i] / cap
      const wetness = this.averageWetnessUnder(i, terrain, soil)

      if (!this.raining[i] && humidity >= AIR_FULL_HUMIDITY) {
        const overDrierGround = humidity > wetness + 1e-4
        if (overDrierGround) {
          this.raining[i] = 1
        } else if (rng) {
          const fullSurfaceFrac = this.fractionFullSurfaceUnder(i, terrain, soil)
          const rainChance =
            AIR_RAIN_RANDOM_CHANCE +
            fullSurfaceFrac * (AIR_RAIN_OVER_FULL_SURFACE_CHANCE - AIR_RAIN_RANDOM_CHANCE)
          if (rng.next() < rainChance) {
            this.raining[i] = 1
          }
        }
      }

      if (!this.raining[i]) continue

      const gap = humidity - wetness
      let want =
        gap > 0
          ? Math.max(AIR_PRECIP_MIN_UNITS, gap * cap * AIR_PRECIP_GAP_RATE)
          : AIR_PRECIP_MIN_UNITS
      want = Math.min(this.vapor[i], want)

      const landed = this.depositPrecipitation(want, i, terrain, soil, true)
      this.vapor[i] -= landed

      if (this.vapor[i] <= emptyEpsilon) {
        this.vapor[i] = 0
        this.raining[i] = 0
      } else {
        rainingCount += 1
      }
    }

    this.rainingCount = rainingCount
  }

  snapshot(): AirGridSnapshot {
    return {
      cols: this.cols,
      rows: this.rows,
      cellSize: this.cellSize,
      cellW: this.cellW,
      cellH: this.cellH,
      vapor: this.vapor,
      raining: this.raining,
      cellCapacity: this.cellCapacity,
      offsetX: this.offsetX,
      offsetY: this.offsetY,
    }
  }
}

function rawSurfaceEvaporationRate(
  tempC: number,
  relativeHumidity: number,
  raining = false,
): number {
  const tempFactor = 0.45 + clamp((tempC + 5) / 38, 0, 1) * 0.95
  const dryness = Math.max(0, 1 - relativeHumidity * 0.98)
  let rate = tempFactor * dryness
  if (raining) return 0
  if (relativeHumidity >= RAIN_START_HUMIDITY) rate *= 0.08
  else if (relativeHumidity >= RAIN_ARM_HUMIDITY) rate *= 0.35
  return rate
}

export function surfaceEvaporationRate(
  tempC: number,
  relativeHumidity: number,
  raining = false,
): number {
  return rawSurfaceEvaporationRate(tempC, relativeHumidity, raining) * SURFACE_EVAPORATION_SCALE
}

const SWEAT_REFERENCE_RATE = rawSurfaceEvaporationRate(18, 0.55)

export function creatureSweatLoss(
  baseLoss: number,
  tempC: number,
  relativeHumidity: number,
  raining = false,
): number {
  const rate = surfaceEvaporationRate(tempC, relativeHumidity, raining)
  return baseLoss * (rate / SWEAT_REFERENCE_RATE)
}

export function plantStoredWater(plant: Plant): number {
  return Math.max(0, plant.water)
}

export function plantHydricMass(plant: Plant): number {
  return plantHydricWater(plant)
}

export function measureTotalWater(
  terrain: TerrainWater,
  soil: SoilMoisture,
  creatures: readonly Creature[],
  plants: readonly Plant[],
  atmosphere: Atmosphere,
  grassWater = 0,
): number {
  let total = atmosphere.totalWater()
  total += terrain.totalWater()
  total += soil.totalWater()
  for (const creature of creatures) total += creature.hydration
  for (const plant of plants) total += plantHydricWater(plant)
  total += grassWater
  return total
}

export function evaporateSoilToAir(
  soil: SoilMoisture,
  atmosphere: Atmosphere,
  tempC: number,
  terrain: TerrainWater,
): void {
  // Evaporation always rises into the air cell directly above each soil cell. It self-limits
  // per tile: a saturated (raining) air cell has no room, so `acceptVaporAt` returns 0 there.
  const evapMult = surfaceEvaporationRate(tempC, atmosphere.humidity, false)
  const avgMoisture = soil.averageMoisture()
  let swampMult = 1
  if (avgMoisture > SOIL_SATURATED_MOISTURE) {
    swampMult = 1 + (avgMoisture - SOIL_SATURATED_MOISTURE) * SOIL_SATURATED_EVAP_BOOST
  }
  const baseRate = SOIL_EVAP_BASE * SOIL_CELL_WATER_CAPACITY * evapMult * swampMult
  soil.evaporateToAtmosphere(
    baseRate,
    (x, y, amount) => atmosphere.acceptVaporAt(x, y, amount),
    (idx) => terrain.surfaceWater[idx] <= 0.05,
  )
}

export function tickWaterCycle(
  atmosphere: Atmosphere,
  soil: SoilMoisture,
  terrain: TerrainWater,
  tempC: number,
): void {
  atmosphere.advect(1)

  // Surface and soil water always evaporate up into the air cell above (per-tile, room-capped),
  // so it isn't globally suspended just because some other region is raining.
  terrain.evaporateToAir(tempC, atmosphere.humidity, false, (x, y, amount) =>
    atmosphere.acceptVaporAt(x, y, amount),
  )
  terrain.tickInfiltration(soil, atmosphere.isRaining)
  evaporateSoilToAir(soil, atmosphere, tempC, terrain)

  atmosphere.tickRain(terrain, soil)
}

export function releaseCreatureWater(
  creature: Creature,
  soil: SoilMoisture,
  atmosphere: Atmosphere,
): void {
  const water = creature.hydration
  if (water <= 0) return

  const toSoil = water * DEATH_WATER_TO_SOIL
  const toAir = water - toSoil
  const soilApplied = soil.depositWater(creature.x, creature.y, toSoil)
  atmosphere.vent(creature.x, creature.y, toAir + (toSoil - soilApplied))
  creature.hydration = 0
}

export function releasePlantWater(
  plant: Plant,
  soil: SoilMoisture,
  atmosphere: Atmosphere,
): void {
  const water = plantHydricWater(plant)
  if (water <= 0) return

  const toSoil = water * DEATH_WATER_TO_SOIL
  const toAir = water - toSoil
  const soilApplied = soil.depositWater(plant.x, plant.y, toSoil)
  atmosphere.vent(plant.x, plant.y, toAir + (toSoil - soilApplied))
  plant.water = 0
  plant.energy = 0
}

export function releasePlantTranspiration(
  waterUnits: number,
  plant: Plant,
  soil: SoilMoisture,
  atmosphere: Atmosphere,
): void {
  if (waterUnits <= 0) return
  releaseTranspiredWater(atmosphere, soil, plant.x, plant.y, waterUnits)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
