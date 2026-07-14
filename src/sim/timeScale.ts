import {
  DAY_LENGTH_SECONDS,
  DAYS_PER_SEASON_YEAR,
  MINUTES_PER_TICK,
  TICKS_PER_DAY as CANONICAL_TICKS_PER_DAY,
  TICKS_PER_SECOND,
  TICKS_PER_YEAR as CANONICAL_TICKS_PER_YEAR,
} from './config'
import { dayLengthTicks } from './dayNight'
import { seasonYearTicks } from './seasons'

/** Canonical calendar year in ticks (365 × 1440) when settings match defaults. */
export const TICKS_PER_YEAR = CANONICAL_TICKS_PER_YEAR
export const TICKS_PER_DAY = CANONICAL_TICKS_PER_DAY

/** Active calendar clock — driven by day-length / days-per-year settings. */
let calendarTicksPerYear = seasonYearTicks(DAY_LENGTH_SECONDS, DAYS_PER_SEASON_YEAR)
let calendarTicksPerDay = dayLengthTicks(DAY_LENGTH_SECONDS)
let calendarDaysPerYear = DAYS_PER_SEASON_YEAR

/** Call whenever day-length / days-per-year settings change (world reset / apply). */
export function setCalendarTimeScale(dayLengthSeconds: number, daysPerSeasonYear: number): void {
  const days = Math.max(1, Math.round(daysPerSeasonYear))
  calendarDaysPerYear = days
  calendarTicksPerDay = dayLengthTicks(dayLengthSeconds)
  calendarTicksPerYear = Math.max(1, seasonYearTicks(dayLengthSeconds, days))
}

export function getCalendarTicksPerYear(): number {
  return calendarTicksPerYear
}

export function getCalendarTicksPerDay(): number {
  return calendarTicksPerDay
}

export function getCalendarDaysPerYear(): number {
  return calendarDaysPerYear
}

/** Convert calendar years → ticks using the active settings clock. */
export function yearsToTicks(years: number): number {
  return years * calendarTicksPerYear
}

export function ticksToYears(ticks: number): number {
  return ticks / calendarTicksPerYear
}

export function ticksToCalendarYears(ticks: number): number {
  return ticks / calendarTicksPerYear
}

/** Helpers for phenotype balance expressions. */
export function hoursToTicks(hours: number): number {
  return (hours * 60) / MINUTES_PER_TICK
}

export function daysToTicks(days: number): number {
  return days * TICKS_PER_DAY
}

export function yearsToCalendarTicks(years: number): number {
  return years * TICKS_PER_YEAR
}

/**
 * Format a tick span using the calendar clock (days-per-year × day length from settings).
 * Short spans show as days/hours so a 365-day year doesn't make everything read as 0.00 years.
 */
export function formatYears(ticks: number, digits = 1): string {
  const years = ticks / calendarTicksPerYear
  if (years >= 10) return `${years.toFixed(0)} years`
  if (years >= 1) {
    const rounded = years.toFixed(digits)
    return `${rounded} ${Number(rounded) === 1 ? 'year' : 'years'}`
  }

  const days = ticks / Math.max(1, calendarTicksPerDay)
  if (days >= 10) return `${days.toFixed(0)} days`
  if (days >= 1) {
    const rounded = days.toFixed(1)
    return `${rounded} ${Number(rounded) === 1 ? 'day' : 'days'}`
  }

  const hours = days * 24
  if (hours >= 1) {
    const rounded = hours.toFixed(hours >= 10 ? 0 : 1)
    return `${rounded} ${Number(rounded) === 1 ? 'hour' : 'hours'}`
  }

  const minutes = hours * 60
  const rounded = Math.max(0, minutes).toFixed(minutes >= 10 ? 0 : 1)
  return `${rounded} min`
}

export const MIN_SPEED_MULTIPLIER = 0.25
/** Doubling steps up through 512× for long calendar scrubbing. */
export const MAX_SPEED_MULTIPLIER = 512

export function clampSpeedMultiplier(value: number): number {
  return Math.min(MAX_SPEED_MULTIPLIER, Math.max(MIN_SPEED_MULTIPLIER, value))
}

/**
 * How long one animation frame may spend on `world.tick()`. Higher speeds trade some visual
 * FPS for sim throughput so the advertised multiplier stays achievable.
 */
export function tickTimeBudgetMs(speed: number): number {
  if (speed <= 2) return 8
  if (speed <= 8) return 12
  if (speed <= 32) return 20
  if (speed <= 128) return 32
  // Warp: spend most of the frame on ticks (~15–20fps paint).
  return 55
}

/** Paint every Nth frame while warping so CPU goes to ticks instead of redraw. */
export function paintEveryNFrames(speed: number): number {
  if (speed <= 8) return 1
  if (speed <= 32) return 2
  if (speed <= 128) return 4
  return 10
}

/** Min ms between React snapshot / HUD pushes (0 = every painted frame). */
export function snapshotReportIntervalMs(speed: number): number {
  if (speed <= 4) return 0
  if (speed <= 16) return 50
  if (speed <= 64) return 100
  return 200
}

/** Cap on ticks in one frame / backlog — scales with speed so warp isn’t soft-capped. */
export function maxTicksPerFrame(speed: number): number {
  return Math.min(4096, Math.max(64, Math.ceil(TICKS_PER_SECOND * speed * 0.35)))
}

/** Display sim speed as 1×, 2×, 0.5×, etc. */
export function formatSpeedMultiplier(value: number): string {
  const rounded = Math.round(value * 100) / 100
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, '')
  return `${text}×`
}
