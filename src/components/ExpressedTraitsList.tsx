import type { HerbivoreTraits } from '../sim/genes'
import { formatYears } from '../sim/timeScale'

function fmt(value: number, digits = 1): string {
  return value.toFixed(digits)
}

type ExpressedTraitsListProps = {
  traits: HerbivoreTraits
  attackCooldown?: number
}

export function ExpressedTraitsList({ traits, attackCooldown }: ExpressedTraitsListProps) {
  return (
    <dl className="inspector-traits">
      <div><dt>Speed</dt><dd>{fmt(traits.speed, 2)}</dd></div>
      <div><dt>Radius</dt><dd>{fmt(traits.radius, 2)}</dd></div>
      <div><dt>Metabolism</dt><dd>{fmt(traits.metabolism, 3)}</dd></div>
      <div><dt>Vision</dt><dd>{fmt(traits.vision, 0)}</dd></div>
      <div><dt>Repro threshold</dt><dd>{fmt(traits.reproThreshold, 0)}</dd></div>
      <div><dt>Max age</dt><dd>{formatYears(traits.maxAge)}</dd></div>
      <div><dt>Forage efficiency</dt><dd>{fmt(traits.forageEfficiency, 2)}</dd></div>
      <div><dt>Offspring gift</dt><dd>{fmt(traits.offspringGift, 2)}</dd></div>
      <div><dt>Color</dt><dd>hsl({fmt(traits.hue, 0)}, {fmt(traits.saturation, 0)}%, {fmt(traits.lightness, 0)}%)</dd></div>
      <div><dt>Shape</dt><dd>{traits.shape}</dd></div>
      <div><dt>Hunger ratio</dt><dd>{fmt(traits.hungerRatio, 2)}</dd></div>
      <div><dt>Satiety buffer</dt><dd>{fmt(traits.satietyBuffer * 100, 0)}%</dd></div>
      <div><dt>Sleep threshold</dt><dd>{fmt(traits.sleepFatigueThreshold, 0)}</dd></div>
      <div><dt>Awake fatigue gain</dt><dd>{fmt(traits.awakeFatigueGain, 2)}</dd></div>
      <div><dt>Sleep recovery</dt><dd>{fmt(traits.sleepFatigueRecovery, 2)}</dd></div>
      <div><dt>Libido</dt><dd>{fmt(traits.libido, 2)}</dd></div>
      <div><dt>Max energy</dt><dd>{fmt(traits.maxEnergy, 0)}</dd></div>
      <div><dt>Bite amount</dt><dd>{fmt(traits.biteAmount, 1)}</dd></div>
      <div><dt>Forage reach</dt><dd>{fmt(traits.forageReach, 1)}</dd></div>
      <div><dt>Repro cooldown</dt><dd>{formatYears(traits.reproCooldown)}</dd></div>
      <div><dt>Mate range</dt><dd>{fmt(traits.mateRange, 1)}</dd></div>
      <div><dt>Sleep mobility</dt><dd>{fmt(traits.sleepMobility, 2)}</dd></div>
      <div><dt>Explore vision</dt><dd>{fmt(traits.exploreVisionMult, 2)}×</dd></div>
      <div><dt>Mode commitment</dt><dd>{fmt(traits.modeCommitment, 0)} ticks</dd></div>
      <div><dt>Wanderlust</dt><dd>{fmt(traits.wanderDurationMin, 0)}–{fmt(traits.wanderDurationMin + traits.wanderDurationSpan, 0)}</dd></div>
      <div><dt>Birth reserve</dt><dd>{fmt(traits.birthEnergyReserve, 2)}</dd></div>
      <div><dt>Maturation age</dt><dd>{formatYears(traits.maturationAge)}</dd></div>
      <div><dt>Gestation</dt><dd>{formatYears(traits.pregnancyTicks)}</dd></div>
      <div><dt>Sleep metabolism</dt><dd>{fmt(traits.sleepMetabolismScale, 2)}×</dd></div>
      <div><dt>Preferred hue</dt><dd>{fmt(traits.preferHue, 0)}°</dd></div>
      <div><dt>Preferred size</dt><dd>{fmt(traits.preferSize * 100, 0)}%</dd></div>
      <div><dt>Preferred speed</dt><dd>{fmt(traits.preferSpeed * 100, 0)}%</dd></div>
      <div><dt>Mate selectivity</dt><dd>{fmt(traits.mateSelectivity * 100, 0)}%</dd></div>
      <div><dt>Genetic assortment</dt><dd>{fmt(traits.geneticAssortment * 100, 0)}% target similarity</dd></div>
      <div><dt>Preference strength</dt><dd>{fmt(traits.matePreferenceStrength * 100, 0)}%</dd></div>
      <div><dt>Space tolerance</dt><dd>{fmt(traits.spaceTolerance * 100, 0)}%</dd></div>
      <div><dt>Cohesion</dt><dd>{fmt(traits.cohesion * 100, 0)}%</dd></div>
      <div><dt>Personal space</dt><dd>{fmt(traits.personalSpace, 1)} px</dd></div>
      <div><dt>Aggressiveness</dt><dd>{fmt(traits.aggressiveness * 100, 0)}%</dd></div>
      <div><dt>Dissimilar predation</dt><dd>{fmt(traits.cannibalPredilection * 100, 0)}%</dd></div>
      <div><dt>Attack damage</dt><dd>{fmt(traits.attackDamage, 1)}</dd></div>
      <div><dt>Attack range</dt><dd>{fmt(traits.attackRange, 1)} px</dd></div>
      {attackCooldown !== undefined && (
        <div><dt>Attack cooldown</dt><dd>{attackCooldown > 0 ? `${attackCooldown} ticks` : 'Ready'}</dd></div>
      )}
      <div><dt>Mutation rate</dt><dd>{fmt(traits.mutationRate * 100, 3)}% per gene</dd></div>
      <div><dt>Mutation amount</dt><dd>±{traits.mutationAmount} (small)</dd></div>
      <div><dt>Plant hardiness break</dt><dd>{fmt(traits.plantHardinessBreak, 2)}</dd></div>
      <div><dt>Plant forage selectivity</dt><dd>{fmt(traits.plantForageSelectivity * 100, 0)}%</dd></div>
      <div><dt>Disease resistance</dt><dd>{fmt(traits.diseaseResistance * 100, 0)}%</dd></div>
      <div><dt>Disease recovery</dt><dd>{fmt(traits.diseaseRecovery * 100, 0)}%</dd></div>
      <div><dt>Inbreeding tolerance</dt><dd>{fmt(traits.inbreedingTolerance * 100, 0)}%</dd></div>
      <div><dt>Contagion</dt><dd>{fmt(traits.contagion * 100, 0)}%</dd></div>
      <div><dt>Courtship eagerness</dt><dd>{fmt(traits.courtshipEagerness * 100, 0)}% toward sated</dd></div>
      <div><dt>Close mate leniency</dt><dd>{fmt(traits.closeMateLeniency * 100, 0)}% pickiness when adjacent</dd></div>
    </dl>
  )
}
