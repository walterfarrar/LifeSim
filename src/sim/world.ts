import { createMultiGroupPopulation } from './dna'
import {
  createInitialPathogens,
  createPathogenFromChampionDna,
  resetPathogenIds,
  type Pathogen,
} from './disease/pathogen'
import { tickDiseaseSystem } from './disease/diseaseSystem'
import { resolveGroupFounderDnas } from './founderGenomes'
import { resolvePlantChampionDna } from './plantFounderGenomes'
import { resolvePathogenChampionDna } from './pathogenFounderGenomes'
import {
  DEFAULT_SIM_SETTINGS,
  type SimSettings,
} from './simSettings'
import {
  setActiveWorldBounds,
  worldBoundsFromSettings,
  type WorldBounds,
} from './worldBounds'
import {
  applyMetabolism,
  applyMovement,
  canSeekMate,
  capEnergy,
  createHerbivore,
  creatureTraits,
  isAlive,
  mate,
  mateProximity,
  moveToward,
  needsFood,
  resetCreatureIds,
  tickPregnancy,
  toroidalDistance,
  tryEatPlant,
  updateMode,
} from './entities/creature'
import {
  biteCorpse,
  createCorpseFromCreature,
  decayCorpse,
  isCorpseEdible,
  resetCorpseIds,
} from './entities/corpse'
import {
  bitePlant,
  createPlant,
  createPlantNear,
  createPlantWithDna,
  growPlant,
  isPlantEdible,
  plantTraits,
  resetPlantIds,
} from './entities/plant'
import {
  isMateEligible,
  mateAcceptanceThreshold,
  mateAttractionScore,
  mutuallyAcceptMate,
} from './matePreference'
import { applySpaceReaction, evaluateSpaceReaction } from './spaceBehavior'
import { findBestPlantTarget } from './foraging'
import {
  attemptPredation,
  findBestCorpseTarget,
  findBestPreyTarget,
  isValidPrey,
  shouldHuntCorpseOverPlant,
  shouldHuntPreyOverPlant,
  tryEatCorpse,
} from './predation'
import {
  energyFromCorpseBiomass,
  energyFromPlantBiomass,
  energyFromPreyBiomass,
  sumEntityEnergy,
} from './energyEconomy'
import { Rng } from './rng'
import type { Corpse, Creature, Plant, WorldSnapshot, WorldStats } from './types'

export class World {
  private plants: Plant[] = []
  private corpses: Corpse[] = []
  private creatures: Creature[] = []
  private pathogens: Pathogen[] = []
  private rng: Rng
  private settings: SimSettings
  private bounds: WorldBounds
  private stats: WorldStats = {
    tick: 0,
    plantCount: 0,
    herbivoreCount: 0,
    births: 0,
    deaths: 0,
    totalEnergy: 0,
    plantEnergy: 0,
    creatureEnergy: 0,
    corpseEnergy: 0,
    primaryProduction: 0,
  }
  private primaryProductionThisTick = 0

  constructor(seed?: number, settings: SimSettings = DEFAULT_SIM_SETTINGS) {
    this.settings = { ...settings }
    this.bounds = worldBoundsFromSettings(this.settings)
    setActiveWorldBounds(this.bounds)
    this.rng = new Rng(seed)
    this.reset()
  }

