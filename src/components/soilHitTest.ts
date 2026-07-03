import type { SoilMoistureSnapshot } from '../sim/soilMoisture'

export function soilCellAt(
  soil: SoilMoistureSnapshot,
  x: number,
  y: number,
): { col: number; row: number; index: number } {
  const col = ((Math.floor(x / soil.cellSize) % soil.cols) + soil.cols) % soil.cols
  const row = ((Math.floor(y / soil.cellSize) % soil.rows) + soil.rows) % soil.rows
  return { col, row, index: row * soil.cols + col }
}

export function soilCellCenter(
  soil: SoilMoistureSnapshot,
  col: number,
  row: number,
): { x: number; y: number } {
  return {
    x: col * soil.cellSize + soil.cellSize / 2,
    y: row * soil.cellSize + soil.cellSize / 2,
  }
}
