/** Normalized SVG paths (-1..1 space) built from DNA — inherited and mutated with the genome. */
export type CreatureAppearance = {
  bodyPath: string
  markingPath: string | null
  markingScale: number
  aspectY: number
}

export type PlantAppearance = {
  foliagePath: string
  stemPath: string
}

export type CorpseAppearance = CreatureAppearance
