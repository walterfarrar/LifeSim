import { SOIL_CELL_WATER_CAPACITY } from '../sim/config'
import type { GrassCoverSnapshot } from '../sim/grassCover'
import { plantKindLabelFromDna } from '../sim/plantKinds'
import { moistureGrowthFactor } from '../sim/soilMoisture'
import { expressPlant } from '../sim/phenotype'
import { soilCellCenter } from './soilHitTest'
import {
  formatElevationFeet,
  surfaceCapacityFromElevation,
  type TerrainWaterSnapshot,
} from '../sim/terrainWater'
import type { SoilMoistureSnapshot } from '../sim/soilMoisture'

type SoilInspectorProps = {
  col: number
  row: number
  soil: SoilMoistureSnapshot
  terrain: TerrainWaterSnapshot
  grass: GrassCoverSnapshot
  woodyPlantCount: number
  onClose: () => void
}

function fmt(value: number, digits = 1): string {
  return value.toFixed(digits)
}

function pct(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`
}

export function SoilInspector({
  col,
  row,
  soil,
  terrain,
  grass,
  woodyPlantCount,
  onClose,
}: SoilInspectorProps) {
  const index = row * soil.cols + col
  const soilWaterUnits = soil.values[index] ?? 0
  const soilMoisture = soilWaterUnits / SOIL_CELL_WATER_CAPACITY
  const surfaceWaterUnits = terrain.surfaceWater[index] ?? 0
  const surfaceCap = terrain.maxSurfaceWater[index] ?? 0
  const elevation = terrain.elevation[index] ?? 0
  const groundHeight = terrain.height[index] ?? elevation
  const basinFromElevation = surfaceCapacityFromElevation(elevation)
  const pondExtra = Math.max(0, surfaceCap - basinFromElevation)
  const surfaceFill = surfaceCap > 0 ? surfaceWaterUnits / surfaceCap : 0
  const totalWaterUnits = soilWaterUnits + surfaceWaterUnits
  const center = soilCellCenter(soil, col, row)
  const grassEnergy = grass.energy[index] ?? 0
  const grassDna = grass.dna[index]
  const hasGrass = grassDna !== null && grassEnergy > 0.5
  const grassTraits = hasGrass ? expressPlant(grassDna) : null

  return (
    <section className="map-inspector">
      <header className="inspector-header">
        <div className="inspector-title-row">
          <h2>Terrain tile ({col}, {row})</h2>
        </div>
        <button type="button" className="inspector-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>

      <h3>Water layers</h3>
      <dl className="inspector-grid">
        <div>
          <dt>Soil water</dt>
          <dd>
            {Math.round(soilWaterUnits)} / {SOIL_CELL_WATER_CAPACITY} units
            <span className="water-sub-label"> · {pct(soilMoisture, 1)} moisture</span>
          </dd>
        </div>
        <div>
          <dt>Surface water</dt>
          <dd>
            {fmt(surfaceWaterUnits, 1)} / {fmt(surfaceCap, 1)} units
            {surfaceCap > 0 ? (
              <span className="water-sub-label"> · {pct(surfaceFill, 0)} full</span>
            ) : surfaceWaterUnits > 0 ? (
              <span className="water-sub-label"> · rain film</span>
            ) : null}
            {pondExtra > 0.5 ? (
              <span className="water-sub-label"> · includes {fmt(pondExtra, 0)} pond depth</span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt>Total on tile</dt>
          <dd>{Math.round(totalWaterUnits)} units</dd>
        </div>
        <div>
          <dt>Ground height</dt>
          <dd>
            {formatElevationFeet(groundHeight)}
            {pondExtra > 0.5 ? (
              <span className="water-sub-label"> · carved pond bowl below surrounding ground</span>
            ) : (
              <span className="water-sub-label">
                {' '}
                · basin holds up to {fmt(basinFromElevation, 1)} surface units
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>Weather</dt>
          <dd>{terrain.isRaining || soil.isRaining ? 'Raining' : 'Dry air'}</dd>
        </div>
      </dl>

      <h3>Tile info</h3>
      <dl className="inspector-grid">
        <div>
          <dt>Cell size</dt>
          <dd>{soil.cellSize}×{soil.cellSize}</dd>
        </div>
        <div>
          <dt>Center</dt>
          <dd>
            {fmt(center.x, 0)}, {fmt(center.y, 0)}
          </dd>
        </div>
        <div>
          <dt>Woody plants here</dt>
          <dd>{woodyPlantCount}</dd>
        </div>
      </dl>

      <h3>Grass turf</h3>
      {hasGrass && grassTraits && grassDna ? (
        <dl className="inspector-grid">
          <div>
            <dt>Strain</dt>
            <dd>{plantKindLabelFromDna(grassDna)}</dd>
          </div>
          <div>
            <dt>Biomass</dt>
            <dd>
              {fmt(grassEnergy)} / {fmt(grassTraits.maxEnergy, 0)}
            </dd>
          </div>
          <div>
            <dt>Tissue water</dt>
            <dd>{fmt(grass.water[index] ?? 0)}</dd>
          </div>
          <div>
            <dt>Moisture growth</dt>
            <dd>
              {fmt(moistureGrowthFactor(soilMoisture, grassTraits.moistureNeed) * 100, 0)}%
            </dd>
          </div>
          <div>
            <dt>Drought stress</dt>
            <dd>
              {(grass.droughtTicks[index] ?? 0) > 0
                ? `${grass.droughtTicks[index]} ticks`
                : 'None'}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="hint">No grass turf on this tile.</p>
      )}
    </section>
  )
}
