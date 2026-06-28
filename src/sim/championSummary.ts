import { geneValue } from './dna'
import type { DNA } from './dna'
import { HerbivoreGene, type HerbivoreGeneIndex, type HerbivoreTraits } from './genes'
import type { AutoChampionRecord } from './autoChampion'
import { formatYears } from './timeScale'

export type ChampionSummary = {
  archetype: string
  intro: string
  body: string
  highlights: string[]
  caveat: string | null
}

type Insight = {
  score: number
  highlight: string
  clause: string
}

function lowIsBetter(value: number, goodAt: number, badAt: number): number {
  if (badAt <= goodAt) return 0
  return Math.max(0, Math.min(1, (badAt - value) / (badAt - goodAt)))
}

function highIsBetter(value: number, goodAt: number, badAt: number): number {
  if (goodAt <= badAt) return 0
  return Math.max(0, Math.min(1, (value - badAt) / (goodAt - badAt)))
}

function pronoun(sex: 'male' | 'female'): { subject: string; possessive: string } {
  if (sex === 'female') {
    return { subject: 'She', possessive: 'her' }
  }
  return { subject: 'He', possessive: 'his' }
}

function joinClauses(clauses: string[]): string {
  if (clauses.length === 0) return ''
  if (clauses.length === 1) return clauses[0]
  if (clauses.length === 2) return `${clauses[0]} and ${clauses[1]}`
  return `${clauses.slice(0, -1).join(', ')}, and ${clauses[clauses.length - 1]}`
}

function pickArchetype(scores: Record<string, number>): string {
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1])
  const top = ranked[0]?.[0] ?? 'generalist'

  const labels: Record<string, string> = {
    frugal_breeder: 'Frugal swarm breeder',
    crowd_specialist: 'Dense clan specialist',
    predator: 'Opportunist predator',
    grazer: 'Efficient grazer',
    rapid_cycle: 'Rapid-cycle reproducer',
    survivor: 'Hardy survivor',
    generalist: 'Balanced generalist',
  }
  return labels[top] ?? labels.generalist
}

