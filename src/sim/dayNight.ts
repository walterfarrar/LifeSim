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

export const VIEWPORT_BORDER_RING_WIDTH = 14
/** Soft depth of the night frame fade (edge → clear), same idea as the old rain vignette. */
export const VIEWPORT_DAY_VIGNETTE_WIDTH = 120
/** Peak edge opacity of the night vignette at midnight. */
export const VIEWPORT_NIGHT_EDGE_ALPHA = 0.72

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
  return { r, g, b, alpha: 0.92 }
}

function smoothstep(lo: number, hi: number, x: number): number {
  if (lo === hi) return x >= hi ? 1 : 0
  const t = Math.max(0, Math.min(1, (x - lo) / (hi - lo)))
  return t * t * (3 - 2 * t)
}

/**
 * Time-of-day frame: invisible by day; dark vignette ramps in through dusk and peaks at night.
 * Drawn like the old rain edge (thick fade toward the center), not a hard color band.
 */
export function computeDayBorder(sunlight: number, dayPhase: number): ViewportBorderRing {
  // Near-black navy — reads as night shadow, not a bright "mode color".
  const NIGHT: [number, number, number] = [6, 10, 22]

  const fromMidnight = Math.min(dayPhase, 1 - dayPhase)
  // Full strength overnight; fades through dawn/dusk; fully clear once sun is up.
  const phaseNight = 1 - smoothstep(0.1, 0.26, fromMidnight)
  const sunNight = 1 - smoothstep(0.14, 0.48, sunlight)
  const nightness = Math.max(phaseNight, sunNight * 0.85)

  return {
    r: NIGHT[0],
    g: NIGHT[1],
    b: NIGHT[2],
    alpha: nightness,
  }
}

export function applyViewportAmbienceStyle(
  element: HTMLElement,
  sunlight: number,
  season: SeasonName,
  dayPhase: number,
): void {
  const seasonRing = computeSeasonBorder(season)
  const dayRing = computeDayBorder(sunlight, dayPhase)

  element.style.setProperty('--border-season-r', String(seasonRing.r))
  element.style.setProperty('--border-season-g', String(seasonRing.g))
  element.style.setProperty('--border-season-b', String(seasonRing.b))
  element.style.setProperty('--border-season-alpha', seasonRing.alpha.toFixed(3))
  element.style.setProperty('--border-season-spread', `${VIEWPORT_BORDER_RING_WIDTH}px`)

  element.style.setProperty('--border-day-r', String(dayRing.r))
  element.style.setProperty('--border-day-g', String(dayRing.g))
  element.style.setProperty('--border-day-b', String(dayRing.b))
  element.style.setProperty('--border-day-width', `${VIEWPORT_DAY_VIGNETTE_WIDTH}px`)
  element.style.setProperty('--border-day-edge-alpha', VIEWPORT_NIGHT_EDGE_ALPHA.toFixed(3))
  // Whole vignette fades with nightness (0 = daytime, invisible).
  element.style.setProperty('--border-day-vignette-opacity', dayRing.alpha.toFixed(3))

  // Rain no longer drives a global edge vignette — clouds/rain are per-tile now.
  element.style.setProperty('--border-rain-vignette-opacity', '0')
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
