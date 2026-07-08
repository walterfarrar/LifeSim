import { LARGE_MUTATION_CHANCE } from '../config'
import type { Rng } from '../rng'

/**
 * The behavior genome — a second DNA string, separate from the trait genome, that encodes a
 * tiny neural network controlling movement. Like the trait DNA it is a fixed-length byte array
 * (0–255 per allele) that inherits via crossover and drifts via mutation. Kept parallel to the
 * trait genome so the existing trait editor / DNA table / budget code stays untouched.
 */
export type BrainDNA = Uint8Array

/**
 * Network shape. Inputs include a constant bias node at index 0. The input vector layout
 * (see {@link ./senses.ts packBrainInputs}) is:
 *   0  bias
 *   1  hungerNeed        2  thirstNeed       3  fatigueNeed      4  reproReady
 *   5  depthHere         6  depthAhead       7  depthLeft        8  depthRight
 *   9  slopeAhead
 *   10 food.forward      11 food.right       12 food.close
 *   13 water.forward     14 water.right      15 water.close
 *   16 mate.forward      17 mate.right
 *   18 crowder.forward   19 crowder.right
 *   20 elevationHere     21 slopeLeft        22 slopeRight
 *   23 soilWaterHere     24 temperature      25 seasonSin       26 seasonCos
 *   27 daylight
 * New inputs are appended at the end so an older genome can be migrated in place — see
 * {@link migrateBrainGenomeInputs}.
 */
export const BRAIN_INPUT_COUNT = 28
export const BRAIN_HIDDEN_COUNT = 8
export const BRAIN_OUTPUT_COUNT = 3

/** Input count the baked founder seed in brainSeed.ts was evolved under (for migration). */
export const BRAIN_SEED_INPUT_COUNT = 20

export const BRAIN_HIDDEN_WEIGHT_COUNT = BRAIN_HIDDEN_COUNT * BRAIN_INPUT_COUNT
export const BRAIN_OUTPUT_WEIGHT_COUNT = BRAIN_OUTPUT_COUNT * (BRAIN_HIDDEN_COUNT + 1)
export const BRAIN_WEIGHT_COUNT = BRAIN_HIDDEN_WEIGHT_COUNT + BRAIN_OUTPUT_WEIGHT_COUNT

/** Meta genes precede the weight block. */
export const BRAIN_META_LEARNING_RATE = 0
export const BRAIN_META_PLASTICITY = 1
export const BRAIN_META_COUNT = 2

export const BRAIN_WEIGHT_START = BRAIN_META_COUNT
export const BRAIN_GENOME_LENGTH = BRAIN_META_COUNT + BRAIN_WEIGHT_COUNT

/** Byte 0..255 maps to a weight in roughly [-SCALE, +SCALE]; 127/128 ≈ 0. */
export const BRAIN_WEIGHT_SCALE = 4

/** Brain DNA explores faster than trait DNA — behavior needs a wider search to find good wiring. */
export const BRAIN_MUTATION_RATE = 0.02
export const BRAIN_MUTATION_SMALL = 6
export const BRAIN_MUTATION_LARGE = 48

export function brainByteToWeight(byte: number): number {
  return ((byte - 127.5) / 127.5) * BRAIN_WEIGHT_SCALE
}

export function brainWeightToByte(weight: number): number {
  const byte = Math.round((weight / BRAIN_WEIGHT_SCALE) * 127.5 + 127.5)
  return Math.max(0, Math.min(255, byte))
}

/** 0–1 learning rate; mid gene ≈ moderate lifetime plasticity. */
export function brainLearningRate(brain: BrainDNA): number {
  return (brain[BRAIN_META_LEARNING_RATE] ?? 0) / 255
}

/** 0–1 overall plasticity gate — scales how much any weight can drift during life. */
export function brainPlasticity(brain: BrainDNA): number {
  return (brain[BRAIN_META_PLASTICITY] ?? 0) / 255
}

export function createRandomBrainDna(rng: Rng): BrainDNA {
  const dna = new Uint8Array(BRAIN_GENOME_LENGTH)
  for (let i = 0; i < dna.length; i++) {
    dna[i] = rng.int(0, 255)
  }
  return dna
}

export function cloneBrainDna(brain: BrainDNA): BrainDNA {
  return new Uint8Array(brain)
}

