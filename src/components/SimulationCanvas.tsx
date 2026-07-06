import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { SOIL_CELL_WATER_CAPACITY, TICKS_PER_SECOND } from '../sim/config'
import { dayNightLabel, applyViewportAmbienceStyle } from '../sim/dayNight'
import { formatDayLengthSeconds, seasonLabel, type SeasonName } from '../sim/seasons'
import { formatTemperatureC } from '../sim/temperature'
import { MIN_SPEED_MULTIPLIER } from '../sim/timeScale'
import { corpseRadius, drawCorpseBody } from '../sim/entities/corpse'
import { plantRadius } from '../sim/entities/plant'
import { drawPlantBody } from '../sim/render/plantDraw'
import { drawTerrainHeight, drawTerrainWater } from '../sim/render/terrainWaterDraw'
import { drawSoilMoisture } from '../sim/render/soilDraw'
import { drawGrassCover } from '../sim/render/grassDraw'
import { drawAirHumidity } from '../sim/render/airDraw'
import { drawElevationMap } from '../sim/render/elevationDraw'
import { moistureGrowthFactor } from '../sim/soilMoisture'
import { temperatureComfortFactor } from '../sim/temperature'
import { isPlantDormant } from '../sim/plantClimate'
import { creatureTraits } from '../sim/entities/creature'
import { plantTraits } from '../sim/entities/plant'
import { plantKindFromDna } from '../sim/plantKinds'
import { drawCreatureBody, creatureFillStyle } from '../sim/render/creatureDraw'
import { plantFillStyle } from '../sim/phenotype'
import { MODE_RING_COLORS, VISUAL_THEME } from '../sim/render/visualTheme'
import { toroidalDisplayOffsets } from '../sim/toroidal'
import { World } from '../sim/world'
import type { SimSettings } from '../sim/simSettings'
import type { Creature, Plant, WorldSnapshot } from '../sim/types'

import { clientToWorld } from './canvasCoords'
import {
  DEFAULT_VIEWPORT,
  MIN_VIEWPORT_ZOOM,
  VIEWPORT_ZOOM_STEP,
  canvasDisplayLayout,
  drawTiledWorld,
  zoomAtClientPoint,
  zoomAtViewportCenter,
  type ViewportTransform,
} from './canvasViewport'
import { pickCreatureAt } from './creatureHitTest'
import { pickPlantAt } from './plantHitTest'
import { soilCellAt } from './soilHitTest'
import { VisualLegend } from './VisualLegend'
import { ElevationLegend } from './ElevationLegend'
import { InspectModeBar } from './InspectModeBar'
import { WindIndicator } from './WindIndicator'
import type { InspectMode, MapSelection } from '../sim/mapSelection'

type SimulationCanvasProps = {
  paused: boolean
  speedMultiplier: number
  seed: number
  settings: SimSettings
  inspectMode: InspectMode
  selection: MapSelection | null
  showClouds: boolean
  showElevation: boolean
  onSnapshot: (snapshot: WorldSnapshot) => void
  onSelect: (selection: MapSelection | null) => void
  onInspectModeChange: (mode: InspectMode) => void
  onToggleClouds: () => void
  onToggleElevation: () => void
}

const DRAG_THRESHOLD_PX = 6

