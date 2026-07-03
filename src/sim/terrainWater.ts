import {
  DROWN_DEPTH_BODY_SIZE_MULT,
  GRASS_FLOOD_SUBMERGE_FREE_FRAC,
  GRASS_TURF_HEIGHT_FRAC,
  POND_DEFAULT_MAX_DEPTH,
  POND_DEPTH_PROFILE_POWER,
  POND_OUTER_RADIUS_SCALE,
  SOIL_CELL_SIZE,
  SURFACE_BALANCE_PASSES,
  SURFACE_EVAP_BASE,
  SURFACE_EVAPORATION_SCALE,
  SURFACE_FLOW_RATE,
  SURFACE_INFILTRATION_RATE,
  SURFACE_INFILTRATION_RAIN_MULT,
  SURFACE_LEVEL_TOLERANCE,
  SURFACE_RAIN_FILL_PER_TILE,
  SURFACE_BUCKET_MIN_CAPACITY,
  SURFACE_PUDDLE_MAX_DEPTH,
  TERRAIN_BASE_ELEVATION,
  TERRAIN_DETAIL_NOISE,
  TERRAIN_ELEVATION_MAX,
  TERRAIN_ELEVATION_FEET_PER_UNIT,
  TERRAIN_ELEVATION_MIN,
  TERRAIN_ELEVATION_SEA_LEVEL,
  TERRAIN_FEATURE_RADIUS_MAX,
  TERRAIN_FEATURE_RADIUS_MIN,
  TERRAIN_HILL_AMPLITUDE,
  TERRAIN_HILL_COUNT_MAX,
  TERRAIN_HILL_COUNT_MIN,
  TERRAIN_POND_CARVE_DEPTH,
  TERRAIN_ROLLING_AMPLITUDE,
  TERRAIN_ROLLING_WAVELENGTH_MAX,
  TERRAIN_ROLLING_WAVELENGTH_MIN,
  TERRAIN_SMOOTH_PASSES,
  TERRAIN_VALLEY_AMPLITUDE,
} from './config'
import type { Rng } from './rng'
import { toroidalDelta, wrapPosition } from './toroidal'
import type { SoilMoisture } from './soilMoisture'
import type { Creature, Vec2 } from './types'
import { getWorldBounds } from './worldBounds'

export type TerrainWaterSnapshot = {
  cols: number
  rows: number
  cellSize: number
  /** Flow/shading elevation (includes pond carve). Same units as elevation. */
  height: Float32Array
  /** Rolling-hill elevation before pond carve (≈ TERRAIN_ELEVATION_MIN–MAX). */
  elevation: Float32Array
  surfaceWater: Float32Array
  maxSurfaceWater: Float32Array
  isRaining: boolean
}

const TERRAIN_ELEVATION_SPAN = TERRAIN_ELEVATION_MAX - TERRAIN_ELEVATION_MIN

/** How far below the hilltops this cell sits — drives max standing water on non-pond tiles. */
export function surfaceCapacityFromElevation(elevation: number): number {
  return Math.max(0, TERRAIN_ELEVATION_MAX - elevation)
}

/** 0 at hilltops, 1 at lowest valleys — for shading and shelter. */
export function elevationBasinFactor(elevation: number): number {
  return clamp01((TERRAIN_ELEVATION_MAX - elevation) / TERRAIN_ELEVATION_SPAN)
}

/** Ground height in feet relative to sea level (negative = below, positive = above). */
export function elevationToFeet(elevation: number): number {
  return (elevation - TERRAIN_ELEVATION_SEA_LEVEL) * TERRAIN_ELEVATION_FEET_PER_UNIT
}

/** Human-readable height for UI — always includes a foot count. */
export function formatElevationFeet(elevation: number): string {
  const feet = elevationToFeet(elevation)
  const rounded = Math.round(feet)
  const n = Math.abs(rounded)
  if (rounded === 0) return '0 ft (at sea level)'
  if (rounded > 0) return `${n} ft above sea level`
  return `${n} ft below sea level`
}

export type SurfaceWaterTarget = {
  x: number
  y: number
  water: number
}

