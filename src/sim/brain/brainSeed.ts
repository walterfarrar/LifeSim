import { normalizeBrainDna, type BrainDNA } from './brainGenome'
import type { Rng } from '../rng'

/**
 * Founder behavior genome. Produced by the offline evolution harness (`npm run evolve:brain`) and
 * baked in here so the live sim starts with creatures that already forage, hydrate, and reproduce,
 * instead of flailing randomly. Regenerate by re-running the harness; it overwrites this array.
 *
 * Last harness score: -10.2 (length 253, expected 253).
 */
export const SEED_BRAIN_DNA: readonly number[] = [
  93, 134, 87, 219, 232, 203, 131, 138, 206, 130, 158, 92, 56, 18, 177, 166,
  121, 87, 90, 127, 17, 127, 127, 127, 127, 127, 126, 127, 121, 127, 5, 115,
  27, 223, 233, 146, 114, 204, 201, 188, 117, 6, 182, 152, 220, 198, 98, 248,
  146, 165, 127, 127, 127, 127, 127, 119, 121, 120, 27, 250, 85, 158, 146, 64,
  192, 229, 244, 41, 17, 107, 83, 69, 166, 23, 86, 150, 191, 206, 127, 127,
  122, 127, 127, 127, 121, 127, 89, 182, 197, 126, 129, 140, 55, 21, 250, 191,
  222, 163, 166, 0, 6, 18, 248, 226, 30, 126, 131, 127, 127, 131, 128, 127,
  127, 127, 155, 91, 27, 229, 238, 74, 87, 23, 166, 27, 63, 193, 156, 111,
  31, 88, 6, 113, 206, 29, 127, 127, 127, 123, 127, 125, 127, 127, 157, 5,
  106, 144, 67, 239, 192, 153, 129, 151, 142, 202, 96, 7, 65, 6, 187, 156,
  14, 111, 127, 127, 127, 122, 127, 128, 127, 127, 37, 117, 130, 240, 243, 80,
  253, 134, 248, 177, 72, 45, 80, 51, 100, 35, 130, 88, 34, 43, 127, 127,
  127, 124, 127, 122, 127, 127, 157, 91, 64, 40, 223, 171, 11, 102, 103, 51,
  192, 165, 208, 218, 214, 239, 120, 88, 52, 253, 127, 127, 131, 127, 127, 132,
  127, 157, 85, 201, 169, 198, 81, 209, 52, 111, 126, 35, 203, 133, 23, 105,
  199, 90, 192, 246, 51, 65, 140, 226, 192, 207, 179, 145, 75,
]

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

export function seedBrainDna(): BrainDNA {
  return normalizeBrainDna(Uint8Array.from(SEED_BRAIN_DNA))
}

/** A founder's brain: the baked seed with small jitter so a group isn't behaviorally identical. */
export function createSeedBrainDna(rng: Rng, jitter = 10): BrainDNA {
  const dna = seedBrainDna()
  if (jitter > 0) {
    for (let i = 0; i < dna.length; i++) {
      dna[i] = clampByte(dna[i] + rng.int(-jitter, jitter))
    }
  }
  return dna
}
