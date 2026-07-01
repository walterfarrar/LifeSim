/** Normalized SVG paths (-1..1 space) built from DNA — inherited and mutated with the genome. */
export type CreatureAppearance = {
  bodyPath: string
  markingPath: string | null
  markingScale: number
  aspectY: number
}

export type PlantSilhouette = 'grass' | 'bush' | 'tree'

export type PlantAppearance = {
  silhouette: PlantSilhouette
  foliagePaths: string[]
  stemPath: string | null
  aspectX: number
  aspectY: number
}

export type CorpseAppearance = CreatureAppearance
