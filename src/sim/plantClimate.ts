import type { DNA } from './dna'
import { PlantGene } from './genes'
import { expressPlant } from './phenotype'
import { plantKindFromDna, type PlantKind } from './plantKinds'
import type { SeasonName } from './seasons'

/** Fixed climate genes per lineage — not in the budget pool. */
export const PLANT_KIND_CLIMATE: Record<
  PlantKind,
  Partial<Record<(typeof PlantGene)[keyof typeof PlantGene], number>>
> = {
  /** Warm-season turf — lush in summer, dormant (not dying) in winter. */
  grass: {
    [PlantGene.MoistureNeed]: 64,
    [PlantGene.TempPreference]: 150,
    [PlantGene.TempGrowthRange]: 155,
    [PlantGene.TempSurvivalRange]: 252,
  },
  /** Deciduous shrub — active spring–autumn, sleeps in winter. */
  bush: {
    [PlantGene.MoistureNeed]: 74,
    [PlantGene.TempPreference]: 118,
    [PlantGene.TempGrowthRange]: 138,
    [PlantGene.TempSurvivalRange]: 235,
  },
  /** Conifer tree — cold-hardy, grows spring–autumn, tolerates heat/cold without stress bleed. */
  tree: {
    [PlantGene.MoistureNeed]: 78,
    [PlantGene.TempPreference]: 82,
    [PlantGene.TempGrowthRange]: 215,
    [PlantGene.TempSurvivalRange]: 252,
    [PlantGene.Hardiness]: 242,
  },
}

export function applyPlantKindClimate(dna: DNA, kind: PlantKind): void {
  const climate = PLANT_KIND_CLIMATE[kind]
  for (const [geneKey, value] of Object.entries(climate)) {
    dna[Number(geneKey)] = value
  }
}

/** Grass and deciduous bushes stop growing in the cold but do not take winter stress damage. */
export function isPlantDormant(dna: DNA, season: SeasonName, temperature: number): boolean {
  const kind = plantKindFromDna(dna)
  const traits = expressPlant(dna)

  if (kind === 'grass') {
    if (season === 'winter') return true
    // Cold or hot — crown quiescent, not dying.
    if (temperature <= traits.idealTemp - traits.tempGrowthHalfWidth) return true
    if (temperature >= traits.idealTemp + traits.tempGrowthHalfWidth * 0.82) return true
    return false
  }

  if (kind === 'bush') {
    if (season === 'winter') return true
    if (season === 'autumn' && temperature < traits.idealTemp - traits.tempGrowthHalfWidth * 0.48) {
      return true
    }
    return false
  }

  return false
}

/** Conifers stay evergreen but grow slowly off-peak. Grass surges in summer. */
export function plantSeasonalGrowthScale(kind: PlantKind, season: SeasonName, dormant: boolean): number {
  if (dormant) return 0
  if (kind === 'grass') {
    switch (season) {
      case 'summer':
        return 2.8
      case 'spring':
        return 1.45
      case 'autumn':
        return 0.65
      case 'winter':
        return 0
    }
  }
  if (kind === 'bush') {
    switch (season) {
      case 'spring':
        return 1.35
      case 'summer':
        return 1.15
      case 'autumn':
        return 0.82
      case 'winter':
        return 0
    }
  }
  if (kind !== 'tree') return 1
  switch (season) {
    case 'summer':
      return 1
    case 'spring':
    case 'autumn':
      return 0.72
    case 'winter':
      return 0.22
  }
}

/** Extra reproduction and outward reach during peak grass season. */
export function plantSeasonalSpreadScale(kind: PlantKind, season: SeasonName): number {
  if (kind === 'grass') {
    switch (season) {
      case 'summer':
        return 2.2
      case 'spring':
        return 1.35
      case 'autumn':
        return 0.55
      case 'winter':
        return 0
    }
  }
  if (kind === 'bush') {
    switch (season) {
      case 'spring':
        return 1.4
      case 'summer':
        return 1.2
      case 'autumn':
        return 0.75
      case 'winter':
        return 0
    }
  }
  return 1
}

export function plantSeasonalReproductionScale(kind: PlantKind, season: SeasonName): number {
  if (kind === 'grass') {
    switch (season) {
      case 'summer':
        return 3.2
      case 'spring':
        return 2.2
      case 'autumn':
        return 0.45
      case 'winter':
        return 0
    }
  }
  if (kind === 'bush') {
    switch (season) {
      case 'spring':
        return 1.55
      case 'summer':
        return 1.35
      case 'autumn':
        return 0.85
      case 'winter':
        return 0
    }
  }
  if (kind === 'tree') {
    switch (season) {
      case 'summer':
        return 0.82
      case 'spring':
      case 'autumn':
        return 1
      case 'winter':
        return 0.28
    }
  }
  return 1
}
