import { pondRadius } from '../entities/pond'
import type { Pond } from '../types'

export function drawPondBody(
  ctx: CanvasRenderingContext2D,
  pond: Pond,
  x: number,
  y: number,
): void {
  if (pond.water <= 0.5) {
    const radius = pond.baseRadius * 0.55
    const inner = ctx.createRadialGradient(x, y, radius * 0.08, x, y, radius)
    inner.addColorStop(0, 'rgba(55, 42, 28, 0.22)')
    inner.addColorStop(0.65, 'rgba(38, 30, 22, 0.16)')
    inner.addColorStop(1, 'rgba(24, 20, 16, 0.06)')

    ctx.fillStyle = inner
    ctx.beginPath()
    ctx.ellipse(x, y, radius, radius * 0.82, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = 'rgba(70, 58, 42, 0.28)'
    ctx.lineWidth = 1.2
    ctx.setLineDash([5, 7])
    ctx.beginPath()
    ctx.ellipse(x, y, radius, radius * 0.82, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    return
  }

  const radius = pondRadius(pond)
  if (radius <= 0) return

  const fill = pond.water / pond.maxWater
  const inner = ctx.createRadialGradient(x, y, radius * 0.1, x, y, radius)
  inner.addColorStop(0, `rgba(90, 180, 255, ${0.35 + fill * 0.25})`)
  inner.addColorStop(0.55, `rgba(40, 120, 210, ${0.28 + fill * 0.22})`)
  inner.addColorStop(1, `rgba(20, 60, 120, ${0.12 + fill * 0.1})`)

  ctx.fillStyle = inner
  ctx.beginPath()
  ctx.ellipse(x, y, radius, radius * 0.82, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = `rgba(120, 200, 255, ${0.25 + fill * 0.35})`
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.ellipse(x, y, radius, radius * 0.82, 0, 0, Math.PI * 2)
  ctx.stroke()
}
