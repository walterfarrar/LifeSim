import { creatureTraits } from '../entities/creature'
import type { LineageCluster } from './lineageCluster'

/** Snapshot score for one lineage at a moment in time — favors groups that thrive together. */
export function scoreLineageInstant(cluster: LineageCluster): number {
  const { members } = cluster
  const population = members.length
  if (population < 2) return 0

  let matureCount = 0
  let ageSum = 0
  let energyRatioSum = 0
  let pregnantCount = 0

  for (const member of members) {
    const traits = creatureTraits(member)
    const isMature = member.age >= traits.maturationAge
    if (isMature) {
      matureCount += 1
      ageSum += member.age
      energyRatioSum += member.energy / traits.maxEnergy
    }
    if (member.pregnancyTicksRemaining > 0) {
      pregnantCount += 1
    }
  }

  const matureRatio = matureCount / population
  const avgAge = matureCount > 0 ? ageSum / matureCount : 0
  const avgEnergy = matureCount > 0 ? energyRatioSum / matureCount : 0

  const populationScore = population * 520
  const maturityScore = matureCount * 280
  const cohesionScore = matureRatio * population * 180
  const ageScore = avgAge * 0.65
  const vitalityScore = avgEnergy * matureCount * 120
  const reproScore = pregnantCount * 520
  const fertilityRate = population > 0 ? pregnantCount / population : 0
  const fertilityBonus = fertilityRate >= 0.08 ? population * fertilityRate * 220 : 0

  return populationScore + maturityScore + cohesionScore + ageScore + vitalityScore + reproScore + fertilityBonus
}

export type LineageFitnessSnapshot = {
  instantScore: number
  population: number
  matureCount: number
  avgAge: number
}

export function lineageFitnessSnapshot(cluster: LineageCluster): LineageFitnessSnapshot {
  const population = cluster.members.length
  let matureCount = 0
  let ageSum = 0

  for (const member of cluster.members) {
    const traits = creatureTraits(member)
    if (member.age >= traits.maturationAge) {
      matureCount += 1
      ageSum += member.age
    }
  }

  return {
    instantScore: scoreLineageInstant(cluster),
    population,
    matureCount,
    avgAge: matureCount > 0 ? ageSum / matureCount : 0,
  }
}

/** Long-running score used to compare lineages across many observations. */
export function lineageTotalFitness(
  cumulativeScore: number,
  peakPopulation: number,
  spanTicks: number,
  lastPopulation: number,
  cumulativePregnancies: number,
  peakPregnant: number,
): number {
  const persistence = spanTicks * (0.08 + lastPopulation * 0.04)
  const peakBonus = peakPopulation * peakPopulation * 45
  const fertilityBonus = cumulativePregnancies * 85 + peakPregnant * peakPregnant * 120
  return cumulativeScore + persistence + peakBonus + fertilityBonus
}