  reset(seed?: number, settings?: SimSettings): void {
    if (seed !== undefined) {
      this.rng = new Rng(seed)
    }
    if (settings) {
      this.settings = { ...settings }
    }
    this.bounds = worldBoundsFromSettings(this.settings)
    setActiveWorldBounds(this.bounds)
    resetPlantIds()
    resetCorpseIds()
    resetCreatureIds()
    resetPathogenIds()
    this.plants = []
    this.corpses = []
    this.creatures = []
    this.pathogens = createInitialPathogens(this.rng, 3)
    const championPathogenDna = resolvePathogenChampionDna(this.settings)
    if (championPathogenDna && this.pathogens.length > 0) {
      this.pathogens[0] = createPathogenFromChampionDna(championPathogenDna, this.rng, {
        mutate: false,
      })
    }
    this.stats = {
      tick: 0,
      plantCount: 0,
      herbivoreCount: 0,
      births: 0,
      deaths: 0,
      totalEnergy: 0,
      plantEnergy: 0,
      creatureEnergy: 0,
      corpseEnergy: 0,
      primaryProduction: 0,
    }
    this.primaryProductionThisTick = 0

    for (let i = 0; i < this.settings.initialPlants; i++) {
      const championDna = i === 0 ? resolvePlantChampionDna(this.settings) : null
      if (championDna) {
        this.plants.push(createPlantWithDna(this.rng, championDna))
      } else {
        this.plants.push(createPlant(this.rng))
      }
    }

    const founderSettings = {
      founderGeneSpread: this.settings.founderGeneSpread,
      founderJitterChance: this.settings.founderJitterChance,
      founderPreferenceNoise: this.settings.founderPreferenceNoise,
    }
    const groupFounderDna = resolveGroupFounderDnas(
      this.settings.creatureGroups,
      this.settings.groupFounders,
    )
    for (const spawn of createMultiGroupPopulation(
      this.rng,
      this.settings.creatureGroups,
      this.settings.herbivoresPerGroup,
      founderSettings,
      groupFounderDna,
    )) {
      this.creatures.push(createHerbivore(this.rng, spawn.position, spawn.dna))
    }
    this.refreshStats()
  }

  tick(): void {
    this.stats.tick += 1
    this.primaryProductionThisTick = 0

    for (const plant of this.plants) {
      const before = plant.energy
      growPlant(plant)
      this.primaryProductionThisTick += Math.max(0, plant.energy - before)
    }

    for (const corpse of this.corpses) {
      decayCorpse(corpse)
    }

    this.spawnPlants()
    this.runCreatureBehavior()
    tickDiseaseSystem(this.creatures, this.pathogens, this.rng, this.stats.tick, this.settings)
    this.cullDead()
    this.refreshStats()
  }

  snapshot(): WorldSnapshot {
    return {
      plants: this.plants,
      corpses: this.corpses,
      creatures: this.creatures,
      pathogens: this.pathogens,
      stats: { ...this.stats },
    }
  }

  get width(): number {
    return this.bounds.width
  }

  get height(): number {
    return this.bounds.height
  }

  private spawnPlants(): void {
    const {
      maxPlants,
      plantWindSpawnChance,
      plantLowCountBoost,
      plantSpawnChance,
    } = this.settings

    if (this.plants.length >= maxPlants) return

    if (this.plants.length === 0) {
      if (this.rng.chance(plantWindSpawnChance)) {
        const plant = createPlant(this.rng)
        this.plants.push(plant)
        this.primaryProductionThisTick += plant.energy
      }
      return
    }

    const spawnChance =
      this.plants.length < plantLowCountBoost
        ? plantSpawnChance * 2.5
        : plantSpawnChance
    if (!this.rng.chance(spawnChance)) return

    const parentIndex = this.rng.int(0, this.plants.length - 1)
    const parent = this.plants[parentIndex]
    if (!parent) return

    const parentTraits = plantTraits(parent)
    const reproductionChance = Math.min(1, spawnChance * parentTraits.reproductionRate)
    if (!this.rng.chance(reproductionChance)) return

    const seedCost = Math.min(parent.energy * 0.22, parentTraits.maxEnergy * 0.14)
    if (parent.energy < seedCost + 0.5) return
    parent.energy -= seedCost

    const child = createPlantNear(this.rng, parent, seedCost * 0.92)
    this.plants.push(child)
  }

