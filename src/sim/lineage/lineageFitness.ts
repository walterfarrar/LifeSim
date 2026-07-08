import { TICKS_PER_SECOND } from '../config'
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

export type LineageCrownStats = {
  /** Mean instant vigor across every observation (cumulativeScore / observationCount). */
  avgInstantScore: number
  /** Mean population across every observation — sustained size, not a momentary peak. */
  avgPopulation: number
  /** Population at the most recent observation. */
  lastPopulation: number
  /** Highest population ever seen for this lineage. */
  peakPopulation: number
  /** Ticks between first and last observation — how long the lineage actually lasted. */
  spanTicks: number
  /** How many times this lineage has been sampled. */
  observationCount: number
  /** Most pregnancies seen at once. */
  peakPregnant: number
  /** Total pregnancies counted across all observations. */
  cumulativePregnancies: number
}

/**
 * A lineage must be observed at least this many times before it can be crowned.
 * Crowning on the first sighting lets a champion appear quickly (within one check
 * interval) so respawn/evolution can bootstrap from real DNA instead of random founders.
 * Sustained lineages still dominate — their score climbs steeply with survival time.
 */
export const MIN_OBSERVATIONS_TO_CROWN = 1

/**
 * Crown fitness rewards a lineage that *survives the best*: population and vigor sustained
 * over time, kept self-sustaining by reproduction. A single-snapshot lineage scores on its
 * instant vigor and size alone (no longevity bonus yet); a momentary peak is only a minor
 * linear tiebreak (never squared), so it is easily overtaken once a lineage proves it lasts.
 */
export function lineageCrownFitness(stats: LineageCrownStats): number {
  if (stats.observationCount < MIN_OBSERVATIONS_TO_CROWN || stats.spanTicks < 0) {
    return 0
  }

  const survivalMinutes = stats.spanTicks / (TICKS_PER_SECOND * 60)

  // Longevity is the backbone: every surviving minute multiplies sustained strength.
  const longevityMultiplier = 1 + survivalMinutes
  const sustainedScore = stats.avgInstantScore * longevityMultiplier

  // Population held *over time*, not a single peak frame.
  const sustainedPopulationBonus = stats.avgPopulation * survivalMinutes * 60

  // Self-sustaining reproduction across the whole life of the lineage.
  const reproductionBonus = stats.cumulativePregnancies * 10

  // Still thriving at save time matters; raw peak is only a small linear nudge.
  const stillAliveBonus = stats.lastPopulation * 40
  const peakBonus = stats.peakPopulation * 20

  return (
    sustainedScore +
    sustainedPopulationBonus +
    reproductionBonus +
    stillAliveBonus +
    peakBonus
  )
}
