import {
  PLANT_WATER_PER_ENERGY,
  SOIL_CELL_SIZE,
  SOIL_CELL_WATER_CAPACITY,
  SOIL_LATERAL_DIFFUSION,
  SOIL_MOISTURE_HALF_SAT,
} from './config'
import { getWorldBounds } from './worldBounds'

export type SoilMoistureSnapshot = {
  cols: number
  rows: number
  cellSize: number
  values: Float32Array
  isRaining: boolean
}

export interface SoilAccess {
  sample(x: number, y: number): number
  consume(x: number, y: number, amount: number): number
  depositWater(x: number, y: number, waterUnits: number): number
}

/** How much growth a plant gets from local soil moisture. */
export function moistureGrowthFactor(moisture: number, moistureNeed: number): number {
  if (moisture <= 0) return 0
  const halfSat = SOIL_MOISTURE_HALF_SAT * (0.65 + moistureNeed * 1.1)
  return moisture / (moisture + halfSat)
}

/** Moisture-fraction demand to support a given energy-growth increment this tick. */
export function plantWaterDemandForGrowth(
  potentialEnergyGrowth: number,
  moistureNeed: number,
): number {
  if (potentialEnergyGrowth <= 0) return 0
  const thirst = 0.72 + moistureNeed * 0.55
  return (potentialEnergyGrowth * PLANT_WATER_PER_ENERGY * thirst) / SOIL_CELL_WATER_CAPACITY
}

export class SoilMoisture implements SoilAccess {
  readonly cols: number
  readonly rows: number
  readonly cellSize: number
  /** Water units per cell (0 … SOIL_CELL_WATER_CAPACITY). */
  readonly values: Float32Array

  constructor(cellSize = SOIL_CELL_SIZE) {
    const bounds = getWorldBounds()
    this.cellSize = cellSize
    this.cols = Math.max(1, Math.ceil(bounds.width / cellSize))
    this.rows = Math.max(1, Math.ceil(bounds.height / cellSize))
    this.values = new Float32Array(this.cols * this.rows)
  }

  reset(): void {
    this.values.fill(0)
  }

  /** Uniformly distribute raw water units across all cells (capped at capacity per cell). */
  fillWithWaterUnits(waterUnits: number): number {
    const n = this.values.length
    if (n <= 0) return waterUnits
    const perCell = waterUnits / n
    let stored = 0
    for (let i = 0; i < n; i++) {
      const amount = Math.min(SOIL_CELL_WATER_CAPACITY, perCell)
      this.values[i] = amount
      stored += amount
    }
    return Math.max(0, waterUnits - stored)
  }

  snapshot(isRaining: boolean): SoilMoistureSnapshot {
    return {
      cols: this.cols,
      rows: this.rows,
      cellSize: this.cellSize,
      values: this.values,
      isRaining,
    }
  }

  private wrap(value: number, count: number): number {
    return ((value % count) + count) % count
  }

  cellIndex(x: number, y: number): number {
    const cx = this.wrap(Math.floor(x / this.cellSize), this.cols)
    const cy = this.wrap(Math.floor(y / this.cellSize), this.rows)
    return cy * this.cols + cx
  }

  /** Moisture fraction 0–1 at a world position. */
  sample(x: number, y: number): number {
    return this.values[this.cellIndex(x, y)] / SOIL_CELL_WATER_CAPACITY
  }

  /** Consumes moisture-fraction `amount`; returns moisture fraction actually taken. */
  consume(x: number, y: number, amount: number): number {
    if (amount <= 0) return 0
    const idx = this.cellIndex(x, y)
    const want = amount * SOIL_CELL_WATER_CAPACITY
    const taken = Math.min(this.values[idx], want)
    this.values[idx] -= taken
    return taken / SOIL_CELL_WATER_CAPACITY
  }

  /** Deposits moisture-fraction `amount`. */
  deposit(x: number, y: number, amount: number): void {
    if (amount <= 0) return
    this.depositWater(x, y, amount * SOIL_CELL_WATER_CAPACITY)
  }

  /** Deposits raw water units; returns amount actually stored. */
  depositWater(x: number, y: number, waterUnits: number): number {
    if (waterUnits <= 0) return 0
    const idx = this.cellIndex(x, y)
    const room = SOIL_CELL_WATER_CAPACITY - this.values[idx]
    const applied = Math.min(room, waterUnits)
    this.values[idx] += applied
    return applied
  }

  totalWater(): number {
    let sum = 0
    for (let i = 0; i < this.values.length; i++) sum += this.values[i]
    return sum
  }

  /** Evaporates water from cells; returns total water moved to atmosphere. */
  evaporateToAtmosphere(
    baseRatePerCell: number,
    cellFilter?: (index: number) => boolean,
  ): number {
    let total = 0
    for (let i = 0; i < this.values.length; i++) {
      if (cellFilter && !cellFilter(i)) continue
      const wetness = this.values[i] / SOIL_CELL_WATER_CAPACITY
      const rate = baseRatePerCell * (0.25 + wetness * 0.75)
      const evap = Math.min(this.values[i], rate)
      this.values[i] -= evap
      total += evap
    }
    return total
  }

  /** Distributes precipitation across cells with capacity; returns amount stored. */
  receivePrecipitation(waterUnits: number): number {
    if (waterUnits <= 0 || this.values.length === 0) return 0

    let remaining = waterUnits
    let applied = 0
    let guard = 0

    while (remaining > 1e-6 && guard++ < 32) {
      let roomTotal = 0
      for (let i = 0; i < this.values.length; i++) {
        roomTotal += Math.max(0, SOIL_CELL_WATER_CAPACITY - this.values[i])
      }
      if (roomTotal <= 1e-6) break

      const chunk = Math.min(remaining, roomTotal)
      let passApplied = 0

      for (let i = 0; i < this.values.length; i++) {
        const room = SOIL_CELL_WATER_CAPACITY - this.values[i]
        if (room <= 0) continue
        const add = chunk * (room / roomTotal)
        const stored = Math.min(room, add)
        this.values[i] += stored
        passApplied += stored
      }

      if (passApplied <= 1e-6) break
      applied += passApplied
      remaining = waterUnits - applied
    }

    return applied
  }

  /** Spread moisture between neighboring cells. */
  tickLateralDiffusion(): number {
    if (SOIL_LATERAL_DIFFUSION <= 0) return 0

    const { cols, rows, values } = this
    const before = this.totalWater()
    const next = new Float32Array(values.length)

    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const idx = cy * cols + cx
        let sum = values[idx]
        let count = 1

        const neighbors = [
          [cx - 1, cy],
          [cx + 1, cy],
          [cx, cy - 1],
          [cx, cy + 1],
        ]
        for (const [nx, ny] of neighbors) {
          const nIdx = this.wrap(ny, rows) * cols + this.wrap(nx, cols)
          sum += values[nIdx]
          count += 1
        }

        const average = sum / count
        next[idx] = values[idx] + SOIL_LATERAL_DIFFUSION * (average - values[idx])
      }
    }

    for (let i = 0; i < values.length; i++) {
      values[i] = Math.max(0, Math.min(SOIL_CELL_WATER_CAPACITY, next[i]))
    }

    return Math.max(0, before - this.totalWater())
  }

  averageMoisture(): number {
    if (this.values.length === 0) return 0
    return this.totalWater() / (this.values.length * SOIL_CELL_WATER_CAPACITY)
  }
}
