import { DAY_TEMP_SWING, SEASON_TEMP_AMPLITUDE, SEASON_TEMP_BASE } from './config'

/** Ambient air temperature (°C) from season and time of day. */
export function ambientTemperatureC(seasonPhase: number, dayPhase: number): number {
  const seasonal = SEASON_TEMP_BASE + SEASON_TEMP_AMPLITUDE * (-Math.cos(2 * Math.PI * seasonPhase))
  const daily = DAY_TEMP_SWING * Math.sin(Math.PI * dayPhase)
  return seasonal + daily
}

/** 0–1 growth scaling — 1 at ideal temp, 0 outside the growth band. */
export function temperatureGrowthFactor(
  temperature: number,
  idealTemp: number,
  growthHalfWidth: number,
): number {
  if (growthHalfWidth <= 0) return 0
  const delta = Math.abs(temperature - idealTemp)
  if (delta >= growthHalfWidth) return 0
  const t = 1 - delta / growthHalfWidth
  return t * t
}

/** Combined comfort for rendering (0 = stressed). */
export function temperatureComfortFactor(
  temperature: number,
  idealTemp: number,
  growthHalfWidth: number,
  survivalHalfWidth: number,
): number {
  const delta = Math.abs(temperature - idealTemp)
  if (delta >= survivalHalfWidth) return 0
  if (delta <= growthHalfWidth) return 1
  const span = survivalHalfWidth - growthHalfWidth
  if (span <= 0) return 0
  return 1 - (delta - growthHalfWidth) / span
}

export function formatTemperatureC(celsius: number): string {
  return `${celsius.toFixed(1)}°C`
}

export function plantTempRangeLabel(ideal: number, growthHalf: number, survivalHalf: number): string {
  return `${(ideal - growthHalf).toFixed(0)}–${(ideal + growthHalf).toFixed(0)}°C grow · ${(ideal - survivalHalf).toFixed(0)}–${(ideal + survivalHalf).toFixed(0)}°C survive`
}
