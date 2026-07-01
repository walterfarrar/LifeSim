import { useEffect, useState, type ReactNode } from 'react'
import {
  MODE_DESCRIPTIONS,
  MODE_LABELS,
  MODE_RING_COLORS,
  VISUAL_THEME,
} from '../sim/render/visualTheme'
import type { CreatureMode } from '../sim/types'

const LEGEND_OPEN_KEY = 'lifesim-legend-open'

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

type LegendItemProps = {
  label: string
  detail?: string
  children: ReactNode
}

function LegendItem({ label, detail, children }: LegendItemProps) {
  return (
    <li className="legend-item">
      <div className="legend-swatch-wrap" aria-hidden>
        {children}
      </div>
      <div className="legend-copy">
        <span className="legend-label">{label}</span>
        {detail && <span className="legend-detail">{detail}</span>}
      </div>
    </li>
  )
}

function ModeRingSwatch({ mode }: { mode: CreatureMode }) {
  return (
    <span
      className="legend-mode-ring"
      style={{ borderColor: MODE_RING_COLORS[mode] }}
    />
  )
}

function CircleSwatch({
  color,
  dashed = false,
  filled = false,
  wide = false,
}: {
  color: string
  dashed?: boolean
  filled?: boolean
  wide?: boolean
}) {
  return (
    <span
      className={`legend-circle${dashed ? ' dashed' : ''}${filled ? ' filled' : ''}${wide ? ' wide' : ''}`}
      style={filled ? { backgroundColor: color } : { borderColor: color }}
    />
  )
}

export function VisualLegend() {
  const [open, setOpen] = useState(loadLegendOpen)

  useEffect(() => {
    saveLegendOpen(open)
  }, [open])

  return (
    <div className={`visual-legend${open ? ' open' : ''}`}>
      {open && (
        <button
          type="button"
          className="legend-backdrop"
          onClick={() => setOpen(false)}
          aria-label="Close legend"
        />
      )}
      <button
        type="button"
        className="legend-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="visual-legend-panel"
      >
        {open ? 'Hide legend' : 'Legend'}
      </button>

      {open && (
        <section id="visual-legend-panel" className="legend-panel" aria-label="Visual legend">
          <header className="legend-panel-header">
            <h2>Map legend</h2>
            <button
              type="button"
              className="legend-panel-close"
              onClick={() => setOpen(false)}
              aria-label="Close legend"
            >
              ×
            </button>
          </header>

          <div className="legend-section">
            <h3>Behavior modes</h3>
            <ul className="legend-list">
              {(Object.keys(MODE_RING_COLORS) as CreatureMode[]).map((mode) => (
                <LegendItem
                  key={mode}
                  label={MODE_LABELS[mode]}
                  detail={MODE_DESCRIPTIONS[mode]}
                >
                  <ModeRingSwatch mode={mode} />
                </LegendItem>
              ))}
            </ul>
          </div>

          <div className="legend-section">
            <h3>Creatures</h3>
            <ul className="legend-list">
              <LegendItem label="Body color" detail="From DNA hue; lightness shows energy">
                <CircleSwatch color={VISUAL_THEME.creatureSample} filled />
              </LegendItem>
              <LegendItem label="Female tint" detail="Slightly shifted hue vs males">
                <CircleSwatch color={VISUAL_THEME.creatureFemaleSample} filled />
              </LegendItem>
              <LegendItem label="Vision range" detail="Wraps across map edges; toroidal sight">
                <CircleSwatch color={VISUAL_THEME.visionRing} wide />
              </LegendItem>
              <LegendItem label="Pregnant" detail="Pink dashed outer ring">
                <CircleSwatch color={VISUAL_THEME.pregnancyRing} dashed />
              </LegendItem>
            </ul>
          </div>

          <div className="legend-section">
            <h3>Selected creature</h3>
            <ul className="legend-list">
              <LegendItem label="Selection" detail="Click a creature to inspect">
                <CircleSwatch color={VISUAL_THEME.selectionRing} />
              </LegendItem>
              <LegendItem label="Personal space" detail="Dashed; size from DNA">
                <CircleSwatch color={VISUAL_THEME.personalSpaceRing} dashed wide />
              </LegendItem>
              <LegendItem label="Attack reach" detail="Aggressive creatures only">
                <CircleSwatch color={VISUAL_THEME.attackRangeRing} wide />
              </LegendItem>
            </ul>
          </div>

          <div className="legend-section">
            <h3>Plant lineages</h3>
            <ul className="legend-list">
              <LegendItem label="Grass" detail="Thin blades; spreads fast in summer, dormant in winter">
                <span className="legend-plant-grass" aria-hidden />
              </LegendItem>
              <LegendItem label="Deciduous" detail="Low lumpy shrubs; active spring–autumn, dormant in winter">
                <span className="legend-plant-bush" aria-hidden />
              </LegendItem>
              <LegendItem label="Conifer" detail="Tall evergreen tiers on a trunk; hardy year-round">
                <span className="legend-plant-tree" aria-hidden />
              </LegendItem>
            </ul>
          </div>

          <div className="legend-section">
            <h3>Environment</h3>
            <ul className="legend-list">
              <LegendItem label="Plant color" detail="Green hue from DNA; brightness shows energy">
                <CircleSwatch color={VISUAL_THEME.plantHealthy} filled />
              </LegendItem>
              <LegendItem label="Plant (low energy)" detail="Darker when eaten down; may die">
                <CircleSwatch color={VISUAL_THEME.plantDim} filled />
              </LegendItem>
              <LegendItem label="Infected" detail="Purple dashed ring; severity widens ring">
                <CircleSwatch color={VISUAL_THEME.infectionRing} dashed />
              </LegendItem>
              <LegendItem label="Corpse" detail="Dead creature; scavenged or decays away">
                <CircleSwatch color={VISUAL_THEME.corpseSample} filled />
              </LegendItem>
              <LegendItem label="Pond" detail="Fresh water at the shore; submerged creatures and plants drown">
                <CircleSwatch color={VISUAL_THEME.pondSample} filled wide />
              </LegendItem>
              <LegendItem label="Soil moisture" detail="Wettest at the pond shore, tapering inland; plants drink from local soil">
                <span className="legend-soil-swatch" aria-hidden>
                  <span className="legend-soil-dry" style={{ backgroundColor: VISUAL_THEME.soilDrySample }} />
                  <span className="legend-soil-wet" style={{ backgroundColor: VISUAL_THEME.soilWetSample }} />
                </span>
              </LegendItem>
              <LegendItem label="Temperature" detail="Off-ideal temps slow plant growth; only extreme heat or cold is lethal">
                <span className="legend-temp-swatch" aria-hidden>
                  <span className="legend-temp-cold" />
                  <span className="legend-temp-ideal" />
                  <span className="legend-temp-hot" />
                </span>
              </LegendItem>
              <LegendItem label="Day & night" detail="Window border color shifts by season and darkens at night">
                <span className="legend-day-night" aria-hidden>
                  <span className="legend-day-half" />
                  <span className="legend-night-half" />
                </span>
              </LegendItem>
              <LegendItem label="Rain" detail="Refills soil and tops up the pond (see stats panel)">
                <CircleSwatch color="rgba(100, 160, 220, 0.6)" filled wide />
              </LegendItem>
            </ul>
          </div>

          <p className="legend-footnote">
            Space pauses · Click creature to inspect · ⚙ for start settings
          </p>

          <footer className="legend-panel-footer">
            <button type="button" className="legend-panel-close-full" onClick={() => setOpen(false)}>
              Close legend
            </button>
          </footer>
        </section>
      )}
    </div>
  )
}
