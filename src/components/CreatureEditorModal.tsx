import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DnaAvatar } from './CreatureAvatar'
import { ExpressedTraitsList } from './ExpressedTraitsList'
import {
  copyGenomeToClipboard,
  downloadGenomeFile,
  loadSavedGenomeLibrary,
  parseSavedGenome,
  removeFromGenomeLibrary,
  saveToGenomeLibrary,
  type SavedGenome,
} from '../sim/dnaExport'
import {
  cloneSavedGenome,
  createDefaultEditorGenome,
  editorGenesToDna,
  clampEditorGenes,
  herbivoreBudgetRemaining,
  herbivoreBudgetSum,
  isEditorBudgetValid,
  savedGenomeFromGenes,
  setEditorGeneValue,
  setEditorSex,
  HERBIVORE_BUDGET_GENES,
  HERBIVORE_BUDGET_TOTAL,
} from '../sim/creatureEditor'
import { GeneLabelTooltip } from './GeneLabelTooltip'
import { HERBIVORE_GENE_DESCRIPTIONS, HERBIVORE_GENE_LABELS } from '../sim/geneLabels'
import { isHerbivoreBudgetGene } from '../sim/herbivoreBudget'
import { listFounderGenomeChoices } from '../sim/founderGenomes'
import { expressHerbivore } from '../sim/phenotype'

type CreatureEditorModalProps = {
  open: boolean
  initialGenome?: SavedGenome | null
  onClose: () => void
}

type LoadOption = {
  id: string
  label: string
  genome: SavedGenome
}

function loadOptions(): LoadOption[] {
  const options: LoadOption[] = [
    {
      id: '__new__',
      label: 'New blank creature',
      genome: createDefaultEditorGenome(),
    },
  ]

  for (const genome of listFounderGenomeChoices()) {
    options.push({
      id: genome.id,
      label: genome.name,
      genome: cloneSavedGenome(genome, { id: genome.id }),
    })
  }

  for (const genome of loadSavedGenomeLibrary()) {
    if (options.some((option) => option.id === genome.id)) continue
    options.push({
      id: genome.id,
      label: genome.name,
      genome: cloneSavedGenome(genome),
    })
  }

  return options
}

