import { markPendingDeathCause } from '../deathCause'
import { cloneDNA, crossover, mutate } from '../dna'
import {
  cloneBrainDna,
  createRandomBrainDna,
  crossoverBrainDna,
  mutateBrainDna,
  normalizeBrainDna,
  type BrainDNA,
} from '../brain/brainGenome'
import { createBrainState } from '../brain/network'
import { consolidateLearnedBrain } from '../brain/learning'
import { createRandomHerbivoreDNA } from '../herbivoreBudget'
import { TREE_GRAZE_BITE_SCALE } from '../config'
import { plantBiteEffectiveness } from '../foraging'
import { plantKindFromDna } from '../plantKinds'
import { expressCreatureTraits, expressSex } from '../phenotype'
import { computeInbreedingLoad } from '../inbreeding'
import type { Rng } from '../rng'
import { toroidalDelta, toroidalDistance } from '../toroidal'
import type { Creature, Plant, Vec2 } from '../types'
import { getWorldBounds } from '../worldBounds'
import { creatureSweatLoss } from '../waterCycle'
import { plantTraits } from './plant'

export { toroidalDelta, toroidalDistance } from '../toroidal'

let nextCreatureId = 1

export function resetCreatureIds(): void {
  nextCreatureId = 1
}

export function createHerbivore(
  rng: Rng,
  position?: Vec2,
  dna = createRandomHerbivoreDNA(rng),
  brainDna: BrainDNA = createRandomBrainDna(rng),
): Creature {
  const bounds = getWorldBounds()
  const margin = Math.min(75, Math.max(40, Math.min(bounds.width, bounds.height) * 0.04))
  const traits = expressCreatureTraits(dna, 0)
  const normalizedBrain = normalizeBrainDna(brainDna)
  return {
    kind: 'creature',
    id: nextCreatureId++,
    species: 'herbivore',
    sex: expressSex(dna),
    mode: 'hungry',
    fatigue: 0,
    modeTicksInCurrent: 0,
    x: position?.x ?? rng.range(margin, bounds.width - margin),
    y: position?.y ?? rng.range(margin, bounds.height - margin),
    vx: 0,
    vy: 0,
    energy: Math.min(
      traits.maxEnergy,
      traits.reproThreshold * (traits.hungerRatio + traits.birthEnergyReserve),
    ),
    hydration: Math.min(
      traits.maxHydration,
      traits.maxHydration * (0.9 + traits.birthEnergyReserve * 0.11),
    ),
    age: 0,
    dna,
    brainDna: normalizedBrain,
    brain: createBrainState(normalizedBrain),
    heading: rng.range(0, Math.PI * 2),
    reproductionCooldown: 0,
    pregnancyTicksRemaining: 0,
    pendingBirthEnergy: 0,
    wanderX: rng.range(margin, bounds.width - margin),
    wanderY: rng.range(margin, bounds.height - margin),
    wanderTicksRemaining: rng.int(traits.wanderDurationMin, traits.wanderDurationMin + traits.wanderDurationSpan),
    attackCooldown: 0,
    inbreedingLoad: 0,
    memories: [],
  }
}

export function creatureTraits(creature: Creature) {
  if (creature.traitsCache !== undefined && creature.traitsCacheLoad === creature.inbreedingLoad) {
    return creature.traitsCache
  }
  const traits = expressCreatureTraits(creature.dna, creature.inbreedingLoad)
  creature.traitsCache = traits
  creature.traitsCacheLoad = creature.inbreedingLoad
  return traits
}

export function moveAwayFrom(creature: Creature, threat: Vec2, traits = creatureTraits(creature)): void {
  const { dx, dy } = toroidalDelta(creature, threat)
  const dist = Math.hypot(dx, dy)
  if (dist < traits.stopDistance) {
    creature.vx = traits.speed
    creature.vy = 0
    return
  }
  creature.vx = (-dx / dist) * traits.speed
  creature.vy = (-dy / dist) * traits.speed
}

