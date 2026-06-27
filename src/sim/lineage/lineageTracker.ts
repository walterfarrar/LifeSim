import { geneArrayToDna } from '../dnaExport'
import { dnaToGeneArray } from '../dnaExport'
import type { Creature } from '../types'
import {
  clusterCreaturesIntoLineages,
  lineageSimilarity,
  pickLineageRepresentative,
  type LineageCluster,
} from './lineageCluster'
import { lineageFitnessSnapshot, lineageTotalFitness } from './lineageFitness'

export type TrackedLineage = {
  id: string
  representativeGenes: number[]
  centroidGenes: number[]
  firstSeenTick: number
  lastSeenTick: number
  peakPopulation: number
  lastPopulation: number
  cumulativeScore: number
  observationCount: number
  bestRepresentative: Creature | null
}

let nextLineageId = 1

export class LineageTracker {
  private lineages: TrackedLineage[] = []

  reset(): void {
    this.lineages = []
    nextLineageId = 1
  }

  observe(creatures: readonly Creature[], tick: number): TrackedLineage | null {
    const clusters = clusterCreaturesIntoLineages(creatures)

    for (const cluster of clusters) {
      const tracked = this.matchOrCreate(cluster, tick)
      this.recordObservation(tracked, cluster, tick)
    }

    return this.bestLineage()
  }

  bestLineage(): TrackedLineage | null {
    let best: TrackedLineage | null = null
    let bestFitness = -1

    for (const lineage of this.lineages) {
      const fitness = this.fitnessOf(lineage)
      if (fitness > bestFitness) {
        bestFitness = fitness
        best = lineage
      }
    }

    return best
  }

  fitnessOf(lineage: TrackedLineage): number {
    return lineageTotalFitness(
      lineage.cumulativeScore,
      lineage.peakPopulation,
      lineage.lastSeenTick - lineage.firstSeenTick,
      lineage.lastPopulation,
    )
  }

  private matchOrCreate(cluster: LineageCluster, tick: number): TrackedLineage {
    const centroidGenes = dnaToGeneArray(cluster.centroid)
    let bestMatch: TrackedLineage | null = null
    let bestSimilarity = 0

    for (const lineage of this.lineages) {
      const similarity = lineageSimilarity(cluster.centroid, geneArrayToDna(lineage.centroidGenes))
      if (similarity >= 0.76 && similarity > bestSimilarity) {
        bestSimilarity = similarity
        bestMatch = lineage
      }
    }

    if (bestMatch) {
      bestMatch.centroidGenes = centroidGenes
      return bestMatch
    }

    const created: TrackedLineage = {
      id: `lineage-${nextLineageId++}`,
      representativeGenes: dnaToGeneArray(pickLineageRepresentative(cluster.members).dna),
      centroidGenes,
      firstSeenTick: tick,
      lastSeenTick: tick,
      peakPopulation: cluster.members.length,
      lastPopulation: cluster.members.length,
      cumulativeScore: 0,
      observationCount: 0,
      bestRepresentative: pickLineageRepresentative(cluster.members),
    }
    this.lineages.push(created)
    return created
  }

  private recordObservation(
    lineage: TrackedLineage,
    cluster: LineageCluster,
    tick: number,
  ): void {
    const snapshot = lineageFitnessSnapshot(cluster)
    const representative = pickLineageRepresentative(cluster.members)

    lineage.lastSeenTick = tick
    lineage.lastPopulation = snapshot.population
    lineage.peakPopulation = Math.max(lineage.peakPopulation, snapshot.population)
    lineage.cumulativeScore += snapshot.instantScore
    lineage.observationCount += 1
    lineage.centroidGenes = dnaToGeneArray(cluster.centroid)
    lineage.representativeGenes = dnaToGeneArray(representative.dna)
    lineage.bestRepresentative = representative
  }
}
