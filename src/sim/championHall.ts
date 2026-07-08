export const CHAMPION_HALL_MAX = 5
export const CREATURE_CHAMPION_HALL_MAX = 10

export type ChampionHallEntry = {
  entryId: string
  fitnessScore: number
  runSeed: number
  runTick: number
  savedAt: string
}

/** True when the ranking, membership, or any entry's score differs — i.e. worth persisting. */
function hallChanged<T extends ChampionHallEntry>(
  before: readonly T[],
  after: readonly T[],
): boolean {
  if (before.length !== after.length) return true
  for (let i = 0; i < after.length; i++) {
    if (after[i].entryId !== before[i].entryId) return true
    if (after[i].fitnessScore !== before[i].fitnessScore) return true
  }
  return false
}

/** Insert into the hall when reigning is beaten, or when the candidate qualifies for the top N. */
export function crownInHall<T extends ChampionHallEntry>(
  hall: readonly T[],
  candidate: T,
  maxEntries: number = CHAMPION_HALL_MAX,
): { hall: T[]; crowned: boolean; changed: boolean } {
  const reigning = hall[0] ?? null
  const existing = hall.find((entry) => entry.entryId === candidate.entryId) ?? null

  // Keep the best-ever record for a given entryId. If this lineage/strain has been
  // crowned before with a higher score, don't downgrade it to the current (weaker) snapshot.
  const kept = existing && existing.fitnessScore >= candidate.fitnessScore ? existing : candidate
  const improved = kept === candidate && (!existing || candidate.fitnessScore > existing.fitnessScore)

  const withoutDuplicate = hall.filter((entry) => entry.entryId !== candidate.entryId)
  const sorted = [...withoutDuplicate, kept].sort((a, b) => b.fitnessScore - a.fitnessScore)
  const next = sorted.slice(0, maxEntries)
  const madeHall = next.some((entry) => entry.entryId === kept.entryId)

  if (!madeHall) {
    return { hall: [...hall], crowned: false, changed: false }
  }

  const beatReigning = improved && (!reigning || kept.fitnessScore > reigning.fitnessScore)
  return { hall: next, crowned: beatReigning, changed: hallChanged(hall, next) }
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

export function clearChampionHall(storageKey: string, legacyKeys: readonly string[] = []): void {
  try {
    localStorage.removeItem(storageKey)
    for (const key of legacyKeys) {
      localStorage.removeItem(key)
    }
  } catch {
    // ignore private mode errors
  }
}

export function hallChampion<T extends ChampionHallEntry>(hall: readonly T[]): T | null {
  return hall[0] ?? null
}
