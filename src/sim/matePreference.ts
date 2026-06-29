import { geneValue } from './dna'
import type { DNA } from './dna'
import {
  canReproduce,
  canSeekMate,
  creatureTraits,
  mateProximity,
  toroidalDistance,
} from './entities/creature'
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
  const traitsA = creatureTraits(a)
  const traitsB = creatureTraits(b)
  const thresholdA = mateAcceptanceThreshold(a)
  const thresholdB = mateAcceptanceThreshold(b)
  const scoreAToB = mateAttractionScore(a, b, distance, maxRange)
  const scoreBToA = mateAttractionScore(b, a, distance, maxRange)

  if (distance <= maxRange) {
    return (
      scoreAToB >= thresholdA * traitsA.closeMateLeniency &&
      scoreBToA >= thresholdB * traitsB.closeMateLeniency
    )
  }

  return scoreAToB >= thresholdA && scoreBToA >= thresholdB
}

export function isMateEligible(seeker: Creature, target: Creature): boolean {
  if (target.id === seeker.id || target.sex === seeker.sex) return false
  return true
}

/** Who a horny creature should move toward when seeking a mate. */
export function isMateSearchTarget(seeker: Creature, target: Creature): boolean {
  if (!isMateEligible(seeker, target)) return false
  if (seeker.sex === 'male') {
    return (
      target.sex === 'female' &&
      canReproduce(target) &&
      target.pregnancyTicksRemaining <= 0
    )
  }
  return canSeekMate(target) || target.mode === 'horny'
}

/** Male must be horny; female must be fertile and not already pregnant. */
export function canAttemptMating(male: Creature, female: Creature): boolean {
  if (male.sex !== 'male' || female.sex !== 'female') return false
  if (male.mode !== 'horny') return false
  if (!canSeekMate(male)) return false
  if (!canReproduce(female)) return false
  if (female.pregnancyTicksRemaining > 0) return false
  return true
}

/**
 * Whether mating succeeds this tick.
 * Horny males can catch reluctant females in range; horny females accept more readily.
 */
export function willMate(
  male: Creature,
  female: Creature,
  distance: number,
  maxRange: number,
): boolean {
  if (!canAttemptMating(male, female)) return false
  if (distance > maxRange) return false

  const maleTraits = creatureTraits(male)
  const femaleTraits = creatureTraits(female)
  const maleScore = mateAttractionScore(male, female, distance, maxRange)
  const maleThreshold = mateAcceptanceThreshold(male)
  if (maleScore < maleThreshold * maleTraits.closeMateLeniency) return false

  if (female.mode === 'horny') {
    const femaleScore = mateAttractionScore(female, male, distance, maxRange)
    const femaleThreshold = mateAcceptanceThreshold(female)
    return femaleScore >= femaleThreshold * femaleTraits.closeMateLeniency
  }

  return true
}

/** Horny pairs closing distance — suppress flee/predation while pursuing or receptive. */
export function isMatingCourtship(a: Creature, b: Creature): boolean {
  if (a.sex === b.sex) return false
  const male = a.sex === 'male' ? a : b.sex === 'male' ? b : null
  const female = a.sex === 'female' ? a : b.sex === 'female' ? b : null
  if (!male || !female) return false

  const dist = toroidalDistance(a, b)
  const mateRange = mateProximity(male, female)
  const courtshipRange = Math.max(
    mateRange,
    creatureTraits(male).vision,
    creatureTraits(female).vision,
  )
  if (dist > courtshipRange) return false
  if (!canAttemptMating(male, female)) return false
  if (willMate(male, female, dist, mateRange)) return true

  const maleScore = mateAttractionScore(male, female, dist, mateRange)
  return maleScore >= mateAcceptanceThreshold(male) * 0.72
}
