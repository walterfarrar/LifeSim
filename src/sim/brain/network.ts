import {
  BRAIN_HIDDEN_COUNT,
  BRAIN_HIDDEN_WEIGHT_COUNT,
  BRAIN_INPUT_COUNT,
  BRAIN_OUTPUT_COUNT,
  BRAIN_WEIGHT_START,
  brainByteToWeight,
  brainLearningRate,
  brainPlasticity,
  type BrainDNA,
} from './brainGenome'

/**
 * Live neural state for one creature. Weights are decoded from the brain DNA at birth into
 * Float32 arrays so lifetime learning (step 4) can nudge them at sub-byte precision. The last
 * forward-pass activations are retained so a reward signal can reinforce the action just taken.
 */
export type BrainState = {
  /** BRAIN_HIDDEN_COUNT × BRAIN_INPUT_COUNT, row-major. */
  hiddenWeights: Float32Array
  /** BRAIN_OUTPUT_COUNT × (BRAIN_HIDDEN_COUNT + 1), row-major; last column is the bias weight. */
  outputWeights: Float32Array
  learningRate: number
  plasticity: number
  lastInputs: Float32Array
  lastHidden: Float32Array
  lastOutputs: Float32Array
  /** Reward-modulated Hebbian eligibility traces, one per weight. */
  hiddenElig: Float32Array
  outputElig: Float32Array
  /** Running-average wellbeing (EMA) — reward is measured relative to this baseline. */
  baseline: number
  /** energy + hydration captured at the start of the tick, for the reward delta. */
  prevWellbeing: number
  /** False until the first full tick has established a baseline (newborns skip one learn step). */
  primed: boolean
}

export type BrainOutputs = {
  /** Ego-forward steering component (−1..1). */
  forward: number
  /** Ego-right steering component (−1..1). */
  right: number
  /** Speed gate 0..1 (fraction of the creature's max speed to use). */
  throttle: number
}

function decodeWeights(brain: BrainDNA): { hidden: Float32Array; output: Float32Array } {
  const hidden = new Float32Array(BRAIN_HIDDEN_WEIGHT_COUNT)
  const output = new Float32Array(BRAIN_OUTPUT_COUNT * (BRAIN_HIDDEN_COUNT + 1))
  let g = BRAIN_WEIGHT_START
  for (let i = 0; i < hidden.length; i++) hidden[i] = brainByteToWeight(brain[g++] ?? 127)
  for (let i = 0; i < output.length; i++) output[i] = brainByteToWeight(brain[g++] ?? 127)
  return { hidden, output }
}

export function createBrainState(brain: BrainDNA): BrainState {
  const { hidden, output } = decodeWeights(brain)
  return {
    hiddenWeights: hidden,
    outputWeights: output,
    learningRate: brainLearningRate(brain),
    plasticity: brainPlasticity(brain),
    lastInputs: new Float32Array(BRAIN_INPUT_COUNT),
    lastHidden: new Float32Array(BRAIN_HIDDEN_COUNT),
    lastOutputs: new Float32Array(BRAIN_OUTPUT_COUNT),
    hiddenElig: new Float32Array(hidden.length),
    outputElig: new Float32Array(output.length),
    baseline: 0,
    prevWellbeing: 0,
    primed: false,
  }
}

function tanh(x: number): number {
  if (x > 20) return 1
  if (x < -20) return -1
  const e = Math.exp(2 * x)
  return (e - 1) / (e + 1)
}

/**
 * Run the network for one tick. `inputs` must be length BRAIN_INPUT_COUNT with inputs[0] = 1
 * (bias). Activations are cached on the state for the learning step.
 */
export function brainForward(state: BrainState, inputs: Float32Array): BrainOutputs {
  const { hiddenWeights, outputWeights, lastHidden, lastOutputs } = state
  state.lastInputs.set(inputs)

  for (let h = 0; h < BRAIN_HIDDEN_COUNT; h++) {
    let sum = 0
    const base = h * BRAIN_INPUT_COUNT
    for (let i = 0; i < BRAIN_INPUT_COUNT; i++) {
      sum += hiddenWeights[base + i] * inputs[i]
    }
    lastHidden[h] = tanh(sum)
  }

  const stride = BRAIN_HIDDEN_COUNT + 1
  for (let o = 0; o < BRAIN_OUTPUT_COUNT; o++) {
    let sum = outputWeights[o * stride + BRAIN_HIDDEN_COUNT] // bias
    const base = o * stride
    for (let h = 0; h < BRAIN_HIDDEN_COUNT; h++) {
      sum += outputWeights[base + h] * lastHidden[h]
    }
    lastOutputs[o] = tanh(sum)
  }

  return {
    forward: lastOutputs[0],
    right: lastOutputs[1],
    throttle: (lastOutputs[2] + 1) * 0.5,
  }
}
