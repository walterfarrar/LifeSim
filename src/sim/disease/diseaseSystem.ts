import { creatureTraits, toroidalDistance } from '../entities/creature'
import type { Creature } from '../types'
import type { Rng } from '../rng'
import { PATHOGEN_CHAMPION_CHECK_INTERVAL } from '../config'
import type { SimSettings } from '../simSettings'
import { pickPathogenChampionDna } from '../pathogenFounderGenomes'
import {
  antigenMatch,
  createPathogenFromChampionDna,
  createRandomPathogen,
  DISEASE_SPREAD_RANGE,
  driftPathogenGenome,
  immuneProfileFromDna,
  MAX_PATHOGEN_STRAINS,
  MIN_INFECTION_CHANCE,
  MIN_SEVERITY_FLOOR,
  mutatePathogenOnSpread,
  pathogenTraits,
  type Pathogen,
} from './pathogen'

export function infectCreature(creature: Creature, pathogen: Pathogen, rng: Rng): void {
  const traits = creatureTraits(creature)
  const susceptibility = exposureSusceptibility(creature, pathogen, traits)
  if (!rng.chance(susceptibility)) return

  creature.infection = {
    pathogenId: pathogen.id,
    severity: Math.max(MIN_SEVERITY_FLOOR, susceptibility * rng.range(0.35, 0.85)),
    ticksInfected: 0,
  }
}

function exposureSusceptibility(
  creature: Creature,
  pathogen: Pathogen,
  traits = creatureTraits(creature),
): number {
  const strain = pathogenTraits(pathogen)
  const match = antigenMatch(immuneProfileFromDna(creature.dna), strain.antigens)
  const resist =
    traits.diseaseResistance * 0.52 +
    match * traits.diseaseResistance * 0.28 +
    traits.diseaseRecovery * 0.12
  return Math.max(MIN_INFECTION_CHANCE, 1 - Math.min(0.92, resist))
}

function pathogenById(pathogens: Pathogen[], id: number): Pathogen | undefined {
  return pathogens.find((p) => p.id === id)
}

function registerPathogen(pathogens: Pathogen[], strain: Pathogen): Pathogen {
  pathogens.push(strain)
  if (pathogens.length > MAX_PATHOGEN_STRAINS) {
    pathogens.sort((a, b) => b.generation - a.generation)
    pathogens.length = MAX_PATHOGEN_STRAINS
  }
  return strain
}

function resolveSpreadStrain(pathogens: Pathogen[], source: Pathogen, rng: Rng): Pathogen {
  if (!rng.chance(0.32)) return source
  return registerPathogen(pathogens, mutatePathogenOnSpread(source, rng))
}

export function tickDiseaseSystem(
  creatures: Creature[],
  pathogens: Pathogen[],
  rng: Rng,
  tick: number,
  settings?: SimSettings,
): void {
  if (pathogens.length === 0 && creatures.length === 0) return

  if (settings) {
    maybeIntroduceChampionPathogen(pathogens, creatures, settings, rng, tick)
  }

  if (pathogens.length === 0) return

  maybeEnvironmentalSpark(creatures, pathogens, rng, tick)
  spreadInfections(creatures, pathogens, rng)
  applyInfectionHarm(creatures, pathogens)
  tickRecoveries(creatures, pathogens, rng)
  driftEndemicStrains(pathogens, rng, tick)
}

/** Weighted pick from the hall — slight mutation so reintroduced strains can evolve again. */
function maybeIntroduceChampionPathogen(
  pathogens: Pathogen[],
  creatures: Creature[],
  settings: SimSettings,
  rng: Rng,
  tick: number,
): void {
  if (creatures.length < 6) return
  if (tick < PATHOGEN_CHAMPION_CHECK_INTERVAL) return
  if (tick % PATHOGEN_CHAMPION_CHECK_INTERVAL !== 0) return
  if (settings.pathogenChampionSpawnChance <= 0) return
  if (!rng.chance(settings.pathogenChampionSpawnChance)) return
  if (pathogens.length >= MAX_PATHOGEN_STRAINS) return

  const championDna = pickPathogenChampionDna(rng)
  if (!championDna) return

  const strain = createPathogenFromChampionDna(championDna, rng, { mutate: true })
  pathogens.push(strain)

  if (rng.chance(0.55)) {
    const target = creatures[rng.int(0, creatures.length - 1)]
    if (target && !target.infection) {
      infectCreature(target, strain, rng)
    }
  }
}

