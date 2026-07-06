import { WIND_MAX_SPEED } from '../sim/config'

const COMPASS_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

/** Compass bearing (deg, 0 = north, clockwise) for a wind vector in screen space (+x east, +y south). */
function windBearingDeg(dir: number): number {
  const vx = Math.cos(dir)
  const vy = Math.sin(dir)
  const bearing = (Math.atan2(vx, -vy) * 180) / Math.PI
  return (bearing + 360) % 360
}

function compassLabel(bearingDeg: number): string {
  return COMPASS_POINTS[Math.round(bearingDeg / 45) % 8]
}

type WindIndicatorProps = {
  dir: number
  speed: number
  showClouds: boolean
  onToggleClouds: () => void
}

/** Upper-right map overlay: a compass arrow pointing where the wind blows, plus a cloud toggle. */
export function WindIndicator({ dir, speed, showClouds, onToggleClouds }: WindIndicatorProps) {
  const bearing = windBearingDeg(dir)
  const label = compassLabel(bearing)
  const strengthPct = Math.round(Math.min(1, speed / WIND_MAX_SPEED) * 100)

  return (
    <div className="wind-indicator" title={`Wind blowing ${label} · strength ${strengthPct}%`}>
      <div className="wind-compass" aria-hidden="true">
        <svg viewBox="0 0 32 32" style={{ transform: `rotate(${bearing}deg)` }}>
          <path d="M16 3 L23 27 L16 21 L9 27 Z" fill="currentColor" />
        </svg>
      </div>
      <div className="wind-readout">
        <span className="wind-dir">{label}</span>
        <span className="wind-speed">{strengthPct}%</span>
      </div>
      <button
        type="button"
        className={`cloud-toggle${showClouds ? ' active' : ''}`}
        onClick={onToggleClouds}
        title={showClouds ? 'Hide cloud layer' : 'Show cloud layer'}
        aria-pressed={showClouds}
      >
        {showClouds ? 'Clouds on' : 'Clouds off'}
      </button>
    </div>
  )
}
