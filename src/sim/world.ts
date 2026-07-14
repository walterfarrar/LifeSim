import { createSingleGroupPopulation, type GroupSpawn } from './dna'
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
import { allPlantKindsAtCap, isPlantKindAtCap, maxPlantsForKind } from './plantLimits'
import { resolvePathogenChampionDna } from './pathogenFounderGenomes'
import { expressCreatureTraits } from './phenotype'
import {
  DEFAULT_SIM_SETTINGS,
  totalStartingHerbivores,
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
  hungryExitLine,
  isAlive,
  mate,
  mateProximity,
  moveToward,
  shouldForageForFood,
  needsFood,
  needsWater,
  resetCreatureIds,
  thirstyExitLine,
  tickPregnancy,
  toroidalDistance,
  tryAttackCreature,
  tryEatPlant,
  updateMode,
} from './entities/creature'
import { brainForward } from './brain/network'
import { packBrainInputs, type BrainSenseReadings, type SenseTarget } from './brain/senses'
import { cloneBrainDna, type BrainDNA } from './brain/brainGenome'
import { createSeedBrainDna } from './brain/brainSeed'
import {
  beginBrainTick,
  learnFromOutcome,
  rewardBrainAction,
  BRAIN_CONSUME_REWARD_WEIGHT,
} from './brain/learning'
import { toroidalDelta } from './toroidal'
import {
  biteCorpse,
  createCorpseFromCreature,
  decayCorpse,
  isCorpseEdible,
  resetCorpseIds,
} from './entities/corpse'
import {
  foragePlantBite,
  createPlantNear,
  createPlantWithDna,
  growPlant,
  applyPlantTemperature,
  applyPlantAging,
  applyPlantOldAge,
  applyPlantDrought,
  isPlantEdible,
  transferPlantSeedWater,
  plantPopulationSpawnAttempts,
  plantDrownDamage,
  plantDrownRadius,
  plantReproductionChance,
  pickPlantForReproduction,
  plantTraits,
  resetPlantIds,
} from './entities/plant'
import {
  isPondDrinkable,
  applyCreatureDrowning,
  applyPlantDrowning,
  pondApproachTarget,
  tryDrinkFromSurface,
} from './entities/pond'
import {
  isMateSearchTarget,
  mateAcceptanceThreshold,
  mateAttractionScore,
  willMate,
} from './matePreference'
import { applySpaceReaction, evaluateSpaceReaction } from './spaceBehavior'
import { findCohesionTarget } from './cohesion'
import { GrassCover } from './grassCover'
import {
  findBestGrassTarget,
  findBestGrassWaterTarget,
  forageGrassBite,
  grassWaterScore,
  trySipGrassDew,
  scoreGrassFoodTarget,
  tryEatGrass,
} from './grassForaging'
import { findBestPlantTarget, scorePlantFoodTarget } from './foraging'
import {
  findBestPondTarget,
  findBestPlantWaterTarget,
  plantWaterScore,
  pondWaterScore,
} from './hydration'
import {
  bestMemoryGoal,
  decayCreatureMemories,
  forgetCreatureMemoryNear,
  recordCreatureMemory,
  weakenCreatureMemoryNear,
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
import type { PlantKind } from './plantKinds'
import {
  DROWN_DEPTH_BODY_SIZE_MULT,
  PLANT_EXTINCT_WIND_RESEED_CHANCE,
  PLANT_KIND_EXTINCT_RESEED_CHANCE,
  PLANT_WATER_PER_ENERGY,
  SOIL_CELL_SIZE,
  SOIL_REPRO_MIN_MOISTURE,
  TERRAIN_ELEVATION_MAX,
} from './config'
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
  plantHydricMass,
} from './waterCycle'
import { tickWoodyPlantWaterUptake } from './plantWaterUptake'
import { distributeInitialWorldWater, fundInitialCreatureHydration, fundInitialPlantStructuralWater } from './waterInit'
import { TerrainWater } from './terrainWater'
import { yearsToTicks, setCalendarTimeScale } from './timeScale'
import { Rng } from './rng'
import type { Corpse, Creature, Plant, Vec2, WorldSnapshot, WorldStats } from './types'