function maybeEnvironmentalSpark(
  creatures: Creature[],
  pathogens: Pathogen[],
  rng: Rng,
  tick: number,
): void {
  if (creatures.length < 8) return
  if (tick % 90 !== 0) return
  if (!rng.chance(0.18)) return

  const target = creatures[rng.int(0, creatures.length - 1)]
  if (!target || target.infection) return

  const strain = pathogens[rng.int(0, pathogens.length - 1)]
  if (strain) infectCreature(target, strain, rng)
}

function spreadInfections(creatures: Creature[], pathogens: Pathogen[], rng: Rng): void {
  for (const source of creatures) {
    if (!source.infection) continue
    const strain = pathogenById(pathogens, source.infection.pathogenId)
    if (!strain) {
      source.infection = undefined
      continue
    }

    const sourceTraits = creatureTraits(source)
    const strainTraits = pathogenTraits(strain)
    const spreadRange = DISEASE_SPREAD_RANGE + sourceTraits.contagion * 18

    for (const target of creatures) {
      if (target.id === source.id) continue
      if (toroidalDistance(source, target) > spreadRange) continue

      if (
        target.infection?.pathogenId === strain.id &&
        (target.infection.severity ?? 0) > 0.35
      ) {
        continue
      }

      const targetTraits = creatureTraits(target)
      const susceptibility = exposureSusceptibility(target, strain, targetTraits)
      const transmission =
        strainTraits.transmissibility *
        (0.35 + source.infection.severity * 0.65) *
        (0.4 + sourceTraits.contagion * 0.6) *
        susceptibility

      if (!rng.chance(Math.min(0.85, transmission))) continue

      const spreadStrain = resolveSpreadStrain(pathogens, strain, rng)
      if (!target.infection || target.infection.pathogenId !== spreadStrain.id) {
        infectCreature(target, spreadStrain, rng)
      } else {
        target.infection.severity = Math.min(1, target.infection.severity + susceptibility * 0.08)
      }
    }
  }
}

function applyInfectionHarm(creatures: Creature[], pathogens: Pathogen[]): void {
  for (const creature of creatures) {
    if (!creature.infection) continue
    const strain = pathogenById(pathogens, creature.infection.pathogenId)
    if (!strain) {
      creature.infection = undefined
      continue
    }

    creature.infection.ticksInfected += 1
    const traits = creatureTraits(creature)
    const strainTraits = pathogenTraits(strain)
    const match = antigenMatch(immuneProfileFromDna(creature.dna), strainTraits.antigens)
    const mitigated = Math.min(0.78, traits.diseaseResistance * 0.5 + match * 0.28)

    const effectiveSeverity = Math.max(
      MIN_SEVERITY_FLOOR,
      creature.infection.severity * (1 - mitigated),
    )

    const harm =
      effectiveSeverity * strainTraits.virulence * (0.35 + creature.infection.ticksInfected * 0.002)
    creature.energy -= harm + traits.metabolism * effectiveSeverity * 0.15

    if (creature.infection.ticksInfected % 40 === 0) {
      creature.infection.severity = Math.min(1, creature.infection.severity + 0.04 * (1 - mitigated))
    }
  }
}

function tickRecoveries(creatures: Creature[], pathogens: Pathogen[], rng: Rng): void {
  for (const creature of creatures) {
    if (!creature.infection) continue
    if (!pathogenById(pathogens, creature.infection.pathogenId)) {
      creature.infection = undefined
      continue
    }

    const traits = creatureTraits(creature)
    const strain = pathogenById(pathogens, creature.infection.pathogenId)!
    const strainTraits = pathogenTraits(strain)
    const match = antigenMatch(immuneProfileFromDna(creature.dna), strainTraits.antigens)
    const recovery =
      traits.diseaseRecovery * 0.004 + match * 0.002 + (creature.mode === 'sleepy' ? 0.002 : 0)

    creature.infection.severity -= recovery
    if (creature.infection.severity <= 0.05 && rng.chance(0.08 + traits.diseaseRecovery * 0.12)) {
      creature.infection = undefined
    }
  }
}

function driftEndemicStrains(pathogens: Pathogen[], rng: Rng, tick: number): void {
  if (tick % 600 !== 0) return
  for (const strain of pathogens) {
    if (!rng.chance(0.35)) continue
    driftPathogenGenome(strain, rng)
  }
}

export function seedWildPathogen(pathogens: Pathogen[], rng: Rng): Pathogen {
  const strain = createRandomPathogen(rng)
  pathogens.push(strain)
  return strain
}
