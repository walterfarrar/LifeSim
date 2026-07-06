import type { SoilAccess } from './soilMoisture'

/** Minimal atmosphere interface: a positional vapor sink/source. */
export type AtmospherePool = {
  /** Deposit water into the sky at a world position; overflow routes to surface then soil. */
  vent(x: number, y: number, units: number): number
  /** Pull up to `units` of vapor from the air cell over a world position; returns amount taken. */
  drawFrom(x: number, y: number, units: number): number
}

/**
 * Route transpired water to soil first (roots' immediate surroundings), then vent the rest
 * into the local sky. `vent` guarantees the remainder lands somewhere, so nothing leaves the
 * water budget.
 */
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

  atmosphere.vent(x, y, remaining)
}
