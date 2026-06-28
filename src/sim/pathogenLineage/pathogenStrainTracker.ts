import { geneArrayToDna } from '../dnaExport'
import { dnaToGeneArray } from '../dnaExport'
import type { Creature } from '../types'
import type { Pathogen } from '../disease/pathogen'
import {
  clusterPathogensIntoStrains,
  infectionStatsByPathogenId,
  pathogenStrainSimilarity,
  pickPathogenStrainRepresentative,
  type PathogenStrainCluster,
} from './pathogenStrainCluster'
import {
  pathogenStrainFitnessSnapshot,
  pathogenStrainTotalFitness,
} from './pathogenStrainFitness'

export type TrackedPathogenStrain = {
  id: string
  representativeGenes: number[]
  centroidGenes: number[]
  firstSeenTick: number
  lastSeenTick: number
  peakInfected: number
  lastInfected: number
  peakStrainCount: number
  cumulativeScore: number
  observationCount: number
  bestRepresentative: Pathogen | null
}

let nextStrainId = 1

export class PathogenStrainTracker {
  private strains: TrackedPathogenStrain[] = []

  reset(): void {
    this.strains = []
    nextStrainId = 1
  }

  observe(
    pathogens: readonly Pathogen[],
    creatures: readonly Creature[],
    tick: number,
  ): TrackedPathogenStrain | null {
    const infectionStats = infectionStatsByPathogenId(creatures)
    const clusters = clusterPathogensIntoStrains(pathogens)

    for (const cluster of clusters) {
      const stats = pathogenStrainFitnessSnapshot(cluster, infectionStats)
      if (stats.infectedCount === 0 && stats.instantScore <= 0) continue

      const tracked = this.matchOrCreate(cluster, tick)
      this.recordObservation(tracked, cluster, stats, tick)
    }

    return this.bestStrain()
  }

  bestStrain(): TrackedPathogenStrain | null {
    let best: TrackedPathogenStrain | null = null
    let bestFitness = -1

    for (const strain of this.strains) {
      const fitness = this.fitnessOf(strain)
      if (fitness > bestFitness) {
        bestFitness = fitness
        best = strain
      }
    }

    return best
  }

  fitnessOf(strain: TrackedPathogenStrain): number {
    return pathogenStrainTotalFitness(
      strain.cumulativeScore,
      strain.peakInfected,
      strain.lastSeenTick - strain.firstSeenTick,
      strain.lastInfected,
      strain.peakStrainCount,
    )
  }

  private matchOrCreate(cluster: PathogenStrainCluster, tick: number): TrackedPathogenStrain {
    const centroidGenes = dnaToGeneArray(cluster.centroid)
    let bestMatch: TrackedPathogenStrain | null = null
    let bestSimilarity = 0

    for (const strain of this.strains) {
      const similarity = pathogenStrainSimilarity(
        cluster.centroid,
        geneArrayToDna(strain.centroidGenes),
      )
      if (similarity >= 0.8 && similarity > bestSimilarity) {
        bestSimilarity = similarity
        bestMatch = strain
      }
    }

    if (bestMatch) {
      bestMatch.centroidGenes = centroidGenes
      return bestMatch
    }

    const created: TrackedPathogenStrain = {
      id: `pathogen-strain-${nextStrainId++}`,
      representativeGenes: dnaToGeneArray(pickPathogenStrainRepresentative(cluster.members).dna),
      centroidGenes,
      firstSeenTick: tick,
      lastSeenTick: tick,
      peakInfected: 0,
      lastInfected: 0,
      peakStrainCount: cluster.members.length,
      cumulativeScore: 0,
      observationCount: 0,
      bestRepresentative: pickPathogenStrainRepresentative(cluster.members),
    }
    this.strains.push(created)
    return created
  }

  private recordObservation(
    strain: TrackedPathogenStrain,
    cluster: PathogenStrainCluster,
    snapshot: ReturnType<typeof pathogenStrainFitnessSnapshot>,
    tick: number,
  ): void {
    const representative = pickPathogenStrainRepresentative(cluster.members)

    strain.lastSeenTick = tick
    strain.lastInfected = snapshot.infectedCount
    strain.peakInfected = Math.max(strain.peakInfected, snapshot.infectedCount)
    strain.peakStrainCount = Math.max(strain.peakStrainCount, snapshot.strainCount)
    strain.cumulativeScore += snapshot.instantScore
    strain.observationCount += 1
    strain.centroidGenes = dnaToGeneArray(cluster.centroid)
    strain.representativeGenes = dnaToGeneArray(representative.dna)
    strain.bestRepresentative = representative
  }
}
