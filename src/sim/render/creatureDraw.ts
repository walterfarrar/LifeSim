import type { Creature } from '../types'
import type { HerbivoreTraits } from '../genes'
import { expressCreatureAppearance } from './expressAppearance'
import { drawCreatureAppearance } from './svgCanvas'

export function creatureFillStyle(
  creature: Creature,
  traits: HerbivoreTraits,
  energyRatio: number,
): string {
  const sexShift = creature.sex === 'female' ? 12 : 0
  const hue = (traits.hue + sexShift) % 360
  const lightness = traits.lightness + energyRatio * 22
  return `hsl(${hue}, ${traits.saturation}%, ${lightness}%)`
}

export function creatureMarkingFillStyle(
  creature: Creature,
  traits: HerbivoreTraits,
): string {
  const sexShift = creature.sex === 'female' ? 12 : 0
  const hue = (traits.hue + sexShift + 28) % 360
  return `hsl(${hue}, ${Math.min(100, traits.saturation + 12)}%, ${traits.lightness + 8}%)`
}

export function drawCreatureBody(
  ctx: CanvasRenderingContext2D,
  creature: Creature,
  traits: HerbivoreTraits,
  fillStyle: string,
): void {
  const appearance = expressCreatureAppearance(creature.dna)
  drawCreatureAppearance(
    ctx,
    creature.x,
    creature.y,
    traits.radius,
    appearance,
    fillStyle,
    creatureMarkingFillStyle(creature, traits),
  )
}
