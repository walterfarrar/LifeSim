import type { InspectMode } from '../sim/mapSelection'

type InspectModeBarProps = {
  mode: InspectMode
  onChange: (mode: InspectMode) => void
}

const MODES: Array<{ id: InspectMode; label: string; hint: string }> = [
  { id: 'creature', label: 'Creature', hint: 'Click a creature to inspect it' },
  { id: 'plant', label: 'Plant', hint: 'Click a plant to inspect it' },
  { id: 'soil', label: 'Soil', hint: 'Click a tile to inspect soil and surface water' },
]

export function InspectModeBar({ mode, onChange }: InspectModeBarProps) {
  return (
    <div className="inspect-mode-bar" role="toolbar" aria-label="Inspect mode">
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
  )
}
