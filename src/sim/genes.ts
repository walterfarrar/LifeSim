/** Herbivore genome layout — add species-specific gene maps later. */
export const HERBIVORE_GENE_COUNT = 53

export const HerbivoreGene = {
  Speed: 0,
  Size: 1,
  Metabolism: 2,
  Vision: 3,
  ReproThreshold: 4,
  MaxAge: 5,
  ForageEfficiency: 6,
  OffspringGift: 7,
  Hue: 8,
  Saturation: 9,
  Shape: 10,
  HungerDrive: 11,
  SleepNeed: 12,
  FatigueRate: 13,
  SleepRecovery: 14,
  Libido: 15,
  SatietyBuffer: 16,
  MaxEnergy: 17,
  ReproCooldown: 18,
  MateRange: 19,
  SleepMobility: 20,
  SleepMetabolism: 21,
  BitePower: 22,
  ForageReach: 23,
  ModeCommitment: 24,
  Wanderlust: 25,
  ExploreVision: 26,
  Maturation: 27,
  Gestation: 28,
  BirthReserve: 29,
  SexExpression: 30,
  PreferredHue: 31,
  PreferredSize: 32,
  PreferredSpeed: 33,
  MateSelectivity: 34,
  GeneticAssortment: 35,
  SpaceTolerance: 36,
  Aggressiveness: 37,
  MutationRate: 38,
  MutationAmount: 39,
  CannibalPredilection: 40,
  PlantHardiness: 41,
  PlantForageSelectivity: 42,
  BodyElongation: 43,
  BodySpikiness: 44,
  BodyMarking: 45,
  DiseaseResistance: 46,
  DiseaseRecovery: 47,
  InbreedingTolerance: 48,
  Contagion: 49,
  /** How soon after leaving “hungry” the creature enters horny mode (0 = at hungry line, 1 = at full satiety). */
  CourtshipEagerness: 50,
  /** Willingness multiplier on mate pickiness when already within physical mate reach. */
  CloseMateLeniency: 51,
  /** Pull toward nearby genetically similar creatures (group cohesion). */
  Cohesion: 52,
} as const

/** Mid gene values ≈ former hardcoded sim defaults (0.38 courtship, 0.45 close leniency). */
export const DEFAULT_COURTSHIP_EAGERNESS_GENE = 115
export const DEFAULT_CLOSE_MATE_LENIENCY_GENE = 110
export const DEFAULT_COHESION_GENE = 110

export type HerbivoreGeneIndex = (typeof HerbivoreGene)[keyof typeof HerbivoreGene]

/** Plant genome — color, growth, and spread are all heritable. */
export const PLANT_GENE_COUNT = 15

export const PlantGene = {
  GreenHue: 0,
  Saturation: 1,
  Lightness: 2,
  MaxEnergy: 3,
  GrowthRate: 4,
  SpreadMin: 5,
  SpreadMax: 6,
  Maturation: 7,
  Reproduction: 8,
  BaseRadius: 9,
  MutationRate: 10,
  MutationAmount: 11,
  Hardiness: 12,
  LeafLobes: 13,
  LeafPointiness: 14,
} as const

export type PlantGeneIndex = (typeof PlantGene)[keyof typeof PlantGene]

export type PlantTraits = {
  greenHue: number
  saturation: number
  lightness: number
  maxEnergy: number
  growthRate: number
  spreadMin: number
  spreadMax: number
  maturationAge: number
  spreadAgeBonus: number
  reproductionRate: number
  baseRadius: number
  radiusEnergyScale: number
  mutationRate: number
  mutationAmount: number
  hardiness: number
}

export type CreatureShape = 'round' | 'oval' | 'square' | 'triangle'

export type HerbivoreTraits = {
  speed: number
  radius: number
  metabolism: number
  vision: number
  reproThreshold: number
  maxAge: number
  forageEfficiency: number
  offspringGift: number
  hue: number
  saturation: number
  lightness: number
  shape: CreatureShape
  hungerRatio: number
  satietyBuffer: number
  minSleepEnergyRatio: number
  sleepFatigueThreshold: number
  awakeFatigueGain: number
  sleepFatigueRecovery: number
  sleepEnergyRecovery: number
  libido: number
  maturationAge: number
  pregnancyTicks: number
  maxEnergy: number
  reproCooldown: number
  mateRange: number
  sleepMobility: number
  sleepMetabolismScale: number
  biteAmount: number
  forageReach: number
  modeCommitment: number
  wanderDurationMin: number
  wanderDurationSpan: number
  exploreVisionMult: number
  birthEnergyReserve: number
  mateLibidoFactor: number
  stopDistance: number
  preferHue: number
  preferSize: number
  preferSpeed: number
  mateSelectivity: number
  geneticAssortment: number
  matePreferenceStrength: number
  spaceTolerance: number
  personalSpace: number
  aggressiveness: number
  attackDamage: number
  attackRange: number
  mutationRate: number
  mutationAmount: number
  cannibalPredilection: number
  plantHardinessBreak: number
  plantForageSelectivity: number
  diseaseResistance: number
  diseaseRecovery: number
  inbreedingTolerance: number
  contagion: number
  courtshipEagerness: number
  closeMateLeniency: number
  cohesion: number
}

/** Pathogen genome — antigens and transmission traits are heritable. */
export const PATHOGEN_GENE_COUNT = 5

export const PathogenGene = {
  Antigen0: 0,
  Antigen1: 1,
  Antigen2: 2,
  Virulence: 3,
  Transmissibility: 4,
} as const

export type PathogenGeneIndex = (typeof PathogenGene)[keyof typeof PathogenGene]

export type PathogenExpressedTraits = {
  antigens: [number, number, number]
  virulence: number
  transmissibility: number
}