export class World {
  private plants: Plant[] = []
  private corpses: Corpse[] = []
  private creatures: Creature[] = []
  private terrain: TerrainWater = new TerrainWater()
  private soil: SoilMoisture = new SoilMoisture()
  private grass: GrassCover = new GrassCover(SOIL_CELL_SIZE)
  private atmosphere: Atmosphere = new Atmosphere()
  private pathogens: Pathogen[] = []
  private rng: Rng
  private settings: SimSettings
  private bounds: WorldBounds
  /** Index of the next founder group to introduce during the intro cycle. */
  private creatureNextGroupIndex = 0
  /** Tick when the next founder group or extinction check is due. */
  private creatureNextSpawnTick = 0
  /** True after every settings group has been introduced once — then only extinction checks run. */
  private creatureIntroCycleComplete = false
  /** Alternating sex assignment across all founder spawns in this run. */
  private creatureSexIndexOffset = 0
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
    surfaceWater: 0,
    hasSurfaceWater: false,
    airWater: 0,
    airWaterCapacity: 0,
    soilWater: 0,
    creatureWater: 0,
    plantWater: 0,
    totalWater: 0,
    totalWaterBudget: 0,
    avgSoilMoisture: 0,
    airHumidity: 0,
    isRaining: false,
    wind: { dir: 0, speed: 0 },
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
  /** When set, every founder spawns with this exact brain genome (used by the evolution harness). */
  private founderBrainDna: BrainDNA | null = null
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
    setCalendarTimeScale(this.settings.dayLengthSeconds, this.settings.daysPerSeasonYear)
    this.bounds = worldBoundsFromSettings(this.settings)
    setActiveWorldBounds(this.bounds)
    resetPlantIds()
    resetCorpseIds()
    resetCreatureIds()
    resetPathogenIds()
    this.plants = []
    this.corpses = []
    this.creatures = []
    this.soil = new SoilMoisture()
    this.grass = new GrassCover(SOIL_CELL_SIZE)
    this.terrain = new TerrainWater(SOIL_CELL_SIZE)
    this.terrain.generate(this.rng, this.settings.pondBaseRadius, this.settings.pondMaxDepth)
    this.atmosphere = new Atmosphere()
    this.atmosphere.attach(this.terrain, this.soil, this.rng)
    distributeInitialWorldWater(
      this.settings.totalWater,
      this.soil,
      this.terrain,
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
      surfaceWater: 0,
      hasSurfaceWater: false,
      airWater: 0,
      airWaterCapacity: 0,
      soilWater: 0,
      creatureWater: 0,
      plantWater: 0,
      totalWater: 0,
      totalWaterBudget: 0,
      avgSoilMoisture: 0,
      airHumidity: 0,
      isRaining: false,
      wind: { dir: 0, speed: 0 },
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

    const championDna = resolvePlantChampionDna(this.settings)
    const grassChampion =
      championDna && plantKindFromDna(championDna) === 'grass' ? championDna : null
    const grassSeedCount = Math.min(
      this.settings.maxGrassPlants,
      Math.max(48, Math.round(this.settings.initialPlants * 0.5)),
    )
    this.grass.seedInitial(this.rng, grassSeedCount, grassChampion)
    for (let gi = 0; gi < this.grass.energy.length; gi++) {
      if (this.grass.hasGrass(gi)) {
        this.grass.fundStructuralWaterFromSoil(gi, this.soil, this.atmosphere)
      }
    }

    const woodyKinds: PlantKind[] = ['bush', 'tree']
    for (let i = 0; i < this.settings.initialPlants; i++) {
      const founderDna = i === 0 ? championDna : null
      if (founderDna && plantKindFromDna(founderDna) !== 'grass') {
        this.plants.push(createPlantWithDna(this.rng, founderDna))
      } else if (i < woodyKinds.length) {
        this.plants.push(createPlantWithDna(this.rng, createPlantKindDna(woodyKinds[i], this.rng)))
      } else {
        const kind: PlantKind = this.rng.chance(0.55) ? 'bush' : 'tree'
        this.plants.push(createPlantWithDna(this.rng, createPlantKindDna(kind, this.rng)))
      }
    }

    this.resetCreatureSpawnSchedule()
    for (const plant of this.plants) {
      fundInitialPlantStructuralWater(plant, this.soil, this.atmosphere)
    }
    this.refreshStats()
    this.stats.totalWaterBudget = this.stats.totalWater
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

    tickWaterCycle(this.atmosphere, this.soil, this.terrain, temperature)

    if (this.stats.tick % 4 === 0) {
      // Soil/surface flow is heavy — batch a few passes every 4 minutes of sim time.
      for (let pass = 0; pass < 2; pass++) {
        this.atmosphere.vent(
          this.bounds.width / 2,
          this.bounds.height / 2,
          this.soil.tickLateralDiffusion(),
        )
        this.terrain.tickSurfaceFlow()
      }
    }

    if (this.stats.tick % 4 === 0) {
      this.primaryProductionThisTick += this.grass.tick(
        this.rng,
        this.soil,
        this.atmosphere,
        season.season,
        sunlight,
        temperature,
        this.settings.maxGrassPlants,
        this.plants,
        this.terrain,
        4,
      )
    }

    const plantDt = this.stats.tick % 2 === 0 ? 2 : 0
    if (plantDt > 0) {
      for (const plant of this.plants) {
        applyPlantAging(plant, plantDt)
        const energyBeforeStress = plant.energy
        applyPlantOldAge(plant)
        applyPlantTemperature(plant, temperature, season.season)
        const stressEnergyLost = energyBeforeStress - plant.energy
        if (stressEnergyLost > 0) {
          releasePlantTranspiration(
            stressEnergyLost * PLANT_WATER_PER_ENERGY,
            plant,
            this.soil,
            this.atmosphere,
          )
        }
        tickWoodyPlantWaterUptake(plant, this.soil, this.atmosphere, season.season, temperature)
        const transpired = applyPlantDrought(plant, this.soil, season.season, temperature)
        releasePlantTranspiration(transpired, plant, this.soil, this.atmosphere)
        const before = plant.energy
        const submerged = this.terrain.isSubmerged(
          plant.x,
          plant.y,
          plantDrownRadius(plant),
        )
        if (!submerged) {
          growPlant(plant, this.soil, sunlight, temperature, season.season, this.atmosphere)
          growPlant(plant, this.soil, sunlight, temperature, season.season, this.atmosphere)
          this.primaryProductionThisTick += Math.max(0, plant.energy - before)
        }
      }
    }

    for (const corpse of this.corpses) {
      decayCorpse(corpse)
    }

    if (plantDt > 0) this.spawnPlants()
    this.runCreatureBehavior()
    this.applySurfaceDrowning()
    if (this.settings.brainControlEnabled && this.stats.tick % 2 === 0) {
      this.tickBrainLearning()
    }
    if (this.stats.tick % 2 === 0) {
      tickDiseaseSystem(this.creatures, this.pathogens, this.rng, this.stats.tick, this.settings)
    }
    this.cullDead()
    this.tickCreatureSpawning()
    this.refreshStats(this.stats.tick % 8 === 0)
  }

  snapshot(): WorldSnapshot {
    return {
      plants: this.plants,
      corpses: this.corpses,
      creatures: this.creatures,
      terrain: this.terrain.snapshot(this.atmosphere.isRaining),
      soil: this.soil.snapshot(this.atmosphere.isRaining),
      grass: this.grass.snapshot(),
      air: this.atmosphere.snapshot(),
      pathogens: this.pathogens,
      stats: { ...this.stats },
    }
  }

  /** Force all founders to spawn with a specific brain genome (evolution harness); null = seed. */
  setFounderBrainDna(brain: BrainDNA | null): void {
    this.founderBrainDna = brain ? cloneBrainDna(brain) : null
  }

  get width(): number {
    return this.bounds.width
  }

  get height(): number {
    return this.bounds.height
  }

  private resetCreatureSpawnSchedule(): void {
    this.creatureNextGroupIndex = 0
    this.creatureNextSpawnTick = yearsToTicks(this.settings.creatureFirstSpawnDelayYears)
    this.creatureIntroCycleComplete = false
    this.creatureSexIndexOffset = 0
  }

  private resolveCreatureSpawnPosition(spawn: GroupSpawn): Vec2 {
    const radius = expressCreatureTraits(spawn.dna, 0).radius
    return this.terrain.resolveDryLandSpawn(this.rng, spawn.position, radius)
  }

