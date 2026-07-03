import { HERBIVORE_GENE_COUNT, HerbivoreGene } from './genes'
import { createRandomHerbivoreDNA } from './herbivoreBudget'
import type { Rng } from './rng'
import type { FounderSettings } from './simSettings'
import type { Vec2 } from './types'
import { getWorldBounds } from './worldBounds'

/** Fixed-length byte genome; each allele is 0–255. */
export type DNA = Uint8Array

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

export function createRandomDNA(rng: Rng, length = HERBIVORE_GENE_COUNT): DNA {
  const dna = new Uint8Array(length)
  for (let i = 0; i < length; i++) {
    dna[i] = rng.int(0, 255)
  }
  return dna
}

export function cloneDNA(dna: DNA): DNA {
  return new Uint8Array(dna)
}

/** Normalize a single gene to 0–1 for phenotype expression. */
export function geneValue(dna: DNA, index: number): number {
  return dna[index] / 255
}

/**
 * Sexual reproduction: each gene is inherited from one parent at random (50/50).
 * This gives each offspring half its alleles from each parent on average.
 */
export function crossover(parentA: DNA, parentB: DNA, rng: Rng): DNA {
  const length = Math.min(parentA.length, parentB.length)
  const child = new Uint8Array(length)
  for (let i = 0; i < length; i++) {
    child[i] = rng.chance(0.5) ? parentA[i] : parentB[i]
  }
  return child
}

export { mutate } from './mutation'

export function createFounderVariantDNA(rng: Rng, founder: DNA, founderSettings: FounderSettings): DNA {
  const next = cloneDNA(founder)
  for (let i = 0; i < next.length; i++) {
    if (!rng.chance(founderSettings.founderJitterChance)) continue
    next[i] = clampByte(next[i] + rng.int(-founderSettings.founderGeneSpread, founderSettings.founderGeneSpread))
  }
  return next
}

function createFounderGroupDNA(
  rng: Rng,
  groupIndex: number,
  groupCount: number,
): DNA {
  const founder = createRandomHerbivoreDNA(rng)
  const hueStep = 255 / Math.max(1, groupCount)
  founder[HerbivoreGene.Hue] = clampByte(groupIndex * hueStep + rng.int(-18, 18))
  founder[HerbivoreGene.Saturation] = clampByte(120 + rng.int(-35, 35))
  founder[HerbivoreGene.Size] = clampByte(90 + groupIndex * 18 + rng.int(-12, 12))
  founder[HerbivoreGene.Speed] = clampByte(100 + (groupCount - 1 - groupIndex) * 16 + rng.int(-12, 12))
  return founder
}

export type GroupSpawn = {
  dna: DNA
  position: Vec2
}

export function createSingleGroupPopulation(
  rng: Rng,
  groupIndex: number,
  totalGroups: number,
  herbivoresPerGroup: number,
  founderSettings: FounderSettings,
  groupFounderDna?: (DNA | null)[],
  sexIndexOffset = 0,
): GroupSpawn[] {
  const spawns: GroupSpawn[] = []
  const cols = Math.ceil(Math.sqrt(totalGroups))
  const rows = Math.ceil(totalGroups / cols)

  const bounds = getWorldBounds()
  const groupSpread = Math.min(75, Math.max(40, Math.min(bounds.width, bounds.height) * 0.04))

  const savedFounder = groupFounderDna?.[groupIndex]
  const founder = savedFounder ? cloneDNA(savedFounder) : createFounderGroupDNA(rng, groupIndex, totalGroups)
  const row = Math.floor(groupIndex / cols)
  const col = groupIndex % cols
  const centerX = (bounds.width / (cols + 1)) * (col + 1)
  const centerY = (bounds.height / (rows + 1)) * (row + 1)

  for (let i = 0; i < herbivoresPerGroup; i++) {
    const dna = i === 0 ? cloneDNA(founder) : createFounderVariantDNA(rng, founder, founderSettings)
    const sexIndex = sexIndexOffset + i
    dna[HerbivoreGene.SexExpression] =
      sexIndex % 2 === 0 ? rng.int(20, 120) : rng.int(135, 235)

    spawns.push({
      dna,
      position: {
        x: centerX + rng.range(-groupSpread, groupSpread),
        y: centerY + rng.range(-groupSpread, groupSpread),
      },
    })
  }

  return spawns
}

export function createMultiGroupPopulation(
  rng: Rng,
  groupCount: number,
  herbivoresPerGroup: number,
  founderSettings: FounderSettings,
  groupFounderDna?: (DNA | null)[],
): GroupSpawn[] {
  const spawns: GroupSpawn[] = []
  for (let group = 0; group < groupCount; group++) {
    spawns.push(
      ...createSingleGroupPopulation(
        rng,
        group,
        groupCount,
        herbivoresPerGroup,
        founderSettings,
        groupFounderDna,
        group * herbivoresPerGroup,
      ),
    )
  }
  return spawns
}
