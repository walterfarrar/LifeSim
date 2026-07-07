export type InspectMode = 'creature' | 'plant' | 'soil' | 'air'

export type MapSelection =
  | { type: 'creature'; id: number }
  | { type: 'plant'; id: number }
  | { type: 'soil'; col: number; row: number }
  | { type: 'air'; col: number; row: number }

export function selectionMatchesMode(selection: MapSelection | null, mode: InspectMode): boolean {
  return selection?.type === mode
}
