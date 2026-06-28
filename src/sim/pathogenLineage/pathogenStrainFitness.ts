import { pathogenTraits } from '../disease/pathogen'
import type { PathogenStrainCluster } from './pathogenStrainCluster'
import { clusterInfectionStats, type PathogenInfectionStats } from './pathogenStrainCluster'

export function scorePathogenStrainInstant(
  cluster: PathogenStrainCluster,
  infectionStats: PathogenInfectionStats,
): number {
  const { infectedCount, severitySum } = infectionStats
  if (infectedCount === 0 && cluster.members.length === 0) return 0

  let maxGeneration = 0
  for (const member of cluster.members) {
    maxGeneration = Math.max(maxGeneration, member.generation)
  }

  const avgSeverity = infectedCount > 0 ? severitySum / infectedCount : 0
  const strainTraits = pathogenTraits(cluster.members[0])

  return (
    infectedCount * 620 +
    severitySum * 280 +
    cluster.members.length * 90 +
    maxGeneration * 45 +
    strainTraits.virulence * infectedCount * 180 +
    strainTraits.transmissibility * infectedCount * 140 +
    avgSeverity * infectedCount * 120
  )
}

export type PathogenStrainFitnessSnapshot = {
  instantScore: number
  infectedCount: number
  severitySum: number
  strainCount: number
}

export function pathogenStrainFitnessSnapshot(
  cluster: PathogenStrainCluster,
  statsByPathogenId: Map<number, { infectedCount: number; severitySum: number }>,
): PathogenStrainFitnessSnapshot {
  const infectionStats = clusterInfectionStats(cluster, statsByPathogenId)
  return {
    instantScore: scorePathogenStrainInstant(cluster, infectionStats),
    infectedCount: infectionStats.infectedCount,
    severitySum: infectionStats.severitySum,
    strainCount: cluster.members.length,
  }
}

export function pathogenStrainTotalFitness(
  cumulativeScore: number,
  peakInfected: number,
  spanTicks: number,
  lastInfected: number,
  peakStrainCount: number,
): number {
  const persistence = spanTicks * (0.05 + lastInfected * 0.04)
  const peakBonus = peakInfected * peakInfected * 55
  const diversityBonus = peakStrainCount * peakStrainCount * 30
  return cumulativeScore + persistence + peakBonus + diversityBonus
}
