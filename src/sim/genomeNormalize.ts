import {
  DEFAULT_CLOSE_MATE_LENIENCY_GENE,
  DEFAULT_COHESION_GENE,
  DEFAULT_COURTSHIP_EAGERNESS_GENE,
  DEFAULT_MEMORY_GENE,
  DEFAULT_WATER_SOURCE_GENE,
  HERBIVORE_GENE_COUNT,
  PLANT_GENE_COUNT,
  PATHOGEN_GENE_COUNT,
  HerbivoreGene,
  PlantGene,
  DEFAULT_PLANT_MOISTURE_NEED_GENE,
  DEFAULT_PLANT_TEMP_GROWTH_RANGE_GENE,
  DEFAULT_PLANT_TEMP_PREFERENCE_GENE,
  DEFAULT_PLANT_TEMP_SURVIVAL_RANGE_GENE,
} from './genes'
import { normalizeHerbivoreBudget } from './herbivoreBudget'
import { normalizePlantBudget } from './plantBudget'
import { applyPlantKindClimate } from './plantClimate'
import { PLANT_KIND_GENE, plantKindFromGeneValue } from './plantKinds'

/** Pad or trim saved genomes so older champions still load; enforce trait budget. */
export function normalizeHerbivoreGenes(genes: number[]): number[] {
  const out = genes.slice(0, HERBIVORE_GENE_COUNT).map((g) => Math.max(0, Math.min(255, Math.round(g))))
  while (out.length < HERBIVORE_GENE_COUNT) {
    const index = out.length
    if (index === HerbivoreGene.CourtshipEagerness) {
      out.push(DEFAULT_COURTSHIP_EAGERNESS_GENE)
    } else if (index === HerbivoreGene.CloseMateLeniency) {
      out.push(DEFAULT_CLOSE_MATE_LENIENCY_GENE)
    } else if (index === HerbivoreGene.Cohesion) {
      out.push(DEFAULT_COHESION_GENE)
    } else if (index === HerbivoreGene.WaterSource) {
      out.push(DEFAULT_WATER_SOURCE_GENE)
    } else if (index === HerbivoreGene.Memory) {
      out.push(DEFAULT_MEMORY_GENE)
    } else {
      out.push(127)
    }
  }
  const dna = new Uint8Array(out)
  normalizeHerbivoreBudget(dna)
  return Array.from(dna)
}

/** Pad or trim saved plant genomes and enforce the shared trait budget. */
export function normalizePlantGenes(genes: number[]): number[] {
  const originalLength = genes.length
  const out = genes.slice(0, PLANT_GENE_COUNT).map((g) => Math.max(0, Math.min(255, Math.round(g))))
  while (out.length < PLANT_GENE_COUNT) {
    const index = out.length
    if (index === PlantGene.Kind) {
      out.push(PLANT_KIND_GENE.bush)
    } else if (index === PlantGene.MoistureNeed) {
      out.push(DEFAULT_PLANT_MOISTURE_NEED_GENE)
    } else if (index === PlantGene.TempPreference) {
      out.push(DEFAULT_PLANT_TEMP_PREFERENCE_GENE)
    } else if (index === PlantGene.TempGrowthRange) {
      out.push(DEFAULT_PLANT_TEMP_GROWTH_RANGE_GENE)
    } else if (index === PlantGene.TempSurvivalRange) {
      out.push(DEFAULT_PLANT_TEMP_SURVIVAL_RANGE_GENE)
    } else {
      out.push(127)
    }
  }
  const dna = new Uint8Array(out)
  normalizePlantBudget(dna)

  if (originalLength < PLANT_GENE_COUNT) {
    const kind = plantKindFromGeneValue(dna[PlantGene.Kind])
    applyPlantKindClimate(dna, kind)
  }

  return Array.from(dna)
}

/** Pad or trim saved pathogen genomes. */
export function normalizePathogenGenes(genes: number[]): number[] {
  const out = genes.slice(0, PATHOGEN_GENE_COUNT).map((g) => Math.max(0, Math.min(255, Math.round(g))))
  while (out.length < PATHOGEN_GENE_COUNT) {
    out.push(127)
  }
  return out
}
