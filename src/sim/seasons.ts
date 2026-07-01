import {
  MIN_DAY_LENGTH_SECONDS,
  SEASON_DAY_LENGTH_SWING,
} from './config'
import { dayLengthTicks } from './dayNight'

/** Season year begins at spring equinox (neutral day length). */
export const SEASON_START_PHASE = 0.25

export type SeasonName = 'winter' | 'spring' | 'summer' | 'autumn'

export function seasonYearTicks(dayLengthSeconds: number, daysPerSeasonYear: number): number {
  return dayLengthTicks(dayLengthSeconds) * Math.max(1, daysPerSeasonYear)
}

/** 0–1 through the season year (0.25 spring equinox, 0.5 summer solstice, 0.75 autumn). */
export function seasonPhaseAtTick(tick: number, seasonYearTicks: number): number {
  if (seasonYearTicks <= 0) return SEASON_START_PHASE
  const offset = Math.floor(seasonYearTicks * SEASON_START_PHASE)
  return ((tick + offset) % seasonYearTicks) / seasonYearTicks
}

/** Multiplier on base day length — longest at summer solstice, shortest at winter. */
export function seasonalDayLengthScale(seasonPhase: number): number {
  return 1 + SEASON_DAY_LENGTH_SWING * (-Math.cos(2 * Math.PI * seasonPhase))
}

export function effectiveDayLengthSeconds(baseSeconds: number, seasonPhase: number): number {
  const scaled = baseSeconds * seasonalDayLengthScale(seasonPhase)
  return Math.max(MIN_DAY_LENGTH_SECONDS * 0.55, scaled)
}

export function seasonName(seasonPhase: number): SeasonName {
  if (seasonPhase < 0.125 || seasonPhase >= 0.875) return 'winter'
  if (seasonPhase < 0.375) return 'spring'
  if (seasonPhase < 0.625) return 'summer'
  return 'autumn'
}

export function seasonLabel(name: SeasonName): string {
  switch (name) {
    case 'winter':
      return 'Winter'
    case 'spring':
      return 'Spring'
    case 'summer':
      return 'Summer'
    case 'autumn':
      return 'Autumn'
  }
}

/** Human-readable day length for UI. */
export function formatDayLengthSeconds(seconds: number): string {
  if (seconds >= 10) return `${Math.round(seconds)}s`
  return `${seconds.toFixed(1)}s`
}

export type SeasonSnapshot = {
  seasonPhase: number
  season: SeasonName
  effectiveDayLengthSeconds: number
  dayLengthScale: number
}

export function computeSeasonSnapshot(
  tick: number,
  baseDayLengthSeconds: number,
  daysPerSeasonYear: number,
): SeasonSnapshot {
  const yearTicks = seasonYearTicks(baseDayLengthSeconds, daysPerSeasonYear)
  const seasonPhase = seasonPhaseAtTick(tick, yearTicks)
  const dayLengthScale = seasonalDayLengthScale(seasonPhase)
  const effectiveSeconds = effectiveDayLengthSeconds(baseDayLengthSeconds, seasonPhase)
  return {
    seasonPhase,
    season: seasonName(seasonPhase),
    effectiveDayLengthSeconds: effectiveSeconds,
    dayLengthScale,
  }
}
