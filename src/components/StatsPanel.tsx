import type { WorldStats } from '../sim/types'
import { topDeathCauses } from '../sim/deathCause'
import { dayNightLabel } from '../sim/dayNight'
import { formatDayLengthSeconds, seasonLabel } from '../sim/seasons'
import { formatTemperatureC } from '../sim/temperature'
import { formatYears, formatSpeedMultiplier, MAX_SPEED_MULTIPLIER, MIN_SPEED_MULTIPLIER } from '../sim/timeScale'
import type { AutoChampionRecord } from '../sim/autoChampion'
import type { AutoPlantChampionRecord } from '../sim/plantAutoChampion'
import type { AutoPathogenChampionRecord } from '../sim/pathogenAutoChampion'
import type { SimSettings } from '../sim/simSettings'
import { totalStartingHerbivores } from '../sim/simSettings'
import { PLANT_KIND_LABEL, type PlantKind } from '../sim/plantKinds'

const PLANT_KIND_ORDER: readonly PlantKind[] = ['grass', 'bush', 'tree']

const PLANT_KIND_COUNT_KEY: Record<PlantKind, keyof Pick<WorldStats, 'grassPlantCount' | 'bushPlantCount' | 'treePlantCount'>> = {
  grass: 'grassPlantCount',
  bush: 'bushPlantCount',
  tree: 'treePlantCount',
}

function formatWaterUnits(units: number): string {
  return Math.round(units).toLocaleString()
}

function formatWaterDelta(units: number): string {
  const rounded = Math.round(units)
  if (rounded === 0) return '±0'
  return rounded > 0 ? `+${rounded.toLocaleString()}` : rounded.toLocaleString()
}

type StatsPanelProps = {
  stats: WorldStats
  maxTickReached: number
  paused: boolean
  settings: SimSettings
  seed: number
  autoChampion: AutoChampionRecord | null
  autoPlantChampion: AutoPlantChampionRecord | null
  autoPathogenChampion: AutoPathogenChampionRecord | null
  hasChampionHall: boolean
  pendingSettingsChanges: boolean
  speedMultiplier: number
  onTogglePause: () => void
  onSlower: () => void
  onFaster: () => void
  onRestart: () => void
  onReseed: () => void
  onOpenSettings: () => void
  onOpenHall: () => void
  onOpenEditor: () => void
}

