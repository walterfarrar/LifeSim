import { creatureTraits } from './creature'
import { expressCreatureAppearance } from '../render/expressAppearance'
import { drawCreatureAppearance } from '../render/svgCanvas'
import type { Corpse, Creature } from '../types'

export const CORPSE_DECAY_RATE = 0.055

let nextCorpseId = 1

export function resetCorpseIds(): void {
  nextCorpseId = 1
}

function corpseBiomass(creature: Creature): number {
  return Math.max(0, creature.energy * 0.88)
}

export function createCorpseFromCreature(creature: Creature): Corpse {
  const traits = creatureTraits(creature)
  const energy = corpseBiomass(creature)
  const sexShift = creature.sex === 'female' ? 12 : 0

  return {
    kind: 'corpse',
    id: nextCorpseId++,
    x: creature.x,
    y: creature.y,
    dna: creature.dna,
    energy,
    maxEnergy: energy,
    age: 0,
    hue: (traits.hue + sexShift) % 360,
    saturation: traits.saturation * 0.55,
    shape: traits.shape,
    radius: traits.radius * 0.92,
  }
}

export function decayCorpse(corpse: Corpse): void {
  corpse.age += 1
  corpse.energy = Math.max(0, corpse.energy - CORPSE_DECAY_RATE)
}

export function biteCorpse(corpse: Corpse, amount: number): number {
  const eaten = Math.min(corpse.energy, amount)
  corpse.energy -= eaten
  return eaten
}

export function isCorpseEdible(corpse: Corpse): boolean {
  return corpse.energy > 0.5
}

export function corpseRadius(corpse: Corpse): number {
  const energyRatio = Math.min(1, corpse.energy / corpse.maxEnergy)
  return corpse.radius * (0.55 + energyRatio * 0.45)
}

export function corpseFillStyle(corpse: Corpse): string {
  const energyRatio = Math.min(1, corpse.energy / corpse.maxEnergy)
  const lightness = 14 + energyRatio * 16
  const saturation = corpse.saturation * (0.45 + energyRatio * 0.55)
  return `hsl(${corpse.hue.toFixed(1)}, ${saturation.toFixed(1)}%, ${lightness.toFixed(1)}%)`
}

function corpseMarkingFill(corpse: Corpse): string {
  const energyRatio = Math.min(1, corpse.energy / corpse.maxEnergy)
  const lightness = 14 + energyRatio * 16 + 8
  const saturation = corpse.saturation * (0.45 + energyRatio * 0.55)
  return `hsl(${((corpse.hue + 28) % 360).toFixed(1)}, ${saturation.toFixed(1)}%, ${lightness.toFixed(1)}%)`
}

export function drawCorpseBody(
  ctx: CanvasRenderingContext2D,
  corpse: Corpse,
  x: number,
  y: number,
): void {
  const r = corpseRadius(corpse)
  const fillStyle = corpseFillStyle(corpse)
  const energyRatio = Math.min(1, corpse.energy / corpse.maxEnergy)
  const alpha = 0.35 + energyRatio * 0.45
  const appearance = expressCreatureAppearance(corpse.dna)

  drawCreatureAppearance(
    ctx,
    x,
    y,
    r,
    appearance,
    fillStyle,
    corpseMarkingFill(corpse),
    alpha,
  )
}
