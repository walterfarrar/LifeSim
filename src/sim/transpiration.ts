import { RAIN_TRANSPIRATION_TO_AIR } from './config'
import type { SoilAccess } from './soilMoisture'

/** Minimal atmosphere interface for transpiration routing. */
export type AtmospherePool = {
  vapor: number
  raining?: boolean
}

/** Route transpiration overflow to soil first; nothing leaves the water budget. */
export function releaseTranspiredWater(
  atmosphere: AtmospherePool,
  soil: SoilAccess,
  x: number,
  y: number,
  waterUnits: number,
): void {
  if (waterUnits <= 0) return

  let remaining = waterUnits
  remaining -= soil.depositWater(x, y, remaining)
  if (remaining <= 0) return

  const airFraction = atmosphere.raining ? RAIN_TRANSPIRATION_TO_AIR : 1
  const toAir = remaining * airFraction
  atmosphere.vapor += toAir
  remaining -= toAir

  if (remaining > 0) {
    remaining -= soil.depositWater(x, y, remaining)
  }

  if (remaining > 0) {
    atmosphere.vapor += remaining
  }
}
