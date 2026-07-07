import type { SoilMoistureSnapshot } from '../sim/soilMoisture'
import { soilCellAtWorld, soilCellCenterWorld } from '../sim/soilGridLayout'

export function soilCellAt(
  soil: SoilMoistureSnapshot,
  x: number,
  y: number,
): { col: number; row: number; index: number } {
  return soilCellAtWorld(x, y, soil.cellW, soil.cellH, soil.cols, soil.rows)
}

export function soilCellCenter(
  soil: SoilMoistureSnapshot,
  col: number,
  row: number,
): { x: number; y: number } {
  return soilCellCenterWorld(col, row, soil.cellW, soil.cellH)
}
