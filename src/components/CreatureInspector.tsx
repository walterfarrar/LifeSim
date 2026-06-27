import { CreatureAvatar } from './CreatureAvatar'
import { creatureTraits, hungryEnterLine, hungryExitLine } from '../sim/entities/creature'
import { HERBIVORE_GENE_LABELS } from '../sim/geneLabels'
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
  creature: Creature | null
  onClose: () => void
}

function fmt(value: number, digits = 1): string {
  return value.toFixed(digits)
}

export function CreatureInspector({ creature, onClose }: CreatureInspectorProps) {
  const [saveName, setSaveName] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [library, setLibrary] = useState<SavedGenome[]>(() => loadSavedGenomeLibrary())

  if (!creature) {
    return (
      <section className="creature-inspector empty">
        <h2>Creature inspector</h2>
        <p className="hint">Click a creature on the map to inspect its DNA and stats.</p>
      </section>
    )
  }

  const traits = creatureTraits(creature)
  const hungryAt = hungryEnterLine(creature)
  const satedAt = hungryExitLine(creature)
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
    <section className="creature-inspector">
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
          <dt>Hungry below</dt>
          <dd>{fmt(hungryAt)}</dd>
        </div>
        <div>
          <dt>Sated above</dt>
          <dd>{fmt(satedAt)}</dd>
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
      </dl>

      <h3>Expressed traits</h3>
      <dl className="inspector-traits">
        <div><dt>Speed</dt><dd>{fmt(traits.speed, 2)}</dd></div>
        <div><dt>Radius</dt><dd>{fmt(traits.radius, 2)}</dd></div>
        <div><dt>Metabolism</dt><dd>{fmt(traits.metabolism, 3)}</dd></div>
        <div><dt>Vision</dt><dd>{fmt(traits.vision, 0)}</dd></div>
        <div><dt>Repro threshold</dt><dd>{fmt(traits.reproThreshold, 0)}</dd></div>
        <div><dt>Max age</dt><dd>{formatYears(traits.maxAge)}</dd></div>
        <div><dt>Forage efficiency</dt><dd>{fmt(traits.forageEfficiency, 2)}</dd></div>
        <div><dt>Offspring gift</dt><dd>{fmt(traits.offspringGift, 2)}</dd></div>
        <div><dt>Color</dt><dd>hsl({fmt(traits.hue, 0)}, {fmt(traits.saturation, 0)}%, {fmt(traits.lightness, 0)}%)</dd></div>
        <div><dt>Shape</dt><dd>{traits.shape}</dd></div>
        <div><dt>Hunger ratio</dt><dd>{fmt(traits.hungerRatio, 2)}</dd></div>
        <div><dt>Satiety buffer</dt><dd>{fmt(traits.satietyBuffer * 100, 0)}%</dd></div>
        <div><dt>Sleep threshold</dt><dd>{fmt(traits.sleepFatigueThreshold, 0)}</dd></div>
        <div><dt>Awake fatigue gain</dt><dd>{fmt(traits.awakeFatigueGain, 2)}</dd></div>
        <div><dt>Sleep recovery</dt><dd>{fmt(traits.sleepFatigueRecovery, 2)}</dd></div>
        <div><dt>Libido</dt><dd>{fmt(traits.libido, 2)}</dd></div>
        <div><dt>Max energy</dt><dd>{fmt(traits.maxEnergy, 0)}</dd></div>
        <div><dt>Bite amount</dt><dd>{fmt(traits.biteAmount, 1)}</dd></div>
        <div><dt>Forage reach</dt><dd>{fmt(traits.forageReach, 1)}</dd></div>
        <div><dt>Repro cooldown</dt><dd>{formatYears(traits.reproCooldown)}</dd></div>
        <div><dt>Mate range</dt><dd>{fmt(traits.mateRange, 1)}</dd></div>
        <div><dt>Sleep mobility</dt><dd>{fmt(traits.sleepMobility, 2)}</dd></div>
        <div><dt>Explore vision</dt><dd>{fmt(traits.exploreVisionMult, 2)}×</dd></div>
        <div><dt>Mode commitment</dt><dd>{fmt(traits.modeCommitment, 0)} ticks</dd></div>
        <div><dt>Wanderlust</dt><dd>{fmt(traits.wanderDurationMin, 0)}–{fmt(traits.wanderDurationMin + traits.wanderDurationSpan, 0)}</dd></div>
        <div><dt>Birth reserve</dt><dd>{fmt(traits.birthEnergyReserve, 2)}</dd></div>
        <div><dt>Maturation age</dt><dd>{formatYears(traits.maturationAge)}</dd></div>
        <div><dt>Gestation</dt><dd>{formatYears(traits.pregnancyTicks)}</dd></div>
        <div><dt>Sleep metabolism</dt><dd>{fmt(traits.sleepMetabolismScale, 2)}×</dd></div>
        <div><dt>Preferred hue</dt><dd>{fmt(traits.preferHue, 0)}°</dd></div>
        <div><dt>Preferred size</dt><dd>{fmt(traits.preferSize * 100, 0)}%</dd></div>
        <div><dt>Preferred speed</dt><dd>{fmt(traits.preferSpeed * 100, 0)}%</dd></div>
        <div><dt>Mate selectivity</dt><dd>{fmt(traits.mateSelectivity * 100, 0)}%</dd></div>
        <div><dt>Genetic assortment</dt><dd>{fmt(traits.geneticAssortment * 100, 0)}% target similarity</dd></div>
        <div><dt>Preference strength</dt><dd>{fmt(traits.matePreferenceStrength * 100, 0)}%</dd></div>
        <div><dt>Space tolerance</dt><dd>{fmt(traits.spaceTolerance * 100, 0)}%</dd></div>
        <div><dt>Personal space</dt><dd>{fmt(traits.personalSpace, 1)} px</dd></div>
        <div><dt>Aggressiveness</dt><dd>{fmt(traits.aggressiveness * 100, 0)}%</dd></div>
        <div><dt>Dissimilar predation</dt><dd>{fmt(traits.cannibalPredilection * 100, 0)}%</dd></div>
        <div><dt>Attack damage</dt><dd>{fmt(traits.attackDamage, 1)}</dd></div>
        <div><dt>Attack range</dt><dd>{fmt(traits.attackRange, 1)} px</dd></div>
        <div><dt>Attack cooldown</dt><dd>{creature.attackCooldown > 0 ? `${creature.attackCooldown} ticks` : 'Ready'}</dd></div>
        <div><dt>Mutation rate</dt><dd>{fmt(traits.mutationRate * 100, 3)}% per gene</dd></div>
        <div><dt>Mutation amount</dt><dd>±{traits.mutationAmount} (small)</dd></div>
        <div><dt>Disease resistance</dt><dd>{fmt(traits.diseaseResistance * 100, 0)}%</dd></div>
        <div><dt>Disease recovery</dt><dd>{fmt(traits.diseaseRecovery * 100, 0)}%</dd></div>
        <div><dt>Inbreeding tolerance</dt><dd>{fmt(traits.inbreedingTolerance * 100, 0)}%</dd></div>
        <div><dt>Contagion</dt><dd>{fmt(traits.contagion * 100, 0)}%</dd></div>
      </dl>

      <div className="dna-save-panel">
        <h3>Save DNA</h3>
        <p className="hint">
          Saves a snapshot of this genome only — your creature keeps running in the sim.
        </p>
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
      <div className="dna-table-wrap">
        <table className="dna-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Gene</th>
              <th>Raw</th>
              <th>%</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(creature.dna, (allele, index) => (
              <tr key={index}>
                <td>{index}</td>
                <td>{HERBIVORE_GENE_LABELS[index] ?? `Gene ${index}`}</td>
                <td>{allele}</td>
                <td>{fmt((allele / 255) * 100, 0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
