import { geneValue } from './dna'
import type { DNA } from './dna'
import { applyInbreedingToTraits } from './inbreeding'
import {
  HerbivoreGene,
  PlantGene,
  type CreatureShape,
  type HerbivoreGeneIndex,
  type HerbivoreTraits,
  type PlantGeneIndex,
  type PlantTraits,
} from './genes'

function shapeFromGene(value: number): CreatureShape {
  if (value < 0.25) return 'round'
  if (value < 0.5) return 'oval'
  if (value < 0.75) return 'square'
  return 'triangle'
}

/** Map raw DNA to expressed traits — keep all balance knobs here. */
export function expressHerbivore(dna: DNA): HerbivoreTraits {
  const g = (gene: HerbivoreGeneIndex) => geneValue(dna, gene)
  const size = g(HerbivoreGene.Size)
  const forageEfficiency = 0.25 + g(HerbivoreGene.ForageEfficiency) * 0.65
  const bitePower = g(HerbivoreGene.BitePower)
  const libido = g(HerbivoreGene.Libido)
  const spaceTolerance = g(HerbivoreGene.SpaceTolerance)
  const aggressiveness = g(HerbivoreGene.Aggressiveness)
  const radius = 3 + size * 7

  return {
    speed: 0.4 + g(HerbivoreGene.Speed) * 2.2,
    radius,
    metabolism: 0.05 + g(HerbivoreGene.Metabolism) * 0.22,
    vision: 35 + g(HerbivoreGene.Vision) * 130,
    reproThreshold: 55 + g(HerbivoreGene.ReproThreshold) * 90,
    maxAge: 800 + g(HerbivoreGene.MaxAge) * 2400,
    forageEfficiency,
    offspringGift: 0.15 + g(HerbivoreGene.OffspringGift) * 0.25,
    hue: g(HerbivoreGene.Hue) * 360,
    saturation: 45 + g(HerbivoreGene.Saturation) * 50,
    lightness: 28 + g(HerbivoreGene.Saturation) * 18,
    shape: shapeFromGene(g(HerbivoreGene.Shape)),
    hungerRatio: 0.35 + g(HerbivoreGene.HungerDrive) * 0.4,
    satietyBuffer: 0.12 + g(HerbivoreGene.SatietyBuffer) * 0.2,
    minSleepEnergyRatio: 0.12 + (1 - g(HerbivoreGene.SleepNeed)) * 0.18,
    sleepFatigueThreshold: 145 - g(HerbivoreGene.SleepNeed) * 85,
    awakeFatigueGain: 0.2 + g(HerbivoreGene.FatigueRate) * 0.45,
    sleepFatigueRecovery: 1.0 + g(HerbivoreGene.SleepRecovery) * 2.0,
    sleepEnergyRecovery: 0.05 + g(HerbivoreGene.SleepRecovery) * 0.18,
    libido,
    maturationAge: 30 + g(HerbivoreGene.Maturation) * 110,
    pregnancyTicks: 80 + g(HerbivoreGene.Gestation) * 180,
    maxEnergy: 110 + g(HerbivoreGene.MaxEnergy) * 90,
    reproCooldown: 60 + g(HerbivoreGene.ReproCooldown) * 180,
    mateRange: 8 + g(HerbivoreGene.MateRange) * 16,
    sleepMobility: 0.2 + g(HerbivoreGene.SleepMobility) * 0.55,
    sleepMetabolismScale: 0.25 + g(HerbivoreGene.SleepMetabolism) * 0.55,
    biteAmount: 4 + bitePower * 16 + forageEfficiency * 14,
    forageReach: 1 + g(HerbivoreGene.ForageReach) * 7,
    modeCommitment: 20 + g(HerbivoreGene.ModeCommitment) * 50,
    wanderDurationMin: 30 + g(HerbivoreGene.Wanderlust) * 40,
    wanderDurationSpan: 30 + g(HerbivoreGene.Wanderlust) * 90,
    exploreVisionMult: 1.2 + g(HerbivoreGene.ExploreVision) * 2.0,
    birthEnergyReserve: 0.12 + g(HerbivoreGene.BirthReserve) * 0.35,
    mateLibidoFactor: 0.15 + libido * 0.2,
    stopDistance: 0.8 + size * 1.4,
    preferHue: g(HerbivoreGene.PreferredHue) * 360,
    preferSize: g(HerbivoreGene.PreferredSize),
    preferSpeed: g(HerbivoreGene.PreferredSpeed),
    mateSelectivity: g(HerbivoreGene.MateSelectivity),
    geneticAssortment: g(HerbivoreGene.GeneticAssortment),
    matePreferenceStrength: 0.25 + g(HerbivoreGene.MateSelectivity) * 0.7,
    spaceTolerance,
    personalSpace: radius + 6 + (1 - spaceTolerance) * 52,
    aggressiveness,
    attackDamage: 3 + aggressiveness * 10 + size * 5 + bitePower * 4,
    attackRange: radius + 2 + g(HerbivoreGene.ForageReach) * 2,
    mutationRate: 0.00035 + g(HerbivoreGene.MutationRate) * 0.0115,
    mutationAmount: 1 + Math.floor(g(HerbivoreGene.MutationAmount) * 7),
    cannibalPredilection: g(HerbivoreGene.CannibalPredilection),
    plantHardinessBreak: 0.2 + g(HerbivoreGene.PlantHardiness) * 1.15,
    plantForageSelectivity: g(HerbivoreGene.PlantForageSelectivity),
    diseaseResistance: g(HerbivoreGene.DiseaseResistance),
    diseaseRecovery: g(HerbivoreGene.DiseaseRecovery),
    inbreedingTolerance: g(HerbivoreGene.InbreedingTolerance),
    contagion: g(HerbivoreGene.Contagion),
    courtshipEagerness: 0.12 + g(HerbivoreGene.CourtshipEagerness) * 0.58,
    closeMateLeniency: 0.15 + g(HerbivoreGene.CloseMateLeniency) * 0.7,
    cohesion: g(HerbivoreGene.Cohesion),
  }
}