export function StatsPanel({
  stats,
  maxTickReached,
  paused,
  settings,
  seed,
  autoChampion,
  autoPlantChampion,
  autoPathogenChampion,
  hasChampionHall,
  pendingSettingsChanges,
  speedMultiplier,
  onTogglePause,
  onSlower,
  onFaster,
  onRestart,
  onReseed,
  onOpenSettings,
  onOpenHall,
  onOpenEditor,
}: StatsPanelProps) {
  const leadingDeathCauses = topDeathCauses(stats.deathCauseCounts)

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
          <dd>
            {formatYears(stats.tick)}
            <span className="max-time-reached" title="Longest this attempt has run">
              {' '}
              · max {formatYears(maxTickReached)}
            </span>
          </dd>
        </div>
        <div>
          <dt>Total energy</dt>
          <dd title={`Plants ${Math.round(stats.plantEnergy)} · Creatures ${Math.round(stats.creatureEnergy)} · Corpses ${Math.round(stats.corpseEnergy)}`}>
            {Math.round(stats.totalEnergy)}
          </dd>
        </div>
        <div>
          <dt>Solar input</dt>
          <dd title="Energy added this tick by plant growth — drops at night without sunlight">
            {stats.primaryProduction.toFixed(1)}/tick
          </dd>
        </div>
        <div className="stats-span-full">
          <dt>Plants</dt>
          <dd className="plant-stats">
            <span className="plant-stats-total">{stats.plantCount}</span>
            <ul className="plant-kind-grid" aria-label="Plants by lineage">
              {PLANT_KIND_ORDER.map((kind) => (
                <li key={kind}>
                  <span className="plant-kind-label">{PLANT_KIND_LABEL[kind]}</span>
                  <span className="plant-kind-count">{stats[PLANT_KIND_COUNT_KEY[kind]]}</span>
                </li>
              ))}
            </ul>
          </dd>
        </div>
        <div>
          <dt>Creatures</dt>
          <dd>{stats.herbivoreCount}</dd>
        </div>
        <div>
          <dt>Surface water</dt>
          <dd title="Standing water in terrain depressions — separate from soil moisture">
            {!stats.hasSurfaceWater
              ? 'None'
              : stats.surfaceWater > 0.5
                ? formatWaterUnits(stats.surfaceWater)
                : 'Empty'}
          </dd>
        </div>
        <div>
          <dt>Soil water</dt>
          <dd title="Total water held in soil across the map">
            {formatWaterUnits(stats.soilWater)}
            <span className="water-sub-label"> · {(stats.avgSoilMoisture * 100).toFixed(0)}% avg wetness</span>
          </dd>
        </div>
        <div>
          <dt>Air water</dt>
          <dd title="Atmospheric vapor — rain starts at 90% humidity, stops at 20%, re-arms after drying to ~72%">
            {formatWaterUnits(stats.airWater)}
            <span className="water-sub-label"> · {(stats.airHumidity * 100).toFixed(0)}% humidity</span>
            {stats.isRaining && <span className="rain-label"> · raining</span>}
          </dd>
        </div>
        <div>
          <dt>Creature water</dt>
          <dd title="Total water stored in living creatures">
            {formatWaterUnits(stats.creatureWater)}
          </dd>
        </div>
        <div>
          <dt>Plant water</dt>
          <dd title="Total water held in living plant biomass">
            {formatWaterUnits(stats.plantWater)}
          </dd>
        </div>
        <div>
          <dt>Total water</dt>
          <dd title="Sum of pond, soil, air, creature, and plant pools — should match the start budget">
            {formatWaterUnits(stats.totalWater)}
            {stats.totalWaterBudget > 0 && (
              <span className="water-sub-label">
                {' '}
                · {formatWaterDelta(stats.totalWater - stats.totalWaterBudget)} vs start
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>Temperature</dt>
          <dd title="Ambient air temperature — shifts with season and time of day">
            {formatTemperatureC(stats.temperature)}
          </dd>
        </div>
        <div>
          <dt>Season</dt>
          <dd title={`Day length ${formatDayLengthSeconds(stats.effectiveDayLengthSeconds)} at equinox ${settings.dayLengthSeconds}s`}>
            {seasonLabel(stats.season)}
            <span className="season-day-length">
              {' '}
              · {formatDayLengthSeconds(stats.effectiveDayLengthSeconds)} days
            </span>
          </dd>
        </div>
        <div>
          <dt>Time of day</dt>
          <dd title={`Sunlight ${Math.round(stats.sunlight * 100)}% — plants need light to grow`}>
            {dayNightLabel(stats.dayPhase)}
            {stats.isNight ? (
              <span className="night-label"> · dark</span>
            ) : (
              <span> · {Math.round(stats.sunlight * 100)}% sun</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Births</dt>
          <dd>{stats.births}</dd>
        </div>
        <div>
          <dt>Deaths</dt>
          <dd>{stats.deaths}</dd>
        </div>
        <div className="stats-span-full">
          <dt>Top causes of death</dt>
          <dd>
            {leadingDeathCauses.length === 0 ? (
              'None yet'
            ) : (
              <ol className="death-causes-list">
                {leadingDeathCauses.map((entry, index) => (
                  <li key={entry.cause}>
                    <span className="death-cause-rank">{index + 1}.</span>
                    <span className="death-cause-label">{entry.label}</span>
                    <span className="death-cause-count">{entry.count}</span>
                  </li>
                ))}
              </ol>
            )}
          </dd>
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
        <div className="speed-controls" aria-label="Simulation speed">
          <button
            type="button"
            className="speed-button"
            onClick={onSlower}
            disabled={speedMultiplier <= MIN_SPEED_MULTIPLIER}
            title="Halve simulation speed"
            aria-label="Halve simulation speed"
          >
            Slower
          </button>
          <span className="speed-value" title="Simulation speed multiplier">
            {formatSpeedMultiplier(speedMultiplier)}
          </span>
          <button
            type="button"
            className="speed-button"
            onClick={onFaster}
            disabled={speedMultiplier >= MAX_SPEED_MULTIPLIER}
            title="Double simulation speed"
            aria-label="Double simulation speed"
          >
            Faster
          </button>
        </div>
        <button
          type="button"
          className="creature-editor-button"
          onClick={onOpenEditor}
          title="Design creature DNA and save to your library"
        >
          Creature editor
        </button>
        <button
          type="button"
          className="champion-button"
          onClick={onOpenHall}
          disabled={!hasChampionHall}
          title={
            hasChampionHall
              ? 'View top 5 champions — creatures, plants, and diseases'
              : 'No champions saved yet'
          }
        >
          Hall of fame
        </button>
      </div>

      <p className="stats-hint">
        Open <strong>Legend</strong> on the map for mode colors and overlays.
        {autoChampion && (
          <>
            {' '}
            Creature #1: peak {autoChampion.peakPopulation}.
          </>
        )}
        {autoPlantChampion && (
          <>
            {' '}
            Plant #1: peak {autoPlantChampion.peakPopulation}
            {settings.respawnBestPlantSpecies ? ' · re-seeds on reset' : ''}.
          </>
        )}
        {autoPathogenChampion && (
          <>
            {' '}
            Disease #1: peak {autoPathogenChampion.peakInfected} infected
            {settings.respawnBestPathogen ? ' · in pool at reset' : ''}
            {settings.pathogenChampionSpawnChance > 0 ? ' · may return mid-run' : ''}.
          </>
        )}
        {hasChampionHall && (
          <>
            {' '}
            <button type="button" className="stats-inline-link" onClick={onOpenHall}>
              View top 5 lists
            </button>
          </>
        )}
      </p>
    </div>
  )
}
