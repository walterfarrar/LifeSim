import { useEffect, useMemo, useState } from 'react'
import type { AutoChampionRecord } from '../sim/autoChampion'
import { summarizeChampion } from '../sim/championSummary'
import {
  copyGenomeToClipboard,
  downloadGenomeFile,
  geneArrayToDna,
} from '../sim/dnaExport'
import { expressCreatureTraits } from '../sim/phenotype'
import { formatYears } from '../sim/timeScale'
import { DnaAvatar } from './CreatureAvatar'
import { ExpressedTraitsList } from './ExpressedTraitsList'
import { GenomeDnaTable } from './GenomeDnaTable'

type ChampionModalProps = {
  open: boolean
  champion: AutoChampionRecord | null
  onClose: () => void
}

function fmt(value: number, digits = 1): string {
  return value.toFixed(digits)
}

function formatSavedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString()
}

export function ChampionModal({ open, champion, onClose }: ChampionModalProps) {
  const [message, setMessage] = useState<string | null>(null)

  const dna = useMemo(() => {
    if (!champion) return null
    return geneArrayToDna(champion.genome.genes)
  }, [champion])

  const traits = useMemo(() => {
    if (!dna) return null
    return expressCreatureTraits(dna, 0)
  }, [dna])

  const summary = useMemo(() => {
    if (!champion || !dna || !traits) return null
    return summarizeChampion(traits, dna, champion)
  }, [champion, dna, traits])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  useEffect(() => {
    if (!open) setMessage(null)
  }, [open])

  if (!open) return null

  const flash = (text: string) => {
    setMessage(text)
    window.setTimeout(() => setMessage(null), 2800)
  }

  return (
    <div
      className="settings-modal-backdrop champion-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="settings-modal champion-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="champion-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="settings-modal-header champion-modal-header">
          <div className="champion-modal-title-block">
            {champion && dna && (
              <DnaAvatar dna={dna} sex={champion.genome.sex} size={72} />
            )}
            <div>
              <h2 id="champion-modal-title">All-time lineage champion</h2>
              <p className="settings-subtitle">
                {champion
                  ? champion.genome.name
                  : 'No champion saved yet — strongest lineage is tracked once per minute.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="settings-modal-close"
            onClick={onClose}
            aria-label="Close champion view"
          >
            ×
          </button>
        </header>

        <div className="settings-modal-body champion-modal-body">
          {!champion || !dna || !traits ? (
            <p className="hint">
              Run the simulation until a dominant lineage emerges. The best group is saved
              automatically and can be used as a founder in settings.
            </p>
          ) : (
            <>
              {summary && (
                <section className="champion-summary" aria-label="Champion analysis">
                  <p className="champion-archetype">{summary.archetype}</p>
                  <p className="champion-summary-intro">{summary.intro}</p>
                  <p className="champion-summary-body">{summary.body}</p>
                  {summary.highlights.length > 0 && (
                    <ul className="champion-highlights">
                      {summary.highlights.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                  {summary.caveat && <p className="champion-caveat">{summary.caveat}</p>}
                </section>
              )}

              <h3>Lineage record</h3>
              <dl className="inspector-grid champion-lineage-grid">
                <div>
                  <dt>Fitness score</dt>
                  <dd>{fmt(champion.fitnessScore, 1)}</dd>
                </div>
                <div>
                  <dt>Peak population</dt>
                  <dd>{champion.peakPopulation}</dd>
                </div>
                <div>
                  <dt>Alive at save</dt>
                  <dd>{champion.population}</dd>
                </div>
                <div>
                  <dt>Together for</dt>
                  <dd>{formatYears(champion.lineageSpanTicks)}</dd>
                </div>
                <div>
                  <dt>Observations</dt>
                  <dd>{champion.observationCount}</dd>
                </div>
                <div>
                  <dt>Saved</dt>
                  <dd>{formatSavedAt(champion.savedAt)}</dd>
                </div>
                <div>
                  <dt>Run seed</dt>
                  <dd className="seed-value">{champion.runSeed}</dd>
                </div>
                <div>
                  <dt>Run time</dt>
                  <dd>{formatYears(champion.runTick)}</dd>
                </div>
              </dl>

              <h3>Representative snapshot</h3>
              <p className="hint">
                Medoid creature from the lineage — appearance and DNA below.
              </p>
              <dl className="inspector-grid">
                <div>
                  <dt>Creature</dt>
                  <dd>#{champion.genome.sourceCreatureId}</dd>
                </div>
                <div>
                  <dt>Sex</dt>
                  <dd>{champion.genome.sex}</dd>
                </div>
                <div>
                  <dt>Age at save</dt>
                  <dd>{formatYears(champion.genome.ageTicks)}</dd>
                </div>
                <div>
                  <dt>Energy at save</dt>
                  <dd>
                    {fmt(champion.genome.energy)} / {fmt(traits.maxEnergy, 0)}
                  </dd>
                </div>
                <div>
                  <dt>Genes</dt>
                  <dd>{champion.genome.genes.length}</dd>
                </div>
                <div>
                  <dt>Lineage id</dt>
                  <dd className="seed-value">{champion.lineageId}</dd>
                </div>
              </dl>

              <h3>Expressed traits</h3>
              <ExpressedTraitsList traits={traits} />

              <h3>DNA (raw genes)</h3>
              <GenomeDnaTable dna={dna} />
            </>
          )}
        </div>

        {champion && (
          <footer className="settings-modal-footer">
            {message && <p className="dna-save-message">{message}</p>}
            <div className="settings-actions">
              <button type="button" onClick={onClose}>
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  void copyGenomeToClipboard(champion.genome).then(
                    () => flash('DNA copied to clipboard'),
                    () => flash('Could not copy DNA'),
                  )
                }}
              >
                Copy JSON
              </button>
              <button
                type="button"
                className="settings-primary"
                onClick={() => {
                  downloadGenomeFile(champion.genome)
                  flash('Downloaded DNA file')
                }}
              >
                Download DNA
              </button>
            </div>
          </footer>
        )}
      </div>
    </div>
  )
}
