import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChampionHallModal } from './components/ChampionHallModal'
import { CreatureEditorModal } from './components/CreatureEditorModal'
import { SimulationCanvas } from './components/SimulationCanvas'
import { StatsPanel } from './components/StatsPanel'
import { CreatureInspector } from './components/CreatureInspector'
import { PlantInspector } from './components/PlantInspector'
import { SoilInspector } from './components/SoilInspector'
import { SettingsModal } from './components/SettingsModal'
import {
  AUTO_CHAMPION_CHECK_INTERVAL,
  loadAutoChampionRecord,
  loadCreatureChampionHall,
  tryUpdateAutoChampion,
  type AutoChampionRecord,
} from './sim/autoChampion'
import {
  loadAutoPlantChampionRecord,
  loadPlantChampionHall,
  tryUpdateAutoPlantChampion,
  type AutoPlantChampionRecord,
} from './sim/plantAutoChampion'
import {
  loadAutoPathogenChampionRecord,
  loadPathogenChampionHall,
  tryUpdateAutoPathogenChampion,
  type AutoPathogenChampionRecord,
} from './sim/pathogenAutoChampion'
import { LineageTracker } from './sim/lineage/lineageTracker'
import { createEmptyDeathCauseCounts } from './sim/deathCause'
import { PlantSpeciesTracker } from './sim/plantLineage/plantSpeciesTracker'
import { PathogenStrainTracker } from './sim/pathogenLineage/pathogenStrainTracker'
import { loadSimSettings, saveSimSettings } from './sim/settingsStorage'
import { creatureToSavedGenome, type SavedGenome } from './sim/dnaExport'
import {
  cloneSettings,
  settingsRunKey,
} from './sim/simSettings'
import type { WorldSnapshot } from './sim/types'
import type { InspectMode, MapSelection } from './sim/mapSelection'
import { selectionMatchesMode } from './sim/mapSelection'
import { plantKindFromDna } from './sim/plantKinds'
import { SOIL_CELL_WATER_CAPACITY } from './sim/config'
import { soilCellAt } from './components/soilHitTest'
import { clampSpeedMultiplier } from './sim/timeScale'
import './App.css'

