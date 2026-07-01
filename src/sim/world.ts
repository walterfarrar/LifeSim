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
import { allPlantKinds, createPlantKindDna, countPlantsByKind, plantKindFromDna } from './plantKinds'
import { allPlantKindsAtCap, isPlantKindAtCap } from './plantLimits'
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
  capHydration,
  createHerbivore,
  creatureTraits,
  isAlive,
  mate,
  mateProximity,
  moveToward,
  needsFood,
  needsWater,
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
  foragePlantBite,
  createPlant,
  createPlantNear,
  createPlantWithDna,
  growPlant,
  applyPlantTemperature,
  applyPlantAging,
  applyPlantOldAge,
  applyPlantDrought,
  isPlantEdible,
  absorbPlantWaterFromSoil,
  transferPlantSeedWater,
  plantPopulationSpawnAttempts,
  plantRadius,
  plantReproductionChance,
  pickPlantForReproduction,
  plantTraits,
  resetPlantIds,
} from './entities/plant'
import {
  createPond,
  isPondDrinkable,
  applyCreatureDrowning,
  applyPlantDrowning,
  pondApproachTarget,
  resetPondIds,
  tryDrinkFromPond,
} from './entities/pond'
import {
  isMateSearchTarget,
  mateAcceptanceThreshold,
  mateAttractionScore,
  willMate,
} from './matePreference'
import { applySpaceReaction, evaluateSpaceReaction } from './spaceBehavior'
import { findCohesionTarget } from './cohesion'
import { findBestPlantTarget } from './foraging'
import {
  findBestPondTarget,
  findBestPlantWaterTarget,
  plantWaterScore,
  pondWaterScore,
} from './hydration'
import {
  bestMemoryGoal,
  decayCreatureMemories,
  recordCreatureMemory,
} from './creatureMemory'
import { CreatureGrid } from './spatialGrid'
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
  energyFromPreyBiomass,
  sumEntityEnergy,
} from './energyEconomy'
import { PLANT_EXTINCT_WIND_RESEED_CHANCE, SOIL_REPRO_MIN_MOISTURE } from './config'
import { classifyDeathCause, createEmptyDeathCauseCounts } from './deathCause'
import {
  dayLengthTicks,
  dayPhaseAtTick,
  isNightSunlight,
  sunlightFactor,
} from './dayNight'
import { computeSeasonSnapshot } from './seasons'
import { ambientTemperatureC } from './temperature'
import { SoilMoisture } from './soilMoisture'
import {
  Atmosphere,
  tickWaterCycle,
  releaseCreatureWater,
  releasePlantWater,
  releasePlantTranspiration,
  plantStoredWater,
} from './waterCycle'
import { distributeInitialWorldWater, fundInitialCreatureHydration } from './waterInit'
import { Rng } from './rng'
import type { Corpse, Creature, Plant, Pond, WorldSnapshot, WorldStats } from './types'

