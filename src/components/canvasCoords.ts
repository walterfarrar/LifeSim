import { clientToWorldCoords, type ViewportTransform } from './canvasViewport'

/** Map a screen click to simulation world coordinates (viewport pan/zoom + fit scale). */
export function clientToWorld(
  viewportRect: DOMRect,
  clientX: number,
  clientY: number,
  worldWidth: number,
  worldHeight: number,
  viewport: ViewportTransform,
): { x: number; y: number } | null {
  return clientToWorldCoords(viewportRect, clientX, clientY, worldWidth, worldHeight, viewport)
}
