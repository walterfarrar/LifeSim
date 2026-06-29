import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChampionHallModal } from './components/ChampionHallModal'
import { SimulationCanvas } from './components/SimulationCanvas'
import { StatsPanel } from './components/StatsPanel'
import { CreatureInspector } from './components/CreatureInspector'
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
import { PlantSpeciesTracker } from './sim/plantLineage/plantSpeciesTracker'
import { PathogenStrainTracker } from './sim/pathogenLineage/pathogenStrainTracker'
import { loadSimSettings, saveSimSettings } from './sim/settingsStorage'
import {
  cloneSettings,
  settingsRunKey,
} from './sim/simSettings'
import type { WorldSnapshot } from './sim/types'
import { clampSpeedMultiplier } from './sim/timeScale'
import './App.css'

function App() {
  const [paused, setPaused] = useState(false)
  const [speedMultiplier, setSpeedMultiplier] = useState(1)
  const [seed, setSeed] = useState(() => Date.now())
  const [runId, setRunId] = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [hallOpen, setHallOpen] = useState(false)
  const [draftSettings, setDraftSettings] = useState(loadSimSettings)
  const [activeSettings, setActiveSettings] = useState(loadSimSettings)
  const [snapshot, setSnapshot] = useState<WorldSnapshot | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
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
    setSelectedId(null)
    setPaused(false)
    setSettingsOpen(false)
  }, [draftSettings])

  useEffect(() => {
    setSelectedId(null)
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
    if (selectedId === null) return
    const stillAlive = snapshot?.creatures.some((creature) => creature.id === selectedId)
    if (snapshot && !stillAlive) setSelectedId(null)
  }, [snapshot, selectedId])

  useEffect(() => {
    if (!snapshot) return
    if (snapshot.stats.herbivoreCount > 0) return
    if (snapshot.stats.tick === 0) return

    setSeed(Date.now())
    setRunId((id) => id + 1)
    setSelectedId(null)
  }, [snapshot])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
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
  }, [settingsOpen, hallOpen])

  const selectedCreature =
    snapshot?.creatures.find((creature) => creature.id === selectedId) ?? null

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
  }

  const pendingSettingsChanges = settingsRunKey(draftSettings) !== settingsRunKey(activeSettings)

  return (
    <div className="app">
      <aside className="sidebar">
        <StatsPanel
          stats={stats}
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
        />
        <CreatureInspector
          creature={selectedCreature}
          onClose={() => setSelectedId(null)}
        />
      </aside>
      <SimulationCanvas
        key={canvasKey}
        paused={paused}
        speedMultiplier={speedMultiplier}
        seed={seed}
        settings={activeSettings}
        selectedId={selectedId}
        onSnapshot={onSnapshot}
        onSelectCreature={setSelectedId}
      />
      <ChampionHallModal open={hallOpen} onClose={() => setHallOpen(false)} />
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