export function moveToward(creature: Creature, target: Vec2, traits = creatureTraits(creature)): void {
  const { dx, dy } = toroidalDelta(creature, target)
  const dist = Math.hypot(dx, dy)
  if (dist < traits.stopDistance) return
  creature.vx = (dx / dist) * traits.speed
  creature.vy = (dy / dist) * traits.speed
}

export function applyMovement(creature: Creature): void {
  const bounds = getWorldBounds()
  creature.x = wrap(creature.x + creature.vx, bounds.width)
  creature.y = wrap(creature.y + creature.vy, bounds.height)
}

export function applyMetabolism(
  creature: Creature,
  tempC: number,
  relativeHumidity: number,
  raining = false,
): number {
  const traits = creatureTraits(creature)
  const metabolismScale = creature.mode === 'sleepy' ? traits.sleepMetabolismScale : 1
  creature.energy -= traits.metabolism * metabolismScale
  const sweatRate = creatureSweatLoss(
    traits.thirstDehydration * metabolismScale,
    tempC,
    relativeHumidity,
    raining,
  )
  const sweat = Math.min(creature.hydration, sweatRate)
  creature.hydration -= sweat
  creature.age += 1
  if (creature.reproductionCooldown > 0) {
    creature.reproductionCooldown -= 1
  }
  if (creature.attackCooldown > 0) {
    creature.attackCooldown -= 1
  }
  applyFatigue(creature)
  return sweat
}

export function hungryEnterLine(creature: Creature): number {
  const traits = creatureTraits(creature)
  return traits.reproThreshold * traits.hungerRatio
}

export function hungryExitLine(creature: Creature): number {
  const traits = creatureTraits(creature)
  return hungryEnterLine(creature) + traits.reproThreshold * traits.satietyBuffer
}

export function needsFood(creature: Creature): boolean {
  return creature.energy < hungryExitLine(creature)
}

/** Graze/browse whenever in hungry mode — not only after energy drops below the exit line. */
export function shouldForageForFood(creature: Creature): boolean {
  if (creature.mode === 'horny' || creature.mode === 'sleepy') return false
  if (creature.mode === 'thirsty') return needsFood(creature)
  return creature.mode === 'hungry'
}

export function thirstyEnterLine(creature: Creature): number {
  const traits = creatureTraits(creature)
  return traits.maxHydration * traits.thirstRatio
}

export function thirstyExitLine(creature: Creature): number {
  const traits = creatureTraits(creature)
  return thirstyEnterLine(creature) + traits.maxHydration * traits.satietyBuffer * 0.52
}

export function needsWater(creature: Creature): boolean {
  return creature.hydration < thirstyExitLine(creature)
}

export function capHydration(creature: Creature, amount: number): number {
  return Math.min(creatureTraits(creature).maxHydration, amount)
}

/** What mode instincts want right now — before stickiness is applied. */
export function desiredMode(creature: Creature): Creature['mode'] {
  const hungryEnter = hungryEnterLine(creature)
  const thirstyEnter = thirstyEnterLine(creature)
  const thirstyExit = thirstyExitLine(creature)
  const hornyAt = reproduceModeThreshold(creature)
  const traits = creatureTraits(creature)
  const minEnergyToSleep = traits.reproThreshold * traits.minSleepEnergyRatio

  const needsThirst =
    creature.hydration < thirstyEnter ||
    (creature.mode === 'thirsty' && creature.hydration < thirstyExit)
  const needsHunger =
    creature.energy < hungryEnter || (creature.mode === 'hungry' && creature.energy < hornyAt)

  if (needsThirst && needsHunger) {
    const thirstFrac = creature.hydration / Math.max(thirstyEnter, 0.01)
    const hungerFrac = creature.energy / Math.max(hungryEnter, 0.01)
    return thirstFrac < hungerFrac ? 'thirsty' : 'hungry'
  }
  if (needsThirst) return 'thirsty'
  if (needsHunger) return 'hungry'

  if (creature.fatigue >= traits.sleepFatigueThreshold && creature.energy >= minEnergyToSleep) {
    return 'sleepy'
  }
  if (
    canSeekMate(creature) &&
    creature.energy >= hornyAt &&
    creature.hydration >= thirstyEnter
  ) {
    return 'horny'
  }
  return 'hungry'
}

