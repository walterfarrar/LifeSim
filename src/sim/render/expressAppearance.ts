import { geneValue } from '../dna'
import type { DNA } from '../dna'
import { HerbivoreGene, PlantGene, type CreatureShape } from '../genes'
import type { CreatureAppearance, PlantAppearance } from './appearanceTypes'

const appearanceCache = new Map<string, CreatureAppearance | PlantAppearance>()
const CACHE_LIMIT = 600

function cacheKey(prefix: string, dna: DNA): string {
  return `${prefix}:${Array.from(dna).join(',')}`
}

function remember<T extends CreatureAppearance | PlantAppearance>(key: string, value: T): T {
  if (appearanceCache.size >= CACHE_LIMIT) {
    appearanceCache.clear()
  }
  appearanceCache.set(key, value)
  return value
}

function shapeFromGene(value: number): CreatureShape {
  if (value < 0.25) return 'round'
  if (value < 0.5) return 'oval'
  if (value < 0.75) return 'square'
  return 'triangle'
}

/** Smooth closed blob; spikiness perturbs radius, elongation squashes vertically. */
function buildBlobPath(segments: number, elongation: number, spikiness: number): string {
  const points: string[] = []
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2 - Math.PI / 2
    const wobble =
      1 + spikiness * 0.42 * Math.sin(angle * (2 + spikiness * 4) + spikiness * 2.1)
    const px = Math.cos(angle) * wobble
    const py = Math.sin(angle) * wobble * (1 - elongation * 0.5)
    points.push(`${i === 0 ? 'M' : 'L'} ${px.toFixed(4)} ${py.toFixed(4)}`)
  }
  return `${points.join(' ')} Z`
}

function buildRoundedSquarePath(roundness: number, elongation: number): string {
  const size = 0.92
  const ry = size * (1 - elongation * 0.35)
  const r = size * (0.12 + roundness * 0.28)
  const sx = size
  const sy = ry
  return [
    `M ${-sx + r} ${-sy}`,
    `L ${sx - r} ${-sy}`,
    `Q ${sx} ${-sy} ${sx} ${-sy + r}`,
    `L ${sx} ${sy - r}`,
    `Q ${sx} ${sy} ${sx - r} ${sy}`,
    `L ${-sx + r} ${sy}`,
    `Q ${-sx} ${sy} ${-sx} ${sy - r}`,
    `L ${-sx} ${-sy + r}`,
    `Q ${-sx} ${-sy} ${-sx + r} ${-sy}`,
    'Z',
  ].join(' ')
}

function buildTrianglePath(elongation: number, spikiness: number): string {
  const stretch = 1 + spikiness * 0.25
  const top = -0.95 * stretch
  const bottom = 0.78 + elongation * 0.18
  const width = 0.92 + spikiness * 0.12
  return `M 0 ${top} L ${width} ${bottom} L ${-width} ${bottom} Z`
}

function buildCreatureBodyPath(
  shape: CreatureShape,
  elongation: number,
  spikiness: number,
): string {
  switch (shape) {
    case 'round':
      return buildBlobPath(14 + Math.floor(spikiness * 6), elongation * 0.35, spikiness * 0.55)
    case 'oval':
      return buildBlobPath(12 + Math.floor(spikiness * 5), elongation, spikiness * 0.45)
    case 'square':
      return buildRoundedSquarePath(spikiness, elongation)
    case 'triangle':
      return buildTrianglePath(elongation, spikiness)
  }
}

export function expressCreatureAppearance(dna: DNA): CreatureAppearance {
  const key = cacheKey('creature', dna)
  const cached = appearanceCache.get(key)
  if (cached && 'bodyPath' in cached) return cached

  const shape = shapeFromGene(geneValue(dna, HerbivoreGene.Shape))
  const elongation = geneValue(dna, HerbivoreGene.BodyElongation)
  const spikiness = geneValue(dna, HerbivoreGene.BodySpikiness)
  const marking = geneValue(dna, HerbivoreGene.BodyMarking)

  const bodyPath = buildCreatureBodyPath(shape, elongation, spikiness)
  const markingPath = marking > 0.22 ? buildCreatureBodyPath(shape, elongation, spikiness * 0.45) : null

  return remember(key, {
    bodyPath,
    markingPath,
    markingScale: 0.42 + marking * 0.38,
    aspectY: shape === 'oval' ? 0.65 + elongation * 0.2 : 1,
  })
}

function buildPlantFoliagePath(lobes: number, pointiness: number, spread: number): string {
  const segments = Math.max(3, Math.min(8, Math.round(lobes)))
  const points: string[] = []
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2 - Math.PI / 2
    const tip = 0.55 + spread * 0.4
    const valley = 0.18 + (1 - pointiness) * 0.22
    const isTip = i % 2 === 0
    const radius = isTip ? tip : valley
    const px = Math.cos(angle) * radius
    const py = Math.sin(angle) * radius * 0.85 - 0.08
    points.push(`${i === 0 ? 'M' : 'L'} ${px.toFixed(4)} ${py.toFixed(4)}`)
  }
  return `${points.join(' ')} Z`
}

export function expressPlantAppearance(dna: DNA): PlantAppearance {
  const key = cacheKey('plant', dna)
  const cached = appearanceCache.get(key)
  if (cached && 'foliagePath' in cached) return cached as PlantAppearance

  const lobesGene = geneValue(dna, PlantGene.LeafLobes)
  const pointiness = geneValue(dna, PlantGene.LeafPointiness)
  const spread = geneValue(dna, PlantGene.BaseRadius)

  const lobes = 3 + lobesGene * 5
  const foliagePath = buildPlantFoliagePath(lobes, pointiness, spread)
  const stemPath = 'M 0 0.15 L 0 0.95'

  return remember(key, { foliagePath, stemPath })
}

/** Full SVG markup for previews / export (unit viewBox). */
export function creatureAppearanceToSvg(
  appearance: CreatureAppearance,
  fill: string,
  markingFill?: string,
): string {
  const marking = appearance.markingPath
    ? `<g transform="scale(${appearance.markingScale})"><path d="${appearance.markingPath}" fill="${markingFill ?? fill}" opacity="0.45"/></g>`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1.1 -1.1 2.2 2.2"><g transform="scale(1 ${appearance.aspectY})"><path d="${appearance.bodyPath}" fill="${fill}"/>${marking}</g></svg>`
}

export function plantAppearanceToSvg(appearance: PlantAppearance, fill: string, stemFill: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1.1 -1.1 2.2 2.2"><path d="${appearance.stemPath}" stroke="${stemFill}" stroke-width="0.12" fill="none"/><path d="${appearance.foliagePath}" fill="${fill}"/></svg>`
}
