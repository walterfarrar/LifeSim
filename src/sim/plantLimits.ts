import type { PlantKind } from './plantKinds'
import type { SimSettings } from './simSettings'

export function maxPlantsForKind(settings: SimSettings, kind: PlantKind): number {
  switch (kind) {
    case 'grass':
      return settings.maxGrassPlants
    case 'bush':
      return settings.maxBushPlants
    case 'tree':
      return settings.maxTreePlants
  }
}

export function isPlantKindAtCap(
  settings: SimSettings,
  counts: Record<PlantKind, number>,
  kind: PlantKind,
): boolean {
  return counts[kind] >= maxPlantsForKind(settings, kind)
}

export function allPlantKindsAtCap(
  settings: SimSettings,
  counts: Record<PlantKind, number>,
): boolean {
  return (
    counts.grass >= settings.maxGrassPlants &&
    counts.bush >= settings.maxBushPlants &&
    counts.tree >= settings.maxTreePlants
  )
}