export function SimulationCanvas({
  paused,
  speedMultiplier,
  seed,
  settings,
  inspectMode,
  selection,
  showClouds,
  showElevation,
  onSnapshot,
  onSelect,
  onInspectModeChange,
  onToggleClouds,
  onToggleElevation,
}: SimulationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const displayCanvasRef = useRef<HTMLCanvasElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const viewportSizeRef = useRef({ width: 0, height: 0 })
  const worldRef = useRef<World | null>(null)
  const pausedRef = useRef(paused)
  const speedRef = useRef(speedMultiplier)
  const viewportRefState = useRef<ViewportTransform>(DEFAULT_VIEWPORT)
  const dragRef = useRef({
    active: false,
    moved: false,
    pointerId: -1,
    startClientX: 0,
    startClientY: 0,
    startPanX: 0,
    startPanY: 0,
  })
  const [, setReady] = useState(false)
  const [viewport, setViewport] = useState<ViewportTransform>(DEFAULT_VIEWPORT)
  const [dayDisplay, setDayDisplay] = useState({
    label: 'Morning',
    sunlight: 0.5,
    isNight: false,
    season: 'spring' as SeasonName,
    dayLengthSeconds: 24,
    temperature: 20,
  })
  const [windDisplay, setWindDisplay] = useState({ dir: 0, speed: 0 })

  const showCloudsRef = useRef(showClouds)
  const showElevationRef = useRef(showElevation)

  pausedRef.current = paused
  speedRef.current = speedMultiplier
  viewportRefState.current = viewport
  showCloudsRef.current = showClouds
  showElevationRef.current = showElevation

  const applyViewport = useCallback((next: ViewportTransform) => {
    viewportRefState.current = next
    setViewport(next)
  }, [])

  useEffect(() => {
    worldRef.current = new World(seed, settings)
    applyViewport(DEFAULT_VIEWPORT)
    setReady(true)
    onSnapshot(worldRef.current.snapshot())
  }, [seed, settings, onSnapshot, applyViewport])

  useEffect(() => {
    const viewportEl = viewportRef.current
    if (!viewportEl) return

    const updateSize = () => {
      const next = {
        width: viewportEl.clientWidth,
        height: viewportEl.clientHeight,
      }
      viewportSizeRef.current = next
    }

    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(viewportEl)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const worldCanvas = canvasRef.current
    const displayCanvas = displayCanvasRef.current
    if (!worldCanvas || !displayCanvas || !worldRef.current) return

    const worldCtx = worldCanvas.getContext('2d')
    const displayCtx = displayCanvas.getContext('2d')
    if (!worldCtx || !displayCtx) return

    const world = worldRef.current
    worldCanvas.width = world.width
    worldCanvas.height = world.height

    let frameId = 0
    let lastTime = performance.now()
    let tickDebt = 0
    let lastReportedTick = -1

    const render = (time: number) => {
      const delta = time - lastTime
      lastTime = time

      if (!pausedRef.current) {
        tickDebt += delta
        const speed = Math.max(speedRef.current, MIN_SPEED_MULTIPLIER)
        const tickInterval = 1000 / (TICKS_PER_SECOND * speed)
        const maxTicksPerFrame = Math.min(50, Math.max(10, Math.ceil(speed * 10)))
        let ticksThisFrame = 0
        while (tickDebt >= tickInterval && ticksThisFrame < maxTicksPerFrame) {
          world.tick()
          tickDebt -= tickInterval
          ticksThisFrame += 1
        }
      }

      const snapshot = world.snapshot()
      drawWorld(
        worldCtx,
        snapshot,
        selection,
        world.width,
        world.height,
        showCloudsRef.current,
        showElevationRef.current,
      )

      const viewportSize = viewportSizeRef.current
      if (viewportSize.width > 0 && viewportSize.height > 0) {
        if (displayCanvas.width !== viewportSize.width || displayCanvas.height !== viewportSize.height) {
          displayCanvas.width = viewportSize.width
          displayCanvas.height = viewportSize.height
        }
        const layout = canvasDisplayLayout(
          viewportSize,
          world.width,
          world.height,
          viewportRefState.current,
        )
        drawTiledWorld(displayCtx, worldCanvas, layout, viewportSize)
      }

      const viewportEl = viewportRef.current
      if (viewportEl) {
        applyViewportAmbienceStyle(
          viewportEl,
          snapshot.stats.sunlight,
          snapshot.stats.season,
          snapshot.stats.dayPhase,
        )
      }

      if (snapshot.stats.tick !== lastReportedTick) {
        lastReportedTick = snapshot.stats.tick
        setDayDisplay({
          label: dayNightLabel(snapshot.stats.dayPhase),
          sunlight: snapshot.stats.sunlight,
          isNight: snapshot.stats.isNight,
          season: snapshot.stats.season,
          dayLengthSeconds: snapshot.stats.effectiveDayLengthSeconds,
          temperature: snapshot.stats.temperature,
        })
        setWindDisplay({ dir: snapshot.stats.wind.dir, speed: snapshot.stats.wind.speed })
        onSnapshot(snapshot)
      }
      frameId = requestAnimationFrame(render)
    }

    frameId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(frameId)
  }, [onSnapshot, selection])

  useEffect(() => {
    const viewportEl = viewportRef.current
    const world = worldRef.current
    if (!viewportEl || !world) return

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = viewportEl.getBoundingClientRect()
      const factor = event.deltaY > 0 ? 1 / VIEWPORT_ZOOM_STEP : VIEWPORT_ZOOM_STEP
      applyViewport(
        zoomAtClientPoint(
          viewportRefState.current,
          event.clientX,
          event.clientY,
          rect,
          world.width,
          world.height,
          factor,
        ),
      )
    }

    viewportEl.addEventListener('wheel', onWheel, { passive: false })
    return () => viewportEl.removeEventListener('wheel', onWheel)
  }, [applyViewport])

  const zoomFromCenter = useCallback(
    (factor: number) => {
      const viewportEl = viewportRef.current
      const world = worldRef.current
      if (!viewportEl || !world) return
      applyViewport(
        zoomAtViewportCenter(
          viewportRefState.current,
          viewportEl.getBoundingClientRect(),
          world.width,
          world.height,
          factor,
        ),
      )
    },
    [applyViewport],
  )

  const pickAtClient = useCallback(
    (clientX: number, clientY: number) => {
      const viewportEl = viewportRef.current
      const world = worldRef.current
      if (!viewportEl || !world) return

      const point = clientToWorld(
        viewportEl.getBoundingClientRect(),
        clientX,
        clientY,
        world.width,
        world.height,
        viewportRefState.current,
      )
      if (!point) {
        onSelect(null)
        return
      }

      const snapshot = world.snapshot()

      if (inspectMode === 'creature') {
        const hit = pickCreatureAt(snapshot.creatures, point.x, point.y, world.width, world.height)
        if (hit) {
          onSelect({ type: 'creature', id: hit.id })
          return
        }
      }

      if (inspectMode === 'plant') {
        const hit = pickPlantAt(snapshot.plants, point.x, point.y, world.width, world.height)
        if (hit) {
          onSelect({ type: 'plant', id: hit.id })
          return
        }
      }

      const cell = soilCellAt(snapshot.soil, point.x, point.y)
      onSelect({ type: 'soil', col: cell.col, row: cell.row })
    },
    [inspectMode, onSelect],
  )

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    dragRef.current = {
      active: true,
      moved: false,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPanX: viewportRefState.current.panX,
      startPanY: viewportRefState.current.panY,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag.active || drag.pointerId !== event.pointerId) return

    const dx = event.clientX - drag.startClientX
    const dy = event.clientY - drag.startClientY
    if (!drag.moved && Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) {
      drag.moved = true
    }
    if (!drag.moved) return

    applyViewport({
      ...viewportRefState.current,
      panX: drag.startPanX + dx,
      panY: drag.startPanY + dy,
    })
  }

  const finishPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag.active || drag.pointerId !== event.pointerId) return

    const wasClick = !drag.moved
    drag.active = false
    drag.moved = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (wasClick) {
      pickAtClient(event.clientX, event.clientY)
    }
  }

  const canZoomOut = viewport.zoom > MIN_VIEWPORT_ZOOM + 0.001

  return (
    <div
      className="canvas-wrap"
      style={{
        aspectRatio: `${settings.worldWidth} / ${settings.worldHeight}`,
        ['--map-aspect' as string]: String(settings.worldWidth / settings.worldHeight),
      }}
    >
      {paused && <div className="paused-badge">Paused</div>}
      <div
        className={`time-badge${dayDisplay.isNight ? ' night' : ''}`}
        title={`${seasonLabel(dayDisplay.season)} · ${formatTemperatureC(dayDisplay.temperature)} · day length ${formatDayLengthSeconds(dayDisplay.dayLengthSeconds)} · sunlight ${Math.round(dayDisplay.sunlight * 100)}%`}
      >
        {seasonLabel(dayDisplay.season)} · {dayDisplay.label}
      </div>
      {showElevation ? <ElevationLegend /> : <VisualLegend />}
      <WindIndicator
        dir={windDisplay.dir}
        speed={windDisplay.speed}
        showClouds={showClouds}
        onToggleClouds={onToggleClouds}
      />
      <InspectModeBar
        mode={inspectMode}
        onChange={onInspectModeChange}
        showElevation={showElevation}
        onToggleElevation={onToggleElevation}
      />
      <div className="zoom-controls" aria-label="Map zoom">
        <button
          type="button"
          onClick={() => zoomFromCenter(1 / VIEWPORT_ZOOM_STEP)}
          disabled={!canZoomOut}
          title="Zoom out (limited to full map)"
        >
          −
        </button>
        <span className="zoom-value" title="100% = entire map visible">
          {Math.round(viewport.zoom * 100)}%
        </span>
        <button type="button" onClick={() => zoomFromCenter(VIEWPORT_ZOOM_STEP)} title="Zoom in">
          +
        </button>
        <button type="button" onClick={() => applyViewport(DEFAULT_VIEWPORT)} title="Reset zoom and pan">
          Fit
        </button>
      </div>
      <div
        ref={viewportRef}
        className={`canvas-viewport inspect-${inspectMode}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
      >
        <canvas ref={canvasRef} className="sim-canvas-source" aria-hidden="true" />
        <canvas
          ref={displayCanvasRef}
          className="sim-canvas"
          aria-label="Evolution simulation world"
        />
      </div>
    </div>
  )
}

function strokeCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
): void {
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.stroke()
}

function drawPlantAt(
  ctx: CanvasRenderingContext2D,
  plant: Plant,
  ox: number,
  oy: number,
  soilMoisture: number,
  temperature: number,
  season: SeasonName,
  selectedPlantId: number | null,
): void {
  const radius = plantRadius(plant)
  const traits = plantTraits(plant)
  const moistureFactor = moistureGrowthFactor(soilMoisture, traits.moistureNeed)
  const dormant = isPlantDormant(plant.dna, season, temperature)
  const tempComfort = dormant
    ? 0.72
    : temperatureComfortFactor(
        temperature,
        traits.idealTemp,
        traits.tempGrowthHalfWidth,
        traits.tempSurvivalHalfWidth,
      )
  drawPlantBody(
    ctx,
    plant,
    plant.x + ox,
    plant.y + oy,
    radius,
    plantFillStyle(plant, moistureFactor, tempComfort),
  )

  if (plant.id === selectedPlantId) {
    ctx.strokeStyle = VISUAL_THEME.selectionRing
    ctx.lineWidth = 2.5
    strokeCircle(ctx, plant.x + ox, plant.y + oy, radius + 6)
  }
}

function drawCreatureAt(
  ctx: CanvasRenderingContext2D,
  creature: Creature,
  selectedId: number | null,
  ox: number,
  oy: number,
  worldWidth: number,
  worldHeight: number,
): void {
  const drawX = creature.x + ox
  const drawY = creature.y + oy
  const traits = creatureTraits(creature)
  const energyRatio = Math.min(1, creature.energy / traits.reproThreshold)

  ctx.save()
  ctx.translate(ox, oy)
  drawCreatureBody(ctx, creature, traits, creatureFillStyle(creature, traits, energyRatio))

  ctx.strokeStyle = MODE_RING_COLORS[creature.mode]
  ctx.lineWidth = 2
  strokeCircle(ctx, creature.x, creature.y, traits.radius + 2)

  if (creature.pregnancyTicksRemaining > 0) {
    ctx.strokeStyle = VISUAL_THEME.pregnancyRing
    ctx.lineWidth = 2
    ctx.setLineDash([3, 3])
    strokeCircle(ctx, creature.x, creature.y, traits.radius + 5)
    ctx.setLineDash([])
  }

  if (creature.infection && creature.infection.severity > 0.08) {
    ctx.strokeStyle = VISUAL_THEME.infectionRing
    ctx.lineWidth = 1.5
    ctx.setLineDash([2, 4])
    strokeCircle(
      ctx,
      creature.x,
      creature.y,
      traits.radius + 3 + creature.infection.severity * 4,
    )
    ctx.setLineDash([])
  }

  if (creature.id === selectedId) {
    ctx.strokeStyle = VISUAL_THEME.selectionRing
    ctx.lineWidth = 2.5
    strokeCircle(ctx, creature.x, creature.y, traits.radius + 8)

    ctx.strokeStyle = VISUAL_THEME.personalSpaceRing
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    strokeCircle(ctx, creature.x, creature.y, traits.personalSpace)
    ctx.setLineDash([])

    if (traits.aggressiveness >= 0.32) {
      ctx.strokeStyle = `rgba(255, 70, 50, ${0.2 + traits.aggressiveness * 0.35})`
      ctx.lineWidth = 1
      strokeCircle(ctx, creature.x, creature.y, traits.attackRange)
    }
  }

  ctx.restore()

  ctx.strokeStyle = VISUAL_THEME.visionRing
  ctx.lineWidth = 1
  for (const visionOffset of toroidalDisplayOffsets(drawX, drawY, traits.vision, worldWidth, worldHeight)) {
    strokeCircle(ctx, drawX + visionOffset.ox, drawY + visionOffset.oy, traits.vision)
  }
}

function drawSoilSelection(
  ctx: CanvasRenderingContext2D,
  soil: WorldSnapshot['soil'],
  col: number,
  row: number,
  worldWidth: number,
  worldHeight: number,
): void {
  const x = col * soil.cellSize
  const y = row * soil.cellSize
  const w = Math.min(soil.cellSize, worldWidth - x)
  const h = Math.min(soil.cellSize, worldHeight - y)
  if (w <= 0 || h <= 0) return

  ctx.strokeStyle = VISUAL_THEME.selectionRing
  ctx.lineWidth = 2.5
  ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3)
}

function drawWorld(
  ctx: CanvasRenderingContext2D,
  snapshot: WorldSnapshot,
  selection: MapSelection | null,
  worldWidth: number,
  worldHeight: number,
  showClouds: boolean,
  showElevation: boolean,
): void {
  const { plants, corpses, creatures, terrain, soil, grass, air, stats } = snapshot
  const selectedCreatureId = selection?.type === 'creature' ? selection.id : null
  const selectedPlantId = selection?.type === 'plant' ? selection.id : null
  const selectedSoil = selection?.type === 'soil' ? selection : null

  ctx.fillStyle = VISUAL_THEME.canvasBackground
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  if (showElevation) {
    drawElevationMap(ctx, terrain, worldWidth, worldHeight)
    if (selectedSoil) {
      drawSoilSelection(ctx, soil, selectedSoil.col, selectedSoil.row, worldWidth, worldHeight)
    }
    return
  }

  // Ground stack: soil (+ basin shading) → grass turf → surface water on top.
  drawSoilMoisture(ctx, soil, worldWidth, worldHeight)
  drawTerrainHeight(ctx, terrain, worldWidth, worldHeight)
  drawGrassCover(ctx, grass, worldWidth, worldHeight)
  drawTerrainWater(ctx, terrain, worldWidth, worldHeight)

  if (selectedSoil) {
    drawSoilSelection(ctx, soil, selectedSoil.col, selectedSoil.row, worldWidth, worldHeight)
  }

  for (const plant of plants) {
    if (plantKindFromDna(plant.dna) === 'grass') continue
    const margin = plantRadius(plant) + 8
    const soilMoisture =
      soil.values[soilCellAt(soil, plant.x, plant.y).index] / SOIL_CELL_WATER_CAPACITY
    for (const { ox, oy } of toroidalDisplayOffsets(plant.x, plant.y, margin, worldWidth, worldHeight)) {
      drawPlantAt(
        ctx,
        plant,
        ox,
        oy,
        soilMoisture,
        stats.temperature,
        stats.season,
        selectedPlantId,
      )
    }
  }

  for (const corpse of corpses) {
    const margin = corpseRadius(corpse) + 8
    for (const { ox, oy } of toroidalDisplayOffsets(corpse.x, corpse.y, margin, worldWidth, worldHeight)) {
      drawCorpseBody(ctx, corpse, corpse.x + ox, corpse.y + oy)
    }
  }

  for (const creature of creatures) {
    const traits = creatureTraits(creature)
    const margin = Math.max(traits.vision, traits.radius + 12)
    for (const { ox, oy } of toroidalDisplayOffsets(creature.x, creature.y, margin, worldWidth, worldHeight)) {
      drawCreatureAt(ctx, creature, selectedCreatureId, ox, oy, worldWidth, worldHeight)
    }
  }

  // Clouds sit above everything as the top atmospheric layer.
  if (showClouds) {
    drawAirHumidity(ctx, air, worldWidth, worldHeight)
  }
}
