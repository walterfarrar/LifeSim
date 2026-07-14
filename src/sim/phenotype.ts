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
import { PLANT_KIND_TRAIT_SCALE, plantKindFromDna } from './plantKinds'
import { TICKS_PER_YEAR, daysToTicks, hoursToTicks } from './timeScale'

function shapeFromGene(value: number): CreatureShape {
  if (value < 0.25) return 'round'
  if (value < 0.5) return 'oval'
  if (value < 0.75) return 'square'
  return 'triangle'
}

/**
 * Soft senescence frailty: 0 until the MaxAge gene “prime”, then ramps toward 1.
 * No hard death — raises metabolism / thirst / disease vulnerability only.
 */
export function senescenceFrailty(age: number, primeTicks: number): number {
  if (primeTicks <= 0 || age <= primeTicks) return 0
  const ramp = Math.max(primeTicks, TICKS_PER_YEAR)
  return Math.min(1, (age - primeTicks) / ramp)
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
    /**
     * px/tick (= px/min). Floor raised after the calendar refactor so even slow genotypes
     * can usually reach a pond shore before thirst death on the default map.
     */
    speed: 0.6 + g(HerbivoreGene.Speed) * 2.5,
    radius,
    /** Per-minute burn — mid genes empty a ~155 tank over roughly a day–night with some eating. */
    metabolism: 0.035 + g(HerbivoreGene.Metabolism) * 0.14,
    vision: 35 + g(HerbivoreGene.Vision) * 130,
    reproThreshold: 55 + g(HerbivoreGene.ReproThreshold) * 90,
    /** Soft senescence prime (~2 months – ~4 years); not a hard lifespan ceiling. */
    maxAge: daysToTicks(60) + g(HerbivoreGene.MaxAge) * (daysToTicks(365 * 4) - daysToTicks(60)),
    forageEfficiency,
    offspringGift: 0.15 + g(HerbivoreGene.OffspringGift) * 0.25,
    hue: g(HerbivoreGene.Hue) * 360,
    saturation: 45 + g(HerbivoreGene.Saturation) * 50,
    lightness: 28 + g(HerbivoreGene.Saturation) * 18,
    shape: shapeFromGene(g(HerbivoreGene.Shape)),
    hungerRatio: 0.35 + g(HerbivoreGene.HungerDrive) * 0.4,
    /** Thirst enter line — between hunger-aligned (35–75%) and the lenient 18–32% band. */
    thirstRatio: 0.26 + g(HerbivoreGene.HungerDrive) * 0.27,
    satietyBuffer: 0.12 + g(HerbivoreGene.SatietyBuffer) * 0.2,
    minSleepEnergyRatio: 0.12 + (1 - g(HerbivoreGene.SleepNeed)) * 0.18,
    sleepFatigueThreshold: 145 - g(HerbivoreGene.SleepNeed) * 85,
    /** Full day of activity before sleep for mid genes (~16–22h awake). */
    awakeFatigueGain: 0.04 + g(HerbivoreGene.FatigueRate) * 0.08,
    /** Several hours of sleep to clear a day’s fatigue. */
    sleepFatigueRecovery: 0.25 + g(HerbivoreGene.SleepRecovery) * 0.55,
    sleepEnergyRecovery: 0.02 + g(HerbivoreGene.SleepRecovery) * 0.08,
    libido,
    /** ~2 weeks – ~6 months. */
    maturationAge: daysToTicks(14) + g(HerbivoreGene.Maturation) * daysToTicks(166),
    /** ~7–40 days. */
    pregnancyTicks: daysToTicks(7) + g(HerbivoreGene.Gestation) * daysToTicks(33),
    maxEnergy: 110 + g(HerbivoreGene.MaxEnergy) * 90,
    /** ~one soil tile of water (7–13); kept on MaxEnergy so larger bodies still hold a bit more. */
    maxHydration: 7 + g(HerbivoreGene.MaxEnergy) * 6,
    /** Scaled with the small tank so lifetime-to-thirst stays roughly one waking day mid-gene. */
    thirstDehydration: 0.004 + g(HerbivoreGene.Metabolism) * 0.012,
    /** ~3–20 days. */
    reproCooldown: daysToTicks(3) + g(HerbivoreGene.ReproCooldown) * daysToTicks(17),
    mateRange: 8 + g(HerbivoreGene.MateRange) * 16,
    sleepMobility: 0.2 + g(HerbivoreGene.SleepMobility) * 0.55,
    sleepMetabolismScale: 0.25 + g(HerbivoreGene.SleepMetabolism) * 0.55,
    biteAmount: 4 + bitePower * 16 + forageEfficiency * 14,
    forageReach: 1 + g(HerbivoreGene.ForageReach) * 7,
    /** Tens of minutes–a few hours of mode stickiness (long enough to finish a task, short enough to escape danger). */
    modeCommitment: hoursToTicks(0.2) + g(HerbivoreGene.ModeCommitment) * hoursToTicks(2.8),
    wanderDurationMin: hoursToTicks(0.5) + g(HerbivoreGene.Wanderlust) * hoursToTicks(5),
    wanderDurationSpan: hoursToTicks(1) + g(HerbivoreGene.Wanderlust) * hoursToTicks(10),
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
    /** Low WaterSource gene → pond; high → grass dew and plant tissue water. */
    forageWaterPreference: g(HerbivoreGene.WaterSource),
    soilDrinking: 0,
    pondDrinking: 1 - g(HerbivoreGene.WaterSource),
    memorySlots: Math.floor(g(HerbivoreGene.Memory) * 6.5),
    memoryDecay: 0.00002 * (1.3 - g(HerbivoreGene.Memory) * 0.95),
    memoryRecall: 0.06 + g(HerbivoreGene.Memory) * 0.9,
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
const plantTraitsByDna = new WeakMap<DNA, PlantTraits>()

export function expressPlant(dna: DNA): PlantTraits {
  const cached = plantTraitsByDna.get(dna)
  if (cached) return cached

  const g = (gene: PlantGeneIndex) => geneValue(dna, gene)
  const maxEnergy = 35 + g(PlantGene.MaxEnergy) * 55
  const kind = plantKindFromDna(dna)
  const scale = PLANT_KIND_TRAIT_SCALE[kind]

  const traits: PlantTraits = {
    greenHue: 78 + g(PlantGene.GreenHue) * 82,
    saturation: 32 + g(PlantGene.Saturation) * 58,
    lightness: 20 + g(PlantGene.Lightness) * 30,
    maxEnergy: maxEnergy * scale.maxEnergy,
    /**
     * Photosynthetic refill per minute — supports grazing herds: mid genes refill a tank in
     * a few hours; kind scales differentiate grass vs woody leafiness.
     */
    growthRate: (0.04 + g(PlantGene.GrowthRate) * 0.12) * scale.growthRate,
    spreadMin: (14 + g(PlantGene.SpreadMin) * 55) * scale.spread,
    spreadMax: (55 + g(PlantGene.SpreadMax) * 110) * scale.spread,
    /** Woody: months–years; grass kind scale brings this down to days–months. */
    maturationAge: (daysToTicks(20) + g(PlantGene.Maturation) * daysToTicks(700)) * scale.maturation,
    spreadAgeBonus: (daysToTicks(10) + g(PlantGene.SpreadMax) * daysToTicks(120)) * scale.spread,
    /** Seed/vegetative reproduction attempts — hours–days scale, kind-multiplied. */
    reproductionRate: (0.0008 + g(PlantGene.Reproduction) * 0.0035) * scale.reproduction,
    baseRadius: (2.5 + g(PlantGene.BaseRadius) * 4.5) * scale.radius,
    radiusEnergyScale: (2.5 + g(PlantGene.BaseRadius) * 6) * scale.radiusEnergy,
    mutationRate: 0.0008 + g(PlantGene.MutationRate) * 0.018,
    mutationAmount: 1 + Math.floor(g(PlantGene.MutationAmount) * 8),
    hardiness: g(PlantGene.Hardiness),
    moistureNeed: g(PlantGene.MoistureNeed),
    /** Ecological hard ceiling: years–decades after kind lifespan scale. */
    maxAge:
      (daysToTicks(120) +
        g(PlantGene.Maturation) * daysToTicks(365 * 12) +
        g(PlantGene.Hardiness) * daysToTicks(365 * 8)) *
      scale.lifespan,
    idealTemp: 4 + g(PlantGene.TempPreference) * 32,
    tempGrowthHalfWidth: 2 + g(PlantGene.TempGrowthRange) * 14,
    tempSurvivalHalfWidth:
      2 +
      g(PlantGene.TempGrowthRange) * 14 +
      1 +
      g(PlantGene.TempSurvivalRange) * 12,
  }
  plantTraitsByDna.set(dna, traits)
  return traits
}

export function plantFillStyle(
  plant: { energy: number; dna: DNA },
  moistureFactor = 1,
  tempComfort = 1,
): string {
  const traits = expressPlant(plant.dna)
  const energyRatio = Math.min(1, plant.energy / traits.maxEnergy)
  const wilt = Math.max(0, 1 - Math.min(moistureFactor, tempComfort))
  const lightness = traits.lightness + energyRatio * 24 - wilt * 16
  const saturation = traits.saturation + energyRatio * 12 - wilt * 10
  const hueShift = tempComfort < 0.45 ? wilt * 18 : 0
  return `hsl(${(traits.greenHue + hueShift).toFixed(1)}, ${Math.max(8, saturation).toFixed(1)}%, ${Math.max(8, lightness).toFixed(1)}%)`
}
