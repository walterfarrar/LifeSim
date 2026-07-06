import { useEffect, useState } from 'react'
import {
  TERRAIN_ELEVATION_FEET_PER_UNIT,
  TERRAIN_ELEVATION_MAX,
  TERRAIN_ELEVATION_MIN,
  TERRAIN_ELEVATION_SEA_LEVEL,
} from '../sim/config'
import { ELEVATION_COLOR_STOPS } from '../sim/render/elevationDraw'
import { elevationToFeet } from '../sim/terrainWater'

const LEGEND_OPEN_KEY = 'lifesim-elevation-legend-open'

function loadLegendOpen(): boolean {
  try {
    return localStorage.getItem(LEGEND_OPEN_KEY) === '1'
  } catch {
    return false
  }
}

function saveLegendOpen(open: boolean): void {
  try {
    localStorage.setItem(LEGEND_OPEN_KEY, open ? '1' : '0')
  } catch {
    // ignore
  }
}

function formatFeetShort(elevation: number): string {
  const feet = Math.round(elevationToFeet(elevation))
  if (feet === 0) return '0 ft'
  return feet > 0 ? `+${feet} ft` : `${feet} ft`
}

const gradientCss = `linear-gradient(to top, ${ELEVATION_COLOR_STOPS.map(
  (stop) => `rgb(${stop.r}, ${stop.g}, ${stop.b}) ${(stop.t * 100).toFixed(1)}%`,
).join(', ')})`

export function useElevationLegendOpen() {
  const [open, setOpen] = useState(loadLegendOpen)

  useEffect(() => {
    saveLegendOpen(open)
  }, [open])

  return [open, setOpen] as const
}

type ElevationLegendToggleProps = {
  open: boolean
  onToggle: () => void
}

export function ElevationLegendToggle({ open, onToggle }: ElevationLegendToggleProps) {
  return (
    <button
      type="button"
      className="elevation-legend-toggle"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls="elevation-legend-panel"
    >
      {open ? 'Hide scale' : 'Scale'}
    </button>
  )
}

type ElevationLegendPanelProps = {
  onClose: () => void
}

export function ElevationLegendPanel({ onClose }: ElevationLegendPanelProps) {
  const spanFeet = Math.round(
    (TERRAIN_ELEVATION_MAX - TERRAIN_ELEVATION_MIN) * TERRAIN_ELEVATION_FEET_PER_UNIT,
  )

  return (
    <div id="elevation-legend-panel" className="elevation-legend-panel" aria-label="Elevation map legend">
      <div className="elevation-legend-header">
        <h2 className="elevation-legend-title">Elevation</h2>
        <button type="button" className="elevation-legend-close" onClick={onClose} aria-label="Hide elevation scale">
          ×
        </button>
      </div>
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
    </div>
  )
}
