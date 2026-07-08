import { adaptBakedBrainSeed, type BrainDNA } from './brainGenome'
import type { Rng } from '../rng'

/**
 * Founder behavior genome. Produced by the offline evolution harness (`npm run evolve:brain`) and
 * baked in here so the live sim starts with creatures that already forage and avoid deep water,
 * instead of flailing randomly. Regenerate by re-running the harness; it overwrites this array.
 *
 * Last harness score: 5.8 (length 189, evolved under 20 inputs). The live network now has more
 * inputs; {@link adaptBakedBrainSeed} migrates this array into the current layout at load time,
 * preserving the evolved wiring and starting the new senses neutral. Re-run the harness to bake a
 * fresh seed that also uses the new senses from birth.
 */
export const SEED_BRAIN_DNA: readonly number[] = [
  93, 134, 85, 216, 238, 203, 131, 138, 206, 130, 158, 93, 49, 18, 177, 162,
  117, 87, 90, 127, 17, 127, 5, 115, 27, 223, 233, 146, 114, 200, 201, 188,
  117, 6, 184, 152, 215, 198, 98, 248, 146, 165, 32, 251, 85, 161, 146, 64,
  190, 233, 244, 41, 17, 107, 83, 69, 166, 27, 86, 150, 191, 206, 89, 182,
  197, 126, 129, 140, 55, 21, 250, 193, 222, 163, 165, 0, 6, 18, 248, 226,
  30, 126, 155, 91, 27, 230, 238, 74, 87, 23, 166, 27, 63, 199, 156, 111,
  31, 88, 6, 113, 206, 29, 161, 3, 106, 144, 67, 239, 192, 153, 129, 153,
  142, 204, 96, 7, 65, 6, 185, 156, 14, 111, 37, 117, 130, 240, 243, 80,
  253, 130, 248, 183, 72, 45, 80, 51, 100, 35, 133, 88, 38, 43, 154, 90,
  64, 40, 223, 171, 11, 98, 103, 56, 192, 165, 208, 218, 215, 239, 120, 82,
  53, 253, 85, 201, 169, 198, 81, 209, 46, 111, 126, 35, 203, 139, 23, 105,
  199, 90, 196, 246, 51, 65, 137, 223, 192, 207, 181, 145, 69,
]

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

export function seedBrainDna(): BrainDNA {
  return adaptBakedBrainSeed(SEED_BRAIN_DNA)
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
