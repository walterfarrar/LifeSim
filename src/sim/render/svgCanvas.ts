import type { CreatureAppearance, PlantAppearance } from './appearanceTypes'

export function fillSvgPath(
  ctx: CanvasRenderingContext2D,
  pathD: string,
  fill: string,
  alpha = 1,
): void {
  ctx.save()
  if (alpha < 1) ctx.globalAlpha *= alpha
  ctx.fillStyle = fill
  ctx.fill(new Path2D(pathD))
  ctx.restore()
}

export function strokeSvgPath(
  ctx: CanvasRenderingContext2D,
  pathD: string,
  stroke: string,
  lineWidth: number,
  alpha = 1,
): void {
  ctx.save()
  if (alpha < 1) ctx.globalAlpha *= alpha
  ctx.strokeStyle = stroke
  ctx.lineWidth = lineWidth
  ctx.stroke(new Path2D(pathD))
  ctx.restore()
}

export function drawCreatureAppearance(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  appearance: CreatureAppearance,
  fill: string,
  markingFill?: string,
  alpha = 1,
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(radius, radius * appearance.aspectY)
  if (alpha < 1) ctx.globalAlpha *= alpha

  ctx.fillStyle = fill
  ctx.fill(new Path2D(appearance.bodyPath))

  if (appearance.markingPath && markingFill) {
    ctx.save()
    ctx.scale(appearance.markingScale, appearance.markingScale)
    ctx.globalAlpha *= 0.45
    ctx.fillStyle = markingFill
    ctx.fill(new Path2D(appearance.markingPath))
    ctx.restore()
  }

  ctx.restore()
}

export function drawPlantAppearance(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  appearance: PlantAppearance,
  foliageFill: string,
  stemStroke: string,
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(radius, radius)

  strokeSvgPath(ctx, appearance.stemPath, stemStroke, 0.14, 1)
  fillSvgPath(ctx, appearance.foliagePath, foliageFill)

  ctx.restore()
}
