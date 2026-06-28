import { geneArrayToDna } from '../dnaExport'
import { plantTraits } from '../entities/plant'
import type { DNA } from '../dna'
import type { Plant } from '../types'
import { dnaSimilarity } from '../matePreference'

export const PLANT_SPECIES_CLUSTER_SIMILARITY = 0.82
export const PLANT_SPECIES_MATCH_SIMILARITY = 0.78
export const MIN_PLANT_SPECIES_POPULATION = 2

export type PlantSpeciesCluster = {
  members: Plant[]
  centroid: DNA
}

export function computePlantCentroidDna(members: readonly Plant[]): DNA {
  const length = members[0]?.dna.length ?? 0
  const genes = new Array<number>(length).fill(0)
  for (const member of members) {
    for (let i = 0; i < length; i++) {
      genes[i] += member.dna[i]
    }
  }
  for (let i = 0; i < length; i++) {
    genes[i] = Math.round(genes[i] / members.length)
  }
  return geneArrayToDna(genes)
}

export function clusterPlantsIntoSpecies(
  plants: readonly Plant[],
  similarityThreshold = PLANT_SPECIES_CLUSTER_SIMILARITY,
  minPopulation = MIN_PLANT_SPECIES_POPULATION,
): PlantSpeciesCluster[] {
  const assigned = new Set<number>()
  const clusters: PlantSpeciesCluster[] = []

  for (const seed of plants) {
    if (assigned.has(seed.id)) continue

    const members: Plant[] = []
    for (const candidate of plants) {
      if (assigned.has(candidate.id)) continue
      if (dnaSimilarity(seed.dna, candidate.dna) >= similarityThreshold) {
        members.push(candidate)
        assigned.add(candidate.id)
      }
    }

    if (members.length >= minPopulation) {
      clusters.push({ members, centroid: computePlantCentroidDna(members) })
    }
  }

  return clusters
}

export function pickPlantSpeciesRepresentative(members: readonly Plant[]): Plant {
  let best = members[0]
  let bestCohesion = -1

  for (const candidate of members) {
    let cohesion = 0
    for (const member of members) {
      cohesion += dnaSimilarity(candidate.dna, member.dna)
    }
    if (cohesion > bestCohesion) {
      bestCohesion = cohesion
      best = candidate
    }
  }

  return best
}

export function plantSpeciesSimilarity(a: DNA, b: DNA): number {
  return dnaSimilarity(a, b)
}

export function plantSpeciesEnergyTotal(members: readonly Plant[]): number {
  return members.reduce((sum, plant) => sum + plant.energy, 0)
}

export function plantSpeciesMatureCount(members: readonly Plant[]): number {
  let count = 0
  for (const plant of members) {
    const traits = plantTraits(plant)
    if (plant.age >= traits.maturationAge * 0.45) count += 1
  }
  return count
}
