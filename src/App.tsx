import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChampionModal } from './components/ChampionModal'
import { SimulationCanvas } from './components/SimulationCanvas'
import { StatsPanel } from './components/StatsPanel'
import { CreatureInspector } from './components/CreatureInspector'
import { SettingsModal } from './components/SettingsModal'
import {
  AUTO_CHAMPION_CHECK_INTERVAL,
  loadAutoChampionRecord,
  tryUpdateAutoChampion,
  type AutoChampionRecord,
} from './sim/autoChampion'
import { LineageTracker } from './sim/lineage/lineageTracker'
import { loadSimSettings, saveSimSettings } from './sim/settingsStorage'
import {
  cloneSettings,
  settingsRunKey,
} from './sim/simSettings'
import type { WorldSnapshot } from './sim/types'
import './App.css'

function App() {
  const [paused, setPaused] = useState(false)
  const [seed, setSeed] = useState(() => Date.now())
  const [runId, setRunId] = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [championOpen, setChampionOpen] = useState(false)
  const [draftSettings, setDraftSettings] = useState(loadSimSettings)
  const [activeSettings, setActiveSettings] = useState(loadSimSettings)
  const [snapshot, setSnapshot] = useState<WorldSnapshot | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [autoChampion, setAutoChampion] = useState<AutoChampionRecord | null>(() => loadAutoChampionRecord())
  const lineageTrackerRef = useRef(new LineageTracker())

  const onSnapshot = useCallback((next: WorldSnapshot) => {
    setSnapshot(next)
  }, [])

  const canvasKey = useMemo(
    () => `sim-${seed}-${settingsRunKey(activeSettings)}-${runId}`,
    [seed, activeSettings, runId],
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
    lineageTrackerRef.current.reset()
    setAutoChampion(loadAutoChampionRecord())
  }, [canvasKey])

  useEffect(() => {
    if (!snapshot || paused) return
    if (snapshot.stats.herbivoreCount === 0) return
    if (snapshot.stats.tick % AUTO_CHAMPION_CHECK_INTERVAL !== 0) return

    const record = tryUpdateAutoChampion(
      lineageTrackerRef.current,
      snapshot.creatures,
      seed,
      snapshot.stats.tick,
    )
    if (record) {
      setAutoChampion((current) => {
        if (!current || record.fitnessScore > current.fitnessScore) {
          return record
        }
        return current
      })
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
      if (event.code === 'Escape' && championOpen) {
        setChampionOpen(false)
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
  }, [settingsOpen, championOpen])

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
          pendingSettingsChanges={pendingSettingsChanges}
          onTogglePause={() => setPaused((value) => !value)}
          onRestart={() => handleStart(false)}
          onReseed={() => handleStart(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenChampion={() => setChampionOpen(true)}
        />
        <CreatureInspector
          creature={selectedCreature}
          onClose={() => setSelectedId(null)}
        />
      </aside>
      <SimulationCanvas
        key={canvasKey}
        paused={paused}
        seed={seed}
        settings={activeSettings}
        selectedId={selectedId}
        onSnapshot={onSnapshot}
        onSelectCreature={setSelectedId}
      />
      <ChampionModal
        open={championOpen}
        champion={autoChampion}
        onClose={() => setChampionOpen(false)}
      />
      <SettingsModal
        open={settingsOpen}
        draft={draftSettings}
        active={activeSettings}
        seed={seed}
        autoChampion={autoChampion}
        onChange={setDraftSettings}
        onStart={handleStart}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  )
}

export default App