function collectInsights(traits: HerbivoreTraits, dna: DNA): Insight[] {
  const g = (gene: HerbivoreGeneIndex) => geneValue(dna, gene)
  const insights: Insight[] = []

  const metabolism = lowIsBetter(traits.metabolism, 0.08, 0.22)
  if (metabolism > 0.45) {
    insights.push({
      score: metabolism,
      highlight: 'Very low metabolism',
      clause: `${metabolism > 0.75 ? 'extremely' : 'unusually'} cheap to keep alive`,
    })
  }

  const reproThreshold = lowIsBetter(traits.reproThreshold, 65, 120)
  if (reproThreshold > 0.45) {
    insights.push({
      score: reproThreshold,
      highlight: 'Low energy bar for breeding',
      clause: 'needs little stored energy before mating',
    })
  }

  const hunger = lowIsBetter(traits.hungerRatio, 0.38, 0.68)
  if (hunger > 0.4) {
    insights.push({
      score: hunger,
      highlight: 'Stays sated longer',
      clause: 'spends less time hunting for food',
    })
  }

  const space = highIsBetter(traits.spaceTolerance, 0.72, 0.25)
  if (space > 0.45) {
    insights.push({
      score: space,
      highlight: 'High crowding tolerance',
      clause: 'tolerates dense groups without fleeing neighbors',
    })
  }

  const assortment = highIsBetter(traits.geneticAssortment, 0.68, 0.35)
  if (assortment > 0.45) {
    insights.push({
      score: assortment,
      highlight: 'Kin-biased mating',
      clause: 'prefers genetically similar mates, locking in a winning genome',
    })
  }

  const inbreeding = highIsBetter(traits.inbreedingTolerance, 0.55, 0.2)
  if (inbreeding > 0.45) {
    insights.push({
      score: inbreeding,
      highlight: 'Inbreeding tolerant',
      clause: 'weathers inbreeding load better than average',
    })
  }

  const cannibal = highIsBetter(traits.cannibalPredilection, 0.55, 0.15)
  if (cannibal > 0.45) {
    insights.push({
      score: cannibal,
      highlight: 'Cannibal opportunist',
      clause: 'eats dissimilar creatures and corpses when plants run low',
    })
  }

  const forage = highIsBetter(traits.forageEfficiency, 0.75, 0.35)
  if (forage > 0.45) {
    insights.push({
      score: forage,
      highlight: 'Strong plant foraging',
      clause: 'extracts more energy from each plant bite',
    })
  }

  const maturation = lowIsBetter(traits.maturationAge, 45, 110)
  if (maturation > 0.45) {
    insights.push({
      score: maturation,
      highlight: 'Fast maturation',
      clause: 'reaches breeding age quickly',
    })
  }

  const gestation = lowIsBetter(traits.pregnancyTicks, 100, 220)
  if (gestation > 0.45) {
    insights.push({
      score: gestation,
      highlight: 'Short gestation',
      clause: 'finishes pregnancies faster than most',
    })
  }

  const cooldown = lowIsBetter(traits.reproCooldown, 80, 200)
  if (cooldown > 0.45) {
    insights.push({
      score: cooldown,
      highlight: 'Short repro cooldown',
      clause: 'returns to mating sooner after each birth',
    })
  }

  const libido = highIsBetter(traits.libido, 0.65, 0.25)
  if (libido > 0.45) {
    insights.push({
      score: libido,
      highlight: 'High libido',
      clause: 'enters mating mode readily when energy allows',
    })
  }

  const mateEase = lowIsBetter(traits.mateSelectivity, 0.25, 0.72)
  if (mateEase > 0.45) {
    insights.push({
      score: mateEase,
      highlight: 'Low mate pickiness',
      clause: 'accepts partners easily instead of searching for a perfect match',
    })
  }

  const courtship = highIsBetter(traits.courtshipEagerness, 0.42, 0.2)
  if (courtship > 0.45) {
    insights.push({
      score: courtship,
      highlight: 'Eager to court',
      clause: 'enters horny mode before fully sated, spending more time seeking mates',
    })
  }

  const closeLeniency = highIsBetter(traits.closeMateLeniency, 0.5, 0.25)
  if (closeLeniency > 0.45) {
    insights.push({
      score: closeLeniency,
      highlight: 'Commits when close',
      clause: 'accepts a partner more readily once physically in mate range',
    })
  }

  const offspringGift = lowIsBetter(traits.offspringGift, 0.18, 0.32)
  if (offspringGift > 0.45) {
    insights.push({
      score: offspringGift,
      highlight: 'Selfish reproduction',
      clause: 'donates less energy to offspring, keeping parents alive',
    })
  }

  const lifespan = highIsBetter(traits.maxAge, 2200, 1100)
  if (lifespan > 0.45) {
    insights.push({
      score: lifespan,
      highlight: 'Long lifespan',
      clause: 'lives long enough for mature adults to accumulate in the score',
    })
  }

  const disease = highIsBetter(traits.diseaseResistance, 0.58, 0.25)
  if (disease > 0.45) {
    insights.push({
      score: disease,
      highlight: 'Disease resistant',
      clause: 'resists infection pressure better than most',
    })
  }

  const aggression = highIsBetter(traits.aggressiveness, 0.55, 0.2)
  if (aggression > 0.45 && cannibal < 0.35) {
    insights.push({
      score: aggression * 0.85,
      highlight: 'Aggressive',
      clause: 'damages neighbors through direct attacks',
    })
  }

  const plantHardiness = highIsBetter(traits.plantHardinessBreak, 0.95, 0.45)
  if (plantHardiness > 0.45) {
    insights.push({
      score: plantHardiness * 0.9,
      highlight: 'Eats tough plants',
      clause: 'can bite hardy plants others struggle to eat',
    })
  }

  const mutation = lowIsBetter(traits.mutationRate, 0.002, 0.008)
  if (mutation > 0.45) {
    insights.push({
      score: mutation * 0.7,
      highlight: 'Stable genome',
      clause: 'mutates slowly, preserving the core strategy',
    })
  }

  const size = lowIsBetter(traits.radius, 4.5, 8.5)
  if (size > 0.45) {
    insights.push({
      score: size * 0.65,
      highlight: 'Small body',
      clause: 'keeps movement and space costs down in crowds',
    })
  }

  const elongation = g(HerbivoreGene.BodyElongation)
  if (elongation > 0.78 || elongation < 0.22) {
    insights.push({
      score: 0.25,
      highlight: elongation > 0.78 ? 'Elongated build' : 'Compact build',
      clause: elongation > 0.78 ? 'has an elongated silhouette' : 'has a compact silhouette',
    })
  }

  return insights.sort((a, b) => b.score - a.score)
}