function modeStickinessTicks(creature: Creature): number {
  const traits = creatureTraits(creature)
  return traits.modeCommitment + Math.floor(traits.satietyBuffer * 120)
}

/** Pick mode with stickiness so hungry/horny don't flip every tick. */
export function updateMode(creature: Creature): void {
  creature.modeTicksInCurrent += 1
  const target = desiredMode(creature)
  const thirstyEnter = thirstyEnterLine(creature)
  const hungryEnter = hungryEnterLine(creature)

  if (creature.hydration < thirstyEnter) {
    if (creature.mode !== 'thirsty') {
      creature.mode = 'thirsty'
      creature.modeTicksInCurrent = 0
    }
    return
  }

  if (creature.energy < hungryEnter) {
    if (creature.mode !== 'hungry') {
      creature.mode = 'hungry'
      creature.modeTicksInCurrent = 0
    }
    return
  }

  if (target !== creature.mode && creature.modeTicksInCurrent >= modeStickinessTicks(creature)) {
    creature.mode = target
    creature.modeTicksInCurrent = 0
  }
}

function applyFatigue(creature: Creature): void {
  const traits = creatureTraits(creature)
  if (creature.mode === 'sleepy') {
    creature.fatigue = Math.max(0, creature.fatigue - traits.sleepFatigueRecovery)
  } else {
    creature.fatigue += traits.awakeFatigueGain
  }
}

export function tryEatPlant(creature: Creature, plant: Plant): number {
  const traits = creatureTraits(creature)
  const { dx, dy } = toroidalDelta(creature, plant)
  const dist = Math.hypot(dx, dy)
  const reach = traits.radius + traits.forageReach
  if (dist > reach) return 0

  const kind = plantKindFromDna(plant.dna)
  const effectiveness = plantBiteEffectiveness(traits, plantTraits(plant), kind)
  const biteScale = kind === 'tree' ? TREE_GRAZE_BITE_SCALE : 1
  const bite = traits.biteAmount * effectiveness * biteScale
  return Math.min(bite, plant.energy)
}

export function canReproduce(creature: Creature): boolean {
  const traits = creatureTraits(creature)
  return (
    creature.reproductionCooldown <= 0 &&
    creature.energy >= mateEnergyMinimum(creature) &&
    creature.hydration >= thirstyEnterLine(creature) &&
    creature.age > traits.maturationAge
  )
}

export function mateEnergyMinimum(creature: Creature): number {
  const traits = creatureTraits(creature)
  return traits.reproThreshold * (1 - traits.mateLibidoFactor)
}

/** Energy needed to enter horny mode — gene-driven fraction between hungry and sated. */
export function reproduceModeThreshold(creature: Creature): number {
  const traits = creatureTraits(creature)
  const enter = hungryEnterLine(creature)
  const exit = hungryExitLine(creature)
  const mateMin = mateEnergyMinimum(creature)
  return Math.max(mateMin, enter + (exit - enter) * traits.courtshipEagerness)
}

export function canSeekMate(creature: Creature): boolean {
  if (!canReproduce(creature)) return false
  if (creature.sex === 'female' && creature.pregnancyTicksRemaining > 0) return false
  return true
}

export function isPregnant(creature: Creature): boolean {
  return creature.pregnancyTicksRemaining > 0
}

/** Max center-to-center distance for mating (gene range plus both body radii). */
export function mateProximity(a: Creature, b: Creature): number {
  const traitsA = creatureTraits(a)
  const traitsB = creatureTraits(b)
  return Math.max(traitsA.mateRange, traitsB.mateRange) + traitsA.radius + traitsB.radius
}

