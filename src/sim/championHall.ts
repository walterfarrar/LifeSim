export const CHAMPION_HALL_MAX = 5

export type ChampionHallEntry = {
  entryId: string
  fitnessScore: number
  runSeed: number
  runTick: number
  savedAt: string
}

/** Insert a new reigning champion at the top; keep only the top N by fitness. */
export function crownInHall<T extends ChampionHallEntry>(
  hall: readonly T[],
  candidate: T,
): { hall: T[]; crowned: boolean } {
  const reigning = hall[0] ?? null
  if (reigning && candidate.fitnessScore <= reigning.fitnessScore) {
    return { hall: [...hall], crowned: false }
  }

  const withoutDuplicate = hall.filter((entry) => entry.entryId !== candidate.entryId)
  const next = [candidate, ...withoutDuplicate]
    .sort((a, b) => b.fitnessScore - a.fitnessScore)
    .slice(0, CHAMPION_HALL_MAX)

  return { hall: next, crowned: true }
}

export function loadChampionHall<T extends ChampionHallEntry>(
  storageKey: string,
  parseEntry: (raw: unknown) => T | null,
  legacyKey?: string,
  parseLegacy?: (raw: unknown) => T | null,
): T[] {
  try {
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      const parsed = JSON.parse(stored) as unknown
      if (Array.isArray(parsed)) {
        return parsed.map(parseEntry).filter((entry): entry is T => entry !== null)
      }
    }
  } catch {
    // fall through to legacy migration
  }

  if (legacyKey && parseLegacy) {
    try {
      const legacy = localStorage.getItem(legacyKey)
      if (legacy) {
        const entry = parseLegacy(JSON.parse(legacy))
        if (entry) return [entry]
      }
    } catch {
      // ignore
    }
  }

  return []
}

export function saveChampionHall<T>(storageKey: string, hall: readonly T[]): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(hall))
  } catch {
    // ignore quota / private mode errors
  }
}

export function hallChampion<T extends ChampionHallEntry>(hall: readonly T[]): T | null {
  return hall[0] ?? null
}