  private spawnCreatureGroup(groupIndex: number): Creature[] {
    const founderSettings = {
      founderGeneSpread: this.settings.founderGeneSpread,
      founderJitterChance: this.settings.founderJitterChance,
    }
    const groupFounderDna = resolveGroupFounderDnas(
      this.settings.creatureGroups,
      this.settings.groupFounders,
    )
    const spawned: Creature[] = []
    for (const spawn of createSingleGroupPopulation(
      this.rng,
      groupIndex,
      this.settings.creatureGroups,
      this.settings.herbivoresPerGroup,
      founderSettings,
      groupFounderDna,
      this.creatureSexIndexOffset,
    )) {
      const brainDna = this.founderBrainDna
        ? cloneBrainDna(this.founderBrainDna)
        : createSeedBrainDna(this.rng)
      spawned.push(
        createHerbivore(
          this.rng,
          this.resolveCreatureSpawnPosition(spawn),
          spawn.dna,
          brainDna,
        ),
      )
    }
    this.creatureSexIndexOffset += this.settings.herbivoresPerGroup
    return spawned
  }

  private introduceCreatureGroup(groupIndex: number): void {
    const newcomers = this.spawnCreatureGroup(groupIndex)
    if (newcomers.length === 0) return
    fundInitialCreatureHydration(newcomers, this.terrain, this.atmosphere, this.soil)
    this.creatures.push(...newcomers)
  }

  /**
   * Intro cycle: spawn each founder group in full every interval (even if prior groups died out).
   * After all groups have appeared once, check every interval for extinction and restart if empty.
   */
  private tickCreatureSpawning(): void {
    if (totalStartingHerbivores(this.settings) === 0) return

    const now = this.stats.tick
    const totalGroups = this.settings.creatureGroups
    const interval = yearsToTicks(this.settings.creatureGroupSpawnIntervalYears)
    if (now < this.creatureNextSpawnTick) return

    if (!this.creatureIntroCycleComplete) {
      if (this.creatureNextGroupIndex < totalGroups) {
        this.introduceCreatureGroup(this.creatureNextGroupIndex)
        this.creatureNextGroupIndex += 1
        if (this.creatureNextGroupIndex >= totalGroups) {
          this.creatureIntroCycleComplete = true
        }
      }
      this.creatureNextSpawnTick = now + interval
      return
    }

    this.creatureNextSpawnTick = now + interval
    if (this.creatures.length > 0) return

    this.creatureIntroCycleComplete = false
    this.creatureNextGroupIndex = 1
    this.introduceCreatureGroup(0)
  }

  /** Wind-borne seeds for any lineage that has died out locally. */
  private reseedExtinctPlantKinds(kindCounts: Record<PlantKind, number>): void {
    const totalExtinction = this.plants.length === 0 && this.grass.countEdible() === 0

    for (const kind of allPlantKinds()) {
      if (kind === 'grass') {
        if (kindCounts.grass > 0) continue
        if (this.settings.maxGrassPlants <= 0) continue
        const chance = totalExtinction ? PLANT_EXTINCT_WIND_RESEED_CHANCE : PLANT_KIND_EXTINCT_RESEED_CHANCE
        if (
          this.grass.tryWindReseed(this.rng, this.soil, this.atmosphere, chance, this.settings.maxGrassPlants)
        ) {
          kindCounts.grass += 1
        }
        continue
      }

      if (kindCounts[kind] > 0) continue
      if (maxPlantsForKind(this.settings, kind) <= 0) continue
      if (isPlantKindAtCap(this.settings, kindCounts, kind)) continue

      const chance = totalExtinction ? PLANT_EXTINCT_WIND_RESEED_CHANCE : PLANT_KIND_EXTINCT_RESEED_CHANCE
      if (!this.rng.chance(chance)) continue

      const plant = createPlantWithDna(this.rng, createPlantKindDna(kind, this.rng))
      fundInitialPlantStructuralWater(plant, this.soil, this.atmosphere)
      this.plants.push(plant)
      kindCounts[kind] += 1
      this.primaryProductionThisTick += plant.energy
    }
  }

  private spawnPlants(): void {
    const kindCounts = countPlantsByKind(this.plants)
    kindCounts.grass = this.grass.countEdible()

    if (allPlantKindsAtCap(this.settings, kindCounts)) return

    this.reseedExtinctPlantKinds(kindCounts)

    const woodyPlants = this.plants.filter((plant) => plantKindFromDna(plant.dna) !== 'grass')
    if (woodyPlants.length === 0) return

    const attempts = plantPopulationSpawnAttempts(woodyPlants, this.stats.season)

    for (let attempt = 0; attempt < attempts; attempt++) {
      if (allPlantKindsAtCap(this.settings, kindCounts)) return

      const parent = pickPlantForReproduction(this.rng, woodyPlants)
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
      releasePlantTranspiration(
        seedCost * PLANT_WATER_PER_ENERGY,
        parent,
        this.soil,
        this.atmosphere,
      )
      const child = createPlantNear(this.rng, parent, this.stats.season, seedCost * 0.95)
      if (this.terrain.isSubmerged(child.x, child.y, plantDrownRadius(child))) {
        parent.energy += seedCost
        continue
      }
      transferPlantSeedWater(parent, child, seedCost, this.atmosphere)
      fundInitialPlantStructuralWater(child, this.soil, this.atmosphere)
      this.plants.push(child)
      kindCounts[parentKind] += 1
    }
  }

