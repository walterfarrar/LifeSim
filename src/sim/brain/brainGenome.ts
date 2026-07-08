import { LARGE_MUTATION_CHANCE } from '../config'
import type { Rng } from '../rng'

/**
 * The behavior genome — a second DNA string, separate from the trait genome, that encodes a
 * tiny neural network controlling movement. Like the trait DNA it is a fixed-length byte array
 * (0–255 per allele) that inherits via crossover and drifts via mutation. Kept parallel to the
 * trait genome so the existing trait editor / DNA table / budget code stays untouched.
 */
export type BrainDNA = Uint8Array

/** Network shape. Inputs include a constant bias node at index 0. */
export const BRAIN_INPUT_COUNT = 20
export const BRAIN_HIDDEN_COUNT = 8
export const BRAIN_OUTPUT_COUNT = 3

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