/** Pair a male and female; the female carries the pregnancy until gestation ends. */
export function mate(male: Creature, female: Creature): boolean {
  if (male.sex !== 'male' || female.sex !== 'female') return false
  if (!canReproduce(male) || !canReproduce(female)) return false
  if (female.pregnancyTicksRemaining > 0) return false

  const traitsMale = creatureTraits(male)
  const traitsFemale = creatureTraits(female)
  const gift =
    male.energy * traitsMale.offspringGift * 0.5 +
    female.energy * traitsFemale.offspringGift * 0.5

  male.energy -= male.energy * traitsMale.offspringGift * 0.5
  female.energy -= female.energy * traitsFemale.offspringGift * 0.5
  male.reproductionCooldown = traitsMale.reproCooldown
  female.reproductionCooldown = traitsFemale.reproCooldown

  female.pregnancyTicksRemaining = traitsFemale.pregnancyTicks
  female.pregnancyPartnerDna = cloneDNA(male.dna)
  female.pregnancyPartnerBrainDna = cloneBrainDna(male.brainDna)
  female.pendingBirthEnergy = Math.min(traitsFemale.maxEnergy, gift)
  return true
}

export function tickPregnancy(creature: Creature, rng: Rng): Creature | null {
  if (creature.pregnancyTicksRemaining <= 0) return null

  creature.pregnancyTicksRemaining -= 1
  if (creature.pregnancyTicksRemaining > 0) return null
  if (!creature.pregnancyPartnerDna) return null

  const childDna = mutate(
    crossover(creature.dna, creature.pregnancyPartnerDna, rng),
    rng,
  )
  const motherBrain = consolidatedBrainDna(creature)
  const fatherBrain = creature.pregnancyPartnerBrainDna ?? motherBrain
  const childBrainDna = mutateBrainDna(crossoverBrainDna(motherBrain, fatherBrain, rng), rng)
  const child = createHerbivore(
    rng,
    { x: creature.x, y: creature.y },
    childDna,
    childBrainDna,
  )
  child.inbreedingLoad = computeInbreedingLoad(creature.dna, creature.pregnancyPartnerDna, childDna)
  child.energy = creature.pendingBirthEnergy

  const childTraits = creatureTraits(child)
  const targetHydration = Math.min(
    childTraits.maxHydration,
    childTraits.maxHydration * (0.82 + childTraits.birthEnergyReserve * 0.14),
  )
  const fromMother = Math.min(creature.hydration * 0.14, targetHydration)
  creature.hydration = Math.max(0, creature.hydration - fromMother)
  child.hydration = fromMother

  creature.pregnancyPartnerDna = undefined
  creature.pregnancyPartnerBrainDna = undefined
  creature.pendingBirthEnergy = 0
  return child
}

/**
 * The brain genome a creature passes to offspring: its birth genome with a fraction of the weights
 * it learned during life folded back in (Lamarckian inheritance).
 */
function consolidatedBrainDna(creature: Creature): BrainDNA {
  if (creature.brain) return consolidateLearnedBrain(creature.brainDna, creature.brain)
  return cloneBrainDna(creature.brainDna)
}

export function isAlive(creature: Creature): boolean {
  const traits = creatureTraits(creature)
  return creature.energy > 0 && creature.hydration > 0 && creature.age < traits.maxAge
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function wrap(value: number, max: number): number {
  if (value < 0) return value + max
  if (value >= max) return value - max
  return value
}

export function capEnergy(creature: Creature, amount: number): number {
  return Math.min(creatureTraits(creature).maxEnergy, amount)
}

const ATTACK_AGGRESSION_THRESHOLD = 0.32

export function effectiveAggressiveness(creature: Creature): number {
  const traits = creatureTraits(creature)
  const modeScale = creature.mode === 'sleepy' ? 0.25 : 1
  return traits.aggressiveness * modeScale
}

export function tryAttackCreature(attacker: Creature, victim: Creature): boolean {
  const traits = creatureTraits(attacker)
  if (effectiveAggressiveness(attacker) < ATTACK_AGGRESSION_THRESHOLD) return false
  if (attacker.attackCooldown > 0) return false

  const dist = toroidalDistance(attacker, victim)
  if (dist > traits.attackRange) return false

  const damage = traits.attackDamage * (0.55 + traits.aggressiveness * 0.45)
  victim.energy -= damage
  markPendingDeathCause(victim, 'combat')
  attacker.energy -= damage * 0.12
  attacker.attackCooldown = Math.floor(10 + (1 - traits.aggressiveness) * 22)
  return true
}