/** Traits after inbreeding depression from birth. */
export function expressCreatureTraits(dna: DNA, inbreedingLoad = 0): HerbivoreTraits {
  return applyInbreedingToTraits(expressHerbivore(dna), inbreedingLoad)
}

/** Sex is expressed from DNA at creation time. */
export function expressSex(dna: DNA): 'male' | 'female' {
  return geneValue(dna, HerbivoreGene.SexExpression) > 0.5 ? 'female' : 'male'
}

/** Map plant DNA to growth, spread, color, and reproduction traits. */
export function expressPlant(dna: DNA): PlantTraits {
  const g = (gene: PlantGeneIndex) => geneValue(dna, gene)
  const maxEnergy = 35 + g(PlantGene.MaxEnergy) * 55

  return {
    greenHue: 78 + g(PlantGene.GreenHue) * 82,
    saturation: 32 + g(PlantGene.Saturation) * 58,
    lightness: 20 + g(PlantGene.Lightness) * 30,
    maxEnergy,
    growthRate: 0.28 + g(PlantGene.GrowthRate) * 0.92,
    spreadMin: 14 + g(PlantGene.SpreadMin) * 55,
    spreadMax: 55 + g(PlantGene.SpreadMax) * 110,
    maturationAge: 60 + g(PlantGene.Maturation) * 420,
    spreadAgeBonus: 80 + g(PlantGene.SpreadMax) * 180,
    reproductionRate: 0.45 + g(PlantGene.Reproduction) * 1.55,
    baseRadius: 2.5 + g(PlantGene.BaseRadius) * 4.5,
    radiusEnergyScale: 2.5 + g(PlantGene.BaseRadius) * 6,
    mutationRate: 0.0008 + g(PlantGene.MutationRate) * 0.018,
    mutationAmount: 1 + Math.floor(g(PlantGene.MutationAmount) * 8),
    hardiness: g(PlantGene.Hardiness),
  }
}

export function plantFillStyle(plant: { energy: number; dna: DNA }): string {
  const traits = expressPlant(plant.dna)
  const energyRatio = Math.min(1, plant.energy / traits.maxEnergy)
  const lightness = traits.lightness + energyRatio * 24
  const saturation = traits.saturation + energyRatio * 12
  return `hsl(${traits.greenHue.toFixed(1)}, ${saturation.toFixed(1)}%, ${lightness.toFixed(1)}%)`
}
