import { CreatureAvatar } from './CreatureAvatar'
import { ExpressedTraitsList } from './ExpressedTraitsList'
import { GenomeDnaTable } from './GenomeDnaTable'
import { creatureTraits, hungryEnterLine, hungryExitLine, thirstyEnterLine, thirstyExitLine } from '../sim/entities/creature'
import {
  copyGenomeToClipboard,
  creatureToSavedGenome,
  downloadGenomeFile,
  loadSavedGenomeLibrary,
  removeFromGenomeLibrary,
  saveToGenomeLibrary,
  type SavedGenome,
} from '../sim/dnaExport'
import { formatYears } from '../sim/timeScale'
import type { Creature } from '../sim/types'
import { useState } from 'react'

type CreatureInspectorProps = {
  creature: Creature
  onClose: () => void
  onEditInDesigner?: (creature: Creature) => void
}

function fmt(value: number, digits = 1): string {
  return value.toFixed(digits)
}

export function CreatureInspector({ creature, onClose, onEditInDesigner }: CreatureInspectorProps) {
  const [saveName, setSaveName] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [library, setLibrary] = useState<SavedGenome[]>(() => loadSavedGenomeLibrary())

  const traits = creatureTraits(creature)
  const hungryAt = hungryEnterLine(creature)
  const satedAt = hungryExitLine(creature)
  const thirstyAt = thirstyEnterLine(creature)
  const hydratedAt = thirstyExitLine(creature)
  const defaultName = `Champion #${creature.id}`

  const flash = (text: string) => {
    setMessage(text)
    window.setTimeout(() => setMessage(null), 2800)
  }

  const buildSave = () => creatureToSavedGenome(creature, saveName || defaultName)

  const handleSaveToLibrary = () => {
    const saved = buildSave()
    setLibrary(saveToGenomeLibrary(saved))
    flash(`Saved “${saved.name}” to this browser`)
  }

  const handleCopy = async () => {
    try {
      await copyGenomeToClipboard(buildSave())
      flash('DNA copied to clipboard')
    } catch {
      flash('Could not copy — try Save or Download instead')
    }
  }

  const handleDownload = () => {
    downloadGenomeFile(buildSave())
    flash('Downloaded DNA file')
  }

  const handleDeleteSaved = (id: string) => {
    setLibrary(removeFromGenomeLibrary(id))
    flash('Removed saved DNA')
  }

  return (
    <section className="map-inspector creature-inspector">
      <header className="inspector-header">
        <div className="inspector-title-row">
          <CreatureAvatar creature={creature} size={52} />
          <h2>Creature #{creature.id}</h2>
        </div>
        <button type="button" className="inspector-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>

      <dl className="inspector-grid">
        <div>
          <dt>Sex</dt>
          <dd>{creature.sex}</dd>
        </div>
        <div>
          <dt>Mode</dt>
          <dd className={`mode-${creature.mode}`}>{creature.mode}</dd>
        </div>
        <div>
          <dt>Age</dt>
          <dd>{formatYears(creature.age)}</dd>
        </div>
        <div>
          <dt>Energy</dt>
          <dd>
            {fmt(creature.energy)} / {fmt(traits.maxEnergy, 0)}
          </dd>
        </div>
        <div>
          <dt>Hydration</dt>
          <dd>
            {fmt(creature.hydration)} / {fmt(traits.maxHydration, 0)}
          </dd>
        </div>
        <div>
          <dt>Hungry below</dt>
          <dd>{fmt(hungryAt)}</dd>
        </div>
        <div>
          <dt>Sated above</dt>
          <dd>{fmt(satedAt)}</dd>
        </div>
        <div>
          <dt>Thirsty below</dt>
          <dd>{fmt(thirstyAt)}</dd>
        </div>
        <div>
          <dt>Hydrated above</dt>
          <dd>{fmt(hydratedAt)}</dd>
        </div>
        <div>
          <dt>Fatigue</dt>
          <dd>{fmt(creature.fatigue)} / {fmt(traits.sleepFatigueThreshold, 0)}</dd>
        </div>
        <div>
          <dt>Position</dt>
          <dd>
            {fmt(creature.x, 0)}, {fmt(creature.y, 0)}
          </dd>
        </div>
        <div>
          <dt>Velocity</dt>
          <dd>
            {fmt(creature.vx, 2)}, {fmt(creature.vy, 2)}
          </dd>
        </div>
        <div>
          <dt>Repro cooldown</dt>
          <dd>{creature.reproductionCooldown > 0 ? formatYears(creature.reproductionCooldown) : 'Ready'}</dd>
        </div>
        <div>
          <dt>Pregnancy</dt>
          <dd>
            {creature.pregnancyTicksRemaining > 0
              ? `${formatYears(creature.pregnancyTicksRemaining)} left`
              : 'None'}
          </dd>
        </div>
        <div>
          <dt>Inbreeding load</dt>
          <dd>{creature.inbreedingLoad > 0 ? `${fmt(creature.inbreedingLoad * 100, 0)}%` : 'None'}</dd>
        </div>
        <div>
          <dt>Infection</dt>
          <dd>
            {creature.infection
              ? `Severity ${fmt(creature.infection.severity * 100, 0)}% · strain #${creature.infection.pathogenId}`
              : 'None'}
          </dd>
        </div>
        {traits.memorySlots > 0 && (
          <div>
            <dt>Memories</dt>
            <dd>
              {creature.memories && creature.memories.length > 0
                ? creature.memories
                    .map((memory) => {
                      const label = memory.kind === 'water' ? 'Water' : 'Food'
                      return `${label} ${fmt(memory.strength * 100, 0)}% @ (${fmt(memory.x, 0)}, ${fmt(memory.y, 0)})`
                    })
                    .join(' · ')
                : 'None yet'}
            </dd>
          </div>
        )}
      </dl>

      <h3>Expressed traits</h3>
      <ExpressedTraitsList traits={traits} attackCooldown={creature.attackCooldown} />

      <div className="dna-save-panel">
        <h3>Save DNA</h3>
        <p className="hint">
          Saves a snapshot of this genome only — your creature keeps running in the sim.
        </p>
        {onEditInDesigner && (
          <button
            type="button"
            className="settings-primary creature-inspector-edit"
            onClick={() => onEditInDesigner(creature)}
          >
            Open in creature editor
          </button>
        )}
        <label className="dna-save-field">
          <span>Name</span>
          <input
            type="text"
            value={saveName}
            placeholder={defaultName}
            onChange={(event) => setSaveName(event.target.value)}
          />
        </label>
        <div className="dna-save-actions">
          <button type="button" className="settings-primary" onClick={handleSaveToLibrary}>
            Save to library
          </button>
          <button type="button" onClick={() => void handleCopy()}>
            Copy JSON
          </button>
          <button type="button" onClick={handleDownload}>
            Download file
          </button>
        </div>
        {message && <p className="dna-save-message">{message}</p>}
        {library.length > 0 && (
          <ul className="dna-library-list">
            {library.map((item) => (
              <li key={item.id}>
                <span className="dna-library-name">{item.name}</span>
                <span className="dna-library-meta">
                  #{item.sourceCreatureId} · {item.genes.length} genes
                </span>
                <button type="button" className="dna-library-delete" onClick={() => handleDeleteSaved(item.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <h3>DNA (raw genes)</h3>
      <GenomeDnaTable dna={creature.dna} />
    </section>
  )
}
