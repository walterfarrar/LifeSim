import { geneArrayToDna } from '../dnaExport'
import { dnaSimilarity } from '../matePreference'
import type { DNA } from '../dna'
import type { Creature } from '../types'

export const LINEAGE_CLUSTER_SIMILARITY = 0.8
export const LINEAGE_MATCH_SIMILARITY = 0.76
export const MIN_LINEAGE_POPULATION = 2

export type LineageCluster = {
  members: Creature[]
  centroid: DNA
}

export function computeCentroidDna(members: readonly Creature[]): DNA {
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

/** Greedy DNA clusters — members are alike enough to count as one lineage. */
export function clusterCreaturesIntoLineages(
  creatures: readonly Creature[],
  similarityThreshold = LINEAGE_CLUSTER_SIMILARITY,
  minPopulation = MIN_LINEAGE_POPULATION,
): LineageCluster[] {
  const assigned = new Set<number>()
  const clusters: LineageCluster[] = []

  for (const seed of creatures) {
    if (assigned.has(seed.id)) continue

    const members: Creature[] = []
    for (const candidate of creatures) {
      if (assigned.has(candidate.id)) continue
      if (dnaSimilarity(seed.dna, candidate.dna) >= similarityThreshold) {
        members.push(candidate)
        assigned.add(candidate.id)
      }
    }

    if (members.length >= minPopulation) {
      clusters.push({ members, centroid: computeCentroidDna(members) })
    }
  }

  return clusters
}

/** Most typical member — highest mean similarity to cluster mates (medoid). */
export function pickLineageRepresentative(members: readonly Creature[]): Creature {
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

export function lineageSimilarity(a: DNA, b: DNA): number {
  return dnaSimilarity(a, b)
}
