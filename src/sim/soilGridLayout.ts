import { getWorldBounds } from './worldBounds'

export type SoilGridLayout = {
  cols: number
  rows: number
  /** Nominal square cell size from config (display). */
  cellSize: number
  /** Render cell width — cols·cellW spans exactly the world. */
  cellW: number
  /** Render cell height — rows·cellH spans exactly the world. */
  cellH: number
  gridWidth: number
  gridHeight: number
}

/** Tile the world with slightly rectangular cells so cols·cellW and rows·cellH match exactly. */
export function computeSoilGridLayout(nominalCellSize: number): SoilGridLayout {
  const bounds = getWorldBounds()
  const cols = Math.max(1, Math.ceil(bounds.width / nominalCellSize))
  const rows = Math.max(1, Math.ceil(bounds.height / nominalCellSize))
  const gridWidth = bounds.width
  const gridHeight = bounds.height
  return {
    cols,
    rows,
    cellSize: nominalCellSize,
    gridWidth,
    gridHeight,
    cellW: gridWidth / cols,
    cellH: gridHeight / rows,
  }
}

export function soilCellAtWorld(
  x: number,
  y: number,
  cellW: number,
  cellH: number,
  cols: number,
  rows: number,
): { col: number; row: number; index: number } {
  const col = wrapIndex(Math.floor(x / cellW), cols)
  const row = wrapIndex(Math.floor(y / cellH), rows)
  return { col, row, index: row * cols + col }
}

export function soilCellCenterWorld(
  col: number,
  row: number,
  cellW: number,
  cellH: number,
): { x: number; y: number } {
  return {
    x: (col + 0.5) * cellW,
    y: (row + 0.5) * cellH,
  }
}

function wrapIndex(value: number, count: number): number {
  return ((value % count) + count) % count
}
