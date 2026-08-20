import { useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'ravendb-map-theme'

// localStorage throws (not just returns null) when storage is blocked - e.g.
// Safari private mode, or "block third-party cookies" when the map is embedded
// in an iframe. Reading it during the very first render would take the whole app
// down, so every access is guarded, the same way src/lib/github.ts does it.
function readStoredTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(readStoredTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Preference just won't survive this visit.
    }
  }, [theme])

  return [theme, setTheme]
}
