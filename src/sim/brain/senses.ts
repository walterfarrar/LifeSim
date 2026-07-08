import { BRAIN_INPUT_COUNT } from './brainGenome'

/** A direction to something of interest, in world-space delta plus a 0–1 proximity. */
export type SenseTarget = {
  dx: number
  dy: number
  /** 0 = at/edge of vision, 1 = right on top of it. */
  close: number
} | null

/**
 * Raw per-tick perception gathered by the world, before normalization. Directions are world-space
 * deltas (target − creature); {@link packBrainInputs} rotates them into the creature's egocentric
 * frame using `heading` so a learned "veer away from water ahead" reflex generalizes to any facing.
 */
export type BrainSenseReadings = {
  /** Facing angle (radians) — forward unit vector is (cos, sin). */
  heading: number
  hungerNeed: number
  thirstNeed: number
  fatigueNeed: number
  reproReady: number
  /** 0 = dry, 1 = deep enough to drown, values normalized to body submersion. */
  depthHere: number
  depthAhead: number
  depthLeft: number
  depthRight: number
  /** −1 = steep downhill ahead, +1 = steep uphill ahead. */
  slopeAhead: number
  food: SenseTarget
  water: SenseTarget
  mate: SenseTarget
  crowder: SenseTarget
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

/** Center a 0–1 reading into the network's −1..1 working range. */
function center01(v: number): number {
  return clamp(v, 0, 1) * 2 - 1
}

/** Rotate a world-space delta into egocentric (forward, right) unit components. */
function egoUnit(dx: number, dy: number, heading: number): { f: number; r: number } {
  const dist = Math.hypot(dx, dy)
  if (dist < 1e-6) return { f: 0, r: 0 }
  const nx = dx / dist
  const ny = dy / dist
  const cos = Math.cos(heading)
  const sin = Math.sin(heading)
  return {
    f: nx * cos + ny * sin,
    r: -nx * sin + ny * cos,
  }
}

/** Assemble the normalized input vector (length BRAIN_INPUT_COUNT, index 0 = bias). */
export function packBrainInputs(r: BrainSenseReadings, out?: Float32Array): Float32Array {
  const inputs = out ?? new Float32Array(BRAIN_INPUT_COUNT)
  const food = r.food ? egoUnit(r.food.dx, r.food.dy, r.heading) : { f: 0, r: 0 }
  const water = r.water ? egoUnit(r.water.dx, r.water.dy, r.heading) : { f: 0, r: 0 }
  const mate = r.mate ? egoUnit(r.mate.dx, r.mate.dy, r.heading) : { f: 0, r: 0 }
  const crowder = r.crowder ? egoUnit(r.crowder.dx, r.crowder.dy, r.heading) : { f: 0, r: 0 }

  inputs[0] = 1
  inputs[1] = center01(r.hungerNeed)
  inputs[2] = center01(r.thirstNeed)
  inputs[3] = center01(r.fatigueNeed)
  inputs[4] = center01(r.reproReady)
  inputs[5] = center01(r.depthHere)
  inputs[6] = center01(r.depthAhead)
  inputs[7] = center01(r.depthLeft)
  inputs[8] = center01(r.depthRight)
  inputs[9] = clamp(r.slopeAhead, -1, 1)
  inputs[10] = food.f
  inputs[11] = food.r
  inputs[12] = center01(r.food ? r.food.close : 0)
  inputs[13] = water.f
  inputs[14] = water.r
  inputs[15] = center01(r.water ? r.water.close : 0)
  inputs[16] = mate.f
  inputs[17] = mate.r
  inputs[18] = crowder.f
  inputs[19] = crowder.r
  return inputs
}