export type SurfaceWaterAppearance = {
  r: number
  g: number
  b: number
  alpha: number
  fill: number
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/** Visual water overlay — opacity from standing depth (1 ≈ faint, 10 ≈ light wash). */
export function computeSurfaceWaterAppearance(
  depth: number,
  maxDepth: number,
): SurfaceWaterAppearance | null {
  if (depth <= 0.05) return null

  const fill = clamp01(depth / Math.max(maxDepth, 1))
  const shallowNorm = clamp01(depth / SURFACE_PUDDLE_MAX_DEPTH)
  const alpha =
    0.045 +
    shallowNorm * 0.24 +
    (depth > SURFACE_PUDDLE_MAX_DEPTH
      ? clamp01((depth - SURFACE_PUDDLE_MAX_DEPTH) / Math.max(maxDepth - SURFACE_PUDDLE_MAX_DEPTH, 1)) *
        0.12
      : 0)
  const alphaClamped = Math.min(0.38, alpha)

  const r = Math.round(62 + shallowNorm * 58 + fill * 12)
  const g = Math.round(118 + shallowNorm * 72 + fill * 8)
  const b = Math.round(198 + shallowNorm * 57 + fill * 10)

  return { r, g, b, alpha: alphaClamped, fill }
}

/** Flood stress on turf — shallow rain films are OK; damage ramps once the crown is submerged. */
export function grassFloodStress(
  height: number,
  depth: number,
  maxCapacity: number,
  cellSize: number,
): number {
  const turfDepth = cellSize * GRASS_TURF_HEIGHT_FRAC
  const freeDepth = turfDepth * GRASS_FLOOD_SUBMERGE_FREE_FRAC
  if (depth <= freeDepth) return 0

  const submerged = depth - freeDepth
  const cover = clamp01(submerged / Math.max(turfDepth - freeDepth, 1))
  const capacity = Math.max(maxCapacity, 1)
  const fill = clamp01(depth / capacity)
  const low = elevationBasinFactor(height)

  return clamp01(cover * (0.18 + fill * 0.82) * (0.55 + low * 0.45))
}

/** Max standing depth for a cell (alias for maxSurfaceWater grid). */
export function tileMaxSurfaceDepth(maxSurfaceWater: number): number {
  return maxSurfaceWater
}

export class TerrainWater {
  readonly cols: number
  readonly rows: number
  readonly cellSize: number
  /** Flow/shading elevation (includes pond carve). */
  readonly height: Float32Array
  /** Rolling-hill elevation before pond carve. */
  readonly elevation: Float32Array
  readonly maxSurfaceWater: Float32Array
  readonly surfaceWater: Float32Array
  /** 1 where the carved pond bowl can hold standing water. */
  readonly pondMask: Uint8Array
  /** Main carved basin center (world px). */
  basinCenter: Vec2 = { x: 0, y: 0 }
  basinRadius = 0
  pondMaxDepth = POND_DEFAULT_MAX_DEPTH

  constructor(cellSize = SOIL_CELL_SIZE) {
    const bounds = getWorldBounds()
    this.cellSize = cellSize
    this.cols = Math.max(1, Math.ceil(bounds.width / cellSize))
    this.rows = Math.max(1, Math.ceil(bounds.height / cellSize))
    const n = this.cols * this.rows
    this.height = new Float32Array(n)
    this.elevation = new Float32Array(n)
    this.maxSurfaceWater = new Float32Array(n)
    this.surfaceWater = new Float32Array(n)
    this.pondMask = new Uint8Array(n)
  }

  reset(): void {
    const mid = (TERRAIN_ELEVATION_MIN + TERRAIN_ELEVATION_MAX) / 2
    this.height.fill(mid)
    this.elevation.fill(mid)
    this.maxSurfaceWater.fill(0)
    this.surfaceWater.fill(0)
    this.pondMask.fill(0)
  }

  generate(rng: Rng, basinRadius: number, pondMaxDepth = POND_DEFAULT_MAX_DEPTH): void {
    this.basinRadius = basinRadius
    this.pondMaxDepth = pondMaxDepth

    const n = this.height.length
    const scratch = new Float32Array(n)
    this.synthesizeRollingHeights(rng, scratch)
    this.smoothHeightField(scratch, TERRAIN_SMOOTH_PASSES)
    this.scaleToElevationRange(scratch)
    this.elevation.set(scratch)
    this.basinCenter = this.lowestValleyCenter(scratch)

    const carveReach = basinRadius * POND_OUTER_RADIUS_SCALE
    for (let cy = 0; cy < this.rows; cy++) {
      for (let cx = 0; cx < this.cols; cx++) {
        const idx = cy * this.cols + cx
        const center = this.cellWorldCenter(cx, cy)
        const { dx, dy } = toroidalDelta(center, this.basinCenter)
        const dist = Math.hypot(dx, dy)
        const carve =
          dist < carveReach
            ? (1 - dist / carveReach) ** 1.18 * TERRAIN_POND_CARVE_DEPTH
            : 0
        this.height[idx] = Math.max(
          TERRAIN_ELEVATION_MIN,
          scratch[idx] - carve,
        )
      }
    }

    for (let cy = 0; cy < this.rows; cy++) {
      for (let cx = 0; cx < this.cols; cx++) {
        const idx = cy * this.cols + cx
        const center = this.cellWorldCenter(cx, cy)
        const { dx, dy } = toroidalDelta(center, this.basinCenter)
        const dist = Math.hypot(dx, dy)
        const pondBonus = this.pondDepthBonus(dist)
        this.pondMask[idx] = pondBonus > 0 ? 1 : 0
        this.maxSurfaceWater[idx] = this.computeMaxDepth(scratch[idx], dist)
      }
    }
    this.surfaceWater.fill(0)
  }

  /** Coherent hills and valleys from a few broad features plus gentle rolling slopes. */
  private synthesizeRollingHeights(rng: Rng, scratch: Float32Array): void {
    const bounds = getWorldBounds()
    const featureCount = rng.int(TERRAIN_HILL_COUNT_MIN, TERRAIN_HILL_COUNT_MAX)
    const features: Array<{ x: number; y: number; amp: number; spread: number }> = []

    for (let i = 0; i < featureCount; i++) {
      const isValley = rng.chance(0.45)
      features.push({
        x: rng.range(0, bounds.width),
        y: rng.range(0, bounds.height),
        amp: isValley
          ? -rng.range(TERRAIN_VALLEY_AMPLITUDE * 0.55, TERRAIN_VALLEY_AMPLITUDE)
          : rng.range(TERRAIN_HILL_AMPLITUDE * 0.6, TERRAIN_HILL_AMPLITUDE),
        spread: rng.range(TERRAIN_FEATURE_RADIUS_MIN, TERRAIN_FEATURE_RADIUS_MAX),
      })
    }

    const rollPhaseX = rng.range(0, Math.PI * 2)
    const rollPhaseY = rng.range(0, Math.PI * 2)
    const rollWavelength = rng.range(TERRAIN_ROLLING_WAVELENGTH_MIN, TERRAIN_ROLLING_WAVELENGTH_MAX)

    for (let cy = 0; cy < this.rows; cy++) {
      for (let cx = 0; cx < this.cols; cx++) {
        const idx = cy * this.cols + cx
        const center = this.cellWorldCenter(cx, cy)
        let elevation = TERRAIN_BASE_ELEVATION

        for (const feature of features) {
          const { dx, dy } = toroidalDelta(center, feature)
          const dist = Math.hypot(dx, dy)
          const t = dist / feature.spread
          if (t >= 1.75) continue
          const bump = Math.exp(-0.5 * t * t)
          elevation += feature.amp * bump
        }

        elevation +=
          Math.sin(center.x / rollWavelength + rollPhaseX) *
          Math.cos(center.y / rollWavelength + rollPhaseY) *
          TERRAIN_ROLLING_AMPLITUDE
        elevation += rng.range(-TERRAIN_DETAIL_NOISE, TERRAIN_DETAIL_NOISE)

        scratch[idx] = elevation
      }
    }
  }

  /** Weighted neighbor blur — softens terrain into continuous slopes. */
  private smoothHeightField(field: Float32Array, passes: number): void {
    const temp = new Float32Array(field.length)
    for (let pass = 0; pass < passes; pass++) {
      for (let cy = 0; cy < this.rows; cy++) {
        for (let cx = 0; cx < this.cols; cx++) {
          const idx = cy * this.cols + cx
          let sum = field[idx] * 4
          let weight = 4
          for (const [dx, dy, w] of [
            [1, 0, 2],
            [-1, 0, 2],
            [0, 1, 2],
            [0, -1, 2],
            [1, 1, 1],
            [1, -1, 1],
            [-1, 1, 1],
            [-1, -1, 1],
          ] as const) {
            const nIdx = this.wrapCell(cy + dy, cx + dx)
            sum += field[nIdx] * w
            weight += w
          }
          temp[idx] = sum / weight
        }
      }
      field.set(temp)
    }
  }

  /** Pond sits in the deepest valley so ground height and water depth align visually. */
  private lowestValleyCenter(field: Float32Array): Vec2 {
    let bestIdx = 0
    let bestElev = Infinity
    for (let i = 0; i < field.length; i++) {
      if (field[i] < bestElev) {
        bestElev = field[i]
        bestIdx = i
      }
    }
    const cx = bestIdx % this.cols
    const cy = Math.floor(bestIdx / this.cols)
    return this.cellWorldCenter(cx, cy)
  }

  /** Stretch generated hills into the playable elevation span (≈ 0–10 on non-pond tiles). */
  private scaleToElevationRange(field: Float32Array): void {
    let min = Infinity
    let max = -Infinity
    for (let i = 0; i < field.length; i++) {
      min = Math.min(min, field[i])
      max = Math.max(max, field[i])
    }
    const span = Math.max(max - min, 1e-6)
    for (let i = 0; i < field.length; i++) {
      field[i] =
        TERRAIN_ELEVATION_MIN +
        ((field[i] - min) / span) * (TERRAIN_ELEVATION_MAX - TERRAIN_ELEVATION_MIN)
    }
  }

  /** Gradual pond bowl — deepest at center, merges with puddle depths at the rim. */
  private pondDepthBonus(dist: number): number {
    const outer = this.basinRadius * POND_OUTER_RADIUS_SCALE
    if (dist >= outer) return 0
    const t = 1 - dist / outer
    return t ** POND_DEPTH_PROFILE_POWER * this.pondMaxDepth
  }

  private computeMaxDepth(elevation: number, dist: number): number {
    return surfaceCapacityFromElevation(elevation) + this.pondDepthBonus(dist)
  }

  private surfaceRoom(cellIdx: number): number {
    return Math.max(0, this.maxSurfaceWater[cellIdx] - this.surfaceWater[cellIdx])
  }

  snapshot(isRaining: boolean): TerrainWaterSnapshot {
    return {
      cols: this.cols,
      rows: this.rows,
      cellSize: this.cellSize,
      height: this.height,
      elevation: this.elevation,
      surfaceWater: this.surfaceWater,
      maxSurfaceWater: this.maxSurfaceWater,
      isRaining,
    }
  }

  totalWater(): number {
    let sum = 0
    for (let i = 0; i < this.surfaceWater.length; i++) sum += this.surfaceWater[i]
    return sum
  }

  /** Same fill rate per eligible bucket each rain round (every valley/puddle/pond tile). */
  private distributeWaterAtUniformRate(
    waterUnits: number,
    isEligible: (idx: number) => boolean,
  ): number {
    if (waterUnits <= 0) return 0

    let remaining = waterUnits
    let applied = 0

    while (remaining > 1e-4) {
      const eligible: number[] = []
      for (let i = 0; i < this.surfaceWater.length; i++) {
        if (isEligible(i) && this.surfaceRoom(i) > 1e-4) eligible.push(i)
      }
      if (eligible.length === 0) break

      const fullRoundCost = eligible.length * SURFACE_RAIN_FILL_PER_TILE
      const fillRate =
        remaining >= fullRoundCost
          ? SURFACE_RAIN_FILL_PER_TILE
          : remaining / eligible.length

      let roundApplied = 0
      for (const idx of eligible) {
        const add = Math.min(this.surfaceRoom(idx), fillRate)
        if (add <= 1e-4) continue
        this.surfaceWater[idx] += add
        roundApplied += add
      }

      if (roundApplied <= 1e-4) break
      applied += roundApplied
      remaining -= roundApplied
    }

    return applied
  }

  private isSurfaceBucket(idx: number): boolean {
    return this.maxSurfaceWater[idx] > SURFACE_BUCKET_MIN_CAPACITY
  }

  fillWithWaterUnits(waterUnits: number): number {
    return this.distributeWaterAtUniformRate(waterUnits, (idx) => this.pondMask[idx] === 1)
  }

  cellIndex(x: number, y: number): number {
    const cx = this.wrap(Math.floor(x / this.cellSize), this.cols)
    const cy = this.wrap(Math.floor(y / this.cellSize), this.rows)
    return cy * this.cols + cx
  }

  sampleDepth(x: number, y: number): number {
    return this.surfaceWater[this.cellIndex(x, y)]
  }

  sampleHeight(x: number, y: number): number {
    return this.height[this.cellIndex(x, y)]
  }

  /** True when standing water can pool here (pond bowl tile). */
  isPondAt(x: number, y: number): boolean {
    return this.pondMask[this.cellIndex(x, y)] === 1
  }

  /** Keep spawns on dry land — nudge away from the pond when needed. */
  resolveDryLandSpawn(rng: Rng, position: Vec2): Vec2 {
    if (!this.isPondAt(position.x, position.y)) {
      return wrapPosition(position)
    }

    const outer = this.basinRadius * POND_OUTER_RADIUS_SCALE
    const push = outer + this.cellSize * 2
    const { dx, dy } = toroidalDelta(position, this.basinCenter)
    const dist = Math.max(1e-3, Math.hypot(dx, dy))

    for (let attempt = 0; attempt < 12; attempt++) {
      const scale = push / dist + attempt * this.cellSize * 0.5
      const candidate = wrapPosition({
        x: this.basinCenter.x + dx * scale,
        y: this.basinCenter.y + dy * scale,
      })
      if (!this.isPondAt(candidate.x, candidate.y)) return candidate
    }

    for (let attempt = 0; attempt < 48; attempt++) {
      const cx = rng.int(0, this.cols - 1)
      const cy = rng.int(0, this.rows - 1)
      if (this.pondMask[cy * this.cols + cx] === 1) continue
      return this.cellWorldCenter(cx, cy)
    }

    const angle = rng.range(0, Math.PI * 2)
    return wrapPosition({
      x: this.basinCenter.x + Math.cos(angle) * push,
      y: this.basinCenter.y + Math.sin(angle) * push,
    })
  }

  /** Standing water available for drinking at a world position. */
  sampleDrinkable(x: number, y: number): number {
    const depth = this.sampleDepth(x, y)
    return depth > 0.5 ? depth : 0
  }

  receivePrecipitation(waterUnits: number): number {
    return this.distributeWaterAtUniformRate(waterUnits, (idx) => this.isSurfaceBucket(idx))
  }

  /** Each wet tile loses water at the same rate — like identical buckets, regardless of depth. */
  evaporateToAir(tempC: number, relativeHumidity: number, raining: boolean): number {
    if (raining) return 0
    const evapMult = localSurfaceEvaporationRate(tempC, relativeHumidity)
    const rate = SURFACE_EVAP_BASE * evapMult
    let total = 0
    for (let i = 0; i < this.surfaceWater.length; i++) {
      const depth = this.surfaceWater[i]
      if (depth <= 0) continue
      const evap = Math.min(depth, rate)
      this.surfaceWater[i] -= evap
      total += evap
    }
    return total
  }

  /** Neighbors spill into a tile after drinking lowers its water level. */
  private spillToCell(cellIdx: number): void {
    if (SURFACE_FLOW_RATE <= 0) return

    const cy = Math.floor(cellIdx / this.cols)
    const cx = cellIdx % this.cols

    for (let pass = 0; pass < SURFACE_BALANCE_PASSES; pass++) {
      const next = new Float32Array(this.surfaceWater)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nIdx = this.wrapCell(cy + dy, cx + dx)
        this.balanceSurfaceBetween(cellIdx, nIdx, next)
      }
      this.surfaceWater.set(next)
    }
  }

  private waterSurface(idx: number, depths: Float32Array): number {
    return this.height[idx] + depths[idx]
  }

  private balanceSurfaceBetween(fromIdx: number, toIdx: number, next: Float32Array): void {
    const surfaceFrom = this.waterSurface(fromIdx, next)
    const surfaceTo = this.waterSurface(toIdx, next)
    const delta = surfaceFrom - surfaceTo
    if (Math.abs(delta) <= SURFACE_LEVEL_TOLERANCE) return

    if (delta > 0) {
      this.transferTowardSurface(fromIdx, toIdx, next, surfaceFrom, surfaceTo)
    } else {
      this.transferTowardSurface(toIdx, fromIdx, next, surfaceTo, surfaceFrom)
    }
  }

  private transferTowardSurface(
    fromIdx: number,
    toIdx: number,
    next: Float32Array,
    highSurface: number,
    lowSurface: number,
  ): void {
    if (next[fromIdx] <= 0) return

    const head = (highSurface - lowSurface) / TERRAIN_ELEVATION_SPAN
    const targetDepth = Math.min(this.maxSurfaceWater[toIdx], highSurface - this.height[toIdx])
    const room = Math.max(0, targetDepth - next[toIdx])
    if (room <= 0) return

    const transfer = Math.min(
      next[fromIdx],
      room,
      SURFACE_FLOW_RATE * head * 40,
      next[fromIdx] * 0.45,
    )
    if (transfer <= 1e-4) return

    next[fromIdx] -= transfer
    next[toIdx] += transfer
  }

  /** Surface water slowly soaks into soil when the soil column has room. */
  tickInfiltration(soil: SoilMoisture, raining = false): number {
    if (SURFACE_INFILTRATION_RATE <= 0) return 0
    const rateMult = raining ? SURFACE_INFILTRATION_RAIN_MULT : 1
    let total = 0
    for (let cy = 0; cy < this.rows; cy++) {
      for (let cx = 0; cx < this.cols; cx++) {
        const idx = cy * this.cols + cx
        const depth = this.surfaceWater[idx]
        if (depth <= 0) continue
        const { x, y } = this.cellWorldCenter(cx, cy)
        if (soil.sample(x, y) >= 0.999) continue
        const infiltrate = Math.min(depth, SURFACE_INFILTRATION_RATE * rateMult)
        const applied = soil.depositWater(x, y, infiltrate)
        this.surfaceWater[idx] -= applied
        total += applied
      }
    }
    return total
  }

  consumeAt(x: number, y: number, amount: number): number {
    if (amount <= 0) return 0
    const idx = this.cellIndex(x, y)
    const taken = Math.min(this.surfaceWater[idx], amount)
    this.surfaceWater[idx] -= taken
    if (taken > 0) this.spillToCell(idx)
    return taken
  }

  findBestSurfaceTarget(x: number, y: number, seekRange: number): SurfaceWaterTarget | null {
    const cellRange = Math.ceil(seekRange / this.cellSize) + 1
    const cx0 = this.wrap(Math.floor(x / this.cellSize), this.cols)
    const cy0 = this.wrap(Math.floor(y / this.cellSize), this.rows)

    let best: SurfaceWaterTarget | null = null
    let bestScore = -1

    for (let dy = -cellRange; dy <= cellRange; dy++) {
      for (let dx = -cellRange; dx <= cellRange; dx++) {
        const cx = this.wrap(cx0 + dx, this.cols)
        const cy = this.wrap(cy0 + dy, this.rows)
        const idx = cy * this.cols + cx
        const water = this.surfaceWater[idx]
        if (water <= 0.5) continue
        const center = this.cellWorldCenter(cx, cy)
        const { dx: ddx, dy: ddy } = toroidalDelta({ x, y }, center)
        const dist = Math.hypot(ddx, ddy)
        if (dist > seekRange) continue
        const score = water / (1 + dist / Math.max(seekRange, 1))
        if (score > bestScore) {
          bestScore = score
          best = { x: center.x, y: center.y, water }
        }
      }
    }

    return best
  }

  surfaceWaterScore(dist: number, seekRange: number, pondDrinking: number): number {
    if (pondDrinking <= 0) return 0
    return pondDrinking / (1 + dist / Math.max(seekRange, 1))
  }

  /** Shore point outside standing water, toward `from`. */
  shoreApproachTarget(from: Vec2, waterCenter: Vec2, margin: number): Vec2 {
    const { dx, dy } = toroidalDelta(from, waterCenter)
    const dist = Math.hypot(dx, dy)
    if (dist < 1e-3) {
      return wrapPosition({ x: waterCenter.x + this.cellSize * 0.5 + margin, y: waterCenter.y })
    }
    const nx = dx / dist
    const ny = dy / dist
    const shoreDist = this.cellSize * 0.48 + margin
    return wrapPosition({
      x: waterCenter.x + nx * shoreDist,
      y: waterCenter.y + ny * shoreDist,
    })
  }

  /** True when standing water is deep enough to cover the entity's body (not shallow wading). */
  isSubmerged(x: number, y: number, entityRadius: number): boolean {
    const depth = this.sampleDepth(x, y)
    if (depth <= 0.5) return false
    const bodySize = entityRadius * DROWN_DEPTH_BODY_SIZE_MULT
    return depth >= bodySize
  }

  /** Water depth at a position (0 if dry). */
  wadingDepth(x: number, y: number): number {
    return Math.max(0, this.sampleDepth(x, y))
  }

  /** Flood stress for turf on a shared grid cell (0 = dry, 1 = fully drowned). */
  grassFloodStressAtCell(cellIdx: number): number {
    return grassFloodStress(
      this.height[cellIdx],
      this.surfaceWater[cellIdx],
      this.maxSurfaceWater[cellIdx],
      this.cellSize,
    )
  }

  hasStandingWater(): boolean {
    for (let i = 0; i < this.surfaceWater.length; i++) {
      if (this.surfaceWater[i] > 0.5) return true
    }
    return false
  }

  tryDrinkFromSurface(
    creature: Creature,
    pondDrinking: number,
    traits: { biteAmount: number; forageReach: number; maxHydration: number; radius: number },
  ): number {
    if (pondDrinking <= 0) return 0
    const idx = this.cellIndex(creature.x, creature.y)
    let bestIdx = idx
    let bestDepth = this.surfaceWater[idx]
    if (bestDepth <= 0.5) {
      bestDepth = 0
      const reach = traits.radius + traits.forageReach * 0.35
      const cellRange = Math.ceil(reach / this.cellSize)
      const cx0 = this.wrap(Math.floor(creature.x / this.cellSize), this.cols)
      const cy0 = this.wrap(Math.floor(creature.y / this.cellSize), this.rows)
      for (let dy = -cellRange; dy <= cellRange; dy++) {
        for (let dx = -cellRange; dx <= cellRange; dx++) {
          const cx = this.wrap(cx0 + dx, this.cols)
          const cy = this.wrap(cy0 + dy, this.rows)
          const nIdx = cy * this.cols + cx
          const depth = this.surfaceWater[nIdx]
          if (depth <= 0.5) continue
          const center = this.cellWorldCenter(cx, cy)
          const { dx: ddx, dy: ddy } = toroidalDelta(creature, center)
          if (Math.hypot(ddx, ddy) > reach) continue
          if (depth > bestDepth) {
            bestDepth = depth
            bestIdx = nIdx
          }
        }
      }
    }
    if (bestDepth <= 0.5) return 0

    const room = traits.maxHydration - creature.hydration
    if (room <= 0) return 0
    const sip = Math.min(traits.biteAmount * 0.6 * pondDrinking, this.surfaceWater[bestIdx], room)
    if (sip <= 0) return 0
    this.surfaceWater[bestIdx] -= sip
    this.spillToCell(bestIdx)
    return sip
  }

  private wrap(value: number, count: number): number {
    return ((value % count) + count) % count
  }

  private wrapCell(cy: number, cx: number): number {
    return this.wrap(cy, this.rows) * this.cols + this.wrap(cx, this.cols)
  }

  private cellWorldCenter(cx: number, cy: number): Vec2 {
    return {
      x: (cx + 0.5) * this.cellSize,
      y: (cy + 0.5) * this.cellSize,
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function localSurfaceEvaporationRate(tempC: number, relativeHumidity: number): number {
  const tempFactor = 0.45 + clamp((tempC + 5) / 38, 0, 1) * 0.95
  const dryness = Math.max(0, 1 - relativeHumidity * 0.98)
  return tempFactor * dryness * SURFACE_EVAPORATION_SCALE
}