function App() {
  const [paused, setPaused] = useState(false)
  const [speedMultiplier, setSpeedMultiplier] = useState(1)
  const [seed, setSeed] = useState(() => Date.now())
  const [runId, setRunId] = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [hallOpen, setHallOpen] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorGenome, setEditorGenome] = useState<SavedGenome | null>(null)
  const [draftSettings, setDraftSettings] = useState(loadSimSettings)
  const [activeSettings, setActiveSettings] = useState(loadSimSettings)
  const [snapshot, setSnapshot] = useState<WorldSnapshot | null>(null)
  const [maxTickReached, setMaxTickReached] = useState(0)
  const [inspectMode, setInspectMode] = useState<InspectMode>('creature')
  const [selection, setSelection] = useState<MapSelection | null>(null)
  const [autoChampion, setAutoChampion] = useState<AutoChampionRecord | null>(() => loadAutoChampionRecord())
  const [autoPlantChampion, setAutoPlantChampion] = useState<AutoPlantChampionRecord | null>(() =>
    loadAutoPlantChampionRecord(),
  )
  const [autoPathogenChampion, setAutoPathogenChampion] = useState<AutoPathogenChampionRecord | null>(() =>
    loadAutoPathogenChampionRecord(),
  )
  const lineageTrackerRef = useRef(new LineageTracker())
  const plantSpeciesTrackerRef = useRef(new PlantSpeciesTracker())
  const pathogenStrainTrackerRef = useRef(new PathogenStrainTracker())

  const onSnapshot = useCallback((next: WorldSnapshot) => {
    setSnapshot(next)
    setMaxTickReached((prev) => Math.max(prev, next.stats.tick))
  }, [])

  const canvasKey = useMemo(
    () => `sim-${seed}-${settingsRunKey(activeSettings)}-${runId}`,
    [seed, activeSettings, runId],
  )

  const hasChampionHall = useMemo(
    () =>
      loadCreatureChampionHall().length +
        loadPlantChampionHall().length +
        loadPathogenChampionHall().length >
      0,
    [autoChampion, autoPlantChampion, autoPathogenChampion],
  )

  useEffect(() => {
    saveSimSettings(draftSettings)
  }, [draftSettings])

  const handleStart = useCallback((newSeed: boolean) => {
    const next = cloneSettings(draftSettings)
    setActiveSettings(next)
    saveSimSettings(next)
    if (newSeed) {
      setSeed(Date.now())
    }
    setRunId((id) => id + 1)
    setSelection(null)
    setMaxTickReached(0)
    setPaused(false)
    setSettingsOpen(false)
  }, [draftSettings])

  useEffect(() => {
    setSelection(null)
    setAutoChampion(loadAutoChampionRecord())
    setAutoPlantChampion(loadAutoPlantChampionRecord())
    setAutoPathogenChampion(loadAutoPathogenChampionRecord())
  }, [canvasKey])

  useEffect(() => {
    if (!snapshot || paused) return
    if (snapshot.stats.tick % AUTO_CHAMPION_CHECK_INTERVAL !== 0) return

    if (snapshot.stats.herbivoreCount > 0) {
      const { champion } = tryUpdateAutoChampion(
        lineageTrackerRef.current,
        snapshot.creatures,
        seed,
        snapshot.stats.tick,
      )
      if (champion) setAutoChampion(champion)
    }

    if (snapshot.stats.plantCount > 0) {
      const { champion } = tryUpdateAutoPlantChampion(
        plantSpeciesTrackerRef.current,
        snapshot.plants,
        seed,
        snapshot.stats.tick,
      )
      if (champion) setAutoPlantChampion(champion)
    }

    const infectedCount = snapshot.creatures.filter((c) => c.infection).length
    if (snapshot.pathogens.length > 0 && infectedCount > 0) {
      const { champion } = tryUpdateAutoPathogenChampion(
        pathogenStrainTrackerRef.current,
        snapshot.pathogens,
        snapshot.creatures,
        seed,
        snapshot.stats.tick,
      )
      if (champion) setAutoPathogenChampion(champion)
    }
  }, [snapshot, seed, paused])

  useEffect(() => {
    if (!selection || !snapshot) return
    if (selection.type === 'creature') {
      const stillAlive = snapshot.creatures.some((creature) => creature.id === selection.id)
      if (!stillAlive) setSelection(null)
      return
    }
    if (selection.type === 'plant') {
      const stillAlive = snapshot.plants.some((plant) => plant.id === selection.id)
      if (!stillAlive) setSelection(null)
    }
  }, [snapshot, selection])

  const handleInspectModeChange = useCallback((mode: InspectMode) => {
    setInspectMode(mode)
    setSelection((current) => (selectionMatchesMode(current, mode) ? current : null))
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape' && selection) {
        setSelection(null)
        return
      }
      if (event.code === 'Escape' && editorOpen) {
        setEditorOpen(false)
        return
      }
      if (event.code === 'Escape' && hallOpen) {
        setHallOpen(false)
        return
      }
      if (event.code === 'Escape' && settingsOpen) {
        setSettingsOpen(false)
        return
      }
      if (event.code !== 'Space') return
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }
      event.preventDefault()
      setPaused((value) => !value)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [settingsOpen, hallOpen, editorOpen, selection])

  const selectedCreature =
    selection?.type === 'creature'
      ? (snapshot?.creatures.find((creature) => creature.id === selection.id) ?? null)
      : null

  const selectedPlant =
    selection?.type === 'plant'
      ? (snapshot?.plants.find((plant) => plant.id === selection.id) ?? null)
      : null

  const selectedPlantSoilMoisture =
    selectedPlant && snapshot
      ? snapshot.soil.values[soilCellAt(snapshot.soil, selectedPlant.x, selectedPlant.y).index] /
        SOIL_CELL_WATER_CAPACITY
      : 0

  const selectedSoilWoodyPlantCount =
    selection?.type === 'soil' && snapshot
      ? snapshot.plants.filter((plant) => {
          const cell = soilCellAt(snapshot.soil, plant.x, plant.y)
          return (
            cell.col === selection.col &&
            cell.row === selection.row &&
            plantKindFromDna(plant.dna) !== 'grass'
          )
        }).length
      : 0

  const stats = snapshot?.stats ?? {
    tick: 0,
    plantCount: 0,
    herbivoreCount: 0,
    births: 0,
    deaths: 0,
    totalEnergy: 0,
    plantEnergy: 0,
    creatureEnergy: 0,
    corpseEnergy: 0,
    primaryProduction: 0,
    grassPlantCount: 0,
    bushPlantCount: 0,
    treePlantCount: 0,
    surfaceWater: 0,
    hasSurfaceWater: false,
    airWater: 0,
    soilWater: 0,
    creatureWater: 0,
    plantWater: 0,
    totalWater: 0,
    totalWaterBudget: 0,
    avgSoilMoisture: 0,
    airHumidity: 0,
    isRaining: false,
    deathCauseCounts: createEmptyDeathCauseCounts(),
    dayPhase: 0.3,
    sunlight: 0.85,
    isNight: false,
    season: 'spring' as const,
    seasonPhase: 0.25,
    effectiveDayLengthSeconds: 24,
    temperature: 20,
  }

  const pendingSettingsChanges = settingsRunKey(draftSettings) !== settingsRunKey(activeSettings)

  return (
    <div className="app">
      <aside className="sidebar">
        <StatsPanel
          stats={stats}
          maxTickReached={maxTickReached}
          paused={paused}
          settings={activeSettings}
          seed={seed}
          autoChampion={autoChampion}
          autoPlantChampion={autoPlantChampion}
          autoPathogenChampion={autoPathogenChampion}
          hasChampionHall={hasChampionHall}
          pendingSettingsChanges={pendingSettingsChanges}
          speedMultiplier={speedMultiplier}
          onTogglePause={() => setPaused((value) => !value)}
          onSlower={() => setSpeedMultiplier((value) => clampSpeedMultiplier(value / 2))}
          onFaster={() => setSpeedMultiplier((value) => clampSpeedMultiplier(value * 2))}
          onRestart={() => handleStart(false)}
          onReseed={() => handleStart(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenHall={() => setHallOpen(true)}
          onOpenEditor={() => {
            setEditorGenome(null)
            setEditorOpen(true)
          }}
        />
      </aside>
      <div className="map-stage">
        <SimulationCanvas
          key={canvasKey}
          paused={paused}
          speedMultiplier={speedMultiplier}
          seed={seed}
          settings={activeSettings}
          inspectMode={inspectMode}
          selection={selection}
          onSnapshot={onSnapshot}
          onSelect={setSelection}
          onInspectModeChange={handleInspectModeChange}
        />
        {selectedCreature && (
          <CreatureInspector
            creature={selectedCreature}
            onClose={() => setSelection(null)}
            onEditInDesigner={(creature) => {
              setEditorGenome(creatureToSavedGenome(creature))
              setEditorOpen(true)
            }}
          />
        )}
        {selectedPlant && snapshot && (
          <PlantInspector
            plant={selectedPlant}
            soilMoisture={selectedPlantSoilMoisture}
            temperature={snapshot.stats.temperature}
            season={snapshot.stats.season}
            onClose={() => setSelection(null)}
          />
        )}
        {selection?.type === 'soil' && snapshot && (
          <SoilInspector
            col={selection.col}
            row={selection.row}
            soil={snapshot.soil}
            terrain={snapshot.terrain}
            grass={snapshot.grass}
            woodyPlantCount={selectedSoilWoodyPlantCount}
            onClose={() => setSelection(null)}
          />
        )}
      </div>
      <ChampionHallModal open={hallOpen} onClose={() => setHallOpen(false)} />
      <CreatureEditorModal
        open={editorOpen}
        initialGenome={editorGenome}
        onClose={() => setEditorOpen(false)}
      />
      <SettingsModal
        open={settingsOpen}
        draft={draftSettings}
        active={activeSettings}
        seed={seed}
        autoChampion={autoChampion}
        autoPlantChampion={autoPlantChampion}
        autoPathogenChampion={autoPathogenChampion}
        onChange={setDraftSettings}
        onStart={handleStart}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  )
}

export default App