  private runCreatureBehavior(): void {
    const eatenPlantIds = new Set<number>()
    const eatenCorpseIds = new Set<number>()
    const newborns: Creature[] = []
    const paired = new Set<number>()

    for (const creature of this.creatures) {
      updateMode(creature)
      const traits = creatureTraits(creature)
      const spaceReaction = evaluateSpaceReaction(creature, this.creatures)
      const handledSpace = applySpaceReaction(creature, spaceReaction)

      if (!handledSpace) {
        if (creature.mode === 'sleepy') {
          const target = this.pickWanderGoal(creature)
          moveToward(creature, target, traits)
          creature.vx *= traits.sleepMobility
          creature.vy *= traits.sleepMobility
        } else {
          const target = this.findGoal(creature)
          moveToward(creature, target, traits)
        }
      } else if (creature.mode === 'sleepy') {
        creature.vx *= traits.sleepMobility
        creature.vy *= traits.sleepMobility
      }

      applyMovement(creature)
    }

    for (const creature of this.creatures) {
      if (!needsFood(creature)) continue

      const traits = creatureTraits(creature)
      const forageReach = traits.radius + traits.forageReach
      const nearestPlant = findBestPlantTarget(
        traits,
        this.plants.filter(isPlantEdible),
        (plant) => toroidalDistance(creature, plant),
        forageReach,
        eatenPlantIds,
      )

      if (nearestPlant) {
        const biomass = tryEatPlant(creature, nearestPlant)
        if (biomass > 0) {
          bitePlant(nearestPlant, biomass)
          const gained = energyFromPlantBiomass(biomass, traits.forageEfficiency)
          creature.energy = capEnergy(creature, creature.energy + gained)
          if (!isPlantEdible(nearestPlant)) {
            eatenPlantIds.add(nearestPlant.id)
          }
        }
      }

      if (!needsFood(creature)) continue

      let nearestCorpse: Corpse | null = null
      let nearestCorpseDist = Infinity

      for (const corpse of this.corpses) {
        if (!isCorpseEdible(corpse) || eatenCorpseIds.has(corpse.id)) continue
        const dist = toroidalDistance(creature, corpse)
        if (dist < nearestCorpseDist) {
          nearestCorpseDist = dist
          nearestCorpse = corpse
        }
      }

      if (nearestCorpse) {
        const biomass = tryEatCorpse(creature, nearestCorpse)
        if (biomass > 0) {
          biteCorpse(nearestCorpse, biomass)
          const gained = energyFromCorpseBiomass(biomass, traits.forageEfficiency)
          creature.energy = capEnergy(creature, creature.energy + gained)
          if (!isCorpseEdible(nearestCorpse)) {
            eatenCorpseIds.add(nearestCorpse.id)
          }
        }
      }

      if (!needsFood(creature)) continue

      for (const prey of this.creatures) {
        if (!isValidPrey(creature, prey)) continue
        const biomass = attemptPredation(creature, prey, this.rng)
        if (biomass > 0) {
          const gained = energyFromPreyBiomass(biomass, traits.forageEfficiency)
          creature.energy = capEnergy(creature, creature.energy + gained)
          break
        }
      }
    }

    for (let i = 0; i < this.creatures.length; i++) {
      for (let j = i + 1; j < this.creatures.length; j++) {
        const a = this.creatures[i]
        const b = this.creatures[j]
        if (paired.has(a.id) || paired.has(b.id)) continue
        if (a.sex === b.sex) continue
        if (a.mode !== 'horny' || b.mode !== 'horny') continue
        if (!canSeekMate(a) || !canSeekMate(b)) continue
        if (toroidalDistance(a, b) > mateProximity(a, b)) continue
        const mateDist = toroidalDistance(a, b)
        const mateRange = mateProximity(a, b)
        if (!mutuallyAcceptMate(a, b, mateDist, mateRange)) continue

        const male = a.sex === 'male' ? a : b
        const female = a.sex === 'female' ? a : b
        if (mate(male, female)) {
          paired.add(a.id)
          paired.add(b.id)
        }
      }
    }

    for (const creature of this.creatures) {
      applyMetabolism(creature)
    }

    for (const creature of this.creatures) {
      const child = tickPregnancy(creature, this.rng)
      if (child) {
        newborns.push(child)
        this.stats.births += 1
      }
    }

    this.creatures.push(...newborns)
  }

  private findMateGoal(creature: Creature, vision: number): { x: number; y: number } {
    const traits = creatureTraits(creature)
    const seekRange = vision * traits.exploreVisionMult
    const threshold = mateAcceptanceThreshold(creature)
    let mateTarget: Creature | null = null
    let bestScore = -1

    for (const other of this.creatures) {
      if (!isMateEligible(creature, other)) continue
      if (!canSeekMate(other) && other.mode !== 'horny') continue
      const dist = toroidalDistance(creature, other)
      if (dist >= seekRange) continue

      const score = mateAttractionScore(creature, other, dist, seekRange)
      if (score >= threshold && score > bestScore) {
        bestScore = score
        mateTarget = other
      }
    }

    if (mateTarget) return mateTarget
    return this.findFoodGoalWhileExploring(creature, vision) ?? this.pickWanderGoal(creature)
  }

