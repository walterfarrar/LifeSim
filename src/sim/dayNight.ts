import { TICKS_PER_SECOND } from './config'

import type { SeasonName } from './seasons'

/** Minimum photosynthesis at starlight — not quite zero so very slow night respiration still possible. */
export const STARLIGHT_GROWTH_FLOOR = 0.03

const SEASON_BORDER_RGB: Record<SeasonName, readonly [number, number, number]> = {
  spring: [92, 188, 118],
  summer: [238, 148, 58],
  autumn: [210, 118, 48],
  winter: [88, 158, 228],
}

export const VIEWPORT_BORDER_RING_WIDTH = 6

export function dayLengthTicks(dayLengthSeconds: number): number {
  return Math.max(TICKS_PER_SECOND, Math.round(dayLengthSeconds * TICKS_PER_SECOND))
}

/** Fraction through the day when a new world begins (morning light). */
export const DAY_START_PHASE = 0.3

export function dayPhaseAtTick(tick: number, dayLengthTicks: number, startPhase = DAY_START_PHASE): number {
  if (dayLengthTicks <= 0) return 0.5
  const offset = Math.floor(dayLengthTicks * startPhase)
  return ((tick + offset) % dayLengthTicks) / dayLengthTicks
}

/** 0–1 sunlight intensity — drives plant photosynthesis and the viewport border cue. */
export function sunlightFactor(phase: number): number {
  const daylight = Math.sin(Math.PI * phase)
  return STARLIGHT_GROWTH_FLOOR + (1 - STARLIGHT_GROWTH_FLOOR) * daylight ** 1.35
}

export function isNightSunlight(sunlight: number): boolean {
  return sunlight < 0.12
}

export function dayNightLabel(phase: number): string {
  if (phase < 0.1 || phase > 0.9) return 'Night'
  if (phase < 0.22) return 'Dawn'
  if (phase < 0.38) return 'Morning'
  if (phase < 0.62) return 'Midday'
  if (phase < 0.78) return 'Afternoon'
  return 'Dusk'
}

export type ViewportBorderRing = {
  r: number
  g: number
  b: number
  alpha: number
}

/** Outermost ring — season hue (winter blue, summer orange, etc.). */
export function computeSeasonBorder(season: SeasonName): ViewportBorderRing {
  const [r, g, b] = SEASON_BORDER_RGB[season]
  return { r, g, b, alpha: 0.88 }
}

function smoothstep(lo: number, hi: number, x: number): number {
  if (lo === hi) return x >= hi ? 1 : 0
  const t = Math.max(0, Math.min(1, (x - lo) / (hi - lo)))
  return t * t * (3 - 2 * t)
}

/** Middle ring — time of day: deep blue at night, orange at dawn/dusk, yellow by day. */
export function computeDayBorder(_sunlight: number, dayPhase: number): ViewportBorderRing {
  const NIGHT: [number, number, number] = [20, 34, 108]
  const ORANGE: [number, number, number] = [255, 132, 32]
  const DAY: [number, number, number] = [255, 210, 44]

  const fromMidnight = Math.min(dayPhase, 1 - dayPhase)
  const nightW = 1 - smoothstep(0.08, 0.14, fromMidnight)

  const fromNoon = Math.abs(dayPhase - 0.5)
  const dayW = (1 - smoothstep(0.14, 0.26, fromNoon)) * (1 - nightW)

  let orangeW = Math.max(0, 1 - nightW - dayW)
  const sum = nightW + orangeW + dayW || 1
  const nw = nightW / sum
  const ow = orangeW / sum
  const dw = dayW / sum

  const r = Math.round(nw * NIGHT[0] + ow * ORANGE[0] + dw * DAY[0])
  const g = Math.round(nw * NIGHT[1] + ow * ORANGE[1] + dw * DAY[1])
  const b = Math.round(nw * NIGHT[2] + ow * ORANGE[2] + dw * DAY[2])

  return {
    r,
    g,
    b,
    alpha: 0.82 + nw * 0.12,
  }
}

export function applyViewportAmbienceStyle(
  element: HTMLElement,
  sunlight: number,
  season: SeasonName,
  dayPhase: number,
): void {
  const ringW = VIEWPORT_BORDER_RING_WIDTH
  const seasonRing = computeSeasonBorder(season)
  const dayRing = computeDayBorder(sunlight, dayPhase)

  element.style.setProperty('--border-season-r', String(seasonRing.r))
  element.style.setProperty('--border-season-g', String(seasonRing.g))
  element.style.setProperty('--border-season-b', String(seasonRing.b))
  element.style.setProperty('--border-season-alpha', seasonRing.alpha.toFixed(3))

  element.style.setProperty('--border-day-r', String(dayRing.r))
  element.style.setProperty('--border-day-g', String(dayRing.g))
  element.style.setProperty('--border-day-b', String(dayRing.b))
  element.style.setProperty('--border-day-alpha', dayRing.alpha.toFixed(3))

  // Rain no longer drives a global edge vignette — clouds/rain are per-tile now.
  element.style.setProperty('--border-rain-vignette-opacity', '0')

  // Smallest spread sits outermost (window edge); larger spreads stack inward.
  element.style.setProperty('--border-season-spread', `${ringW}px`)
  element.style.setProperty('--border-day-spread', `${ringW * 2}px`)
}

/** @deprecated Use applyViewportAmbienceStyle with day phase and rain state. */
export function computeViewportAmbience(sunlight: number, season: SeasonName) {
  const seasonRing = computeSeasonBorder(season)
  const dayRing = computeDayBorder(sunlight, 0.5)
  return {
    r: seasonRing.r,
    g: seasonRing.g,
    b: seasonRing.b,
    alpha: dayRing.alpha,
    width: VIEWPORT_BORDER_RING_WIDTH * 2,
  }
}
