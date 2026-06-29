export const MIN_VIEWPORT_ZOOM = 0.35
export const MAX_VIEWPORT_ZOOM = 4
export const VIEWPORT_ZOOM_STEP = 1.25

export type ViewportTransform = {
  zoom: number
  panX: number
  panY: number
}

export const DEFAULT_VIEWPORT: ViewportTransform = {
  zoom: 1,
  panX: 0,
  panY: 0,
}

export function clampViewportZoom(zoom: number): number {
  return Math.max(MIN_VIEWPORT_ZOOM, Math.min(MAX_VIEWPORT_ZOOM, zoom))
}

export function fitScale(
  viewportWidth: number,
  viewportHeight: number,
  worldWidth: number,
  worldHeight: number,
): number {
  if (viewportWidth <= 0 || viewportHeight <= 0) return 1
  return Math.min(viewportWidth / worldWidth, viewportHeight / worldHeight)
}

function contentOrigin(
  viewportRect: DOMRect,
  worldWidth: number,
  worldHeight: number,
  viewport: ViewportTransform,
): { originX: number; originY: number; scale: number } {
  const base = fitScale(viewportRect.width, viewportRect.height, worldWidth, worldHeight)
  const scale = base * viewport.zoom
  const contentW = worldWidth * scale
  const contentH = worldHeight * scale
  return {
    originX: viewportRect.left + (viewportRect.width - contentW) * 0.5 + viewport.panX,
    originY: viewportRect.top + (viewportRect.height - contentH) * 0.5 + viewport.panY,
    scale,
  }
}

export function clientToWorldCoords(
  viewportRect: DOMRect,
  clientX: number,
  clientY: number,
  worldWidth: number,
  worldHeight: number,
  viewport: ViewportTransform,
): { x: number; y: number } | null {
  const { originX, originY, scale } = contentOrigin(viewportRect, worldWidth, worldHeight, viewport)
  if (scale <= 0) return null

  const x = (clientX - originX) / scale
  const y = (clientY - originY) / scale

  if (x < 0 || y < 0 || x > worldWidth || y > worldHeight) return null
  return { x, y }
}

export function zoomAtClientPoint(
  viewport: ViewportTransform,
  clientX: number,
  clientY: number,
  viewportRect: DOMRect,
  worldWidth: number,
  worldHeight: number,
  factor: number,
): ViewportTransform {
  const { originX, originY, scale: oldScale } = contentOrigin(
    viewportRect,
    worldWidth,
    worldHeight,
    viewport,
  )
  if (oldScale <= 0) return viewport

  const worldX = (clientX - originX) / oldScale
  const worldY = (clientY - originY) / oldScale
  const newZoom = clampViewportZoom(viewport.zoom * factor)
  const base = fitScale(viewportRect.width, viewportRect.height, worldWidth, worldHeight)
  const newScale = base * newZoom

  return {
    zoom: newZoom,
    panX: clientX - viewportRect.left - (viewportRect.width - worldWidth * newScale) * 0.5 - worldX * newScale,
    panY: clientY - viewportRect.top - (viewportRect.height - worldHeight * newScale) * 0.5 - worldY * newScale,
  }
}

export function zoomAtViewportCenter(
  viewport: ViewportTransform,
  viewportRect: DOMRect,
  worldWidth: number,
  worldHeight: number,
  factor: number,
): ViewportTransform {
  return zoomAtClientPoint(
    viewport,
    viewportRect.left + viewportRect.width * 0.5,
    viewportRect.top + viewportRect.height * 0.5,
    viewportRect,
    worldWidth,
    worldHeight,
    factor,
  )
}

export function canvasDisplayLayout(
  viewportSize: { width: number; height: number },
  worldWidth: number,
  worldHeight: number,
  viewport: ViewportTransform,
): { width: number; height: number; left: number; top: number } {
  const base = fitScale(viewportSize.width, viewportSize.height, worldWidth, worldHeight)
  const width = worldWidth * base * viewport.zoom
  const height = worldHeight * base * viewport.zoom
  return {
    width,
    height,
    left: (viewportSize.width - width) * 0.5 + viewport.panX,
    top: (viewportSize.height - height) * 0.5 + viewport.panY,
  }
}
