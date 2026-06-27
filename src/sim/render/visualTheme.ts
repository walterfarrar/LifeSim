import type { CreatureMode } from '../types'

export const MODE_RING_COLORS: Record<CreatureMode, string> = {
  hungry: 'rgba(255, 180, 60, 0.75)',
  horny: 'rgba(255, 100, 180, 0.75)',
  sleepy: 'rgba(120, 140, 255, 0.55)',
}

export const VISUAL_THEME = {
  pregnancyRing: 'rgba(255, 180, 220, 0.75)',
  infectionRing: 'rgba(180, 90, 220, 0.7)',
  selectionRing: 'rgba(255, 255, 255, 0.95)',
  personalSpaceRing: 'rgba(180, 200, 220, 0.35)',
  attackRangeRing: 'rgba(255, 70, 50, 0.45)',
  visionRing: 'rgba(255, 255, 255, 0.15)',
  plantHealthy: 'rgb(40, 140, 55)',
  plantDim: 'rgb(40, 80, 55)',
  corpseSample: 'hsl(28, 28%, 22%)',
  creatureSample: 'hsl(160, 55%, 42%)',
  creatureFemaleSample: 'hsl(172, 55%, 42%)',
  canvasBackground: '#0f1410',
} as const

export const MODE_LABELS: Record<CreatureMode, string> = {
  hungry: 'Hungry',
  horny: 'Horny',
  sleepy: 'Sleepy',
}

export const MODE_DESCRIPTIONS: Record<CreatureMode, string> = {
  hungry: 'Seeking food; amber ring',
  horny: 'Seeking a mate; pink ring',
  sleepy: 'Resting; blue ring',
}
