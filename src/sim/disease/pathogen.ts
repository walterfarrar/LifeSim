import type { DNA } from '../dna'
import { HerbivoreGene } from '../genes'
import type { Rng } from '../rng'

/** Evolving pathogen strain — antigens drift to evade host resistance profiles. */
export type Pathogen = {
  id: number
  antigens: [number, number, number]
  virulence: number
  transmissibility: number
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

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

export function createRandomPathogen(rng: Rng): Pathogen {
  return {
    id: nextPathogenId++,
    antigens: [rng.int(0, 255), rng.int(0, 255), rng.int(0, 255)],
    virulence: rng.range(0.12, 0.55),
    transmissibility: rng.range(0.08, 0.42),
    generation: 0,
  }
}

export function createInitialPathogens(rng: Rng, count: number): Pathogen[] {
  return Array.from({ length: count }, () => createRandomPathogen(rng))
}

export function clonePathogen(pathogen: Pathogen): Pathogen {
  return { ...pathogen, antigens: [...pathogen.antigens] as [number, number, number] }
}

/** Offspring strain — antigens and traits drift on transmission. */
export function mutatePathogenOnSpread(pathogen: Pathogen, rng: Rng): Pathogen {
  return {
    id: nextPathogenId++,
    antigens: [
      clampByte(pathogen.antigens[0] + rng.int(-10, 10)),
      clampByte(pathogen.antigens[1] + rng.int(-10, 10)),
      clampByte(pathogen.antigens[2] + rng.int(-10, 10)),
    ],
    virulence: clamp01(pathogen.virulence + rng.range(-0.025, 0.035)),
    transmissibility: clamp01(pathogen.transmissibility + rng.range(-0.02, 0.03)),
    generation: pathogen.generation + 1,
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
