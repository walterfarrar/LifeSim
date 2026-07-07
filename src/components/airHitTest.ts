import { AIR_FULL_HUMIDITY, AIR_GROUND_WET_SURFACE_DEPTH, SOIL_CELL_WATER_CAPACITY } from '../sim/config'
import { airCellAtWorld } from '../sim/render/airGridLayout'
import type { AirGridSnapshot } from '../sim/types'
import type { SoilMoistureSnapshot } from '../sim/soilMoisture'
import type { TerrainWaterSnapshot } from '../sim/terrainWater'

export type CloudState = 'clear' | 'filling' | 'full' | 'raining'

function wrapFloat(value: number, span: number): number {
  return ((value % span) + span) % span
}

function wrapIndex(value: number, count: number): number {
  return ((value % count) + count) % count
}

export function airCellAt(
  air: AirGridSnapshot,
  worldWidth: number,
  worldHeight: number,
  x: number,
  y: number,
): { col: number; row: number; index: number } {
  return airCellAtWorld(
    x,
    y,
    air.cellW,
    air.cellH,
    air.offsetX,
    air.offsetY,
    air.cols,
    air.rows,
    worldWidth,
    worldHeight,
  )
}

export function airCellIndexAtWorld(
  air: AirGridSnapshot,
  worldWidth: number,
  worldHeight: number,
  x: number,
  y: number,
): number {
  return airCellAt(air, worldWidth, worldHeight, x, y).index
}

export function airCellWorldOrigin(
  air: AirGridSnapshot,
  worldWidth: number,
  worldHeight: number,
  col: number,
  row: number,
): { x: number; y: number } {
  return {
    x: wrapFloat(col * air.cellW + air.offsetX, worldWidth),
    y: wrapFloat(row * air.cellH + air.offsetY, worldHeight),
  }
}

export function groundCellsUnderAirCell(
  air: AirGridSnapshot,
  soil: SoilMoistureSnapshot,
  col: number,
  row: number,
  worldWidth: number,
  worldHeight: number,
): { x: number; y: number }[] {
  const { x: baseX, y: baseY } = airCellWorldOrigin(air, worldWidth, worldHeight, col, row)
  const spanC = Math.ceil(air.cellW / soil.cellSize) + 1
  const spanR = Math.ceil(air.cellH / soil.cellSize) + 1
  const soilColStart = Math.floor(baseX / soil.cellSize)
  const soilRowStart = Math.floor(baseY / soil.cellSize)
  const targetIndex = row * air.cols + col
  const out: { x: number; y: number }[] = []

  for (let dr = 0; dr < spanR; dr++) {
    for (let dc = 0; dc < spanC; dc++) {
      const cx = wrapIndex(soilColStart + dc, soil.cols)
      const cy = wrapIndex(soilRowStart + dr, soil.rows)
      const x = (cx + 0.5) * soil.cellSize
      const y = (cy + 0.5) * soil.cellSize
      if (airCellIndexAtWorld(air, worldWidth, worldHeight, x, y) === targetIndex) {
        out.push({ x, y })
      }
    }
  }

  return out
}

function soilCellIndex(soil: SoilMoistureSnapshot, x: number, y: number): number {
  const col = wrapIndex(Math.floor(x / soil.cellSize), soil.cols)
  const row = wrapIndex(Math.floor(y / soil.cellSize), soil.rows)
  return row * soil.cols + col
}

function groundWetnessAt(
  x: number,
  y: number,
  terrain: TerrainWaterSnapshot,
  soil: SoilMoistureSnapshot,
): number {
  const idx = soilCellIndex(soil, x, y)
  const surfaceDepth = terrain.surfaceWater[idx] ?? 0
  if (surfaceDepth > AIR_GROUND_WET_SURFACE_DEPTH) return 1
  return (soil.values[idx] ?? 0) / SOIL_CELL_WATER_CAPACITY
}

export function averageGroundWetnessUnderAirCell(
  air: AirGridSnapshot,
  soil: SoilMoistureSnapshot,
  terrain: TerrainWaterSnapshot,
  col: number,
  row: number,
  worldWidth: number,
  worldHeight: number,
): number {
  const cells = groundCellsUnderAirCell(air, soil, col, row, worldWidth, worldHeight)
  if (cells.length === 0) return 0
  let sum = 0
  for (const { x, y } of cells) sum += groundWetnessAt(x, y, terrain, soil)
  return sum / cells.length
}

export function cloudState(vapor: number, capacity: number, raining: boolean): CloudState {
  if (vapor <= 1e-4) return 'clear'
  if (raining) return 'raining'
  if (capacity > 0 && vapor / capacity >= AIR_FULL_HUMIDITY) return 'full'
  return 'filling'
}

export function cloudStateLabel(state: CloudState): string {
  switch (state) {
    case 'clear':
      return 'Clear'
    case 'filling':
      return 'Filling'
    case 'full':
      return 'Full'
    case 'raining':
      return 'Raining'
  }
}
