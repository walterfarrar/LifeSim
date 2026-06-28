import { geneArrayToDna } from '../dnaExport'
import { dnaSimilarity } from '../matePreference'
import type { DNA } from '../dna'
import type { Pathogen } from '../disease/pathogen'

export const PATHOGEN_STRAIN_CLUSTER_SIMILARITY = 0.84
export const PATHOGEN_STRAIN_MATCH_SIMILARITY = 0.8
export const MIN_PATHOGEN_STRAIN_POPULATION = 1

export type PathogenStrainCluster = {
  members: Pathogen[]
  centroid: DNA
}

export function computePathogenCentroidDna(members: readonly Pathogen[]): DNA {
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

export function clusterPathogensIntoStrains(
  pathogens: readonly Pathogen[],
  similarityThreshold = PATHOGEN_STRAIN_CLUSTER_SIMILARITY,
  minPopulation = MIN_PATHOGEN_STRAIN_POPULATION,
): PathogenStrainCluster[] {
  const assigned = new Set<number>()
  const clusters: PathogenStrainCluster[] = []

  for (const seed of pathogens) {
    if (assigned.has(seed.id)) continue

    const members: Pathogen[] = []
    for (const candidate of pathogens) {
      if (assigned.has(candidate.id)) continue
      if (dnaSimilarity(seed.dna, candidate.dna) >= similarityThreshold) {
        members.push(candidate)
        assigned.add(candidate.id)
      }
    }

    if (members.length >= minPopulation) {
      clusters.push({ members, centroid: computePathogenCentroidDna(members) })
    }
  }

  return clusters
}

export function pickPathogenStrainRepresentative(members: readonly Pathogen[]): Pathogen {
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

export function pathogenStrainSimilarity(a: DNA, b: DNA): number {
  return dnaSimilarity(a, b)
}

export type PathogenInfectionStats = {
  infectedCount: number
  severitySum: number
}

export function infectionStatsByPathogenId(
  creatures: readonly { infection?: { pathogenId: number; severity: number } }[],
): Map<number, PathogenInfectionStats> {
  const stats = new Map<number, PathogenInfectionStats>()
  for (const creature of creatures) {
    if (!creature.infection) continue
    const current = stats.get(creature.infection.pathogenId) ?? {
      infectedCount: 0,
      severitySum: 0,
    }
    current.infectedCount += 1
    current.severitySum += creature.infection.severity
    stats.set(creature.infection.pathogenId, current)
  }
  return stats
}

export function clusterInfectionStats(
  cluster: PathogenStrainCluster,
  statsByPathogenId: Map<number, PathogenInfectionStats>,
): PathogenInfectionStats {
  let infectedCount = 0
  let severitySum = 0
  for (const member of cluster.members) {
    const stats = statsByPathogenId.get(member.id)
    if (!stats) continue
    infectedCount += stats.infectedCount
    severitySum += stats.severitySum
  }
  return { infectedCount, severitySum }
}
