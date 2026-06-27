import type { WorldStats } from '../sim/types'
import { formatYears } from '../sim/timeScale'
import type { AutoChampionRecord } from '../sim/autoChampion'
import type { SimSettings } from '../sim/simSettings'
import { totalStartingHerbivores } from '../sim/simSettings'

type StatsPanelProps = {
  stats: WorldStats
  paused: boolean
  settings: SimSettings
  seed: number
  autoChampion: AutoChampionRecord | null
  pendingSettingsChanges: boolean
  onTogglePause: () => void
  onRestart: () => void
  onReseed: () => void
  onOpenSettings: () => void
}

export function StatsPanel({
  stats,
  paused,
  settings,
  seed,
  autoChampion,
  pendingSettingsChanges,
  onTogglePause,
  onRestart,
  onReseed,
  onOpenSettings,
}: StatsPanelProps) {
  return (
    <div className="stats-panel">
      <header className="stats-header">
        <div>
          <h1>LifeSim</h1>
          <p className="subtitle">
            {settings.creatureGroups} groups · {totalStartingHerbivores(settings)} creatures at start
            {paused && <span className="paused-label"> · Paused</span>}
          </p>
        </div>
        <button
          type="button"
          className="settings-toggle"
          onClick={onOpenSettings}
          aria-label="Open simulation settings"
          title="Simulation settings"
        >
          ⚙
          {pendingSettingsChanges && <span className="settings-badge" aria-hidden />}
        </button>
      </header>

      <dl className="stats-grid">
        <div>
          <dt>Time</dt>
          <dd>{formatYears(stats.tick)}</dd>
        </div>
        <div>
          <dt>Plants</dt>
          <dd>{stats.plantCount}</dd>
        </div>
        <div>
          <dt>Creatures</dt>
          <dd>{stats.herbivoreCount}</dd>
        </div>
        <div>
          <dt>Births</dt>
          <dd>{stats.births}</dd>
        </div>
        <div>
          <dt>Deaths</dt>
          <dd>{stats.deaths}</dd>
        </div>
        <div>
          <dt>Groups</dt>
          <dd>{settings.creatureGroups}</dd>
        </div>
        <div>
          <dt>Seed</dt>
          <dd className="seed-value">{seed}</dd>
        </div>
      </dl>

      <div className="controls">
        <button type="button" onClick={onTogglePause}>
          {paused ? 'Resume' : 'Pause'}
        </button>
        <button type="button" onClick={onRestart}>
          Restart
        </button>
        <button type="button" onClick={onReseed}>
          New seed
        </button>
      </div>

      <p className="stats-hint">
        Open <strong>Legend</strong> on the map for mode colors and overlays.
        {autoChampion && (
          <>
            {' '}
            All-time lineage: peak {autoChampion.peakPopulation} members, together for{' '}
            {formatYears(autoChampion.lineageSpanTicks)} — pick in ⚙ Saved champions.
          </>
        )}
      </p>
    </div>
  )
}
