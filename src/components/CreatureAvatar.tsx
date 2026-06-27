import { expressHerbivore } from '../sim/phenotype'
import { creatureFillStyle, creatureMarkingFillStyle } from '../sim/render/creatureDraw'
import { creatureAppearanceToSvg, expressCreatureAppearance } from '../sim/render/expressAppearance'
import type { Creature } from '../sim/types'

type CreatureAvatarProps = {
  creature: Creature
  size?: number
}

export function CreatureAvatar({ creature, size = 56 }: CreatureAvatarProps) {
  const traits = expressHerbivore(creature.dna)
  const energyRatio = Math.min(1, creature.energy / traits.reproThreshold)
  const fill = creatureFillStyle(creature, traits, energyRatio)
  const markingFill = creatureMarkingFillStyle(creature, traits)
  const appearance = expressCreatureAppearance(creature.dna)
  const svg = creatureAppearanceToSvg(appearance, fill, markingFill)

  return (
    <div
      className="creature-avatar"
      style={{ width: size, height: size }}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

type DnaAvatarProps = {
  dna: Creature['dna']
  sex: Creature['sex']
  size?: number
}

/** Static preview from DNA alone (e.g. saved genomes). */
export function DnaAvatar({ dna, sex, size = 56 }: DnaAvatarProps) {
  const pseudo = { dna, sex } as Creature
  const traits = expressHerbivore(dna)
  const fill = creatureFillStyle(pseudo, traits, 0.85)
  const markingFill = creatureMarkingFillStyle(pseudo, traits)
  const appearance = expressCreatureAppearance(dna)
  const svg = creatureAppearanceToSvg(appearance, fill, markingFill)

  return (
    <div
      className="creature-avatar"
      style={{ width: size, height: size }}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

export function dnaPreviewSvg(dna: Creature['dna'], sex: Creature['sex']): string {
  const pseudo = { dna, sex } as Creature
  const traits = expressHerbivore(dna)
  const fill = creatureFillStyle(pseudo, traits, 0.85)
  const markingFill = creatureMarkingFillStyle(pseudo, traits)
  return creatureAppearanceToSvg(expressCreatureAppearance(dna), fill, markingFill)
}
