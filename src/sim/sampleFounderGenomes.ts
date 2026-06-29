import type { SavedGenome } from './dnaExport'
import { normalizeHerbivoreGenes } from './genomeNormalize'
import {
  DEFAULT_CLOSE_MATE_LENIENCY_GENE,
  DEFAULT_COURTSHIP_EAGERNESS_GENE,
  HERBIVORE_GENE_COUNT,
  HerbivoreGene as G,
} from './genes'
import { HERBIVORE_BUDGET_GENES, HERBIVORE_BUDGET_TOTAL } from './herbivoreBudget'

export const SAMPLE_FOUNDER_HERBIVORE_ID = 'sample-founder-herbivore-grazer'
export const SAMPLE_FOUNDER_OMNIVORE_ID = 'sample-founder-omnivore-opportunist'
export const SAMPLE_FOUNDER_CARNIVORE_ID = 'sample-founder-carnivore-stalker'

function assertBudget(budget: Record<number, number>): void {
  let sum = 0
  for (const gene of HERBIVORE_BUDGET_GENES) {
    sum += budget[gene]
  }
  if (sum !== HERBIVORE_BUDGET_TOTAL) {
    throw new Error(`Sample founder budget sums to ${sum}, expected ${HERBIVORE_BUDGET_TOTAL}`)
  }
}

function buildSampleSavedGenome(config: {
  id: string
  name: string
  budget: Record<number, number>
  free: Record<number, number>
}): SavedGenome {
  assertBudget(config.budget)

  const genes = Array.from({ length: HERBIVORE_GENE_COUNT }, () => 127)
  genes[G.CourtshipEagerness] = DEFAULT_COURTSHIP_EAGERNESS_GENE
  genes[G.CloseMateLeniency] = DEFAULT_CLOSE_MATE_LENIENCY_GENE

  for (const [index, value] of Object.entries(config.free)) {
    genes[Number(index)] = value
  }
  for (const [index, value] of Object.entries(config.budget)) {
    genes[Number(index)] = value
  }

  genes[G.PreferredHue] = genes[G.Hue]
  genes[G.PreferredSize] = genes[G.Size]
  genes[G.PreferredSpeed] = genes[G.Speed]

  return {
    id: config.id,
    name: config.name,
    savedAt: '1970-01-01T00:00:00.000Z',
    geneCount: HERBIVORE_GENE_COUNT,
    genes: normalizeHerbivoreGenes(genes),
    sex: 'female',
    sourceCreatureId: 0,
    ageTicks: 0,
    energy: 0,
  }
}

/** Curated founders for settings — herbivore, omnivore, and carnivore-leaning lineages. */
export const SAMPLE_FOUNDER_GENOMES: readonly SavedGenome[] = [
  buildSampleSavedGenome({
    id: SAMPLE_FOUNDER_HERBIVORE_ID,
    name: 'Sample · Grazer (herbivore)',
    budget: {
      [G.Speed]: 115,
      [G.Size]: 125,
      [G.Metabolism]: 75,
      [G.Vision]: 165,
      [G.ForageEfficiency]: 200,
      [G.MaxEnergy]: 185,
      [G.ReproThreshold]: 120,
      [G.MaxAge]: 155,
      [G.BitePower]: 95,
      [G.ForageReach]: 130,
      [G.SpaceTolerance]: 145,
      [G.Wanderlust]: 85,
      [G.Cohesion]: 130,
      [G.Aggressiveness]: 35,
      [G.DiseaseResistance]: 165,
      [G.MateRange]: 107,
    },
    free: {
      [G.Hue]: 85,
      [G.Saturation]: 130,
      [G.CannibalPredilection]: 10,
      [G.PlantHardiness]: 160,
      [G.PlantForageSelectivity]: 30,
      [G.HungerDrive]: 100,
      [G.InbreedingTolerance]: 125,
      [G.GeneticAssortment]: 205,
      [G.DiseaseRecovery]: 145,
      [G.MutationRate]: 38,
      [G.MutationAmount]: 42,
    },
  }),
  buildSampleSavedGenome({
    id: SAMPLE_FOUNDER_OMNIVORE_ID,
    name: 'Sample · Opportunist (omnivore)',
    budget: {
      [G.Speed]: 140,
      [G.Size]: 130,
      [G.Metabolism]: 95,
      [G.Vision]: 150,
      [G.ForageEfficiency]: 130,
      [G.MaxEnergy]: 150,
      [G.ReproThreshold]: 120,
      [G.MaxAge]: 135,
      [G.BitePower]: 165,
      [G.ForageReach]: 125,
      [G.SpaceTolerance]: 110,
      [G.Wanderlust]: 100,
      [G.Cohesion]: 110,
      [G.Aggressiveness]: 125,
      [G.DiseaseResistance]: 135,
      [G.MateRange]: 112,
    },
    free: {
      [G.Hue]: 35,
      [G.Saturation]: 155,
      [G.CannibalPredilection]: 160,
      [G.PlantHardiness]: 105,
      [G.PlantForageSelectivity]: 85,
      [G.HungerDrive]: 110,
      [G.InbreedingTolerance]: 110,
      [G.GeneticAssortment]: 175,
      [G.DiseaseRecovery]: 125,
      [G.MutationRate]: 42,
      [G.MutationAmount]: 48,
    },
  }),
  buildSampleSavedGenome({
    id: SAMPLE_FOUNDER_CARNIVORE_ID,
    name: 'Sample · Stalker (carnivore)',
    budget: {
      [G.Speed]: 160,
      [G.Size]: 145,
      [G.Metabolism]: 105,
      [G.Vision]: 170,
      [G.ForageEfficiency]: 65,
      [G.MaxEnergy]: 140,
      [G.ReproThreshold]: 110,
      [G.MaxAge]: 125,
      [G.BitePower]: 190,
      [G.ForageReach]: 135,
      [G.SpaceTolerance]: 85,
      [G.Wanderlust]: 130,
      [G.Cohesion]: 50,
      [G.Aggressiveness]: 175,
      [G.DiseaseResistance]: 130,
      [G.MateRange]: 117,
    },
    free: {
      [G.Hue]: 4,
      [G.Saturation]: 165,
      [G.CannibalPredilection]: 230,
      [G.PlantHardiness]: 65,
      [G.PlantForageSelectivity]: 195,
      [G.HungerDrive]: 115,
      [G.InbreedingTolerance]: 95,
      [G.GeneticAssortment]: 150,
      [G.DiseaseRecovery]: 115,
      [G.MutationRate]: 45,
      [G.MutationAmount]: 50,
    },
  }),
]

export function getSampleFounderGenomeById(id: string): SavedGenome | undefined {
  return SAMPLE_FOUNDER_GENOMES.find((genome) => genome.id === id)
}