/** Sexual inheritance: each allele from one parent at random, matching the trait-DNA scheme. */
export function crossoverBrainDna(a: BrainDNA, b: BrainDNA, rng: Rng): BrainDNA {
  const length = Math.min(a.length, b.length)
  const child = new Uint8Array(length)
  for (let i = 0; i < length; i++) {
    child[i] = rng.chance(0.5) ? a[i] : b[i]
  }
  return child
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

export function mutateBrainDna(brain: BrainDNA, rng: Rng): BrainDNA {
  const next = cloneBrainDna(brain)
  for (let i = 0; i < next.length; i++) {
    if (!rng.chance(BRAIN_MUTATION_RATE)) continue
    const bound = rng.chance(LARGE_MUTATION_CHANCE) ? BRAIN_MUTATION_LARGE : BRAIN_MUTATION_SMALL
    next[i] = clampByte(next[i] + rng.int(-bound, bound))
  }
  return next
}

/** Ensure a genome is exactly the expected length (pads with neutral 127, trims overflow). */
export function normalizeBrainDna(brain: BrainDNA): BrainDNA {
  if (brain.length === BRAIN_GENOME_LENGTH) return brain
  const out = new Uint8Array(BRAIN_GENOME_LENGTH).fill(127)
  const copy = Math.min(brain.length, BRAIN_GENOME_LENGTH)
  for (let i = 0; i < copy; i++) out[i] = brain[i]
  return out
}

/** Genome length for a given input count, holding the hidden/output shape fixed. */
export function brainGenomeLengthForInputs(inputCount: number): number {
  return BRAIN_META_COUNT + BRAIN_HIDDEN_COUNT * inputCount + BRAIN_OUTPUT_WEIGHT_COUNT
}

/**
 * Re-layout a genome that was built for `fromInputCount` inputs into the current
 * {@link BRAIN_INPUT_COUNT} layout. Because new inputs are appended at the end, each hidden
 * neuron's existing input weights are preserved and the new input slots are filled with the
 * neutral byte (127 ≈ weight 0), so a migrated brain behaves identically at birth while gaining
 * the capacity to wire up the new senses through learning and evolution. Output weights depend
 * only on the (unchanged) hidden layer, so they carry over unchanged.
 */
export function migrateBrainGenomeInputs(
  genome: ArrayLike<number>,
  fromInputCount: number,
): BrainDNA {
  const out = new Uint8Array(BRAIN_GENOME_LENGTH).fill(127)
  for (let m = 0; m < BRAIN_META_COUNT; m++) out[m] = genome[m] ?? 127

  const copyInputs = Math.min(fromInputCount, BRAIN_INPUT_COUNT)
  for (let h = 0; h < BRAIN_HIDDEN_COUNT; h++) {
    const srcBase = BRAIN_META_COUNT + h * fromInputCount
    const dstBase = BRAIN_WEIGHT_START + h * BRAIN_INPUT_COUNT
    for (let i = 0; i < copyInputs; i++) out[dstBase + i] = genome[srcBase + i] ?? 127
  }

  const srcOut = BRAIN_META_COUNT + BRAIN_HIDDEN_COUNT * fromInputCount
  const dstOut = BRAIN_WEIGHT_START + BRAIN_HIDDEN_WEIGHT_COUNT
  for (let i = 0; i < BRAIN_OUTPUT_WEIGHT_COUNT; i++) out[dstOut + i] = genome[srcOut + i] ?? 127
  return out
}

/**
 * Adapt a baked founder seed array to the current layout: pass-through when it already matches,
 * migrate when it matches the {@link BRAIN_SEED_INPUT_COUNT} legacy layout, else pad/trim.
 */
export function adaptBakedBrainSeed(bytes: ArrayLike<number>): BrainDNA {
  if (bytes.length === BRAIN_GENOME_LENGTH) {
    return normalizeBrainDna(Uint8Array.from(bytes))
  }
  if (bytes.length === brainGenomeLengthForInputs(BRAIN_SEED_INPUT_COUNT)) {
    return migrateBrainGenomeInputs(bytes, BRAIN_SEED_INPUT_COUNT)
  }
  return normalizeBrainDna(Uint8Array.from(bytes))
}
