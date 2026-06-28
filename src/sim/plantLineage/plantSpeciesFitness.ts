import { plantTraits } from '../entities/plant'
import type { PlantSpeciesCluster } from './plantSpeciesCluster'

export function scorePlantSpeciesInstant(cluster: PlantSpeciesCluster): number {
  const { members } = cluster
  const population = members.length
  if (population < 2) return 0

  let matureCount = 0
  let energyRatioSum = 0
  let ageSum = 0
  let totalEnergy = 0

  for (const plant of members) {
    const traits = plantTraits(plant)
    totalEnergy += plant.energy
    const mature = plant.age >= traits.maturationAge * 0.45
    if (mature) {
      matureCount += 1
      energyRatioSum += plant.energy / traits.maxEnergy
      ageSum += plant.age
    }
  }

  const matureRatio = matureCount / population
  const avgEnergy = matureCount > 0 ? energyRatioSum / matureCount : 0
  const avgAge = matureCount > 0 ? ageSum / matureCount : 0

  const populationScore = population * 380
  const maturityScore = matureCount * 240
  const cohesionScore = matureRatio * population * 160
  const vitalityScore = avgEnergy * matureCount * 130
  const biomassScore = totalEnergy * 2.2
  const ageScore = avgAge * 0.35

  return populationScore + maturityScore + cohesionScore + vitalityScore + biomassScore + ageScore
}

export type PlantSpeciesFitnessSnapshot = {
  instantScore: number
  population: number
  matureCount: number
  totalEnergy: number
  avgAge: number
}

export function plantSpeciesFitnessSnapshot(cluster: PlantSpeciesCluster): PlantSpeciesFitnessSnapshot {
  const population = cluster.members.length
  let matureCount = 0
  let ageSum = 0
  let totalEnergy = 0

  for (const plant of cluster.members) {
    const traits = plantTraits(plant)
    totalEnergy += plant.energy
    if (plant.age >= traits.maturationAge * 0.45) {
      matureCount += 1
      ageSum += plant.age
    }
  }

  return {
    instantScore: scorePlantSpeciesInstant(cluster),
    population,
    matureCount,
    totalEnergy,
    avgAge: matureCount > 0 ? ageSum / matureCount : 0,
  }
}

export function plantSpeciesCrownFitness(
  snapshot: PlantSpeciesFitnessSnapshot,
  peakPopulation: number,
  spanTicks: number,
  peakBiomass: number,
): number {
  const persistence = spanTicks * (0.06 + snapshot.population * 0.035)
  const peakBonus = peakPopulation * peakPopulation * 38
  const biomassBonus = peakBiomass * 1.8
  return snapshot.instantScore + persistence + peakBonus + biomassBonus
}
