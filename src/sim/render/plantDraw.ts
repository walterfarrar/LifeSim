import { expressPlant } from '../phenotype'
import type { Plant } from '../types'
import { expressPlantAppearance } from './expressAppearance'
import { drawPlantAppearance } from './svgCanvas'

export function plantStemStyle(plant: Plant): string {
  const traits = expressPlant(plant.dna)
  const energyRatio = Math.min(1, plant.energy / traits.maxEnergy)
  const lightness = traits.lightness * 0.55 + energyRatio * 8
  return `hsl(${traits.greenHue - 8}, ${traits.saturation * 0.7}%, ${lightness}%)`
}

export function drawPlantBody(
  ctx: CanvasRenderingContext2D,
  plant: Plant,
  x: number,
  y: number,
  radius: number,
  foliageFill: string,
): void {
  const appearance = expressPlantAppearance(plant.dna)
  drawPlantAppearance(ctx, x, y, radius, appearance, foliageFill, plantStemStyle(plant))
}
