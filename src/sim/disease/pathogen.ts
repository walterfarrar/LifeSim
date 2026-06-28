import { cloneDNA, createRandomDNA, geneValue, type DNA } from '../dna'
import { HerbivoreGene, PATHOGEN_GENE_COUNT, PathogenGene, type PathogenExpressedTraits } from '../genes'
import type { Rng } from '../rng'

/** Evolving pathogen strain — genome drives antigens and transmission. */
export type Pathogen = {
  id: number
  dna: DNA
  generation: number
}

export type Infection = {
  pathogenId: number
  severity: number
  ticksInfected: number
}

export const MIN_INFECTION_CHANCE = 0.045
export const MIN_SEVERITY_FLOOR = 0.12
export const DISEASE_SPREAD_RANGE = 22
export const MAX_PATHOGEN_STRAINS = 14

let nextPathogenId = 1

export function resetPathogenIds(): void {
  nextPathogenId = 1
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

export function expressPathogen(dna: DNA): PathogenExpressedTraits {
  const g = (gene: (typeof PathogenGene)[keyof typeof PathogenGene]) => geneValue(dna, gene)
  return {
    antigens: [
      clampByte(dna[PathogenGene.Antigen0]),
      clampByte(dna[PathogenGene.Antigen1]),
      clampByte(dna[PathogenGene.Antigen2]),
    ],
    virulence: 0.08 + g(PathogenGene.Virulence) * 0.67,
    transmissibility: 0.08 + g(PathogenGene.Transmissibility) * 0.42,
  }
}

export function pathogenTraits(pathogen: Pathogen): PathogenExpressedTraits {
  return expressPathogen(pathogen.dna)
}

export function createPathogenFromDna(dna: DNA, generation = 0): Pathogen {
  return {
    id: nextPathogenId++,
    dna: cloneDNA(dna),
    generation,
  }
}

/** Reintroduce a saved champion — optionally mutate so it is not a perfect clone mid-run. */
export function createPathogenFromChampionDna(
  dna: DNA,
  rng: Rng,
  options: { mutate?: boolean; generation?: number } = {},
): Pathogen {
  const generation = options.generation ?? 0
  if (options.mutate) {
    const base = createPathogenFromDna(dna, generation)
    return mutatePathogenOnSpread(base, rng)
  }
  return createPathogenFromDna(dna, generation)
}

export function createRandomPathogen(rng: Rng): Pathogen {
  const dna = createRandomDNA(rng, PATHOGEN_GENE_COUNT)
  dna[PathogenGene.Virulence] = rng.int(40, 200)
  dna[PathogenGene.Transmissibility] = rng.int(30, 180)
  return createPathogenFromDna(dna, 0)
}

export function createInitialPathogens(rng: Rng, count: number): Pathogen[] {
  return Array.from({ length: count }, () => createRandomPathogen(rng))
}

export function clonePathogen(pathogen: Pathogen): Pathogen {
  return {
    id: pathogen.id,
    dna: cloneDNA(pathogen.dna),
    generation: pathogen.generation,
  }
}

/** Offspring strain — genome drifts on transmission. */
export function mutatePathogenOnSpread(pathogen: Pathogen, rng: Rng): Pathogen {
  const next = cloneDNA(pathogen.dna)
  next[PathogenGene.Antigen0] = clampByte(next[PathogenGene.Antigen0] + rng.int(-10, 10))
  next[PathogenGene.Antigen1] = clampByte(next[PathogenGene.Antigen1] + rng.int(-10, 10))
  next[PathogenGene.Antigen2] = clampByte(next[PathogenGene.Antigen2] + rng.int(-10, 10))
  next[PathogenGene.Virulence] = clampByte(next[PathogenGene.Virulence] + rng.int(-8, 12))
  next[PathogenGene.Transmissibility] = clampByte(
    next[PathogenGene.Transmissibility] + rng.int(-6, 10),
  )
  return createPathogenFromDna(next, pathogen.generation + 1)
}

export function driftPathogenGenome(pathogen: Pathogen, rng: Rng): void {
  for (let i = 0; i < PATHOGEN_GENE_COUNT; i++) {
    if (!rng.chance(0.35)) continue
    pathogen.dna[i] = clampByte(pathogen.dna[i] + rng.int(-6, 6))
  }
}

export function immuneProfileFromDna(dna: DNA): [number, number, number] {
  return [
    dna[HerbivoreGene.DiseaseResistance],
    dna[HerbivoreGene.DiseaseRecovery],
    dna[HerbivoreGene.Metabolism],
  ]
}

export function antigenMatch(host: [number, number, number], pathogen: [number, number, number]): number {
  let sum = 0
  for (let i = 0; i < 3; i++) {
    sum += 1 - Math.abs(host[i] - pathogen[i]) / 255
  }
  return sum / 3
}
