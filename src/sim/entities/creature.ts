import { cloneDNA, createRandomDNA, crossover, mutate } from '../dna'
import { plantBiteEffectiveness } from '../foraging'
import { expressCreatureTraits, expressSex } from '../phenotype'
import { computeInbreedingLoad } from '../inbreeding'
import type { Rng } from '../rng'
import { toroidalDelta, toroidalDistance } from '../toroidal'
import type { Creature, Plant, Vec2 } from '../types'
import { plantTraits } from './plant'
import { WORLD_HEIGHT, WORLD_WIDTH } from '../config'

export { toroidalDelta, toroidalDistance } from '../toroidal'

let nextCreatureId = 1

export function resetCreatureIds(): void {
  nextCreatureId = 1
}

export function createHerbivore(rng: Rng, position?: Vec2, dna = createRandomDNA(rng)): Creature {
  const traits = expressCreatureTraits(dna, 0)
  return {
    kind: 'creature',
    id: nextCreatureId++,
    species: 'herbivore',
    sex: expressSex(dna),
    mode: 'hungry',
    fatigue: 0,
    modeTicksInCurrent: 0,
    x: position?.x ?? rng.range(40, WORLD_WIDTH - 40),
    y: position?.y ?? rng.range(40, WORLD_HEIGHT - 40),
    vx: 0,
    vy: 0,
    energy: Math.min(
      traits.maxEnergy,
      traits.reproThreshold * (traits.hungerRatio + traits.birthEnergyReserve),
    ),
    age: 0,
    dna,
    reproductionCooldown: 0,
    pregnancyTicksRemaining: 0,
    pendingBirthEnergy: 0,
    wanderX: rng.range(40, WORLD_WIDTH - 40),
    wanderY: rng.range(40, WORLD_HEIGHT - 40),
    wanderTicksRemaining: rng.int(traits.wanderDurationMin, traits.wanderDurationMin + traits.wanderDurationSpan),
    attackCooldown: 0,
    inbreedingLoad: 0,
  }
}

export function creatureTraits(creature: Creature) {
  return expressCreatureTraits(creature.dna, creature.inbreedingLoad)
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
  creature.x = wrap(creature.x + creature.vx, WORLD_WIDTH)
  creature.y = wrap(creature.y + creature.vy, WORLD_HEIGHT)
}

export function applyMetabolism(creature: Creature): void {
  const traits = creatureTraits(creature)
  const metabolismScale = creature.mode === 'sleepy' ? traits.sleepMetabolismScale : 1
  creature.energy -= traits.metabolism * metabolismScale
  creature.age += 1
  if (creature.reproductionCooldown > 0) {
    creature.reproductionCooldown -= 1
  }
  if (creature.attackCooldown > 0) {
    creature.attackCooldown -= 1
  }
  applyFatigue(creature)
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

/** What mode instincts want right now — before stickiness is applied. */
export function desiredMode(creature: Creature): Creature['mode'] {
  const hungryEnter = hungryEnterLine(creature)
  const hungryExit = hungryExitLine(creature)
  const traits = creatureTraits(creature)
  const minEnergyToSleep = traits.reproThreshold * traits.minSleepEnergyRatio

  if (creature.energy < hungryEnter || (creature.mode === 'hungry' && creature.energy < hungryExit)) {
    return 'hungry'
  }
  if (creature.fatigue >= traits.sleepFatigueThreshold && creature.energy >= minEnergyToSleep) {
    return 'sleepy'
  }
  if (canSeekMate(creature) && creature.energy >= hungryExit) {
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
  const hungryEnter = hungryEnterLine(creature)

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
    creature.energy = Math.min(traits.maxEnergy, creature.energy + traits.sleepEnergyRecovery)
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

  const effectiveness = plantBiteEffectiveness(traits, plantTraits(plant))
  const bite = traits.biteAmount * effectiveness
  return Math.min(bite, plant.energy)
}

export function canReproduce(creature: Creature): boolean {
  const traits = creatureTraits(creature)
  return (
    creature.reproductionCooldown <= 0 &&
    creature.energy >= mateEnergyMinimum(creature) &&
    creature.age > traits.maturationAge
  )
}

export function mateEnergyMinimum(creature: Creature): number {
  const traits = creatureTraits(creature)
  return traits.reproThreshold * (1 - traits.mateLibidoFactor)
}

export function canSeekMate(creature: Creature): boolean {
  if (!canReproduce(creature)) return false
  if (creature.sex === 'female' && creature.pregnancyTicksRemaining > 0) return false
  return true
}

export function isPregnant(creature: Creature): boolean {
  return creature.pregnancyTicksRemaining > 0
}

export function mateProximity(a: Creature, b: Creature): number {
  const traitsA = creatureTraits(a)
  const traitsB = creatureTraits(b)
  return Math.max(traitsA.mateRange, traitsB.mateRange)
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
  const child = createHerbivore(
    rng,
    { x: creature.x, y: creature.y },
    childDna,
  )
  child.inbreedingLoad = computeInbreedingLoad(creature.dna, creature.pregnancyPartnerDna, childDna)
  child.energy = creature.pendingBirthEnergy

  creature.pregnancyPartnerDna = undefined
  creature.pendingBirthEnergy = 0
  return child
}

export function isAlive(creature: Creature): boolean {
  const traits = creatureTraits(creature)
  return creature.energy > 0 && creature.age < traits.maxAge
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
  attacker.energy -= damage * 0.12
  attacker.attackCooldown = Math.floor(10 + (1 - traits.aggressiveness) * 22)
  return true
}
