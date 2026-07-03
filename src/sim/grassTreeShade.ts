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

/** Photosynthetic sunlight at a turf cell after conifer canopy shade (toroidal). */
export function grassSunlightWithTreeShade(
  x: number,
  y: number,
  baseSunlight: number,
  trees: readonly Plant[],
): number {
  if (baseSunlight <= 0 || trees.length === 0) return baseSunlight

  let lightFactor = 1
  const point = { x, y }

  for (const tree of trees) {
    if (plantKindFromDna(tree.dna) !== 'tree' || tree.energy <= 0.5) continue

    const { dx, dy } = toroidalDelta(point, tree)
    const dist = Math.hypot(dx, dy)
    const canopyRadius = plantRadius(tree) * TREE_CANOPY_SHADE_RADIUS_SCALE
    const shade = canopyShadeAtDistance(dist, canopyRadius)
    if (shade <= 0) continue

    lightFactor *= 1 - shade
  }

  return baseSunlight * lightFactor
}
