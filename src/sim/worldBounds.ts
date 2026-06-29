import {
  DEFAULT_WORLD_HEIGHT,
  DEFAULT_WORLD_WIDTH,
  MAX_WORLD_HEIGHT,
  MAX_WORLD_WIDTH,
  MIN_WORLD_HEIGHT,
  MIN_WORLD_WIDTH,
} from './config'
import type { SimSettings } from './simSettings'

export type WorldBounds = {
  width: number
  height: number
}

let activeBounds: WorldBounds = {
  width: DEFAULT_WORLD_WIDTH,
  height: DEFAULT_WORLD_HEIGHT,
}

export function clampWorldWidth(value: number): number {
  return Math.min(MAX_WORLD_WIDTH, Math.max(MIN_WORLD_WIDTH, Math.round(value)))
}

export function clampWorldHeight(value: number): number {
  return Math.min(MAX_WORLD_HEIGHT, Math.max(MIN_WORLD_HEIGHT, Math.round(value)))
}

export function worldBoundsFromSettings(settings: Pick<SimSettings, 'worldWidth' | 'worldHeight'>): WorldBounds {
  return {
    width: clampWorldWidth(settings.worldWidth),
    height: clampWorldHeight(settings.worldHeight),
  }
}

export function setActiveWorldBounds(bounds: WorldBounds): void {
  activeBounds = bounds
}

export function getWorldBounds(): WorldBounds {
  return activeBounds
}