  private runCreatureBehavior(): void {
    const eatenPlantIds = new Set<number>()
    const eatenGrassCells = new Set<number>()
    const grassGrazeCounts = new Map<number, number>()
    const eatenCorpseIds = new Set<number>()
    const newborns: Creature[] = []
    const paired = new Set<number>()

    this.grid = new CreatureGrid(this.creatures)
    this.ediblePlants = this.plants.filter(isPlantEdible)

    const brainControl = this.settings.brainControlEnabled

    for (const creature of this.creatures) {
      decayCreatureMemories(creature, creatureTraits(creature))
      if (brainControl && creature.brain) {
        beginBrainTick(creature.brain, creature.energy + creature.hydration)
      }
    }

    for (const creature of this.creatures) {
      updateMode(creature)
      const traits = creatureTraits(creature)
      const spaceNeighbors = this.grid.collect(creature.x, creature.y, traits.personalSpace)

      if (brainControl && creature.brain) {
        this.driveWithBrain(creature, traits, spaceNeighbors)
        // The evolved brain owns navigation; combat stays a reflex for aggressive creatures.
        const reaction = evaluateSpaceReaction(creature, spaceNeighbors)
        if (reaction.kind === 'attack') tryAttackCreature(creature, reaction.intruder)
        this.fleeDrownIfNeeded(creature, traits)
        applyMovement(creature)
        continue
      }

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
      this.fleeDrownIfNeeded(creature, traits)

      applyMovement(creature)
    }

    // Snapshot resources + drive pressure before the eat/drink loops so we can reward satisfying a
    // pressing need (metabolism/mating haven't run yet, so any gain here is pure intake).
    const preConsume = brainControl
      ? new Map<number, { energy: number; hydration: number; hunger: number; thirst: number }>()
      : null
    if (preConsume) {
      for (const creature of this.creatures) {
        if (!creature.brain) continue
        const hungerExit = Math.max(hungryExitLine(creature), 1)
        const thirstExit = Math.max(thirstyExitLine(creature), 1)
        preConsume.set(creature.id, {
          energy: creature.energy,
          hydration: creature.hydration,
          hunger: clamp01((hungerExit - creature.energy) / hungerExit),
          thirst: clamp01((thirstExit - creature.hydration) / thirstExit),
        })
      }
    }

    for (const creature of this.creatures) {
      if (!needsWater(creature)) continue

      const traits = creatureTraits(creature)
      // Emergency drinking: even forage-preferring genotypes may sip from standing water when dry.
      // Without a floor, pondDrinking≈0 creatures never call tryDrinkFromSurface and dehydrate
      // beside lakes.
      const drinkFactor =
        creature.mode === 'thirsty' ? Math.max(traits.pondDrinking, 0.55) : traits.pondDrinking

      if (drinkFactor > 0) {
        const sip = tryDrinkFromSurface(creature, this.terrain, drinkFactor)
        if (sip > 0) {
          creature.hydration = capHydration(creature, creature.hydration + sip)
          const target = this.terrain.findBestSurfaceTarget(creature.x, creature.y, traits.forageReach)
          if (target) {
            recordCreatureMemory(creature, 'water', target.x, target.y, traits)
          }
        }
      }
    }

    for (const creature of this.creatures) {
      if (needsWater(creature) && !shouldForageForFood(creature)) {
        const traits = creatureTraits(creature)
        const forageReach = traits.radius + traits.forageReach

        const waterPlant = findBestPlantWaterTarget(creature, this.ediblePlants, forageReach)
        if (waterPlant) {
          const biomass = tryEatPlant(creature, waterPlant)
          if (biomass > 0) {
            const eaten = foragePlantBite(creature, waterPlant, biomass, this.atmosphere)
            if (eaten > 0) {
              recordCreatureMemory(creature, 'water', waterPlant.x, waterPlant.y, traits)
            }
          }
        }

        if (needsWater(creature)) {
          const grassIdx = findBestGrassWaterTarget(creature, this.grass, forageReach)
          if (grassIdx !== null) {
            const center = this.grass.cellCenter(grassIdx)
            const sipped = trySipGrassDew(creature, this.grass, grassIdx, this.atmosphere)
            if (sipped > 0) {
              recordCreatureMemory(creature, 'water', center.x, center.y, traits)
            }
          }
        }
        continue
      }

      if (!shouldForageForFood(creature)) continue

      const traits = creatureTraits(creature)
      const forageReach = traits.radius + traits.forageReach

      const grassIdx = findBestGrassTarget(
        creature,
        traits,
        this.grass,
        forageReach,
        eatenGrassCells,
        grassGrazeCounts,
      )
      const nearestPlant = findBestPlantTarget(
        traits,
        this.ediblePlants,
        (plant) => toroidalDistance(creature, plant),
        forageReach,
        eatenPlantIds,
      )

      let ate = false
      if (grassIdx !== null) {
        const grassCenter = this.grass.cellCenter(grassIdx)
        const grassDist = toroidalDistance(creature, grassCenter)
        const grassScore = scoreGrassFoodTarget(traits, this.grass, grassIdx, grassDist, forageReach)
        const plantScore =
          nearestPlant !== null
            ? scorePlantFoodTarget(
                traits,
                plantTraits(nearestPlant),
                toroidalDistance(creature, nearestPlant),
                forageReach,
                plantKindFromDna(nearestPlant.dna),
              ) *
              (1 - traits.forageWaterPreference * 0.75)
            : -1

        if (grassScore >= plantScore) {
          const biomass = tryEatGrass(creature, this.grass, grassIdx)
          if (biomass > 0) {
            const eaten = forageGrassBite(creature, this.grass, grassIdx, biomass, this.atmosphere)
            if (eaten > 0) {
              recordCreatureMemory(creature, 'food', grassCenter.x, grassCenter.y, traits)
              grassGrazeCounts.set(grassIdx, (grassGrazeCounts.get(grassIdx) ?? 0) + 1)
              if (!this.grass.isEdibleGrass(grassIdx)) {
                eatenGrassCells.add(grassIdx)
                forgetCreatureMemoryNear(creature, 'food', grassCenter.x, grassCenter.y)
              }
              ate = true
            }
          } else {
            eatenGrassCells.add(grassIdx)
          }
        }
      }

      if (!ate && nearestPlant) {
        const biomass = tryEatPlant(creature, nearestPlant)
        if (biomass > 0) {
          const eaten = foragePlantBite(creature, nearestPlant, biomass, this.atmosphere)
          if (eaten > 0) {
            recordCreatureMemory(creature, 'food', nearestPlant.x, nearestPlant.y, traits)
            if (!isPlantEdible(nearestPlant)) {
              eatenPlantIds.add(nearestPlant.id)
            }
            ate = true
          }
        }
      }

      if (!ate) {
        const footIdx = this.grass.cellIndex(creature.x, creature.y)
        if (!this.grass.isEdibleGrass(footIdx)) {
          forgetCreatureMemoryNear(creature, 'food', creature.x, creature.y, Math.min(this.grass.cellW, this.grass.cellH) * 0.75)
        }
      }

      if (needsWater(creature)) {
        const grassWaterIdx = findBestGrassWaterTarget(creature, this.grass, forageReach)
        if (grassWaterIdx !== null) {
          const center = this.grass.cellCenter(grassWaterIdx)
          const sipped = trySipGrassDew(creature, this.grass, grassWaterIdx, this.atmosphere)
          if (sipped > 0) {
            recordCreatureMemory(creature, 'water', center.x, center.y, traits)
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

    // Positive reinforcement: reward eating in proportion to how hungry the creature was and
    // drinking in proportion to how thirsty, so the brain learns "consume when the need is real".
    if (preConsume) {
      for (const creature of this.creatures) {
        if (!creature.brain) continue
        const pre = preConsume.get(creature.id)
        if (!pre) continue
        const ate = Math.max(0, creature.energy - pre.energy)
        const drank = Math.max(0, creature.hydration - pre.hydration)
        const intake = ate * pre.hunger + drank * pre.thirst
        if (intake > 0) rewardBrainAction(creature.brain, intake * BRAIN_CONSUME_REWARD_WEIGHT)
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
      this.atmosphere.vent(creature.x, creature.y, sweat)
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

  private findBestPlantFood(creature: Creature, seekRange: number): { x: number; y: number } | null {
    const traits = creatureTraits(creature)
    const grassIdx = findBestGrassTarget(creature, traits, this.grass, seekRange)
    const plant = findBestPlantTarget(
      traits,
      this.ediblePlants,
      (p) => toroidalDistance(creature, p),
      seekRange,
    )

    if (grassIdx === null) return plant
    if (!plant) {
      return this.grass.cellCenter(grassIdx)
    }

    const grassCenter = this.grass.cellCenter(grassIdx)
    const grassDist = toroidalDistance(creature, grassCenter)
    const grassScore = scoreGrassFoodTarget(traits, this.grass, grassIdx, grassDist, seekRange)
    const plantScore = scorePlantFoodTarget(
      traits,
      plantTraits(plant),
      toroidalDistance(creature, plant),
      seekRange,
      plantKindFromDna(plant.dna),
    )
    if (grassScore >= plantScore) return grassCenter
    return plant
  }

  private noteSensoryMemories(creature: Creature, traits: ReturnType<typeof creatureTraits>): void {
    if (traits.memorySlots <= 0) return

    if (creature.mode === 'thirsty') {
      if (traits.pondDrinking > 0.08) {
        const surface = findBestPondTarget(creature, this.terrain, traits.vision)
        if (surface && isPondDrinkable(this.terrain)) {
          recordCreatureMemory(creature, 'water', surface.x, surface.y, traits, 0.6)
        }
      }
      if (traits.forageWaterPreference > 0.08) {
        const plant = findBestPlantWaterTarget(creature, this.ediblePlants, traits.vision)
        const grassIdx = findBestGrassWaterTarget(creature, this.grass, traits.vision)
        if (plant) {
          recordCreatureMemory(creature, 'water', plant.x, plant.y, traits, 0.5)
        } else if (grassIdx !== null) {
          const center = this.grass.cellCenter(grassIdx)
          recordCreatureMemory(creature, 'water', center.x, center.y, traits, 0.5)
        }
      }
    }

    if (creature.mode === 'hungry') {
      const food = this.findBestPlantFood(creature, traits.vision)
      if (food) {
        recordCreatureMemory(creature, 'food', food.x, food.y, traits, 0.55)
      }
    }
  }

  private foodAvailableNear(x: number, y: number, seekRange: number): boolean {
    const idx = this.grass.cellIndex(x, y)
    if (this.grass.isEdibleGrass(idx)) return true

    const cx = Math.floor(x / this.grass.cellW)
    const cy = Math.floor(y / this.grass.cellH)
    const cellReach = Math.ceil(seekRange / Math.min(this.grass.cellW, this.grass.cellH)) + 1

    for (let dr = -cellReach; dr <= cellReach; dr++) {
      for (let dc = -cellReach; dc <= cellReach; dc++) {
        const col = ((cx + dc) % this.grass.cols + this.grass.cols) % this.grass.cols
        const row = ((cy + dr) % this.grass.rows + this.grass.rows) % this.grass.rows
        const cellIdx = row * this.grass.cols + col
        if (!this.grass.isEdibleGrass(cellIdx)) continue
        const center = this.grass.cellCenter(cellIdx)
        if (toroidalDistance({ x, y }, center) <= seekRange) return true
      }
    }

    for (const plant of this.ediblePlants) {
      if (toroidalDistance({ x, y }, plant) <= seekRange) return true
    }

    return false
  }

  private resolveFoodMemoryGoal(
    creature: Creature,
    memory: { x: number; y: number },
    seekRange: number,
  ): { x: number; y: number } | null {
    if (this.foodAvailableNear(memory.x, memory.y, seekRange)) {
      const idx = this.grass.cellIndex(memory.x, memory.y)
      if (this.grass.isEdibleGrass(idx)) {
        return this.grass.cellCenter(idx)
      }
      return { x: memory.x, y: memory.y }
    }

    weakenCreatureMemoryNear(creature, 'food', memory.x, memory.y, 0.45)
    const live = this.findBestPlantFood(creature, seekRange)
    return live
  }

  private findFoodGoal(creature: Creature, vision: number): { x: number; y: number } {
    const traits = creatureTraits(creature)
    const seekRange = vision * traits.exploreVisionMult
    const memoryRange = seekRange * (1.6 + traits.memoryRecall)
    const memory = bestMemoryGoal(creature, 'food', traits, memoryRange)
    const memoryScore = memory?.score ?? 0

    const food = this.findBestPlantFood(creature, seekRange)
    const foodDist = food ? toroidalDistance(creature, food) : Infinity
    const liveFoodScore = food ? 1 / (1 + foodDist / Math.max(seekRange, 1)) : 0

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
      const resolved = this.resolveFoodMemoryGoal(creature, memory, seekRange)
      if (resolved) return resolved
    }

    return food ?? this.findFoodGoalWhileExploring(creature, vision) ?? this.pickWanderGoal(creature)
  }

  private resolveWaterMemoryGoal(
    creature: Creature,
    traits: ReturnType<typeof creatureTraits>,
    memory: { x: number; y: number },
    seekRange: number,
    canSurface: boolean,
  ): { x: number; y: number } {
    if (canSurface) {
      const surface = this.terrain.findBestSurfaceTarget(memory.x, memory.y, seekRange)
      if (surface) {
        const dist = toroidalDistance(memory, surface)
        if (dist < seekRange * 0.55 + Math.min(this.terrain.cellW, this.terrain.cellH)) {
          return pondApproachTarget(
            creature,
            surface,
            this.terrain,
            traits.radius + traits.forageReach * 0.85,
          )
        }
      }
    }
    return { x: memory.x, y: memory.y }
  }

  private findWaterGoal(creature: Creature, vision: number): { x: number; y: number } {
    const traits = creatureTraits(creature)
    // Ponds stay available even for forage-preferring genotypes — otherwise they dehydrate
    // next to lakes they genetically "don't drink from."
    const canSurface = true
    const seekRange = vision * traits.exploreVisionMult
    const memoryRange = seekRange * (1.6 + traits.memoryRecall)
    const drinkReach = traits.radius + traits.forageReach * 0.85
    const pondBias = Math.max(0.35, traits.pondDrinking)
    const criticallyDry =
      creature.mode === 'thirsty' || creature.hydration < thirstyExitLine(creature) * 0.85

    const memory = bestMemoryGoal(creature, 'water', traits, memoryRange)
    const memoryScore = memory?.score ?? 0

    const surface = criticallyDry
      ? this.terrain.findBestSurfaceTargetGlobal(creature.x, creature.y)
      : findBestPondTarget(creature, this.terrain, seekRange)
    if (criticallyDry && surface) {
      return pondApproachTarget(creature, surface, this.terrain, drinkReach)
    }
    const surfaceDist = surface ? toroidalDistance(creature, surface) : Infinity
    const surfaceScore = surface ? pondWaterScore(creature, surfaceDist, seekRange) * pondBias : 0

    const plant = findBestPlantWaterTarget(creature, this.ediblePlants, seekRange)
    const plantDist = plant ? toroidalDistance(creature, plant) : Infinity
    const plantScore = plant
      ? plantWaterScore(plant, plantDist, seekRange, traits.forageWaterPreference)
      : 0

    const grassIdx = findBestGrassWaterTarget(creature, this.grass, seekRange)
    const grassCenter = grassIdx !== null ? this.grass.cellCenter(grassIdx) : null
    const grassDist = grassCenter ? toroidalDistance(creature, grassCenter) : Infinity
    const grassScore =
      grassIdx !== null
        ? grassWaterScore(this.grass, grassIdx, grassDist, seekRange, traits.forageWaterPreference)
        : 0

    const bestLiveScore = Math.max(surfaceScore, plantScore, grassScore)
    if (memory && memoryScore > bestLiveScore * 0.92 && memoryScore > 0.04) {
      return this.resolveWaterMemoryGoal(creature, traits, memory, seekRange, canSurface)
    }

    if (surfaceScore >= plantScore && surfaceScore >= grassScore && surface) {
      return pondApproachTarget(creature, surface, this.terrain, drinkReach)
    }

    if (plantScore >= grassScore && plant) {
      return { x: plant.x, y: plant.y }
    }

    if (grassCenter) {
      return grassCenter
    }

    const fallbackSurface = findBestPondTarget(creature, this.terrain, vision)
    if (fallbackSurface) {
      return pondApproachTarget(creature, fallbackSurface, this.terrain, drinkReach)
    }

    if (memory && memoryScore > 0.04) {
      return this.resolveWaterMemoryGoal(creature, traits, memory, seekRange, canSurface)
    }

    return this.pickWanderGoal(creature)
  }

  /** Reward-modulated lifetime learning: each brain adapts from this tick's wellbeing change. */
  private tickBrainLearning(): void {
    for (const creature of this.creatures) {
      if (creature.brain) {
        learnFromOutcome(creature.brain, creature.energy + creature.hydration)
      }
    }
  }

  private applySurfaceDrowning(): void {
    if (!isPondDrinkable(this.terrain)) return
    for (const creature of this.creatures) {
      applyCreatureDrowning(creature, this.terrain)
    }
    for (const plant of this.plants) {
      const before = plant.energy
      applyPlantDrowning(plant, this.terrain, plantDrownRadius(plant), plantDrownDamage(plant))
      const energyLost = before - plant.energy
      if (energyLost > 0) {
        releasePlantTranspiration(
          energyLost * PLANT_WATER_PER_ENERGY,
          plant,
          this.soil,
          this.atmosphere,
        )
      }
    }
    if (this.stats.tick % 4 === 0) {
      this.grass.applyDrowning(
        this.terrain,
        this.soil,
        this.atmosphere,
        this.atmosphere.isRaining,
        4,
      )
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

  /**
   * Leave drowning depth when not critically thirsty. Shore drinking should stand outside
   * submersion; lingering mid-lake for hours is lethal on the minute clock.
   */
  private fleeDrownIfNeeded(
    creature: Creature,
    traits: ReturnType<typeof creatureTraits>,
  ): void {
    if (!this.terrain.isSubmerged(creature.x, creature.y, traits.radius)) return
    // Still allow brief shoreline wading while actively topping up.
    if (creature.mode === 'thirsty' && creature.hydration < thirstyExitLine(creature) * 0.92) {
      return
    }

    const probe = Math.max(10, traits.radius + 14)
    let bestDx = 0
    let bestDy = 0
    let bestScore = -Infinity
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2
      const dx = Math.cos(ang)
      const dy = Math.sin(ang)
      const depth = this.terrain.wadingDepth(creature.x + dx * probe, creature.y + dy * probe)
      const score = -depth
      if (score > bestScore) {
        bestScore = score
        bestDx = dx
        bestDy = dy
      }
    }
    // Prefer climbing out of the basin when every nearby probe is still deep.
    if (bestScore < -0.5) {
      const heightHere = this.terrain.sampleHeight(creature.x, creature.y)
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2
        const dx = Math.cos(ang)
        const dy = Math.sin(ang)
        const height = this.terrain.sampleHeight(creature.x + dx * probe, creature.y + dy * probe)
        const score = height - heightHere
        if (score > bestScore) {
          bestScore = score
          bestDx = dx
          bestDy = dy
        }
      }
    }

    creature.vx = bestDx * traits.speed
    creature.vy = bestDy * traits.speed
    creature.heading = Math.atan2(bestDy, bestDx)
  }

  /** Evolved-brain movement: senses → neural net → egocentric steering → velocity. */
  private driveWithBrain(
    creature: Creature,
    traits: ReturnType<typeof creatureTraits>,
    spaceNeighbors: readonly Creature[],
  ): void {
    if (!creature.brain) return
    const readings = this.computeBrainReadings(creature, traits, spaceNeighbors)
    const inputs = packBrainInputs(readings)
    const out = brainForward(creature.brain, inputs)

    const cos = Math.cos(creature.heading)
    const sin = Math.sin(creature.heading)
    let dirX = out.forward * cos - out.right * sin
    let dirY = out.forward * sin + out.right * cos

    // Thirst competence assist (same spirit as the attack reflex): when thirsty and a drinkable
    // shore/plant/dew target is sensed, steer toward it. Critical thirst fully overrides the net
    // so a seed that still flees water (trained under the old deep-pond cue) can still drink.
    if (creature.mode === 'thirsty' && readings.water && readings.thirstNeed > 0.2) {
      const wDist = Math.hypot(readings.water.dx, readings.water.dy)
      if (wDist > 1e-4) {
        const blend = readings.thirstNeed > 0.55 ? 1 : 0.4 + readings.thirstNeed * 0.55
        dirX = dirX * (1 - blend) + (readings.water.dx / wDist) * blend
        dirY = dirY * (1 - blend) + (readings.water.dy / wDist) * blend
      }
    }

    // Hunger assist: same idea for food so founders don't starve while the seed brain adapts.
    if (creature.mode === 'hungry' && readings.food && readings.hungerNeed > 0.2) {
      const fDist = Math.hypot(readings.food.dx, readings.food.dy)
      if (fDist > 1e-4) {
        const blend = readings.hungerNeed > 0.55 ? 0.85 : 0.3 + readings.hungerNeed * 0.5
        dirX = dirX * (1 - blend) + (readings.food.dx / fDist) * blend
        dirY = dirY * (1 - blend) + (readings.food.dy / fDist) * blend
      }
    }

    const mag = Math.hypot(dirX, dirY)

    let speed = traits.speed * out.throttle
    if (creature.mode === 'sleepy') speed *= traits.sleepMobility
    // Don't dawdle while critically thirsty — get to the drink.
    if (creature.mode === 'thirsty' && readings.thirstNeed > 0.5) {
      speed = Math.max(speed, traits.speed * 0.55)
    }
    if (creature.mode === 'hungry' && readings.hungerNeed > 0.5) {
      speed = Math.max(speed, traits.speed * 0.5)
    }

    if (mag < 1e-4 || speed < 1e-4) {
      creature.vx = 0
      creature.vy = 0
      return
    }

    dirX /= mag
    dirY /= mag
    creature.vx = dirX * speed
    creature.vy = dirY * speed
    creature.heading = Math.atan2(dirY, dirX)
  }

  private computeBrainReadings(
    creature: Creature,
    traits: ReturnType<typeof creatureTraits>,
    spaceNeighbors: readonly Creature[],
  ): BrainSenseReadings {
    const vision = traits.vision
    const bodySize = Math.max(1, traits.radius * DROWN_DEPTH_BODY_SIZE_MULT)
    const probe = traits.radius + 6 + traits.speed * 4

    const ahead = this.probePoint(creature, creature.heading, probe)
    const left = this.probePoint(creature, creature.heading - BRAIN_PROBE_SPREAD, probe)
    const right = this.probePoint(creature, creature.heading + BRAIN_PROBE_SPREAD, probe)

    const heightHere = this.terrain.sampleHeight(creature.x, creature.y)
    const heightAhead = this.terrain.sampleHeight(ahead.x, ahead.y)
    const heightLeft = this.terrain.sampleHeight(left.x, left.y)
    const heightRight = this.terrain.sampleHeight(right.x, right.y)
    const seasonAngle = this.stats.seasonPhase * Math.PI * 2

    const hungerExit = hungryExitLine(creature)
    const thirstExit = thirstyExitLine(creature)

    const food = this.findBestPlantFood(creature, vision)
    const water = this.nearestWaterPoint(creature, traits, vision)
    const mate = canSeekMate(creature) ? this.nearestMatePoint(creature, vision) : null
    const crowder = nearestCrowder(creature, spaceNeighbors)

    return {
      heading: creature.heading,
      hungerNeed: clamp01((hungerExit - creature.energy) / Math.max(hungerExit, 1)),
      thirstNeed: clamp01((thirstExit - creature.hydration) / Math.max(thirstExit, 1)),
      fatigueNeed: clamp01(creature.fatigue / Math.max(traits.sleepFatigueThreshold, 1)),
      reproReady: mate !== null || canSeekMate(creature) ? 1 : 0,
      depthHere: this.terrain.wadingDepth(creature.x, creature.y) / bodySize,
      depthAhead: this.terrain.wadingDepth(ahead.x, ahead.y) / bodySize,
      depthLeft: this.terrain.wadingDepth(left.x, left.y) / bodySize,
      depthRight: this.terrain.wadingDepth(right.x, right.y) / bodySize,
      slopeAhead: clamp((heightAhead - heightHere) / BRAIN_SLOPE_NORM, -1, 1),
      elevationHere: clamp01(heightHere / TERRAIN_ELEVATION_MAX),
      slopeLeft: clamp((heightLeft - heightHere) / BRAIN_SLOPE_NORM, -1, 1),
      slopeRight: clamp((heightRight - heightHere) / BRAIN_SLOPE_NORM, -1, 1),
      soilWaterHere: this.soil.sample(creature.x, creature.y),
      temperature: clamp((this.stats.temperature - BRAIN_TEMP_MID) / BRAIN_TEMP_SCALE, -1, 1),
      seasonSin: Math.sin(seasonAngle),
      seasonCos: Math.cos(seasonAngle),
      daylight: this.stats.sunlight,
      food: this.targetReading(creature, food, vision),
      water: this.targetReading(creature, water, vision),
      mate: this.targetReading(creature, mate, vision),
      crowder: crowder ? this.targetReading(creature, crowder, traits.personalSpace) : null,
    }
  }

  private probePoint(creature: Creature, heading: number, dist: number): Vec2 {
    return { x: creature.x + Math.cos(heading) * dist, y: creature.y + Math.sin(heading) * dist }
  }

  private targetReading(creature: Creature, target: Vec2 | null, range: number): SenseTarget {
    if (!target) return null
    const { dx, dy } = toroidalDelta(creature, target)
    const dist = Math.hypot(dx, dy)
    return { dx, dy, close: clamp01(1 - dist / Math.max(range, 1)) }
  }

  /**
   * Water cue for the brain. Must match legacy {@link findWaterGoal}: pond targets are the
   * *drinkable shore*, not the deep cell center. Pointing at deep water taught brains to avoid
   * the water cue (approach → drown → negative reward) and die of thirst instead.
   */
  private nearestWaterPoint(
    creature: Creature,
    traits: ReturnType<typeof creatureTraits>,
    range: number,
  ): Vec2 | null {
    const seekRange = range * traits.exploreVisionMult
    const drinkReach = traits.radius + traits.forageReach * 0.85
    const criticallyDry =
      creature.mode === 'thirsty' || creature.hydration < thirstyExitLine(creature) * 0.85

    // When dry, linear global pond scan so vision-limited local plant/dew cues don't trap
    // creatures far from lakes. (Range-based search is O(range²) and too slow map-wide.)
    const surface = criticallyDry
      ? this.terrain.findBestSurfaceTargetGlobal(creature.x, creature.y)
      : findBestPondTarget(creature, this.terrain, seekRange)
    if (criticallyDry && surface) {
      return pondApproachTarget(creature, surface, this.terrain, drinkReach)
    }

    const surfaceDist = surface ? toroidalDistance(creature, surface) : Infinity
    const pondBias = Math.max(0.35, traits.pondDrinking)
    const surfaceScore = surface
      ? pondWaterScore(creature, surfaceDist, seekRange) * pondBias
      : 0

    const plant = findBestPlantWaterTarget(creature, this.ediblePlants, seekRange)
    const plantDist = plant ? toroidalDistance(creature, plant) : Infinity
    const plantScore = plant
      ? plantWaterScore(plant, plantDist, seekRange, traits.forageWaterPreference)
      : 0

    const grassIdx = findBestGrassWaterTarget(creature, this.grass, seekRange)
    const grassCenter = grassIdx !== null ? this.grass.cellCenter(grassIdx) : null
    const grassDist = grassCenter ? toroidalDistance(creature, grassCenter) : Infinity
    const grassScore =
      grassIdx !== null
        ? grassWaterScore(this.grass, grassIdx, grassDist, seekRange, traits.forageWaterPreference)
        : 0

    if (surfaceScore >= plantScore && surfaceScore >= grassScore && surface) {
      return pondApproachTarget(creature, surface, this.terrain, drinkReach)
    }
    if (plantScore >= grassScore && plant) {
      return { x: plant.x, y: plant.y }
    }
    if (grassCenter) return grassCenter

    if (surface) {
      return pondApproachTarget(creature, surface, this.terrain, drinkReach)
    }
    return null
  }

  private nearestMatePoint(creature: Creature, range: number): Vec2 | null {
    const candidates = this.grid.collect(creature.x, creature.y, range)
    let best: Creature | null = null
    let bestDist = Infinity
    for (const other of candidates) {
      if (!isMateSearchTarget(creature, other)) continue
      const d = toroidalDistance(creature, other)
      if (d < bestDist) {
        bestDist = d
        best = other
      }
    }
    return best ? { x: best.x, y: best.y } : null
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
      const cause = classifyDeathCause(creature, this.terrain)
      this.stats.deathCauseCounts[cause] += 1
      this.stats.deaths += 1
    }

    this.creatures = survivors

    for (const plant of this.plants) {
      if (isPlantEdible(plant)) continue
      releasePlantWater(plant, this.soil, this.atmosphere)
    }
    this.plants = this.plants.filter(isPlantEdible)

    for (let i = 0; i < this.grass.energy.length; i++) {
      if (this.grass.hasGrass(i)) continue
      this.grass.releaseDeadWater(i, this.soil, this.atmosphere)
    }

    this.corpses = this.corpses.filter(isCorpseEdible)
  }

  private refreshStats(fullWaterAccounting = true): void {
    this.stats.plantCount = this.plants.length
    this.stats.herbivoreCount = this.creatures.length
    this.stats.primaryProduction = this.primaryProductionThisTick

    if (!fullWaterAccounting) {
      return
    }

    const kindCounts = countPlantsByKind(this.plants)
    this.stats.grassPlantCount = this.grass.countEdible()
    this.stats.bushPlantCount = kindCounts.bush
    this.stats.treePlantCount = kindCounts.tree

    this.stats.surfaceWater = this.terrain.totalWater()
    this.stats.hasSurfaceWater = this.terrain.hasStandingWater()
    this.stats.airWater = this.atmosphere.totalWater()
    this.stats.airWaterCapacity = this.atmosphere.vaporCapacityTotal
    this.stats.soilWater = this.soil.totalWater()
    let creatureWater = 0
    for (const creature of this.creatures) creatureWater += creature.hydration
    this.stats.creatureWater = creatureWater
    let plantWater = this.grass.totalWater()
    for (const plant of this.plants) plantWater += plantHydricMass(plant)
    this.stats.plantWater = plantWater
    this.stats.totalWater =
      this.stats.surfaceWater +
      this.stats.airWater +
      this.stats.soilWater +
      this.stats.creatureWater +
      plantWater

    this.stats.avgSoilMoisture = this.soil.averageMoisture()
    this.stats.airHumidity = this.atmosphere.humidity
    this.stats.isRaining = this.atmosphere.isRaining
    this.stats.wind = this.atmosphere.wind

    const energy = sumEntityEnergy(this.plants, this.creatures, this.corpses)
    this.stats.plantEnergy = energy.plants + this.grass.totalEnergy()
    this.stats.creatureEnergy = energy.creatures
    this.stats.corpseEnergy = energy.corpses
    this.stats.totalEnergy = energy.total
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

/** Angular offset (radians) of the left/right water-depth probes from straight ahead. */
const BRAIN_PROBE_SPREAD = 0.7
/** Elevation delta (probe-ahead minus here) that maps to a full ±1 slope sense. */
const BRAIN_SLOPE_NORM = 2.5
/** Temperature (°C) mapped to the −1..1 sense: midpoint reads 0, ±BRAIN_TEMP_SCALE saturates. */
const BRAIN_TEMP_MID = 15
const BRAIN_TEMP_SCALE = 25

function nearestCrowder(creature: Creature, neighbors: readonly Creature[]): Vec2 | null {
  let best: Creature | null = null
  let bestDist = Infinity
  for (const other of neighbors) {
    if (other.id === creature.id) continue
    const d = toroidalDistance(creature, other)
    if (d < bestDist) {
      bestDist = d
      best = other
    }
  }
  return best ? { x: best.x, y: best.y } : null
}

/**
 * Upper bound on mateProximity: max mateRange (8 + 16) plus both max body radii
 * (3 + 7 each). Used as a safe broad-phase radius for mate pairing.
 */
const MAX_MATE_PROXIMITY = 48
