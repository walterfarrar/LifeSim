import { useEffect, useState } from 'react'
import {
  MAX_WORLD_HEIGHT,
  MAX_WORLD_WIDTH,
  MIN_WORLD_HEIGHT,
  MIN_WORLD_WIDTH,
  MAX_CREATURE_FIRST_SPAWN_DELAY_YEARS,
  MAX_CREATURE_GROUP_SPAWN_INTERVAL_YEARS,
  MIN_CREATURE_FIRST_SPAWN_DELAY_YEARS,
  MIN_CREATURE_GROUP_SPAWN_INTERVAL_YEARS,
  POND_MAX_BASE_RADIUS,
  POND_MIN_BASE_RADIUS,
} from '../sim/config'
import {
  AUTO_CHAMPION_GENOME_ID,
  type AutoChampionRecord,
} from '../sim/autoChampion'
import type { AutoPlantChampionRecord } from '../sim/plantAutoChampion'
import type { AutoPathogenChampionRecord } from '../sim/pathogenAutoChampion'
import { getFounderGenomeById, listFounderGenomeChoices } from '../sim/founderGenomes'
import type { SavedGenome } from '../sim/dnaExport'
import type { SimSettings } from '../sim/simSettings'
import { cloneSettings, DEFAULT_SIM_SETTINGS, settingsRunKey, totalStartingHerbivores } from '../sim/simSettings'
import { formatYears } from '../sim/timeScale'

type SettingsPanelProps = {
  draft: SimSettings
  active: SimSettings
  seed: number
  autoChampion: AutoChampionRecord | null
  autoPlantChampion: AutoPlantChampionRecord | null
  autoPathogenChampion: AutoPathogenChampionRecord | null
  onChange: (next: SimSettings) => void
  onStart: (newSeed: boolean) => void
  onClose: () => void
}

type NumberFieldProps = {
  label: string
  hint?: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
}

function NumberField({ label, hint, value, min, max, step = 1, onChange }: NumberFieldProps) {
  const [text, setText] = useState(String(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) {
      setText(String(value))
    }
  }, [value, focused])

  const parsed = Number(text)
  const isNumeric = text.trim() !== '' && Number.isFinite(parsed)
  const outOfBounds = isNumeric && (parsed < min || parsed > max)
  const invalid = text.trim() !== '' && (!isNumeric || outOfBounds)

  const commit = () => {
    setFocused(false)
    if (!isNumeric) {
      setText(String(value))
      return
    }
    const committed = step >= 1 ? Math.round(parsed) : parsed
    onChange(committed)
    setText(String(committed))
  }

  return (
    <label className={`settings-field${invalid ? ' settings-field-invalid' : ''}`}>
      <span className="settings-label">{label}</span>
      {hint && <span className="settings-hint">{hint}</span>}
      <input
        type="text"
        inputMode="decimal"
        value={text}
        aria-invalid={invalid || undefined}
        onChange={(event) => setText(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur()
          }
        }}
      />
      {outOfBounds && (
        <span className="settings-range-hint">Allowed range: {min}–{max}</span>
      )}
    </label>
  )
}

function patch(settings: SimSettings, partial: Partial<SimSettings>): SimSettings {
  return { ...settings, ...partial }
}

function setGroupFounder(settings: SimSettings, groupIndex: number, genomeId: string): SimSettings {
  const groupFounders = [...settings.groupFounders]
  groupFounders[groupIndex] = genomeId
  return { ...settings, groupFounders }
}

function founderOptionLabel(genome: SavedGenome, autoChampion: AutoChampionRecord | null): string {
  if (genome.id.startsWith('sample-founder-')) {
    return genome.name
  }
  if (genome.id === AUTO_CHAMPION_GENOME_ID && autoChampion) {
    return `All-time lineage · peak ${autoChampion.peakPopulation} · ${formatYears(autoChampion.lineageSpanTicks)} together`
  }
  return genome.name
}

