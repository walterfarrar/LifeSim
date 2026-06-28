import { useEffect, useMemo, useState } from 'react'
import {
  loadCreatureChampionHall,
  type AutoChampionRecord,
} from '../sim/autoChampion'
import { summarizeChampion } from '../sim/championSummary'
import { geneArrayToDna } from '../sim/dnaExport'
import { geneArrayToPlantDna } from '../sim/plantDnaExport'
import { geneArrayToPathogenDna } from '../sim/pathogenDnaExport'
import { expressPathogen } from '../sim/disease/pathogen'
import { PATHOGEN_GENE_LABELS, PLANT_GENE_LABELS } from '../sim/geneLabels'
import {
  loadPlantChampionHall,
  type AutoPlantChampionRecord,
} from '../sim/plantAutoChampion'
import {
  loadPathogenChampionHall,
  type AutoPathogenChampionRecord,
} from '../sim/pathogenAutoChampion'
import { expressCreatureTraits, expressPlant } from '../sim/phenotype'
import { formatYears } from '../sim/timeScale'
import { DnaAvatar } from './CreatureAvatar'
import { ExpressedTraitsList } from './ExpressedTraitsList'
import { GenomeDnaTable } from './GenomeDnaTable'

type HallTab = 'creatures' | 'plants' | 'diseases'

type ChampionHallModalProps = {
  open: boolean
  onClose: () => void
}

function fmt(value: number, digits = 1): string {
  return value.toFixed(digits)
}

function KeyValueTraits({ traits }: { traits: Record<string, number | string> }) {
  return (
    <dl className="inspector-traits">
      {Object.entries(traits).map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{typeof value === 'number' ? fmt(value, 2) : value}</dd>
        </div>
      ))}
    </dl>
  )
}

function formatSavedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString()
}

