import type { InspectMode } from '../sim/mapSelection'

type InspectModeBarProps = {
  mode: InspectMode
  onChange: (mode: InspectMode) => void
  showElevation: boolean
  onToggleElevation: () => void
}

const MODES: Array<{ id: InspectMode; label: string; hint: string }> = [
  { id: 'creature', label: 'Creature', hint: 'Click a creature to inspect it' },
  { id: 'plant', label: 'Plant', hint: 'Click a plant to inspect it' },
  { id: 'soil', label: 'Soil', hint: 'Click a tile to inspect soil and surface water' },
  { id: 'air', label: 'Air', hint: 'Click a cloud tile to inspect air moisture' },
]

export function InspectModeBar({
  mode,
  onChange,
  showElevation,
  onToggleElevation,
}: InspectModeBarProps) {
  return (
    <div className="inspect-mode-bar" role="toolbar" aria-label="Inspect mode">
      <div className="inspect-mode-modes">
        {MODES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={mode === entry.id ? 'active' : undefined}
            aria-pressed={mode === entry.id}
            title={entry.hint}
            onClick={() => onChange(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <div className="inspect-mode-divider" aria-hidden="true" />
      <button
        type="button"
        className={`elevation-toggle${showElevation ? ' active' : ''}`}
        aria-pressed={showElevation}
        title="Terrain elevation map — fixed ground height per tile (ignores water and vegetation)"
        onClick={onToggleElevation}
      >
        Elevation
      </button>
    </div>
  )
}
