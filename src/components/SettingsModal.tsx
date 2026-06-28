import { useEffect, useState } from 'react'
import {
  AUTO_CHAMPION_GENOME_ID,
  type AutoChampionRecord,
} from '../sim/autoChampion'
import type { AutoPlantChampionRecord } from '../sim/plantAutoChampion'
import type { AutoPathogenChampionRecord } from '../sim/pathogenAutoChampion'
import { getFounderGenomeById, listFounderGenomeChoices } from '../sim/founderGenomes'
import type { SavedGenome } from '../sim/dnaExport'
import type { SimSettings } from '../sim/simSettings'
import { settingsRunKey, totalStartingHerbivores } from '../sim/simSettings'
import { formatYears } from '../sim/timeScale'

type SettingsModalProps = {
  open: boolean
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
  return (
    <label className="settings-field">
      <span className="settings-label">{label}</span>
      {hint && <span className="settings-hint">{hint}</span>}
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => {
          const parsed = Number(event.target.value)
          if (Number.isFinite(parsed)) {
            onChange(Math.min(max, Math.max(min, parsed)))
          }
        }}
      />
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
  if (genome.id === AUTO_CHAMPION_GENOME_ID && autoChampion) {
    return `All-time lineage · peak ${autoChampion.peakPopulation} · ${formatYears(autoChampion.lineageSpanTicks)} together`
  }
  return genome.name
}

function founderHint(
  selectedId: string,
  autoChampion: AutoChampionRecord | null,
): string {
  if (!selectedId) return 'Random founder DNA for this group'
  if (selectedId === AUTO_CHAMPION_GENOME_ID && autoChampion) {
    return `${autoChampion.genome.sex} · ${autoChampion.population} alive · peak ${autoChampion.peakPopulation} · ${formatYears(autoChampion.lineageSpanTicks)}`
  }
  const selected = getFounderGenomeById(selectedId)
  if (!selected) return 'Saved genome'
  return `${selected.sex} · saved from creature #${selected.sourceCreatureId}`
}

export function SettingsModal({
  open,
  draft,
  active,
  seed,
  autoChampion,
  autoPlantChampion,
  autoPathogenChampion,
  onChange,
  onStart,
  onClose,
}: SettingsModalProps) {
  const [library, setLibrary] = useState<SavedGenome[]>([])

  useEffect(() => {
    if (open) {
      setLibrary(listFounderGenomeChoices())
    }
  }, [open, autoChampion?.fitnessScore])

  if (!open) return null

  const pendingChanges = settingsRunKey(draft) !== settingsRunKey(active)
  const totalHerbivores = totalStartingHerbivores(draft)
  const selectedChampions = draft.groupFounders
    .slice(0, draft.creatureGroups)
    .filter((id) => id.length > 0)

  return (
    <div className="settings-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="settings-modal-header">
          <div>
            <h2 id="settings-modal-title">Simulation settings</h2>
            <p className="settings-subtitle">
              {draft.creatureGroups} group{draft.creatureGroups === 1 ? '' : 's'} · {totalHerbivores}{' '}
              creatures · {draft.initialPlants} plants
              {selectedChampions.length > 0 &&
                ` · ${selectedChampions.length} saved champion${selectedChampions.length === 1 ? '' : 's'}`}
            </p>
          </div>
          <button type="button" className="settings-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="settings-modal-body">
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
                value={draft.herbivoresPerGroup}
                min={2}
                max={80}
                onChange={(herbivoresPerGroup) => onChange(patch(draft, { herbivoresPerGroup }))}
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
                label="Max plants"
                value={draft.maxPlants}
                min={50}
                max={5000}
                onChange={(maxPlants) => onChange(patch(draft, { maxPlants }))}
              />
              <NumberField
                label="Spread chance"
                hint="Per tick when plants exist (%)"
                value={Math.round(draft.plantSpawnChance * 1000) / 10}
                min={0}
                max={20}
                step={0.1}
                onChange={(pct) => onChange(patch(draft, { plantSpawnChance: pct / 100 }))}
              />
              <NumberField
                label="Wind seed chance"
                hint="When map is bare (%)"
                value={Math.round(draft.plantWindSpawnChance * 1000) / 10}
                min={0}
                max={50}
                step={0.1}
                onChange={(pct) => onChange(patch(draft, { plantWindSpawnChance: pct / 100 }))}
              />
              <NumberField
                label="Low plant boost"
                hint="Count below which spread doubles"
                value={draft.plantLowCountBoost}
                min={0}
                max={200}
                onChange={(plantLowCountBoost) => onChange(patch(draft, { plantLowCountBoost }))}
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
              <NumberField
                label="Mate pref. noise"
                hint="How far mate prefs drift from body"
                value={draft.founderPreferenceNoise}
                min={0}
                max={40}
                onChange={(founderPreferenceNoise) => onChange(patch(draft, { founderPreferenceNoise }))}
              />
            </div>
          </details>
        </div>

        <footer className="settings-modal-footer">
          <p className="settings-seed">Active seed: {seed}</p>
          {pendingChanges && (
            <p className="settings-pending">Unsaved changes — restart to apply to the simulation.</p>
          )}
          <div className="settings-actions">
            <button type="button" onClick={onClose}>
              Close
            </button>
            <button type="button" className="settings-primary" onClick={() => onStart(false)}>
              {pendingChanges ? 'Apply & restart' : 'Restart'}
            </button>
            <button type="button" onClick={() => onStart(true)}>
              New seed
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
