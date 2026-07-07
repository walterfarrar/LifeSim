import { AIR_CELL_SIZE_MULT, WIND_MAX_SPEED } from '../sim/config'
import type { WorldStats } from '../sim/types'
import type { AirGridSnapshot } from '../sim/types'
import type { SoilMoistureSnapshot } from '../sim/soilMoisture'
import type { TerrainWaterSnapshot } from '../sim/terrainWater'
import {
  airCellWorldOrigin,
  averageGroundWetnessUnderAirCell,
  cloudState,
  cloudStateLabel,
} from './airHitTest'

type AirInspectorProps = {
  col: number
  row: number
  air: AirGridSnapshot
  soil: SoilMoistureSnapshot
  terrain: TerrainWaterSnapshot
  stats: WorldStats
  worldWidth: number
  worldHeight: number
  onClose: () => void
}

function fmt(value: number, digits = 1): string {
  return value.toFixed(digits)
}

function pct(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`
}

const COMPASS_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

function windBearingDeg(dir: number): number {
  const vx = Math.cos(dir)
  const vy = Math.sin(dir)
  const bearing = (Math.atan2(vx, -vy) * 180) / Math.PI
  return (bearing + 360) % 360
}

function compassLabel(bearingDeg: number): string {
  return COMPASS_POINTS[Math.round(bearingDeg / 45) % 8]
}

export function AirInspector({
  col,
  row,
  air,
  soil,
  terrain,
  stats,
  worldWidth,
  worldHeight,
  onClose,
}: AirInspectorProps) {
  const index = row * air.cols + col
  const vapor = air.vapor[index] ?? 0
  const humidity = air.cellCapacity > 0 ? Math.min(1, vapor / air.cellCapacity) : 0
  const isRaining = (air.raining[index] ?? 0) === 1
  const state = cloudState(vapor, air.cellCapacity, isRaining)
  const groundWetness = averageGroundWetnessUnderAirCell(
    air,
    soil,
    terrain,
    col,
    row,
    worldWidth,
    worldHeight,
  )
  const origin = airCellWorldOrigin(air, worldWidth, worldHeight, col, row)
  const windBearing = windBearingDeg(stats.wind.dir)
  const windStrengthPct = Math.round(Math.min(1, stats.wind.speed / WIND_MAX_SPEED) * 100)
  const soilTilesUnder = Math.round((air.cellW / soil.cellW) * (air.cellH / soil.cellH))

  return (
    <section className="map-inspector">
      <header className="inspector-header">
        <div className="inspector-title-row">
          <h2>Air cell ({col}, {row})</h2>
        </div>
        <button type="button" className="inspector-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>

      <h3>Cloud</h3>
      <dl className="inspector-grid">
        <div>
          <dt>State</dt>
          <dd>{cloudStateLabel(state)}</dd>
        </div>
        <div>
          <dt>Vapor</dt>
          <dd>
            {fmt(vapor, 1)} / {air.cellCapacity} units
            <span className="water-sub-label"> · {pct(humidity, 1)} humidity</span>
          </dd>
        </div>
        <div>
          <dt>Ground below</dt>
          <dd>{pct(groundWetness, 1)} avg wetness</dd>
        </div>
        <div>
          <dt>Humidity gap</dt>
          <dd>{pct(Math.max(0, humidity - groundWetness), 1)}</dd>
        </div>
      </dl>

      <h3>Cell info</h3>
      <dl className="inspector-grid">
        <div>
          <dt>Cell size</dt>
          <dd>
            {fmt(air.cellW, 0)}×{fmt(air.cellH, 0)}
            <span className="water-sub-label"> · {AIR_CELL_SIZE_MULT}× soil tiles</span>
          </dd>
        </div>
        <div>
          <dt>Soil tiles beneath</dt>
          <dd>~{soilTilesUnder}</dd>
        </div>
        <div>
          <dt>Origin (wind-shifted)</dt>
          <dd>
            {fmt(origin.x, 0)}, {fmt(origin.y, 0)}
          </dd>
        </div>
        <div>
          <dt>Wind offset</dt>
          <dd>
            {fmt(air.offsetX, 1)}, {fmt(air.offsetY, 1)}
          </dd>
        </div>
      </dl>

      <h3>Wind (global)</h3>
      <dl className="inspector-grid">
        <div>
          <dt>Direction</dt>
          <dd>{compassLabel(windBearing)}</dd>
        </div>
        <div>
          <dt>Speed</dt>
          <dd>
            {fmt(stats.wind.speed, 2)} px/tick
            <span className="water-sub-label"> · {windStrengthPct}%</span>
          </dd>
        </div>
        <div>
          <dt>World weather</dt>
          <dd>{stats.isRaining ? 'Raining somewhere' : 'Dry overall'}</dd>
        </div>
      </dl>
    </section>
  )
}
