import { HERBIVORE_GENE_COUNT, HerbivoreGene } from './genes'
import type { Rng } from './rng'
import type { FounderSettings } from './simSettings'
import { WORLD_HEIGHT, WORLD_WIDTH } from './config'
import type { Vec2 } from './types'

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

/** Bias mate preferences toward this genome's body — helps founder populations pair. */
export function alignMatePreferencesToBody(
  dna: DNA,
  rng: Rng,
  noise: number,
): void {
  const jitter = () => (noise > 0 ? rng.int(-noise, noise) : 0)
  dna[HerbivoreGene.PreferredHue] = clampByte(dna[HerbivoreGene.Hue] + jitter())
  dna[HerbivoreGene.PreferredSize] = clampByte(dna[HerbivoreGene.Size] + jitter())
  dna[HerbivoreGene.PreferredSpeed] = clampByte(dna[HerbivoreGene.Speed] + jitter())
  dna[HerbivoreGene.GeneticAssortment] = clampByte(210 + rng.int(-18, 18))
  dna[HerbivoreGene.MateSelectivity] = clampByte(65 + rng.int(-28, 28))
  dna[HerbivoreGene.MutationRate] = clampByte(35 + rng.int(-12, 12))
  dna[HerbivoreGene.MutationAmount] = clampByte(45 + rng.int(-12, 12))
}

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
  const founder = createRandomDNA(rng)
  const hueStep = 255 / Math.max(1, groupCount)
  founder[HerbivoreGene.Hue] = clampByte(groupIndex * hueStep + rng.int(-18, 18))
  founder[HerbivoreGene.Saturation] = clampByte(120 + rng.int(-35, 35))
  founder[HerbivoreGene.Size] = clampByte(90 + groupIndex * 18 + rng.int(-12, 12))
  founder[HerbivoreGene.Speed] = clampByte(100 + (groupCount - 1 - groupIndex) * 16 + rng.int(-12, 12))
  alignMatePreferencesToBody(founder, rng, 0)
  return founder
}

export type GroupSpawn = {
  dna: DNA
  position: Vec2
}

export function createMultiGroupPopulation(
  rng: Rng,
  groupCount: number,
  herbivoresPerGroup: number,
  founderSettings: FounderSettings,
  groupFounderDna?: (DNA | null)[],
): GroupSpawn[] {
  const spawns: GroupSpawn[] = []
  const cols = Math.ceil(Math.sqrt(groupCount))
  const rows = Math.ceil(groupCount / cols)

  for (let group = 0; group < groupCount; group++) {
    const savedFounder = groupFounderDna?.[group]
    const founder = savedFounder ? cloneDNA(savedFounder) : createFounderGroupDNA(rng, group, groupCount)
    if (savedFounder) {
      alignMatePreferencesToBody(founder, rng, founderSettings.founderPreferenceNoise)
    }
    const row = Math.floor(group / cols)
    const col = group % cols
    const centerX = (WORLD_WIDTH / (cols + 1)) * (col + 1)
    const centerY = (WORLD_HEIGHT / (rows + 1)) * (row + 1)

    for (let i = 0; i < herbivoresPerGroup; i++) {
      const dna = i === 0 ? cloneDNA(founder) : createFounderVariantDNA(rng, founder, founderSettings)
      const sexIndex = spawns.length
      dna[HerbivoreGene.SexExpression] =
        sexIndex % 2 === 0 ? rng.int(20, 120) : rng.int(135, 235)

      spawns.push({
        dna,
        position: {
          x: centerX + rng.range(-75, 75),
          y: centerY + rng.range(-75, 75),
        },
      })
    }
  }

  return spawns
}
