import {
  TERRAIN_ELEVATION_FEET_PER_UNIT,
  TERRAIN_ELEVATION_MAX,
  TERRAIN_ELEVATION_MIN,
  TERRAIN_ELEVATION_SEA_LEVEL,
} from '../sim/config'
import { ELEVATION_COLOR_STOPS } from '../sim/render/elevationDraw'
import { elevationToFeet } from '../sim/terrainWater'

function formatFeetShort(elevation: number): string {
  const feet = Math.round(elevationToFeet(elevation))
  if (feet === 0) return '0 ft'
  return feet > 0 ? `+${feet} ft` : `${feet} ft`
}

const gradientCss = `linear-gradient(to top, ${ELEVATION_COLOR_STOPS.map(
  (stop) => `rgb(${stop.r}, ${stop.g}, ${stop.b}) ${(stop.t * 100).toFixed(1)}%`,
).join(', ')})`

/** Shown while elevation map mode is active — explains the fixed ground-height color scale. */
export function ElevationLegend() {
  const spanFeet = Math.round(
    (TERRAIN_ELEVATION_MAX - TERRAIN_ELEVATION_MIN) * TERRAIN_ELEVATION_FEET_PER_UNIT,
  )

  return (
    <aside className="elevation-legend" aria-label="Elevation map legend">
      <h2 className="elevation-legend-title">Elevation</h2>
      <p className="elevation-legend-note">Ground height · fixed at world generation</p>
      <div className="elevation-legend-scale">
        <div className="elevation-legend-bar" style={{ background: gradientCss }} aria-hidden />
        <ul className="elevation-legend-labels">
          <li>
            <span className="elevation-legend-feet">{formatFeetShort(TERRAIN_ELEVATION_MAX)}</span>
            <span className="elevation-legend-desc">Highest hills</span>
          </li>
          <li>
            <span className="elevation-legend-feet">{formatFeetShort(TERRAIN_ELEVATION_SEA_LEVEL)}</span>
            <span className="elevation-legend-desc">Sea level (white outline)</span>
          </li>
          <li>
            <span className="elevation-legend-feet">{formatFeetShort(TERRAIN_ELEVATION_MIN)}</span>
            <span className="elevation-legend-desc">Lowest valleys</span>
          </li>
        </ul>
      </div>
      <p className="elevation-legend-footnote">Total relief ≈ {spanFeet} ft · Water and vegetation hidden</p>
    </aside>
  )
}
