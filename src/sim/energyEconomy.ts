import type { Corpse, Creature, Plant } from './types'

/** Share of plant biomass converted to usable creature energy (rest is waste heat). */
export const PLANT_TROPHIC_EFFICIENCY = 0.34

/** Scavenging a corpse — second-hand energy, lower yield. */
export const CORPSE_TROPHIC_EFFICIENCY = 0.17

/** Hunting live prey — costly, lowest yield. */
export const PREDATION_TROPHIC_EFFICIENCY = 0.11

export interface EnergyBreakdown {
  total: number
  plants: number
  creatures: number
  corpses: number
}

export interface WorldEnergyTotals extends EnergyBreakdown {
  /** Energy entering the world this tick via photosynthesis (plant growth only). */
  primaryProduction: number
}

export function energyFromPlantBiomass(rawBiomass: number, forageEfficiency: number): number {
  const digestibility = 0.55 + forageEfficiency * 0.45
  return rawBiomass * PLANT_TROPHIC_EFFICIENCY * digestibility
}

export function energyFromCorpseBiomass(rawBiomass: number, forageEfficiency: number): number {
  const digestibility = 0.6 + forageEfficiency * 0.35
  return rawBiomass * CORPSE_TROPHIC_EFFICIENCY * digestibility
}

export function energyFromPreyBiomass(rawBiomass: number, forageEfficiency: number): number {
  const digestibility = 0.55 + forageEfficiency * 0.35
  return rawBiomass * PREDATION_TROPHIC_EFFICIENCY * digestibility
}

export function sumEntityEnergy(
  plants: readonly Plant[],
  creatures: readonly Creature[],
  corpses: readonly Corpse[],
): EnergyBreakdown {
  let plantEnergy = 0
  for (const plant of plants) {
    plantEnergy += plant.energy
  }

  let creatureEnergy = 0
  for (const creature of creatures) {
    creatureEnergy += creature.energy
  }

  let corpseEnergy = 0
  for (const corpse of corpses) {
    corpseEnergy += corpse.energy
  }

  return {
    plants: plantEnergy,
    creatures: creatureEnergy,
    corpses: corpseEnergy,
    total: plantEnergy + creatureEnergy + corpseEnergy,
  }
}