export function CreatureEditorModal({ open, initialGenome, onClose }: CreatureEditorModalProps) {
  const [options, setOptions] = useState<LoadOption[]>(() => loadOptions())
  const [selectedLoadId, setSelectedLoadId] = useState('__new__')
  const [genomeId, setGenomeId] = useState(() => createDefaultEditorGenome().id)
  const [name, setName] = useState('New creature')
  const [genes, setGenes] = useState<number[]>(() => createDefaultEditorGenome().genes)
  const [sex, setSex] = useState<SavedGenome['sex']>('female')
  const [message, setMessage] = useState<string | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  const flash = useCallback((text: string) => {
    setMessage(text)
    window.setTimeout(() => setMessage(null), 2800)
  }, [])

  const applyGenome = useCallback((genome: SavedGenome, loadId: string) => {
    const normalized = clampEditorGenes([...genome.genes])
    setSelectedLoadId(loadId)
    setGenomeId(genome.id)
    setName(genome.name)
    setGenes(normalized)
    setSex(genome.sex)
  }, [])

  useEffect(() => {
    if (!open) return
    setOptions(loadOptions())
    if (initialGenome) {
      applyGenome(cloneSavedGenome(initialGenome), initialGenome.id)
    } else {
      const fresh = createDefaultEditorGenome()
      applyGenome(fresh, '__new__')
    }
  }, [open, initialGenome, applyGenome])

  const dna = useMemo(() => editorGenesToDna(genes), [genes])
  const traits = useMemo(() => expressHerbivore(dna), [dna])
  const budgetUsed = useMemo(() => herbivoreBudgetSum(genes), [genes])
  const budgetRemaining = useMemo(() => herbivoreBudgetRemaining(genes), [genes])
  const budgetValid = budgetRemaining >= 0

  const budgetGenes = useMemo(
    () =>
      HERBIVORE_BUDGET_GENES.map((gene) => ({
        index: gene,
        label: HERBIVORE_GENE_LABELS[gene] ?? `Gene ${gene}`,
        description: HERBIVORE_GENE_DESCRIPTIONS[gene] ?? '',
      })),
    [],
  )

  const otherGenes = useMemo(
    () =>
      genes
        .map((_, index) => index)
        .filter((index) => !isHerbivoreBudgetGene(index))
        .map((index) => ({
          index,
          label: HERBIVORE_GENE_LABELS[index] ?? `Gene ${index}`,
          description: HERBIVORE_GENE_DESCRIPTIONS[index] ?? '',
        })),
    [genes],
  )

  const buildSaved = useCallback(
    (overrides?: { id?: string; name?: string }) =>
      savedGenomeFromGenes(
        {
          id: overrides?.id ?? genomeId,
          name: (overrides?.name ?? name).trim() || 'Unnamed creature',
          sourceCreatureId: 0,
        },
        setEditorSex(genes, sex),
      ),
    [genomeId, name, genes, sex],
  )

  const handleLoad = (loadId: string) => {
    const option = options.find((entry) => entry.id === loadId)
    if (!option) return
    if (loadId === '__new__') {
      const fresh = createDefaultEditorGenome()
      applyGenome(fresh, '__new__')
      return
    }
    applyGenome(cloneSavedGenome(option.genome), loadId)
  }

  const handleGeneChange = (geneIndex: number, value: number) => {
    setGenes((current) => clampEditorGenes(setEditorGeneValue(current, geneIndex, value)))
  }

  const handleSexChange = (next: SavedGenome['sex']) => {
    setSex(next)
    setGenes((current) => clampEditorGenes(setEditorSex(current, next)))
  }

  const guardBudget = (): boolean => {
    if (isEditorBudgetValid(genes)) return true
    flash('Budget pool is over capacity — lower some core traits before saving.')
    return false
  }

  const handleSave = () => {
    if (!guardBudget()) return
    const saved = buildSaved()
    saveToGenomeLibrary(saved)
    setOptions(loadOptions())
    setGenomeId(saved.id)
    setSelectedLoadId(saved.id)
    flash(`Saved “${saved.name}”`)
  }

  const handleSaveAsNew = () => {
    if (!guardBudget()) return
    const saved = buildSaved({ id: `genome-${Date.now()}`, name: `${name.trim() || 'Creature'} (copy)` })
    saveToGenomeLibrary(saved)
    setOptions(loadOptions())
    setGenomeId(saved.id)
    setSelectedLoadId(saved.id)
    setName(saved.name)
    flash(`Saved copy as “${saved.name}”`)
  }

  const handleDelete = () => {
    if (selectedLoadId === '__new__') return
    removeFromGenomeLibrary(genomeId)
    const fresh = createDefaultEditorGenome()
    setOptions(loadOptions())
    applyGenome(fresh, '__new__')
    flash('Removed from library')
  }

  const handleImport = async (file: File) => {
    try {
      const text = await file.text()
      const imported = parseSavedGenome(text)
      applyGenome(imported, imported.id)
      flash(`Loaded “${imported.name}” from file`)
    } catch {
      flash('Could not read that file')
    }
  }

  if (!open) return null

  return (
    <div className="settings-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="settings-modal creature-editor-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="creature-editor-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="settings-modal-header">
          <div>
            <h2 id="creature-editor-title">Creature editor</h2>
            <p className="settings-subtitle">Design DNA, save to your library, use as a group founder in Settings.</p>
          </div>
          <button type="button" className="settings-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="settings-modal-body creature-editor-body">
          <div className="creature-editor-toolbar">
            <label className="settings-field creature-editor-load">
              <span className="settings-label">Load</span>
              <select value={selectedLoadId} onChange={(event) => handleLoad(event.target.value)}>
                {options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="settings-field creature-editor-name">
              <span className="settings-label">Name</span>
              <input type="text" value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="settings-field creature-editor-sex">
              <span className="settings-label">Sex</span>
              <select value={sex} onChange={(event) => handleSexChange(event.target.value as SavedGenome['sex'])}>
                <option value="female">Female</option>
                <option value="male">Male</option>
              </select>
            </label>
          </div>

          <div className="creature-editor-layout">
            <aside className="creature-editor-preview">
              <DnaAvatar dna={dna} sex={sex} size={96} />
              <p className={`creature-editor-budget${budgetValid ? '' : ' over-capacity'}`}>
                Points remaining: <strong>{budgetRemaining}</strong>
                <span className="creature-editor-budget-detail">
                  {' '}
                  ({budgetUsed} allocated · {HERBIVORE_BUDGET_TOTAL} pool)
                </span>
              </p>
              {!budgetValid && (
                <p className="creature-editor-budget-warning">Over budget — lower core traits before saving.</p>
              )}
              <details open className="creature-editor-traits-details">
                <summary>Expressed traits</summary>
                <ExpressedTraitsList traits={traits} />
              </details>
            </aside>

            <div className="creature-editor-genes">
              <section className="creature-editor-section">
                <h3>Core traits (shared budget)</h3>
                <p className="hint">
                  Each slider moves on its own. Unspent points are fine; saving is blocked if remaining goes below zero.
                </p>
                <ul className="creature-editor-gene-list">
                  {budgetGenes.map(({ index, label, description }) => (
                    <li key={index} className="creature-editor-gene-row budget">
                      <label>
                        <GeneLabelTooltip label={label} description={description} />
                        <span className="gene-value">{genes[index]}</span>
                        <input
                          type="range"
                          min={20}
                          max={220}
                          value={genes[index]}
                          onChange={(event) => handleGeneChange(index, Number(event.target.value))}
                        />
                      </label>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="creature-editor-section">
                <h3>Other genes</h3>
                <ul className="creature-editor-gene-list">
                  {otherGenes.map(({ index, label, description }) => (
                    <li key={index} className="creature-editor-gene-row">
                      <label>
                        <GeneLabelTooltip label={label} description={description} />
                        <span className="gene-value">{genes[index]}</span>
                        <input
                          type="range"
                          min={0}
                          max={255}
                          value={genes[index]}
                          onChange={(event) => handleGeneChange(index, Number(event.target.value))}
                        />
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>

          {message && <p className="dna-save-message">{message}</p>}
        </div>

        <footer className="settings-modal-footer creature-editor-footer">
          <div className="creature-editor-actions">
            <button type="button" className="settings-primary" onClick={handleSave} disabled={!budgetValid}>
              Save to library
            </button>
            <button type="button" onClick={handleSaveAsNew} disabled={!budgetValid}>
              Save as new
            </button>
            <button
              type="button"
              onClick={() => void copyGenomeToClipboard(buildSaved())}
              disabled={!budgetValid}
            >
              Copy JSON
            </button>
            <button type="button" onClick={() => downloadGenomeFile(buildSaved())} disabled={!budgetValid}>
              Download
            </button>
            <button type="button" onClick={() => importRef.current?.click()}>
              Import file
            </button>
            <button
              type="button"
              className="creature-editor-delete"
              onClick={handleDelete}
              disabled={selectedLoadId === '__new__'}
            >
              Delete saved
            </button>
          </div>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void handleImport(file)
              event.target.value = ''
            }}
          />
        </footer>
      </div>
    </div>
  )
}
