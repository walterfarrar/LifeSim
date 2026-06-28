import { geneArrayToDna } from '../dnaExport'
import { dnaToGeneArray } from '../dnaExport'
import type { Plant } from '../types'
import {
  clusterPlantsIntoSpecies,
  MIN_PLANT_SPECIES_POPULATION,
  pickPlantSpeciesRepresentative,
  plantSpeciesSimilarity,
  type PlantSpeciesCluster,
} from './plantSpeciesCluster'
import {
  plantSpeciesCrownFitness,
  plantSpeciesFitnessSnapshot,
} from './plantSpeciesFitness'

export type TrackedPlantSpecies = {
  id: string
  representativeGenes: number[]
  centroidGenes: number[]
  firstSeenTick: number
  lastSeenTick: number
  peakPopulation: number
  lastPopulation: number
  peakBiomass: number
  cumulativeScore: number
  observationCount: number
  lastInstantScore: number
  bestRepresentative: Plant | null
}

let nextSpeciesId = 1

export class PlantSpeciesTracker {
  private species: TrackedPlantSpecies[] = []

  reset(): void {
    this.species = []
    nextSpeciesId = 1
  }

  observe(plants: readonly Plant[], tick: number): TrackedPlantSpecies | null {
    const clusters = clusterPlantsIntoSpecies(plants)

    for (const cluster of clusters) {
      const tracked = this.matchOrCreate(cluster, tick)
      this.recordObservation(tracked, cluster, tick)
    }

    return this.bestSpecies()
  }

  bestSpecies(): TrackedPlantSpecies | null {
    let best: TrackedPlantSpecies | null = null
    let bestFitness = -1

    for (const species of this.species) {
      if (species.lastPopulation < MIN_PLANT_SPECIES_POPULATION) continue
      const fitness = this.fitnessOf(species)
      if (fitness > bestFitness) {
        bestFitness = fitness
        best = species
      }
    }

    return best
  }

  fitnessOf(species: TrackedPlantSpecies): number {
    return plantSpeciesCrownFitness(
      {
        instantScore: species.lastInstantScore,
        population: species.lastPopulation,
        matureCount: 0,
        totalEnergy: 0,
        avgAge: 0,
      },
      species.peakPopulation,
      species.lastSeenTick - species.firstSeenTick,
      species.peakBiomass,
    )
  }

  private matchOrCreate(cluster: PlantSpeciesCluster, tick: number): TrackedPlantSpecies {
    const centroidGenes = dnaToGeneArray(cluster.centroid)
    let bestMatch: TrackedPlantSpecies | null = null
    let bestSimilarity = 0

    for (const species of this.species) {
      const similarity = plantSpeciesSimilarity(
        cluster.centroid,
        geneArrayToDna(species.centroidGenes),
      )
      if (similarity >= 0.78 && similarity > bestSimilarity) {
        bestSimilarity = similarity
        bestMatch = species
      }
    }

    if (bestMatch) {
      bestMatch.centroidGenes = centroidGenes
      return bestMatch
    }

    const created: TrackedPlantSpecies = {
      id: `plant-species-${nextSpeciesId++}`,
      representativeGenes: dnaToGeneArray(pickPlantSpeciesRepresentative(cluster.members).dna),
      centroidGenes,
      firstSeenTick: tick,
      lastSeenTick: tick,
      peakPopulation: cluster.members.length,
      lastPopulation: cluster.members.length,
      peakBiomass: cluster.members.reduce((sum, plant) => sum + plant.energy, 0),
      cumulativeScore: 0,
      observationCount: 0,
      lastInstantScore: 0,
      bestRepresentative: pickPlantSpeciesRepresentative(cluster.members),
    }
    this.species.push(created)
    return created
  }

  private recordObservation(
    species: TrackedPlantSpecies,
    cluster: PlantSpeciesCluster,
    tick: number,
  ): void {
    const snapshot = plantSpeciesFitnessSnapshot(cluster)
    const representative = pickPlantSpeciesRepresentative(cluster.members)
    const biomass = cluster.members.reduce((sum, plant) => sum + plant.energy, 0)

    species.lastSeenTick = tick
    species.lastPopulation = snapshot.population
    species.peakPopulation = Math.max(species.peakPopulation, snapshot.population)
    species.peakBiomass = Math.max(species.peakBiomass, biomass)
    species.cumulativeScore += snapshot.instantScore
    species.observationCount += 1
    species.lastInstantScore = snapshot.instantScore
    species.centroidGenes = dnaToGeneArray(cluster.centroid)
    species.representativeGenes = dnaToGeneArray(representative.dna)
    species.bestRepresentative = representative
  }
}
