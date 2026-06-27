/** Map a screen click to simulation world coordinates (handles CSS object-fit: contain). */
export function clientToWorld(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } | null {
  const rect = canvas.getBoundingClientRect()
  const scale = Math.min(rect.width / canvas.width, rect.height / canvas.height)
  if (scale <= 0) return null

  const displayedWidth = canvas.width * scale
  const displayedHeight = canvas.height * scale
  const offsetX = rect.left + (rect.width - displayedWidth) * 0.5
  const offsetY = rect.top + (rect.height - displayedHeight) * 0.5

  const x = (clientX - offsetX) / scale
  const y = (clientY - offsetY) / scale

  if (x < 0 || y < 0 || x > canvas.width || y > canvas.height) return null
  return { x, y }
}