export class World {
  private plants: Plant[] = []
  private corpses: Corpse[] = []
  private creatures: Creature[] = []
  private ponds: Pond[] = []
  private soil: SoilMoisture = new SoilMoisture()
  private atmosphere: Atmosphere = new Atmosphere()
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
    grassPlantCount: 0,
    bushPlantCount: 0,
    treePlantCount: 0,
    pondWater: 0,
    hasPond: false,
    airWater: 0,
    soilWater: 0,
    creatureWater: 0,
    plantWater: 0,
    totalWater: 0,
    totalWaterBudget: 0,
    avgSoilMoisture: 0,
    airHumidity: 0,
    isRaining: false,
    deathCauseCounts: createEmptyDeathCauseCounts(),
    dayPhase: 0.3,
    sunlight: sunlightFactor(0.3),
    isNight: false,
    season: 'spring',
    seasonPhase: 0.25,
    effectiveDayLengthSeconds: DEFAULT_SIM_SETTINGS.dayLengthSeconds,
    temperature: 20,
  }
  private primaryProductionThisTick = 0
  /** Broad-phase neighbor index for the current tick. */
  private grid: CreatureGrid = new CreatureGrid([])
  /** Edible plants for the current tick — hoisted so we filter once, not per creature. */
  private ediblePlants: Plant[] = []

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
    resetPondIds()
    this.plants = []
    this.corpses = []
    this.creatures = []
    this.ponds = [createPond(this.rng, this.settings.pondBaseRadius)]
    this.soil = new SoilMoisture()
    this.atmosphere = new Atmosphere()
    distributeInitialWorldWater(
      this.settings.totalWater,
      this.soil,
      this.ponds,
      this.atmosphere,
    )
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
      grassPlantCount: 0,
      bushPlantCount: 0,
      treePlantCount: 0,
      pondWater: 0,
      hasPond: false,
      airWater: 0,
      soilWater: 0,
      creatureWater: 0,
      plantWater: 0,
      totalWater: 0,
      totalWaterBudget: 0,
      avgSoilMoisture: 0,
      airHumidity: 0,
      isRaining: false,
      deathCauseCounts: createEmptyDeathCauseCounts(),
      dayPhase: 0.3,
      sunlight: sunlightFactor(0.3),
      isNight: false,
      season: 'spring',
      seasonPhase: 0.25,
      effectiveDayLengthSeconds: this.settings.dayLengthSeconds,
      temperature: 20,
    }
    this.primaryProductionThisTick = 0

    const starterKinds = allPlantKinds()
    for (let i = 0; i < this.settings.initialPlants; i++) {
      const championDna = i === 0 ? resolvePlantChampionDna(this.settings) : null
      if (championDna) {
        this.plants.push(createPlantWithDna(this.rng, championDna))
      } else if (i < starterKinds.length) {
        this.plants.push(createPlantWithDna(this.rng, createPlantKindDna(starterKinds[i], this.rng)))
      } else {
        this.plants.push(createPlant(this.rng))
      }
    }

    const founderSettings = {
      founderGeneSpread: this.settings.founderGeneSpread,
      founderJitterChance: this.settings.founderJitterChance,
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
    for (const plant of this.plants) {
      absorbPlantWaterFromSoil(plant, this.soil)
    }
    fundInitialCreatureHydration(this.creatures, this.ponds, this.atmosphere)
    this.stats.totalWaterBudget = this.settings.totalWater
    this.refreshStats()
  }

  tick(): void {
    this.stats.tick += 1
    this.primaryProductionThisTick = 0

    for (const creature of this.creatures) {
      creature.pendingDeathCause = undefined
    }

    const season = computeSeasonSnapshot(
      this.stats.tick,
      this.settings.dayLengthSeconds,
      this.settings.daysPerSeasonYear,
    )
    const dayLen = dayLengthTicks(season.effectiveDayLengthSeconds)
    const dayPhase = dayPhaseAtTick(this.stats.tick, dayLen)
    const sunlight = sunlightFactor(dayPhase)
    this.stats.dayPhase = dayPhase
    this.stats.sunlight = sunlight
    this.stats.isNight = isNightSunlight(sunlight)
    this.stats.season = season.season
    this.stats.seasonPhase = season.seasonPhase
    this.stats.effectiveDayLengthSeconds = season.effectiveDayLengthSeconds
    const temperature = ambientTemperatureC(season.seasonPhase, dayPhase)
    this.stats.temperature = temperature

    tickWaterCycle(
      this.atmosphere,
      this.soil,
      this.ponds,
      temperature,
      this.bounds.width,
      this.bounds.height,
    )

    for (const pond of this.ponds) {
      this.soil.seepFromPond(pond)
    }
    this.atmosphere.vapor += this.soil.tickLateralDiffusion()

    for (const plant of this.plants) {
      applyPlantAging(plant)
      applyPlantOldAge(plant)
      applyPlantTemperature(plant, temperature, season.season)
      const transpired = applyPlantDrought(plant, this.soil, season.season, temperature)
      releasePlantTranspiration(transpired, plant, this.soil, this.atmosphere)
      const before = plant.energy
      growPlant(plant, this.soil, sunlight, temperature, season.season)
      this.primaryProductionThisTick += Math.max(0, plant.energy - before)
    }

    for (const corpse of this.corpses) {
      decayCorpse(corpse)
    }

    this.spawnPlants()
    this.runCreatureBehavior()
    this.applyPondDrowning()
    tickDiseaseSystem(this.creatures, this.pathogens, this.rng, this.stats.tick, this.settings)
    this.cullDead()
    this.refreshStats()
  }

  snapshot(): WorldSnapshot {
    return {
      plants: this.plants,
      corpses: this.corpses,
      creatures: this.creatures,
      ponds: this.ponds,
      soil: this.soil.snapshot(this.atmosphere.isRaining),
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
    const kindCounts = countPlantsByKind(this.plants)

    if (allPlantKindsAtCap(this.settings, kindCounts)) return

    if (this.plants.length === 0) {
      if (this.rng.chance(PLANT_EXTINCT_WIND_RESEED_CHANCE)) {
        const plant = createPlant(this.rng)
        const kind = plantKindFromDna(plant.dna)
        if (isPlantKindAtCap(this.settings, kindCounts, kind)) return
        absorbPlantWaterFromSoil(plant, this.soil)
        this.plants.push(plant)
        this.primaryProductionThisTick += plant.energy
      }
      return
    }

    const attempts = plantPopulationSpawnAttempts(this.plants, this.stats.season)

    for (let attempt = 0; attempt < attempts; attempt++) {
      if (allPlantKindsAtCap(this.settings, kindCounts)) return

      const parent = pickPlantForReproduction(this.rng, this.plants)
      if (!this.rng.chance(plantReproductionChance(parent, this.stats.season))) continue

      const parentKind = plantKindFromDna(parent.dna)
      if (isPlantKindAtCap(this.settings, kindCounts, parentKind)) continue

      const parentTraits = plantTraits(parent)
      const localMoisture = this.soil.sample(parent.x, parent.y)
      const reproMoistureFloor =
        SOIL_REPRO_MIN_MOISTURE * (1 - parentTraits.moistureNeed * 0.35)
      if (localMoisture < reproMoistureFloor) continue

      const seedCost = Math.min(parent.energy * 0.14, parentTraits.maxEnergy * 0.09)
      if (parent.energy < seedCost + 0.25) continue

      parent.energy -= seedCost
      const child = createPlantNear(this.rng, parent, this.stats.season, seedCost * 0.95)
      transferPlantSeedWater(parent, child, seedCost, this.atmosphere)
      absorbPlantWaterFromSoil(child, this.soil)
      this.plants.push(child)
      kindCounts[parentKind] += 1
    }
  }

  private runCreatureBehavior(): void {
    const eatenPlantIds = new Set<number>()
    const eatenCorpseIds = new Set<number>()
    const newborns: Creature[] = []
    const paired = new Set<number>()

    this.grid = new CreatureGrid(this.creatures)
    this.ediblePlants = this.plants.filter(isPlantEdible)

    for (const creature of this.creatures) {
      decayCreatureMemories(creature, creatureTraits(creature))
    }

    for (const creature of this.creatures) {
      updateMode(creature)
      const traits = creatureTraits(creature)
      const spaceNeighbors = this.grid.collect(creature.x, creature.y, traits.personalSpace)
      const spaceReaction = evaluateSpaceReaction(creature, spaceNeighbors)
      const handledSpace = applySpaceReaction(creature, spaceReaction)

      if (!handledSpace) {
        if (creature.mode === 'sleepy') {
          const target = this.pickWanderGoal(creature)
          moveToward(creature, target, traits)
          creature.vx *= traits.sleepMobility
          creature.vy *= traits.sleepMobility
        } else {
          this.noteSensoryMemories(creature, traits)
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
      if (!needsWater(creature)) continue

      const traits = creatureTraits(creature)

      if (traits.pondDrinking > 0) {
        for (const pond of this.ponds) {
          const sip = tryDrinkFromPond(creature, pond, traits.pondDrinking)
          if (sip > 0) {
            creature.hydration = capHydration(creature, creature.hydration + sip)
            recordCreatureMemory(creature, 'water', pond.x, pond.y, traits)
            break
          }
        }
      }
    }

    for (const creature of this.creatures) {
      if (!needsFood(creature) && !needsWater(creature)) continue

      const traits = creatureTraits(creature)
      const forageReach = traits.radius + traits.forageReach
      const nearestPlant = findBestPlantTarget(
        traits,
        this.ediblePlants,
        (plant) => toroidalDistance(creature, plant),
        forageReach,
        eatenPlantIds,
      )

      if (nearestPlant) {
        const biomass = tryEatPlant(creature, nearestPlant)
        if (biomass > 0) {
          const eaten = foragePlantBite(creature, nearestPlant, biomass, this.atmosphere)
          if (eaten > 0) {
            recordCreatureMemory(creature, 'food', nearestPlant.x, nearestPlant.y, traits)
            if (!isPlantEdible(nearestPlant)) {
              eatenPlantIds.add(nearestPlant.id)
            }
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
          recordCreatureMemory(creature, 'food', nearestCorpse.x, nearestCorpse.y, traits)
          if (!isCorpseEdible(nearestCorpse)) {
            eatenCorpseIds.add(nearestCorpse.id)
          }
        }
      }

      if (!needsFood(creature)) continue

      const preyNeighbors = this.grid.collect(creature.x, creature.y, forageReach)
      for (const prey of preyNeighbors) {
        if (!isValidPrey(creature, prey)) continue
        const biomass = attemptPredation(creature, prey, this.rng)
        if (biomass > 0) {
          const gained = energyFromPreyBiomass(biomass, traits.forageEfficiency)
          creature.energy = capEnergy(creature, creature.energy + gained)
          recordCreatureMemory(creature, 'food', prey.x, prey.y, traits)
          break
        }
      }
    }

    for (const a of this.creatures) {
      if (paired.has(a.id)) continue
      const mateNeighbors = this.grid.collect(a.x, a.y, MAX_MATE_PROXIMITY)
      for (const b of mateNeighbors) {
        if (b.id <= a.id) continue
        if (paired.has(a.id)) break
        if (paired.has(b.id)) continue
        if (a.sex === b.sex) continue
        const male = a.sex === 'male' ? a : b
        const female = a.sex === 'female' ? a : b
        if (male.sex !== 'male' || female.sex !== 'female') continue
        if (!canSeekMate(male)) continue
        const mateDist = toroidalDistance(a, b)
        const mateRange = mateProximity(a, b)
        if (mateDist > mateRange) continue
        if (!willMate(male, female, mateDist, mateRange)) continue

        if (mate(male, female)) {
          paired.add(a.id)
          paired.add(b.id)
        }
      }
    }

    for (const creature of this.creatures) {
      const sweat = applyMetabolism(
        creature,
        this.stats.temperature,
        this.atmosphere.humidity,
        this.atmosphere.isRaining,
      )
      this.atmosphere.vapor += sweat
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
    let prospectTarget: Creature | null = null
    let bestProspectScore = -1

    const candidates = this.grid.collect(creature.x, creature.y, seekRange)
    for (const other of candidates) {
      if (!isMateSearchTarget(creature, other)) continue
      const dist = toroidalDistance(creature, other)
      if (dist >= seekRange) continue

      const score = mateAttractionScore(creature, other, dist, seekRange)
      if (score >= threshold && score > bestScore) {
        bestScore = score
        mateTarget = other
        continue
      }

      if (score > bestProspectScore) {
        bestProspectScore = score
        prospectTarget = other
      }
    }

    if (mateTarget) return mateTarget
    if (prospectTarget) return prospectTarget
    return this.pickWanderGoal(creature)
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
      this.ediblePlants,
      (plant) => toroidalDistance(creature, plant),
      seekRange,
    )
  }

  private noteSensoryMemories(creature: Creature, traits: ReturnType<typeof creatureTraits>): void {
    if (traits.memorySlots <= 0) return

    if (creature.mode === 'thirsty') {
      if (traits.pondDrinking > 0.08) {
        const pond = findBestPondTarget(creature, this.ponds, traits.vision)
        if (pond && isPondDrinkable(pond)) {
          recordCreatureMemory(creature, 'water', pond.x, pond.y, traits, 0.6)
        }
      }
      const plant = findBestPlantWaterTarget(creature, this.ediblePlants, traits.vision)
      if (plant) {
        recordCreatureMemory(creature, 'water', plant.x, plant.y, traits, 0.5)
      }
    }

    if (creature.mode === 'hungry') {
      const food = this.findBestPlantFood(creature, traits.vision)
      if (food) {
        recordCreatureMemory(creature, 'food', food.x, food.y, traits, 0.55)
      }
    }
  }

  private findFoodGoal(creature: Creature, vision: number): { x: number; y: number } {
    const traits = creatureTraits(creature)
    const seekRange = vision * traits.exploreVisionMult
    const memoryRange = seekRange * (1.6 + traits.memoryRecall)
    const memory = bestMemoryGoal(creature, 'food', traits, memoryRange)
    const memoryScore = memory?.score ?? 0

    const food = this.findBestPlantFood(creature, vision)
    const foodDist = food ? toroidalDistance(creature, food) : Infinity
    const liveFoodScore = food ? 1 / (1 + foodDist / Math.max(vision, 1)) : 0

    const corpse = findBestCorpseTarget(creature, this.corpses, vision)
    if (corpse) {
      const corpseDist = toroidalDistance(creature, corpse)
      if (shouldHuntCorpseOverPlant(creature, corpse, foodDist, corpseDist, vision)) {
        return corpse
      }
    }

    const preyCandidates = this.grid.collect(creature.x, creature.y, vision)
    const prey = findBestPreyTarget(creature, preyCandidates, vision)
    if (prey) {
      const preyDist = toroidalDistance(creature, prey)
      if (shouldHuntPreyOverPlant(creature, prey, foodDist, preyDist, vision)) {
        return prey
      }
    }

    if (memory && memoryScore > 0.04 && (!food || memoryScore > liveFoodScore * 1.02)) {
      return { x: memory.x, y: memory.y }
    }

    return food ?? this.findFoodGoalWhileExploring(creature, vision) ?? this.pickWanderGoal(creature)
  }

  private resolveWaterMemoryGoal(
    creature: Creature,
    traits: ReturnType<typeof creatureTraits>,
    memory: { x: number; y: number },
    seekRange: number,
    canPond: boolean,
  ): { x: number; y: number } {
    if (canPond) {
      for (const pond of this.ponds) {
        if (!isPondDrinkable(pond)) continue
        const dist = toroidalDistance(memory, pond)
        if (dist < seekRange * 0.55 + pond.baseRadius) {
          return pondApproachTarget(creature, pond, traits.radius + traits.forageReach * 0.2)
        }
      }
    }
    return { x: memory.x, y: memory.y }
  }

  private findWaterGoal(creature: Creature, vision: number): { x: number; y: number } {
    const traits = creatureTraits(creature)
    const canPond = traits.pondDrinking > 0.08
    const seekRange = vision * traits.exploreVisionMult
    const memoryRange = seekRange * (1.6 + traits.memoryRecall)

    const memory = bestMemoryGoal(creature, 'water', traits, memoryRange)
    const memoryScore = memory?.score ?? 0

    const pond = canPond ? findBestPondTarget(creature, this.ponds, seekRange) : null
    const pondDist = pond ? toroidalDistance(creature, pond) : Infinity
    const pondScore = pond ? pondWaterScore(creature, pondDist, seekRange) : 0

    const plant = findBestPlantWaterTarget(creature, this.ediblePlants, seekRange)
    const plantDist = plant ? toroidalDistance(creature, plant) : Infinity
    const plantScore = plant ? plantWaterScore(plant, plantDist, seekRange) : 0

    const bestLiveScore = Math.max(pondScore, plantScore)
    if (memory && memoryScore > bestLiveScore * 0.92 && memoryScore > 0.04) {
      return this.resolveWaterMemoryGoal(creature, traits, memory, seekRange, canPond)
    }

    if (pondScore >= plantScore && pond) {
      return pondApproachTarget(creature, pond, traits.radius + traits.forageReach * 0.2)
    }

    if (plant) {
      return { x: plant.x, y: plant.y }
    }

    const fallbackPond = canPond ? findBestPondTarget(creature, this.ponds, vision) : null
    if (fallbackPond) {
      return pondApproachTarget(creature, fallbackPond, traits.radius + traits.forageReach * 0.2)
    }

    if (memory && memoryScore > 0.04) {
      return this.resolveWaterMemoryGoal(creature, traits, memory, seekRange, canPond)
    }

    return this.pickWanderGoal(creature)
  }

  private applyPondDrowning(): void {
    for (const pond of this.ponds) {
      if (!isPondDrinkable(pond)) continue
      for (const creature of this.creatures) {
        applyCreatureDrowning(creature, pond)
      }
      for (const plant of this.plants) {
        applyPlantDrowning(plant, pond, plantRadius(plant))
      }
    }
  }

  private findGoal(creature: Creature): { x: number; y: number } {
    const traits = creatureTraits(creature)

    switch (creature.mode) {
      case 'horny':
        return this.findMateGoal(creature, traits.vision)
      case 'hungry':
        return this.findFoodGoal(creature, traits.vision)
      case 'thirsty':
        return this.findWaterGoal(creature, traits.vision)
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

    const cohesionNeighbors = this.grid.collect(creature.x, creature.y, traits.vision)
    const cohesionTarget = findCohesionTarget(creature, cohesionNeighbors)
    const cohesionBias = traits.cohesion
    const useCohesion = cohesionTarget !== null && this.rng.chance(cohesionBias * 0.72 + 0.12)

    if (useCohesion && cohesionTarget) {
      const jitter = 16 + (1 - cohesionBias) * 48
      creature.wanderX = clamp(
        cohesionTarget.x + this.rng.range(-jitter, jitter),
        margin,
        this.bounds.width - margin,
      )
      creature.wanderY = clamp(
        cohesionTarget.y + this.rng.range(-jitter, jitter),
        margin,
        this.bounds.height - margin,
      )
      const baseDuration = traits.wanderDurationMin + this.rng.int(0, traits.wanderDurationSpan)
      creature.wanderTicksRemaining = Math.max(
        20,
        Math.floor(baseDuration * (0.5 + cohesionBias * 0.75)),
      )
    } else {
      creature.wanderX = this.rng.range(margin, this.bounds.width - margin)
      creature.wanderY = this.rng.range(margin, this.bounds.height - margin)
      creature.wanderTicksRemaining =
        traits.wanderDurationMin + this.rng.int(0, traits.wanderDurationSpan)
    }

    return { x: creature.wanderX, y: creature.wanderY }
  }

  private cullDead(): void {
    const survivors: Creature[] = []

    for (const creature of this.creatures) {
      if (isAlive(creature)) {
        survivors.push(creature)
        continue
      }
      releaseCreatureWater(creature, this.soil, this.atmosphere)
      this.corpses.push(createCorpseFromCreature(creature))
      const cause = classifyDeathCause(creature, this.ponds)
      this.stats.deathCauseCounts[cause] += 1
      this.stats.deaths += 1
    }

    this.creatures = survivors

    for (const plant of this.plants) {
      if (isPlantEdible(plant)) continue
      releasePlantWater(plant, this.soil, this.atmosphere)
    }
    this.plants = this.plants.filter(isPlantEdible)
    this.corpses = this.corpses.filter(isCorpseEdible)
  }

  private refreshStats(): void {
    this.stats.plantCount = this.plants.length
    this.stats.herbivoreCount = this.creatures.length
    this.stats.primaryProduction = this.primaryProductionThisTick

    const kindCounts = countPlantsByKind(this.plants)
    this.stats.grassPlantCount = kindCounts.grass
    this.stats.bushPlantCount = kindCounts.bush
    this.stats.treePlantCount = kindCounts.tree

    const pond = this.ponds[0]
    this.stats.pondWater = pond?.water ?? 0
    this.stats.hasPond = pond !== undefined
    this.stats.airWater = this.atmosphere.vapor
    this.stats.soilWater = this.soil.totalWater()
    let creatureWater = 0
    for (const creature of this.creatures) creatureWater += creature.hydration
    this.stats.creatureWater = creatureWater
    let plantWater = 0
    for (const plant of this.plants) plantWater += plantStoredWater(plant)
    this.stats.plantWater = plantWater
    this.stats.totalWater =
      this.stats.pondWater +
      this.stats.airWater +
      this.stats.soilWater +
      this.stats.creatureWater +
      plantWater
    this.stats.avgSoilMoisture = this.soil.averageMoisture()
    this.stats.airHumidity = this.atmosphere.humidity
    this.stats.isRaining = this.atmosphere.isRaining

    const energy = sumEntityEnergy(this.plants, this.creatures, this.corpses)
    this.stats.plantEnergy = energy.plants
    this.stats.creatureEnergy = energy.creatures
    this.stats.corpseEnergy = energy.corpses
    this.stats.totalEnergy = energy.total
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Upper bound on mateProximity: max mateRange (8 + 16) plus both max body radii
 * (3 + 7 each). Used as a safe broad-phase radius for mate pairing.
 */
const MAX_MATE_PROXIMITY = 48
