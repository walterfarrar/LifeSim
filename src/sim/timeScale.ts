/** Mid-range max age in ticks (800 + 0.5 × 2400) — used as ~50-year lifespan. */
const REFERENCE_MAX_AGE_TICKS = 2000
const REFERENCE_LIFESPAN_YEARS = 50

export const TICKS_PER_YEAR = REFERENCE_MAX_AGE_TICKS / REFERENCE_LIFESPAN_YEARS

export function ticksToYears(ticks: number): number {
  return ticks / TICKS_PER_YEAR
}

/** Format tick counts as in-world years for display. */
export function formatYears(ticks: number, digits = 1): string {
  const years = ticksToYears(ticks)
  const rounded =
    years >= 10 ? years.toFixed(0) : years >= 1 ? years.toFixed(digits) : years.toFixed(Math.max(digits, 2))
  return `${rounded} ${years === 1 ? 'year' : 'years'}`
}

export const MIN_SPEED_MULTIPLIER = 0.25
export const MAX_SPEED_MULTIPLIER = 8

export function clampSpeedMultiplier(value: number): number {
  return Math.min(MAX_SPEED_MULTIPLIER, Math.max(MIN_SPEED_MULTIPLIER, value))
}

/** Display sim speed as 1×, 2×, 0.5×, etc. */
export function formatSpeedMultiplier(value: number): string {
  const rounded = Math.round(value * 100) / 100
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, '')
  return `${text}×`
}
