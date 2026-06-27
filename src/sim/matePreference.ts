import { geneValue } from './dna'
import type { DNA } from './dna'
import { creatureTraits } from './entities/creature'
import { HerbivoreGene } from './genes'
import type { Creature } from './types'

/** Mean allele similarity across the genome (0 = unrelated, 1 = identical). */
export function dnaSimilarity(a: DNA, b: DNA): number {
  const len = Math.min(a.length, b.length)
  if (len === 0) return 0

  let sum = 0
  for (let i = 0; i < len; i++) {
    sum += 1 - Math.abs(a[i] - b[i]) / 255
  }
  return sum / len
}

/** Attraction from genetic similarity; peak is the preferred similarity level (0 = outbreed, 1 = inbreed). */
export function geneticAttraction(preferredSimilarity: number, similarity: number): number {
  return Math.max(0, 1 - Math.abs(similarity - preferredSimilarity) * 2)
}

function circularHueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360
  return Math.min(diff, 360 - diff)
}

function traitAttraction(seeker: Creature, target: Creature): number {
  const seekerTraits = creatureTraits(seeker)
  const targetHue = geneValue(target.dna, HerbivoreGene.Hue) * 360
  const targetSize = geneValue(target.dna, HerbivoreGene.Size)
  const targetSpeed = geneValue(target.dna, HerbivoreGene.Speed)

  const hueDist = circularHueDistance(seekerTraits.preferHue, targetHue) / 180
  const sizeDist = Math.abs(seekerTraits.preferSize - targetSize)
  const speedDist = Math.abs(seekerTraits.preferSpeed - targetSpeed)

  return 1 - (hueDist + sizeDist + speedDist) / 3
}

export function mateAcceptanceThreshold(creature: Creature): number {
  const traits = creatureTraits(creature)
  return 0.28 + traits.mateSelectivity * 0.47
}

/** How much seeker is drawn to target (0–1), blending trait ideals, genetics, and proximity. */
export function mateAttractionScore(
  seeker: Creature,
  target: Creature,
  distance: number,
  maxRange: number,
): number {
  const seekerTraits = creatureTraits(seeker)
  const proxScore = maxRange > 0 ? Math.max(0, 1 - distance / maxRange) : 0
  const traitScore = traitAttraction(seeker, target)
  const geneticScore = geneticAttraction(
    seekerTraits.geneticAssortment,
    dnaSimilarity(seeker.dna, target.dna),
  )
  const preferenceBlend = traitScore * 0.5 + geneticScore * 0.5
  return seekerTraits.matePreferenceStrength * preferenceBlend + (1 - seekerTraits.matePreferenceStrength) * proxScore
}

export function mutuallyAcceptMate(a: Creature, b: Creature, distance: number, maxRange: number): boolean {
  const scoreAToB = mateAttractionScore(a, b, distance, maxRange)
  const scoreBToA = mateAttractionScore(b, a, distance, maxRange)
  return (
    scoreAToB >= mateAcceptanceThreshold(a) &&
    scoreBToA >= mateAcceptanceThreshold(b)
  )
}

export function isMateEligible(seeker: Creature, target: Creature): boolean {
  if (target.id === seeker.id || target.sex === seeker.sex) return false
  return true
}