function categoryScores(traits: HerbivoreTraits): Record<string, number> {
  return {
    frugal_breeder:
      lowIsBetter(traits.metabolism, 0.08, 0.22) * 1.2 +
      lowIsBetter(traits.reproThreshold, 65, 120) +
      lowIsBetter(traits.hungerRatio, 0.38, 0.68) +
      lowIsBetter(traits.offspringGift, 0.18, 0.32) * 0.8,
    crowd_specialist:
      highIsBetter(traits.spaceTolerance, 0.72, 0.25) * 1.2 +
      highIsBetter(traits.geneticAssortment, 0.68, 0.35) +
      highIsBetter(traits.inbreedingTolerance, 0.55, 0.2) +
      lowIsBetter(traits.mateSelectivity, 0.25, 0.72) * 0.7,
    predator:
      highIsBetter(traits.cannibalPredilection, 0.55, 0.15) * 1.3 +
      highIsBetter(traits.aggressiveness, 0.55, 0.2) * 0.7 +
      highIsBetter(traits.biteAmount, 22, 10) * 0.5,
    grazer:
      highIsBetter(traits.forageEfficiency, 0.75, 0.35) * 1.2 +
      highIsBetter(traits.plantHardinessBreak, 0.95, 0.45) +
      highIsBetter(traits.biteAmount, 22, 10) * 0.6,
    rapid_cycle:
      lowIsBetter(traits.maturationAge, 45, 110) +
      lowIsBetter(traits.pregnancyTicks, 100, 220) +
      lowIsBetter(traits.reproCooldown, 80, 200) +
      highIsBetter(traits.libido, 0.65, 0.25) * 0.8,
    survivor:
      highIsBetter(traits.maxAge, 2200, 1100) +
      highIsBetter(traits.diseaseResistance, 0.58, 0.25) +
      highIsBetter(traits.diseaseRecovery, 0.55, 0.25) * 0.8,
  }
}

function buildCaveat(traits: HerbivoreTraits, record: AutoChampionRecord): string | null {
  const risks: string[] = []

  if (highIsBetter(traits.geneticAssortment, 0.68, 0.35) > 0.5 && traits.inbreedingTolerance < 0.35) {
    risks.push('heavy inbreeding can still erode health over time')
  }
  if (traits.cannibalPredilection > 0.45 && traits.forageEfficiency < 0.45) {
    risks.push('relying on meat when plants vanish is a dangerous long-term bet')
  }
  if (traits.diseaseResistance < 0.3 && record.peakPopulation > 25) {
    risks.push('dense populations may invite disease outbreaks')
  }
  if (traits.metabolism > 0.18 && traits.reproThreshold > 110) {
    risks.push('high living and breeding costs make this build fragile if food runs short')
  }
  if (traits.spaceTolerance < 0.35 && record.peakPopulation > 30) {
    risks.push('crowd-averse instincts fight against the density that built this lineage')
  }

  if (risks.length === 0) return null
  return `Possible weak points: ${risks.join('; ')}.`
}

export function summarizeChampion(
  traits: HerbivoreTraits,
  dna: DNA,
  record: AutoChampionRecord,
): ChampionSummary {
  const { subject } = pronoun(record.genome.sex)
  const insights = collectInsights(traits, dna)
  const top = insights.slice(0, 4)
  const archetype = pickArchetype(categoryScores(traits))

  const intro =
    `This lineage peaked at ${record.peakPopulation} members, stayed together for ${formatYears(record.lineageSpanTicks)}, ` +
    `and scored ${record.fitnessScore.toFixed(0)} fitness — the sim rewards population, persistence, and observed pregnancies in the group.`

  const bodyParts: string[] = []
  bodyParts.push(
    `${subject} is a representative medoid of that winning cluster — a “${archetype}” whose DNA skews toward ${top[0]?.highlight.toLowerCase() ?? 'balanced survival traits'}.`,
  )

  if (top.length > 0) {
    bodyParts.push(`${subject} ${joinClauses(top.map((item) => item.clause))}.`)
  }

  bodyParts.push(
    `Together, that lets the lineage ${record.peakPopulation >= 40 ? 'swarm the map' : 'outgrow rivals'}, ` +
      `stack mature adults for scoring, and ${record.observationCount > 3 ? 'keep showing up in fitness checks' : 'briefly dominate before the world shifts'}.`,
  )

  return {
    archetype,
    intro,
    body: bodyParts.join(' '),
    highlights: top.map((item) => item.highlight),
    caveat: buildCaveat(traits, record),
  }
}
