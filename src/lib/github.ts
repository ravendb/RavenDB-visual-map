import { REPO, REF } from '../data/architecture'

const cache = new Map<string, string>()
const CACHE_PREFIX = 'ravendb-map:file-cache:'

export interface FetchFileResult {
  content: string
  fromCache: boolean
}

/**
 * Fetches a file's raw text content from GitHub for inline preview.
 * Public repo, no auth - subject to GitHub's unauthenticated rate limits,
 * so results are cached in-memory and in localStorage across sessions.
 */
export async function fetchFileContent(path: string): Promise<FetchFileResult> {
  const memoHit = cache.get(path)
  if (memoHit !== undefined) return { content: memoHit, fromCache: true }

  try {
    const stored = window.localStorage.getItem(CACHE_PREFIX + path)
    if (stored !== null) {
      cache.set(path, stored)
      return { content: stored, fromCache: true }
    }
  } catch {
    // localStorage unavailable (private browsing, etc.) - fall through to network.
  }

  const url = `https://raw.githubusercontent.com/${REPO}/${REF}/${path}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`GitHub returned ${response.status} for ${path}`)
  }
  const content = await response.text()
  cache.set(path, content)
  try {
    window.localStorage.setItem(CACHE_PREFIX + path, content)
  } catch {
    // Quota exceeded or unavailable - in-memory cache still applies for this session.
  }
  return { content, fromCache: false }
}

export function languageForPath(path: string): string {
  if (path.endsWith('.cs')) return 'csharp'
  if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript'
  if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript'
  return 'text'
}
