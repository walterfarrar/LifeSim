import { geneValue } from './dna'
import type { DNA } from './dna'
import { HerbivoreGene } from './genes'
import { dnaSimilarity } from './matePreference'

/** Parental similarity above this begins inbreeding depression on offspring. */
export const INBREEDING_SIMILARITY_START = 0.68

export function computeInbreedingLoad(mother: DNA, father: DNA, childDna: DNA): number {
  const similarity = dnaSimilarity(mother, father)
  if (similarity <= INBREEDING_SIMILARITY_START) return 0

  const raw = (similarity - INBREEDING_SIMILARITY_START) / (1 - INBREEDING_SIMILARITY_START)
  const tolerance = geneValue(childDna, HerbivoreGene.InbreedingTolerance)
  return Math.min(1, raw * (1 - tolerance * 0.88))
}

/** Scale expressed traits based on inbreeding load at birth. */
export function applyInbreedingToTraits<T extends {
  maxEnergy: number
  maturationAge: number
  metabolism: number
  maxAge: number
  diseaseResistance: number
  diseaseRecovery: number
}>(traits: T, load: number): T {
  if (load <= 0) return traits
  return {
    ...traits,
    maxEnergy: traits.maxEnergy * (1 - load * 0.38),
    maturationAge: traits.maturationAge * (1 + load * 0.55),
    metabolism: traits.metabolism * (1 + load * 0.28),
    maxAge: traits.maxAge * (1 - load * 0.22),
    diseaseResistance: traits.diseaseResistance * (1 - load * 0.45),
    diseaseRecovery: traits.diseaseRecovery * (1 - load * 0.35),
  }
}
