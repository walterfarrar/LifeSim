import { TREE_CANOPY_MAX_SHADE, TREE_CANOPY_SHADE_RADIUS_SCALE } from './config'
import { plantRadius } from './entities/plant'
import { plantKindFromDna } from './plantKinds'
import { toroidalDelta } from './toroidal'
import type { Plant } from './types'

function canopyShadeAtDistance(dist: number, canopyRadius: number): number {
  if (canopyRadius <= 0 || dist >= canopyRadius) return 0
  const t = 1 - dist / canopyRadius
  return t * t * TREE_CANOPY_MAX_SHADE
}

/** Precomputed conifer shade discs — build once per grass tick, not per turf cell. */
export type TreeCanopy = {
  x: number
  y: number
  radius: number
}

export function buildTreeCanopies(trees: readonly Plant[]): TreeCanopy[] {
  const canopies: TreeCanopy[] = []
  for (const tree of trees) {
    if (plantKindFromDna(tree.dna) !== 'tree' || tree.energy <= 0.5) continue
    canopies.push({
      x: tree.x,
      y: tree.y,
      radius: plantRadius(tree) * TREE_CANOPY_SHADE_RADIUS_SCALE,
    })
  }
  return canopies
}

/** Photosynthetic sunlight at a turf cell after precomputed canopy shade (toroidal). */
export function grassSunlightWithCanopies(
  x: number,
  y: number,
  baseSunlight: number,
  canopies: readonly TreeCanopy[],
): number {
  if (baseSunlight <= 0 || canopies.length === 0) return baseSunlight

  let lightFactor = 1
  const point = { x, y }

  for (const canopy of canopies) {
    const { dx, dy } = toroidalDelta(point, canopy)
    const dist = Math.hypot(dx, dy)
    const shade = canopyShadeAtDistance(dist, canopy.radius)
    if (shade <= 0) continue
    lightFactor *= 1 - shade
  }

  return baseSunlight * lightFactor
}

/** @deprecated Prefer {@link buildTreeCanopies} + {@link grassSunlightWithCanopies}. */
export function grassSunlightWithTreeShade(
  x: number,
  y: number,
  baseSunlight: number,
  trees: readonly Plant[],
): number {
  return grassSunlightWithCanopies(x, y, baseSunlight, buildTreeCanopies(trees))
}