function founderHint(
  selectedId: string,
  autoChampion: AutoChampionRecord | null,
): string {
  if (selectedId.startsWith('sample-founder-')) {
    const sample = getFounderGenomeById(selectedId)
    return sample
      ? 'Built-in survival template — apply & restart to seed a group with this lineage'
      : 'Sample founder template'
  }
  if (!selectedId) return 'Random founder DNA for this group'
  if (selectedId === AUTO_CHAMPION_GENOME_ID && autoChampion) {
    return `${autoChampion.genome.sex} · ${autoChampion.population} alive · peak ${autoChampion.peakPopulation} · ${formatYears(autoChampion.lineageSpanTicks)}`
  }
  const selected = getFounderGenomeById(selectedId)
  if (!selected) return 'Saved genome'
  return `${selected.sex} · saved from creature #${selected.sourceCreatureId}`
}

export function SettingsPanel({
  draft,
  active,
  seed,
  autoChampion,
  autoPlantChampion,
  autoPathogenChampion,
  onChange,
  onStart,
  onClose,
}: SettingsPanelProps) {
  const [library, setLibrary] = useState<SavedGenome[]>([])

  useEffect(() => {
    setLibrary(listFounderGenomeChoices())
  }, [autoChampion?.fitnessScore])

  const pendingChanges = settingsRunKey(draft) !== settingsRunKey(active)
  const totalHerbivores = totalStartingHerbivores(draft)
  const selectedChampions = draft.groupFounders
    .slice(0, draft.creatureGroups)
    .filter((id) => id.length > 0)

  return (
    <section className="settings-panel sidebar-panel" aria-label="Simulation settings">
      <header className="settings-panel-header">
        <div>
          <h2 id="settings-panel-title">Simulation settings</h2>
          <p className="settings-subtitle">
            {draft.worldWidth}×{draft.worldHeight} map · {draft.creatureGroups} group
            {draft.creatureGroups === 1 ? '' : 's'} · {totalHerbivores} creatures ·{' '}
            {draft.initialPlants} plants
            {selectedChampions.length > 0 &&
              ` · ${selectedChampions.length} saved champion${selectedChampions.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <button type="button" className="settings-panel-close" onClick={onClose} aria-label="Back to stats">
          ×
        </button>
      </header>

      <div className="settings-panel-body">
          <details open className="settings-group">
            <summary>Map</summary>
            <div className="settings-fields">
              <NumberField
                label="Map width"
                hint="Simulation world width in pixels"
                value={draft.worldWidth}
                min={MIN_WORLD_WIDTH}
                max={MAX_WORLD_WIDTH}
                step={100}
                onChange={(worldWidth) => onChange(patch(draft, { worldWidth }))}
              />
              <NumberField
                label="Map height"
                hint="Simulation world height in pixels"
                value={draft.worldHeight}
                min={MIN_WORLD_HEIGHT}
                max={MAX_WORLD_HEIGHT}
                step={100}
                onChange={(worldHeight) => onChange(patch(draft, { worldHeight }))}
              />
            </div>
          </details>

          <details open className="settings-group">
            <summary>Population</summary>
            <div className="settings-fields">
              <NumberField
                label="Creature groups"
                hint="Separate founder lineages at start"
                value={draft.creatureGroups}
                min={1}
                max={8}
                onChange={(creatureGroups) => onChange(patch(draft, { creatureGroups }))}
              />
              <NumberField
                label="Creatures per group"
                hint="Set to 0 for a plant-only world (seasons, weather, no auto-reseed)"
                value={draft.herbivoresPerGroup}
                min={0}
                max={80}
                onChange={(herbivoresPerGroup) => onChange(patch(draft, { herbivoresPerGroup }))}
              />
              <NumberField
                label="First group delay"
                hint="Sim-years before the first founder group appears (all creatures in that group spawn together)"
                value={draft.creatureFirstSpawnDelayYears}
                min={MIN_CREATURE_FIRST_SPAWN_DELAY_YEARS}
                max={MAX_CREATURE_FIRST_SPAWN_DELAY_YEARS}
                step={1}
                onChange={(creatureFirstSpawnDelayYears) =>
                  onChange(patch(draft, { creatureFirstSpawnDelayYears }))
                }
              />
              <NumberField
                label="Group spawn interval"
                hint="Sim-years between each founder group (every creature in a group appears at once)"
                value={draft.creatureGroupSpawnIntervalYears}
                min={MIN_CREATURE_GROUP_SPAWN_INTERVAL_YEARS}
                max={MAX_CREATURE_GROUP_SPAWN_INTERVAL_YEARS}
                step={1}
                onChange={(creatureGroupSpawnIntervalYears) =>
                  onChange(patch(draft, { creatureGroupSpawnIntervalYears }))
                }
              />
            </div>
          </details>

          <details open className="settings-group">
            <summary>Plants</summary>
            <div className="settings-fields">
              <NumberField
                label="Initial plants"
                value={draft.initialPlants}
                min={0}
                max={2000}
                onChange={(initialPlants) => onChange(patch(draft, { initialPlants }))}
              />
              <NumberField
                label="Max grass"
                hint="Cap on soil tiles with grass turf (one dominant strain per tile)"
                value={draft.maxGrassPlants}
                min={0}
                max={4000}
                onChange={(maxGrassPlants) => onChange(patch(draft, { maxGrassPlants }))}
              />
              <NumberField
                label="Max deciduous"
                hint="Population cap for deciduous bushes"
                value={draft.maxBushPlants}
                min={0}
                max={4000}
                onChange={(maxBushPlants) => onChange(patch(draft, { maxBushPlants }))}
              />
              <NumberField
                label="Max conifers"
                hint="Population cap for conifer trees"
                value={draft.maxTreePlants}
                min={0}
                max={4000}
                onChange={(maxTreePlants) => onChange(patch(draft, { maxTreePlants }))}
              />
              <label className="settings-field settings-field-checkbox">
                <span className="settings-label">Respawn best plant species</span>
                <span className="settings-hint">
                  {autoPlantChampion
                    ? `Guarantees 1× "${autoPlantChampion.genome.name}" at reset (peak ${autoPlantChampion.peakPopulation})`
                    : 'No plant champion saved yet — tracked once a minute while plants live'}
                </span>
                <input
                  type="checkbox"
                  checked={draft.respawnBestPlantSpecies}
                  onChange={(event) =>
                    onChange(patch(draft, { respawnBestPlantSpecies: event.target.checked }))
                  }
                />
              </label>
              {autoPathogenChampion && (
                <p className="settings-hint settings-hint-block">
                  Best disease saved: peak {autoPathogenChampion.peakInfected} infected — view in Hall
                  of fame.
                </p>
              )}
            </div>
          </details>

          <details open className="settings-group">
            <summary>Disease</summary>
            <div className="settings-fields">
              <label className="settings-field settings-field-checkbox">
                <span className="settings-label">Respawn best pathogen at reset</span>
                <span className="settings-hint">
                  {autoPathogenChampion
                    ? `Slot 1 of 3 starting strains uses "${autoPathogenChampion.genome.name}"`
                    : 'No disease champion saved yet — hall strains can reappear once crowned'}
                </span>
                <input
                  type="checkbox"
                  checked={draft.respawnBestPathogen}
                  onChange={(event) =>
                    onChange(patch(draft, { respawnBestPathogen: event.target.checked }))
                  }
                />
              </label>
              <NumberField
                label="Hall strain return chance"
                hint="Per ~2 min check while creatures live (%)"
                value={Math.round(draft.pathogenChampionSpawnChance * 1000) / 10}
                min={0}
                max={50}
                step={0.5}
                onChange={(pct) =>
                  onChange(patch(draft, { pathogenChampionSpawnChance: pct / 100 }))
                }
              />
            </div>
          </details>

          <details open className="settings-group">
            <summary>Weather</summary>
            <div className="settings-fields">
              <NumberField
                label="Total water"
                hint="Closed-cycle budget at reset — split across surface pools, soil, air, and living; lower = desert, higher = oasis"
                value={draft.totalWater}
                min={2000}
                max={250000}
                step={1000}
                onChange={(totalWater) => onChange(patch(draft, { totalWater }))}
              />
              <NumberField
                label="Pond width"
                hint="Radius of the main pond in pixels — controls how wide the basin is, not how deep"
                value={draft.pondBaseRadius}
                min={POND_MIN_BASE_RADIUS}
                max={POND_MAX_BASE_RADIUS}
                step={5}
                onChange={(pondBaseRadius) => onChange(patch(draft, { pondBaseRadius }))}
              />
              <NumberField
                label="Pond depth"
                hint="Max standing water depth at the pond center (water units). Puddles elsewhere stay 0–10. Rim slopes gradually from center to shore."
                value={draft.pondMaxDepth}
                min={12}
                max={120}
                step={2}
                onChange={(pondMaxDepth) => onChange(patch(draft, { pondMaxDepth }))}
              />
              <NumberField
                label="Day length"
                hint="Equinox day–night cycle at 1× speed; longer in summer, shorter in winter"
                value={draft.dayLengthSeconds}
                min={6}
                max={180}
                step={1}
                onChange={(dayLengthSeconds) => onChange(patch(draft, { dayLengthSeconds }))}
              />
              <NumberField
                label="Days per year"
                hint="Day–night cycles per season year (spring → summer → autumn → winter)"
                value={draft.daysPerSeasonYear}
                min={4}
                max={24}
                step={1}
                onChange={(daysPerSeasonYear) => onChange(patch(draft, { daysPerSeasonYear }))}
              />
            </div>
          </details>

          <details open className="settings-group">
            <summary>Saved champions</summary>
            <div className="settings-fields settings-fields-wide">
              {library.length === 0 ? (
                <p className="settings-empty">
                  No saved DNA yet. The strongest surviving *lineage* is auto-saved once a
                  minute — or inspect a creature and use Save to library.
                </p>
              ) : (
                Array.from({ length: draft.creatureGroups }, (_, groupIndex) => {
                  const selectedId = draft.groupFounders[groupIndex] ?? ''
                  return (
                    <label key={groupIndex} className="settings-field">
                      <span className="settings-label">Group {groupIndex + 1} founder</span>
                      <span className="settings-hint">{founderHint(selectedId, autoChampion)}</span>
                      <select
                        value={selectedId}
                        onChange={(event) =>
                          onChange(setGroupFounder(draft, groupIndex, event.target.value))
                        }
                      >
                        <option value="">Random founder</option>
                        {library.map((genome) => (
                          <option key={genome.id} value={genome.id}>
                            {founderOptionLabel(genome, autoChampion)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )
                })
              )}
            </div>
          </details>

          <details className="settings-group">
            <summary>Founder genetics</summary>
            <div className="settings-fields">
              <NumberField
                label="Within-group spread"
                hint="Max allele drift from group founder"
                value={draft.founderGeneSpread}
                min={1}
                max={40}
                onChange={(founderGeneSpread) => onChange(patch(draft, { founderGeneSpread }))}
              />
              <NumberField
                label="Gene jitter chance"
                hint="Fraction of genes that drift (%)"
                value={Math.round(draft.founderJitterChance * 100)}
                min={0}
                max={100}
                onChange={(pct) => onChange(patch(draft, { founderJitterChance: pct / 100 }))}
              />
            </div>
          </details>
        </div>

      <footer className="settings-panel-footer">
        <p className="settings-seed">Active seed: {seed}</p>
        {pendingChanges && (
          <p className="settings-pending">Unsaved changes — restart to apply to the simulation.</p>
        )}
        <div className="settings-actions">
          <button type="button" className="settings-primary" onClick={() => onStart(false)}>
            {pendingChanges ? 'Apply & restart' : 'Restart'}
          </button>
          <button type="button" onClick={() => onStart(true)}>
            New seed
          </button>
        </div>
        <button
          type="button"
          className="settings-reset-defaults"
          onClick={() => onChange(cloneSettings(DEFAULT_SIM_SETTINGS))}
        >
          Reset to defaults
        </button>
      </footer>
    </section>
  )
}
