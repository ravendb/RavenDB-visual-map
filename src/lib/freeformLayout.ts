// Persists the user's own drag-and-drop arrangement of macro nodes on the
// free-layout page (see FreeformMap) - separate from MACRO_POSITIONS, which
// stays the hand-placed default every visitor starts from.

export type FreeformPositions = Record<string, { x: number; y: number }>

const STORAGE_KEY = 'ravendb-map-freeform-positions'

export function loadFreeformPositions(): FreeformPositions {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    // Corrupt or inaccessible storage (private browsing, quota, hand-edited
    // value) - fall back to the hand-placed default layout instead of
    // throwing on every page load.
    return {}
  }
}

export function saveFreeformPositions(positions: FreeformPositions): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(positions))
  } catch {
    // Ignore write failures (e.g. storage disabled/full) - dragging still
    // works for the rest of the session, it just won't survive a reload.
  }
}

export function clearFreeformPositions(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to do if storage isn't available.
  }
}
