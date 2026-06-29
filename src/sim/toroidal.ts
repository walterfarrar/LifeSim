import { getWorldBounds } from './worldBounds'
import type { Vec2 } from './types'

/** Offsets for drawing a toroidal world — duplicate near edges so vision/entities wrap visually. */
export function toroidalDisplayOffsets(
  x: number,
  y: number,
  margin: number,
  worldWidth = getWorldBounds().width,
  worldHeight = getWorldBounds().height,
): Array<{ ox: number; oy: number }> {
  const offsets: Array<{ ox: number; oy: number }> = [{ ox: 0, oy: 0 }]
  const nearLeft = x < margin
  const nearRight = x > worldWidth - margin
  const nearTop = y < margin
  const nearBottom = y > worldHeight - margin

  if (nearLeft) offsets.push({ ox: worldWidth, oy: 0 })
  if (nearRight) offsets.push({ ox: -worldWidth, oy: 0 })
  if (nearTop) offsets.push({ ox: 0, oy: worldHeight })
  if (nearBottom) offsets.push({ ox: 0, oy: -worldHeight })
  if (nearLeft && nearTop) offsets.push({ ox: worldWidth, oy: worldHeight })
  if (nearLeft && nearBottom) offsets.push({ ox: worldWidth, oy: -worldHeight })
  if (nearRight && nearTop) offsets.push({ ox: -worldWidth, oy: worldHeight })
  if (nearRight && nearBottom) offsets.push({ ox: -worldWidth, oy: -worldHeight })

  return offsets
}

export function toroidalDelta(from: Vec2, to: Vec2, bounds = getWorldBounds()): { dx: number; dy: number } {
  let dx = to.x - from.x
  let dy = to.y - from.y
  if (dx > bounds.width / 2) dx -= bounds.width
  if (dx < -bounds.width / 2) dx += bounds.width
  if (dy > bounds.height / 2) dy -= bounds.height
  if (dy < -bounds.height / 2) dy += bounds.height
  return { dx, dy }
}

export function toroidalDistance(a: Vec2, b: Vec2): number {
  const { dx, dy } = toroidalDelta(a, b)
  return Math.hypot(dx, dy)
}

export function isWithinToroidalRange(from: Vec2, to: Vec2, range: number): boolean {
  return toroidalDistance(from, to) <= range
}

/** Shortest-path target coords — may lie outside the map bounds. */
export function toroidalNearestPoint(from: Vec2, to: Vec2): Vec2 {
  const { dx, dy } = toroidalDelta(from, to)
  return { x: from.x + dx, y: from.y + dy }
}

/** Max vision radius at full gene expression — wrap render margin for entities. */
export const MAX_VISION_RADIUS = 35 + 130
