import { TICKS_PER_SECOND } from './config'

import type { SeasonName } from './seasons'

/** Minimum photosynthesis at starlight — not quite zero so very slow night respiration still possible. */
export const STARLIGHT_GROWTH_FLOOR = 0.03

const SEASON_BORDER_RGB: Record<SeasonName, readonly [number, number, number]> = {
  spring: [118, 198, 132],
  summer: [238, 192, 88],
  autumn: [212, 148, 72],
  winter: [148, 184, 228],
}

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

export type ViewportAmbience = {
  r: number
  g: number
  b: number
  alpha: number
  width: number
}

/** Colors for the viewport window frame — season hue, darkening at night. */
export function computeViewportAmbience(sunlight: number, season: SeasonName): ViewportAmbience {
  const [sr, sg, sb] = SEASON_BORDER_RGB[season]
  const nightness = 1 - sunlight

  return {
    r: Math.round(42 + sr * (1 - nightness * 0.62)),
    g: Math.round(52 + sg * (1 - nightness * 0.72)),
    b: Math.round(78 + sb * (1 - nightness * 0.38)),
    alpha: 0.45 + nightness * 0.48,
    width: 3 + nightness * 5,
  }
}

export function applyViewportAmbienceStyle(element: HTMLElement, sunlight: number, season: SeasonName): void {
  const { r, g, b, alpha, width } = computeViewportAmbience(sunlight, season)
  element.style.setProperty('--ambience-r', String(r))
  element.style.setProperty('--ambience-g', String(g))
  element.style.setProperty('--ambience-b', String(b))
  element.style.setProperty('--ambience-alpha', alpha.toFixed(3))
  element.style.setProperty('--ambience-width', `${width.toFixed(1)}px`)
}