  private findFoodGoalWhileExploring(creature: Creature, vision: number): { x: number; y: number } | null {
    const traits = creatureTraits(creature)
    const seekRange = vision * traits.exploreVisionMult
    const food = this.findBestPlantFood(creature, seekRange)
    const foodDist = food ? toroidalDistance(creature, food) : Infinity

    const corpse = findBestCorpseTarget(creature, this.corpses, seekRange)
    if (corpse) {
      const corpseDist = toroidalDistance(creature, corpse)
      if (shouldHuntCorpseOverPlant(creature, corpse, foodDist, corpseDist, seekRange)) {
        return corpse
      }
    }

    return food
  }

  private findBestPlantFood(creature: Creature, seekRange: number): Plant | null {
    const traits = creatureTraits(creature)
    return findBestPlantTarget(
      traits,
      this.plants.filter(isPlantEdible),
      (plant) => toroidalDistance(creature, plant),
      seekRange,
    )
  }

  private findFoodGoal(creature: Creature, vision: number): { x: number; y: number } {
    const food = this.findBestPlantFood(creature, vision)
    const foodDist = food ? toroidalDistance(creature, food) : Infinity

    const corpse = findBestCorpseTarget(creature, this.corpses, vision)
    if (corpse) {
      const corpseDist = toroidalDistance(creature, corpse)
      if (shouldHuntCorpseOverPlant(creature, corpse, foodDist, corpseDist, vision)) {
        return corpse
      }
    }

    const prey = findBestPreyTarget(creature, this.creatures, vision)
    if (prey) {
      const preyDist = toroidalDistance(creature, prey)
      if (shouldHuntPreyOverPlant(creature, prey, foodDist, preyDist, vision)) {
        return prey
      }
    }

    return food ?? this.findFoodGoalWhileExploring(creature, vision) ?? this.pickWanderGoal(creature)
  }

  private findGoal(creature: Creature): { x: number; y: number } {
    const traits = creatureTraits(creature)

    switch (creature.mode) {
      case 'horny':
        return this.findMateGoal(creature, traits.vision)
      case 'hungry':
        return this.findFoodGoal(creature, traits.vision)
      case 'sleepy':
        return this.pickWanderGoal(creature)
    }
  }

  private pickWanderGoal(creature: Creature): { x: number; y: number } {
    const traits = creatureTraits(creature)
    const margin = Math.min(75, Math.max(40, Math.min(this.bounds.width, this.bounds.height) * 0.04))
    if (creature.wanderTicksRemaining > 0) {
      creature.wanderTicksRemaining -= 1
      return { x: creature.wanderX, y: creature.wanderY }
    }
    creature.wanderX = this.rng.range(margin, this.bounds.width - margin)
    creature.wanderY = this.rng.range(margin, this.bounds.height - margin)
    creature.wanderTicksRemaining =
      traits.wanderDurationMin + this.rng.int(0, traits.wanderDurationSpan)
    return { x: creature.wanderX, y: creature.wanderY }
  }

  private cullDead(): void {
    const survivors: Creature[] = []

    for (const creature of this.creatures) {
      if (isAlive(creature)) {
        survivors.push(creature)
        continue
      }
      this.corpses.push(createCorpseFromCreature(creature))
      this.stats.deaths += 1
    }

    this.creatures = survivors
    this.plants = this.plants.filter(isPlantEdible)
    this.corpses = this.corpses.filter(isCorpseEdible)
  }

  private refreshStats(): void {
    this.stats.plantCount = this.plants.length
    this.stats.herbivoreCount = this.creatures.length
    this.stats.primaryProduction = this.primaryProductionThisTick

    const energy = sumEntityEnergy(this.plants, this.creatures, this.corpses)
    this.stats.plantEnergy = energy.plants
    this.stats.creatureEnergy = energy.creatures
    this.stats.corpseEnergy = energy.corpses
    this.stats.totalEnergy = energy.total
  }
}
