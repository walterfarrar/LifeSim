import { geneValue } from '../dna'
import type { DNA } from '../dna'
import { HerbivoreGene, PlantGene, type CreatureShape } from '../genes'
import { plantKindFromDna } from '../plantKinds'
import type { CreatureAppearance, PlantAppearance, PlantSilhouette } from './appearanceTypes'

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

function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  return [
    `M ${(cx - rx).toFixed(4)} ${cy.toFixed(4)}`,
    `A ${rx.toFixed(4)} ${ry.toFixed(4)} 0 1 0 ${(cx + rx).toFixed(4)} ${cy.toFixed(4)}`,
    `A ${rx.toFixed(4)} ${ry.toFixed(4)} 0 1 0 ${(cx - rx).toFixed(4)} ${cy.toFixed(4)}`,
    'Z',
  ].join(' ')
}

/** Thin upward blades — reads as turf, not a tree crown. */
function buildGrassBlades(bladeCount: number, pointiness: number): string[] {
  const count = Math.max(5, Math.min(10, bladeCount))
  const paths: string[] = []
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1)
    const baseX = -0.42 + t * 0.84
    const lean = (t - 0.5) * (0.35 + pointiness * 0.25)
    const height = 0.62 + (i % 3) * 0.1 + pointiness * 0.12
    const tipX = baseX + lean
    const width = 0.045 + pointiness * 0.025
    paths.push(
      `M ${baseX.toFixed(4)} 0.18 L ${tipX.toFixed(4)} ${(-height).toFixed(4)} L ${(baseX + width).toFixed(4)} 0.18 Z`,
    )
  }
  return paths
}

/** Low, wide shrub — lumpy lobes instead of smooth ovals. */
function buildBushCluster(fullness: number): { foliagePaths: string[]; stemPath: string | null } {
  const bump = 0.1 + fullness * 0.12
  const lobes = 7
  const paths: string[] = []

  for (let i = 0; i < lobes; i++) {
    const angle = (i / lobes) * Math.PI * 2 - Math.PI / 2
    const cx = Math.cos(angle) * (0.18 + bump * 0.35)
    const cy = Math.sin(angle) * (0.14 + bump * 0.28) - 0.16
    const rx = 0.24 + bump * 0.55
    const ry = 0.2 + bump * 0.45
    paths.push(ellipsePath(cx, cy, rx, ry))
  }

  paths.push(ellipsePath(0, -0.2, 0.34 + bump * 0.65, 0.28 + bump * 0.55))

  return {
    foliagePaths: paths,
    stemPath: 'M 0 0.05 L 0 0.28',
  }
}

/** Layered conifer tiers stacked on the trunk — no floating crown gap. */
function buildConiferTree(layerGene: number, widthGene: number): { foliagePaths: string[]; stemPath: string } {
  const layerCount = Math.max(4, Math.min(6, Math.round(4 + layerGene * 2.2)))
  const widthScale = 0.85 + widthGene * 0.55
  const trunkTop = 0.38
  const tierStep = 0.15
  const tierHeight = 0.22
  const foliagePaths: string[] = []

  for (let i = 0; i < layerCount; i++) {
    const yBottom = trunkTop - i * tierStep
    const yTop = yBottom - tierHeight + i * 0.012
    const halfWidth = (0.24 + (layerCount - i) / layerCount * 0.58) * widthScale
    foliagePaths.push(
      `M 0 ${yTop.toFixed(4)} L ${halfWidth.toFixed(4)} ${yBottom.toFixed(4)} L ${(-halfWidth).toFixed(4)} ${yBottom.toFixed(4)} Z`,
    )
  }

  return {
    foliagePaths,
    stemPath: `M 0 ${trunkTop.toFixed(4)} L 0 1`,
  }
}

function expressPlantAppearanceForKind(dna: DNA, silhouette: PlantSilhouette): PlantAppearance {
  const lobesGene = geneValue(dna, PlantGene.LeafLobes)
  const pointiness = geneValue(dna, PlantGene.LeafPointiness)
  const spread = geneValue(dna, PlantGene.BaseRadius)

  switch (silhouette) {
    case 'grass':
      return {
        silhouette,
        foliagePaths: buildGrassBlades(4 + lobesGene * 6, pointiness),
        stemPath: null,
        aspectX: 1.25,
        aspectY: 1,
      }
    case 'bush': {
      const bush = buildBushCluster(spread)
      return {
        silhouette,
        foliagePaths: bush.foliagePaths,
        stemPath: bush.stemPath,
        aspectX: 1.4,
        aspectY: 0.82,
      }
    }
    case 'tree': {
      const tree = buildConiferTree(lobesGene, spread)
      return {
        silhouette,
        foliagePaths: tree.foliagePaths,
        stemPath: tree.stemPath,
        aspectX: 1.05,
        aspectY: 1.65,
      }
    }
  }
}

export function expressPlantAppearance(dna: DNA): PlantAppearance {
  const key = cacheKey('plant', dna)
  const cached = appearanceCache.get(key)
  if (cached && 'foliagePaths' in cached) return cached as PlantAppearance

  const silhouette = plantKindFromDna(dna)
  return remember(key, expressPlantAppearanceForKind(dna, silhouette))
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
  const stem = appearance.stemPath
    ? `<path d="${appearance.stemPath}" stroke="${stemFill}" stroke-width="0.12" fill="none"/>`
    : ''
  const foliage = appearance.foliagePaths
    .map((path) => `<path d="${path}" fill="${fill}"/>`)
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1.1 -1.1 2.2 2.2">${stem}${foliage}</svg>`
}
