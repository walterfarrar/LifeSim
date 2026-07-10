import {
  BRAIN_HIDDEN_COUNT,
  BRAIN_HIDDEN_WEIGHT_COUNT,
  BRAIN_INPUT_COUNT,
  BRAIN_WEIGHT_SCALE,
  BRAIN_WEIGHT_START,
  brainWeightToByte,
  cloneBrainDna,
  type BrainDNA,
} from './brainGenome'
import type { BrainState } from './network'

/** Overall scale on the genetic learning rate — keeps lifetime drift gentle and stable. */
const BRAIN_LEARN_LR_SCALE = 0.03
/** Eligibility trace decay: how long a past action stays creditable for later reward. */
const BRAIN_ELIG_DECAY = 0.85
/** Gentle pull of weights toward zero so learning can't run away unbounded. */
const BRAIN_WEIGHT_DECAY = 0.0002
/** Hard clamp on any learned weight. */
const BRAIN_WEIGHT_LIMIT = BRAIN_WEIGHT_SCALE * 1.5
/** Wellbeing delta that maps to a full ±1 reward. */
const BRAIN_REWARD_NORM = 3
/** How fast the reward baseline (EMA) tracks recent wellbeing. */
const BRAIN_BASELINE_RATE = 0.02

/**
 * Positive-reinforcement (reward-shaping) constants. These reward consummatory acts that satisfy a
 * pressing drive, on top of the homeostatic wellbeing delta. Values are in wellbeing units (energy +
 * hydration) and are added via {@link rewardBrainAction}, then normalized by BRAIN_REWARD_NORM like
 * the homeostatic term. Unlike the homeostatic term they are NOT baseline-subtracted, so a chronic
 * baseline can't mute the intended teaching signal.
 */
/** Share of need-weighted food/water intake turned into an explicit "ate when hungry" reward. */
export const BRAIN_CONSUME_REWARD_WEIGHT = 0.4
/** Flat satisfaction reward for a successful mating (added to the offset for its energy cost). */
export const BRAIN_MATE_REWARD = 12
/** Satisfaction reward for carrying a pregnancy to a live birth (added to the birth hydration cost). */
export const BRAIN_BIRTH_REWARD = 8
/**
 * Lamarckian write-back: fraction of a parent's lifetime-learned weights folded into the genome
 * offspring inherit. Partial (per design) so fast adaptation doesn't cause runaway lock-in.
 */
export const BRAIN_WRITEBACK_FRACTION = 0.6

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

/** Snapshot wellbeing at the start of a tick so the reward delta can be measured at the end. */
export function beginBrainTick(state: BrainState, wellbeing: number): void {
  state.prevWellbeing = wellbeing
  state.rewardBonus = 0
  state.primed = true
}

/**
 * Credit an explicit need-satisfaction reward for a consummatory act taken this tick (in wellbeing
 * units). Accumulated across the tick and consumed by {@link learnFromOutcome}. Use this to
 * positively reinforce eating while hungry, drinking while thirsty, and mating while horny.
 */
export function rewardBrainAction(state: BrainState, amount: number): void {
  if (amount === 0) return
  state.rewardBonus += amount
}

/**
 * Reward-modulated Hebbian update. `wellbeing` is the creature's energy + hydration now; reward is
 * its change relative to a running baseline (so a drowning/starving tick is punished and a
 * feeding/drinking tick is reinforced), which nudges the weights that produced the last action.
 */
export function learnFromOutcome(state: BrainState, wellbeing: number): void {
  if (!state.primed) {
    state.prevWellbeing = wellbeing
    state.baseline = 0
    state.rewardBonus = 0
    state.primed = true
    return
  }

  // Homeostatic term: gaining resources faster than the running baseline is good, losing them is
  // bad. Baseline tracks only this natural drift so it can't wash out the shaping term below.
  const delta = wellbeing - state.prevWellbeing
  const homeostatic = (delta - state.baseline) / BRAIN_REWARD_NORM
  state.baseline += BRAIN_BASELINE_RATE * (delta - state.baseline)

  // Shaping term: explicit reward for satisfying a drive this tick (eat/drink/mate/birth).
  const shaped = state.rewardBonus / BRAIN_REWARD_NORM
  state.rewardBonus = 0

  const reward = clamp(homeostatic + shaped, -1, 1)

  const lr = state.learningRate * state.plasticity * BRAIN_LEARN_LR_SCALE
  if (lr <= 0) {
    state.prevWellbeing = wellbeing
    return
  }

  const { hiddenWeights, outputWeights, hiddenElig, outputElig, lastInputs, lastHidden, lastOutputs } =
    state

  // Hidden layer: eligibility = input · hidden activation.
  for (let h = 0; h < BRAIN_HIDDEN_COUNT; h++) {
    const post = lastHidden[h]
    const base = h * BRAIN_INPUT_COUNT
    for (let i = 0; i < BRAIN_INPUT_COUNT; i++) {
      const idx = base + i
      const e = BRAIN_ELIG_DECAY * hiddenElig[idx] + lastInputs[i] * post
      hiddenElig[idx] = e
      const w = hiddenWeights[idx] + lr * reward * e - BRAIN_WEIGHT_DECAY * hiddenWeights[idx]
      hiddenWeights[idx] = clamp(w, -BRAIN_WEIGHT_LIMIT, BRAIN_WEIGHT_LIMIT)
    }
  }

  // Output layer: eligibility = hidden activation (or bias 1) · output activation.
  const stride = BRAIN_HIDDEN_COUNT + 1
  for (let o = 0; o < lastOutputs.length; o++) {
    const post = lastOutputs[o]
    const base = o * stride
    for (let h = 0; h < stride; h++) {
      const pre = h < BRAIN_HIDDEN_COUNT ? lastHidden[h] : 1
      const idx = base + h
      const e = BRAIN_ELIG_DECAY * outputElig[idx] + pre * post
      outputElig[idx] = e
      const w = outputWeights[idx] + lr * reward * e - BRAIN_WEIGHT_DECAY * outputWeights[idx]
      outputWeights[idx] = clamp(w, -BRAIN_WEIGHT_LIMIT, BRAIN_WEIGHT_LIMIT)
    }
  }

  state.prevWellbeing = wellbeing
}

/**
 * Fold a fraction of the live (learned) weights back into a copy of the birth brain genome, so the
 * offspring inherit part of what the parent learned during life (Lamarckian inheritance).
 */
export function consolidateLearnedBrain(
  birthBrain: BrainDNA,
  state: BrainState,
  fraction = BRAIN_WRITEBACK_FRACTION,
): BrainDNA {
  const out = cloneBrainDna(birthBrain)
  const blend = (geneIndex: number, learnedWeight: number) => {
    const learnedByte = brainWeightToByte(learnedWeight)
    const birthByte = out[geneIndex]
    out[geneIndex] = Math.round(birthByte + (learnedByte - birthByte) * fraction)
  }

  for (let i = 0; i < state.hiddenWeights.length; i++) {
    blend(BRAIN_WEIGHT_START + i, state.hiddenWeights[i])
  }
  const outStart = BRAIN_WEIGHT_START + BRAIN_HIDDEN_WEIGHT_COUNT
  for (let i = 0; i < state.outputWeights.length; i++) {
    blend(outStart + i, state.outputWeights[i])
  }
  return out
}
