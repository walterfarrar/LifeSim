import type { Creature } from './types'
import { getWorldBounds } from './worldBounds'

const DEFAULT_CELL_SIZE = 128

/**
 * Uniform spatial hash over the toroidal world. Built once per tick to turn the
 * O(n^2) neighbor scans into O(n * k) by only visiting creatures in nearby cells.
 *
 * It is a broad-phase filter: `collect` may return a few creatures slightly
 * outside the radius, so callers must still run their own precise distance
 * checks (which they already do via toroidalDistance).
 */
export class CreatureGrid {
  private readonly cols: number
  private readonly rows: number
  private readonly cellSize: number
  private readonly cells: Creature[][]

  constructor(creatures: readonly Creature[], cellSize: number = DEFAULT_CELL_SIZE) {
    const bounds = getWorldBounds()
    this.cellSize = cellSize
    this.cols = Math.max(1, Math.floor(bounds.width / cellSize))
    this.rows = Math.max(1, Math.floor(bounds.height / cellSize))

    const total = this.cols * this.rows
    this.cells = new Array(total)
    for (let i = 0; i < total; i++) this.cells[i] = []

    for (const creature of creatures) {
      this.cells[this.cellIndex(creature.x, creature.y)].push(creature)
    }
  }

  private wrap(value: number, count: number): number {
    return ((value % count) + count) % count
  }

  private cellIndex(x: number, y: number): number {
    const cx = this.wrap(Math.floor(x / this.cellSize), this.cols)
    const cy = this.wrap(Math.floor(y / this.cellSize), this.rows)
    return cy * this.cols + cx
  }

  /** Creatures in all cells overlapping `radius` around (x, y), toroidal-aware (self included). */
  collect(x: number, y: number, radius: number): Creature[] {
    // +1 cell of slop covers small movement drift between grid build and query time.
    const reach = Math.ceil(radius / this.cellSize) + 1
    const baseCx = Math.floor(x / this.cellSize)
    const baseCy = Math.floor(y / this.cellSize)

    const colSpan = Math.min(this.cols, reach * 2 + 1)
    const rowSpan = Math.min(this.rows, reach * 2 + 1)

    const out: Creature[] = []
    for (let dr = 0; dr < rowSpan; dr++) {
      const cy = this.wrap(baseCy - reach + dr, this.rows)
      const rowBase = cy * this.cols
      for (let dc = 0; dc < colSpan; dc++) {
        const cx = this.wrap(baseCx - reach + dc, this.cols)
        const cell = this.cells[rowBase + cx]
        for (let k = 0; k < cell.length; k++) out.push(cell[k])
      }
    }
    return out
  }
}
