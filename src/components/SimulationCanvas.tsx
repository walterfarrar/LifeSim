import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { TICKS_PER_SECOND } from '../sim/config'
import { MIN_SPEED_MULTIPLIER } from '../sim/timeScale'
import { corpseRadius, drawCorpseBody } from '../sim/entities/corpse'
import { plantRadius } from '../sim/entities/plant'
import { drawPlantBody } from '../sim/render/plantDraw'
import { creatureTraits } from '../sim/entities/creature'
import { creatureFillStyle, drawCreatureBody } from '../sim/render/creatureDraw'
import { plantFillStyle } from '../sim/phenotype'
import { MODE_RING_COLORS, VISUAL_THEME } from '../sim/render/visualTheme'
import { toroidalDisplayOffsets } from '../sim/toroidal'
import { World } from '../sim/world'
import type { SimSettings } from '../sim/simSettings'
import type { Creature, Plant, WorldSnapshot } from '../sim/types'

import { clientToWorld } from './canvasCoords'
import { pickCreatureAt } from './creatureHitTest'
import { VisualLegend } from './VisualLegend'

type SimulationCanvasProps = {
  paused: boolean
  speedMultiplier: number
  seed: number
  settings: SimSettings
  selectedId: number | null
  onSnapshot: (snapshot: WorldSnapshot) => void
  onSelectCreature: (id: number | null) => void
}

export function SimulationCanvas({
  paused,
  speedMultiplier,
  seed,
  settings,
  selectedId,
  onSnapshot,
  onSelectCreature,
}: SimulationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<World | null>(null)
  const pausedRef = useRef(paused)
  const speedRef = useRef(speedMultiplier)
  const [, setReady] = useState(false)

  pausedRef.current = paused
  speedRef.current = speedMultiplier

  useEffect(() => {
    worldRef.current = new World(seed, settings)
    setReady(true)
    onSnapshot(worldRef.current.snapshot())
  }, [seed, settings, onSnapshot])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !worldRef.current) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const world = worldRef.current
    canvas.width = world.width
    canvas.height = world.height

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
      drawWorld(ctx, snapshot, selectedId, world.width, world.height)
      if (snapshot.stats.tick !== lastReportedTick) {
        lastReportedTick = snapshot.stats.tick
        onSnapshot(snapshot)
      }
      frameId = requestAnimationFrame(render)
    }

    frameId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(frameId)
  }, [onSnapshot, selectedId])

  const handleClick = (event: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const world = worldRef.current
    if (!canvas || !world) return

    const point = clientToWorld(canvas, event.clientX, event.clientY)
    if (!point) {
      onSelectCreature(null)
      return
    }

    const hit = pickCreatureAt(world.snapshot().creatures, point.x, point.y, world.width, world.height)
    onSelectCreature(hit?.id ?? null)
  }

  return (
    <div className="canvas-wrap">
      {paused && <div className="paused-badge">Paused</div>}
      <VisualLegend />
      <canvas
        ref={canvasRef}
        className="sim-canvas"
        aria-label="Evolution simulation world"
        onClick={handleClick}
      />
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

function drawPlantAt(ctx: CanvasRenderingContext2D, plant: Plant, ox: number, oy: number): void {
  const radius = plantRadius(plant)
  drawPlantBody(ctx, plant, plant.x + ox, plant.y + oy, radius, plantFillStyle(plant))
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

function drawWorld(
  ctx: CanvasRenderingContext2D,
  snapshot: WorldSnapshot,
  selectedId: number | null,
  worldWidth: number,
  worldHeight: number,
): void {
  const { plants, corpses, creatures } = snapshot

  ctx.fillStyle = '#0f1410'
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  for (const plant of plants) {
    const margin = plantRadius(plant) + 8
    for (const { ox, oy } of toroidalDisplayOffsets(plant.x, plant.y, margin, worldWidth, worldHeight)) {
      drawPlantAt(ctx, plant, ox, oy)
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
      drawCreatureAt(ctx, creature, selectedId, ox, oy, worldWidth, worldHeight)
    }
  }
}