export function ChampionHallModal({ open, onClose }: ChampionHallModalProps) {
  const [tab, setTab] = useState<HallTab>('creatures')
  const [creatureHall, setCreatureHall] = useState<AutoChampionRecord[]>([])
  const [plantHall, setPlantHall] = useState<AutoPlantChampionRecord[]>([])
  const [pathogenHall, setPathogenHall] = useState<AutoPathogenChampionRecord[]>([])
  const [selectedRank, setSelectedRank] = useState(0)

  useEffect(() => {
    if (!open) return
    setCreatureHall(loadCreatureChampionHall())
    setPlantHall(loadPlantChampionHall())
    setPathogenHall(loadPathogenChampionHall())
    setSelectedRank(0)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const activeHall =
    tab === 'creatures' ? creatureHall : tab === 'plants' ? plantHall : pathogenHall

  useEffect(() => {
    if (selectedRank >= activeHall.length) {
      setSelectedRank(0)
    }
  }, [activeHall.length, selectedRank])

  const selectedCreature = creatureHall[tab === 'creatures' ? selectedRank : 0] ?? null
  const selectedPlant = plantHall[tab === 'plants' ? selectedRank : 0] ?? null
  const selectedPathogen = pathogenHall[tab === 'diseases' ? selectedRank : 0] ?? null

  const creatureDna = useMemo(() => {
    if (!selectedCreature) return null
    return geneArrayToDna(selectedCreature.genome.genes)
  }, [selectedCreature])

  const creatureTraits = useMemo(() => {
    if (!creatureDna) return null
    return expressCreatureTraits(creatureDna, 0)
  }, [creatureDna])

  const creatureSummary = useMemo(() => {
    if (!selectedCreature || !creatureDna || !creatureTraits) return null
    return summarizeChampion(creatureTraits, creatureDna, selectedCreature)
  }, [selectedCreature, creatureDna, creatureTraits])

  const plantDna = useMemo(() => {
    if (!selectedPlant) return null
    return geneArrayToPlantDna(selectedPlant.genome.genes)
  }, [selectedPlant])

  const plantTraits = useMemo(() => {
    if (!plantDna) return null
    return expressPlant(plantDna)
  }, [plantDna])

  const pathogenDna = useMemo(() => {
    if (!selectedPathogen) return null
    return geneArrayToPathogenDna(selectedPathogen.genome.genes)
  }, [selectedPathogen])

  const pathogenTraits = useMemo(() => {
    if (!pathogenDna) return null
    return expressPathogen(pathogenDna)
  }, [pathogenDna])

  if (!open) return null

  const hasAnyHall = creatureHall.length + plantHall.length + pathogenHall.length > 0

  return (
    <div className="settings-modal-backdrop champion-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="settings-modal champion-modal champion-hall-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="champion-hall-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="settings-modal-header champion-modal-header">
          <div>
            <h2 id="champion-hall-title">Champion hall of fame</h2>
            <p className="settings-subtitle">
              Top 5 all-time by category — updated only when a new reigning champion is crowned
            </p>
          </div>
          <button type="button" className="settings-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="champion-hall-tabs" role="tablist">
          {(
            [
              ['creatures', `Creatures (${creatureHall.length})`],
              ['plants', `Plants (${plantHall.length})`],
              ['diseases', `Diseases (${pathogenHall.length})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={tab === id ? 'champion-hall-tab active' : 'champion-hall-tab'}
              onClick={() => {
                setTab(id)
                setSelectedRank(0)
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="settings-modal-body champion-modal-body champion-hall-body">
          {!hasAnyHall ? (
            <p className="settings-empty">
              No champions saved yet. Lineages, plant species, and pathogen strains are sampled once
              a minute; beating the reigning champion adds them to the hall (max 5 per category).
            </p>
          ) : activeHall.length === 0 ? (
            <p className="settings-empty">No champions in this category yet.</p>
          ) : (
            <div className="champion-hall-layout">
              <ol className="champion-hall-rankings">
                {activeHall.map((entry, index) => (
                  <li key={entry.entryId}>
                    <button
                      type="button"
                      className={
                        index === selectedRank
                          ? 'champion-hall-rank active'
                          : 'champion-hall-rank'
                      }
                      onClick={() => setSelectedRank(index)}
                    >
                      <span className="champion-hall-rank-num">#{index + 1}</span>
                      <span className="champion-hall-rank-name">{entry.genome.name}</span>
                      <span className="champion-hall-rank-score">{fmt(entry.fitnessScore, 0)}</span>
                    </button>
                  </li>
                ))}
              </ol>

              <div className="champion-hall-detail">
                {tab === 'creatures' && selectedCreature && creatureDna && creatureTraits && (
                  <>
                    <div className="champion-modal-title-block">
                      <DnaAvatar dna={creatureDna} sex={selectedCreature.genome.sex} size={64} />
                      <div>
                        <h3>{selectedCreature.genome.name}</h3>
                        {creatureSummary && (
                          <p className="champion-archetype">{creatureSummary.archetype}</p>
                        )}
                      </div>
                    </div>
                    <dl className="inspector-grid champion-lineage-grid">
                      <div><dt>Fitness</dt><dd>{fmt(selectedCreature.fitnessScore, 1)}</dd></div>
                      <div><dt>Peak population</dt><dd>{selectedCreature.peakPopulation}</dd></div>
                      <div><dt>Alive at save</dt><dd>{selectedCreature.population}</dd></div>
                      <div><dt>Together</dt><dd>{formatYears(selectedCreature.lineageSpanTicks)}</dd></div>
                      <div><dt>Saved</dt><dd>{formatSavedAt(selectedCreature.savedAt)}</dd></div>
                    </dl>
                    {creatureSummary && (
                      <p className="champion-summary-body">{creatureSummary.body}</p>
                    )}
                    <ExpressedTraitsList traits={creatureTraits} />
                    <GenomeDnaTable dna={creatureDna} />
                  </>
                )}

                {tab === 'plants' && selectedPlant && plantDna && plantTraits && (
                  <>
                    <h3>{selectedPlant.genome.name}</h3>
                    <dl className="inspector-grid champion-lineage-grid">
                      <div><dt>Fitness</dt><dd>{fmt(selectedPlant.fitnessScore, 1)}</dd></div>
                      <div><dt>Peak population</dt><dd>{selectedPlant.peakPopulation}</dd></div>
                      <div><dt>Peak biomass</dt><dd>{fmt(selectedPlant.peakBiomass, 0)}</dd></div>
                      <div><dt>Span</dt><dd>{formatYears(selectedPlant.speciesSpanTicks)}</dd></div>
                      <div><dt>Saved</dt><dd>{formatSavedAt(selectedPlant.savedAt)}</dd></div>
                    </dl>
                    <KeyValueTraits
                      traits={{
                        'Max energy': plantTraits.maxEnergy,
                        'Growth rate': plantTraits.growthRate,
                        Reproduction: plantTraits.reproductionRate,
                        'Spread min': plantTraits.spreadMin,
                        'Spread max': plantTraits.spreadMax,
                      }}
                    />
                    <GenomeDnaTable dna={plantDna} labels={PLANT_GENE_LABELS} />
                  </>
                )}

                {tab === 'diseases' && selectedPathogen && pathogenDna && pathogenTraits && (
                  <>
                    <h3>{selectedPathogen.genome.name}</h3>
                    <dl className="inspector-grid champion-lineage-grid">
                      <div><dt>Fitness</dt><dd>{fmt(selectedPathogen.fitnessScore, 1)}</dd></div>
                      <div><dt>Peak infected</dt><dd>{selectedPathogen.peakInfected}</dd></div>
                      <div><dt>Infected at save</dt><dd>{selectedPathogen.infectedCount}</dd></div>
                      <div><dt>Strain variants</dt><dd>{selectedPathogen.peakStrainCount}</dd></div>
                      <div><dt>Span</dt><dd>{formatYears(selectedPathogen.strainSpanTicks)}</dd></div>
                      <div><dt>Generation</dt><dd>{selectedPathogen.genome.generation}</dd></div>
                      <div><dt>Saved</dt><dd>{formatSavedAt(selectedPathogen.savedAt)}</dd></div>
                    </dl>
                    <KeyValueTraits
                      traits={{
                        'Antigen A': pathogenTraits.antigens[0],
                        'Antigen B': pathogenTraits.antigens[1],
                        'Antigen C': pathogenTraits.antigens[2],
                        Virulence: pathogenTraits.virulence,
                        Transmissibility: pathogenTraits.transmissibility,
                      }}
                    />
                    <GenomeDnaTable dna={pathogenDna} labels={PATHOGEN_GENE_LABELS} />
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
