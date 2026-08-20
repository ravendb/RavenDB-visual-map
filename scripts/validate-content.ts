/**
 * Validates the map's content against the real ravendb/ravendb repository.
 *
 * Run with `npm run validate:content`. Checks, for the pinned REF:
 *   1. every `githubPath` exists (file or folder),
 *   2. every `codeRef.file` exists and `codeRef.startLine` really contains
 *      `codeRef.expectSymbol` (so a line number can never drift unnoticed),
 *   3. every `codeRef` declares an `expectSymbol` in the first place,
 *   4. internal consistency: unique node ids, `parentId` resolves, edges point at
 *      existing macro nodes, every macro node has exactly one layout position and
 *      none collide, and every pair of consecutive flow steps is connected by a
 *      real edge.
 *
 * Two ways to read the repository:
 *   - GitHub over HTTPS (default): two hosts, api.github.com for the file tree
 *     and raw.githubusercontent.com for file contents. Set GITHUB_TOKEN to raise
 *     the rate limit; CI does this automatically.
 *   - a local git clone: used when RAVENDB_REPO_DIR points at one, and fallen
 *     back to automatically (cloned into node_modules/.cache) when GitHub is
 *     unreachable - which is what happens behind a corporate proxy that lets
 *     `git` through but blocks Node's fetch.
 *
 * Exits non-zero when anything fails, printing every problem found.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { REPO, REF, nodes, edges, type MapNode } from '../src/data/architecture'
import { FLOWS } from '../src/data/flows'
import { MACRO_POSITIONS } from '../src/lib/layout'

const token = process.env.GITHUB_TOKEN
const headers: Record<string, string> = token ? { authorization: `Bearer ${token}` } : {}

/** Where an automatic fallback clone lives; override to reuse an existing one. */
const CLONE_DIR = process.env.RAVENDB_CLONE_DIR ?? join('node_modules', '.cache', 'ravendb-clone')

const problems: string[] = []
const fileCache = new Map<string, string[] | null>()

function fail(message: string) {
  problems.push(message)
}

function git(repoDir: string, args: string[]): string {
  return execFileSync('git', ['-C', repoDir, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

/** A read-only view of the repository, however we ended up reading it. */
interface Source {
  describe: string
  /** Every path in the repo, or null when the listing was truncated. */
  listPaths(): Promise<Set<string> | null>
  readFile(path: string): Promise<string[] | null>
  /** Only needed when listPaths() came back truncated. */
  pathExists(path: string): Promise<boolean>
}

function localSource(repoDir: string, ref: string): Source {
  return {
    describe: `local clone ${repoDir} @ ${ref}`,
    async listPaths() {
      return new Set(git(repoDir, ['ls-tree', '-r', '-t', '--name-only', ref]).split('\n').filter(Boolean))
    },
    async readFile(path) {
      try {
        return git(repoDir, ['show', `${ref}:${path}`]).split('\n')
      } catch {
        return null
      }
    },
    async pathExists(path) {
      try {
        git(repoDir, ['cat-file', '-e', `${ref}:${path}`])
        return true
      } catch {
        return false
      }
    },
  }
}

const githubSource: Source = {
  describe: `${REPO}@${REF} over HTTPS${token ? '' : ' (no GITHUB_TOKEN - lower rate limit)'}`,
  async listPaths() {
    // One request for the whole tree: the map has dozens of paths and GitHub's
    // unauthenticated limit is 60 requests/hour, so per-path lookups would fail
    // on a laptop without a token.
    const url = `https://api.github.com/repos/${REPO}/git/trees/${REF}?recursive=1`
    const response = await fetch(url, { headers })
    if (!response.ok) {
      throw new Error(`GitHub returned ${response.status} for ${url} - ${await response.text()}`)
    }
    const body = (await response.json()) as { truncated?: boolean; tree: { path: string }[] }
    return body.truncated ? null : new Set(body.tree.map((entry) => entry.path))
  },
  async readFile(path) {
    const response = await fetch(`https://raw.githubusercontent.com/${REPO}/${REF}/${path}`)
    return response.ok ? (await response.text()).split('\n') : null
  },
  async pathExists(path) {
    const url = `https://api.github.com/repos/${REPO}/contents/${path}?ref=${REF}`
    const response = await fetch(url, { headers })
    if (response.status === 200) return true
    if (response.status === 404) return false
    throw new Error(`GitHub returned ${response.status} for ${url} - ${await response.text()}`)
  },
}

function haveGit(): boolean {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * Clone (or reuse) a blobless, checkout-less copy of the branch. Blobless keeps
 * it small; file contents are fetched on demand by `git show`.
 */
function ensureClone(): Source {
  if (!existsSync(join(CLONE_DIR, 'HEAD')) && !existsSync(join(CLONE_DIR, '.git'))) {
    mkdirSync(CLONE_DIR, { recursive: true })
    console.log(`Cloning ${REPO}#${REF} into ${CLONE_DIR} (blobless, one time)…`)
    execFileSync(
      'git',
      ['clone', '--filter=blob:none', '--no-checkout', '--depth', '1', '--branch', REF,
        `https://github.com/${REPO}.git`, CLONE_DIR],
      { stdio: 'inherit' },
    )
  } else {
    // Keep the pinned branch current, but never fail the run over it.
    try {
      git(CLONE_DIR, ['fetch', '--depth', '1', 'origin', REF])
      git(CLONE_DIR, ['reset', '--soft', 'FETCH_HEAD'])
    } catch {
      console.log('Could not refresh the cached clone - validating against what is already there.')
    }
  }
  return localSource(CLONE_DIR, 'HEAD')
}

async function pickSource(): Promise<{ source: Source; paths: Set<string> | null }> {
  const explicitLocal = process.env.RAVENDB_REPO_DIR
  if (explicitLocal) {
    const source = localSource(explicitLocal, process.env.RAVENDB_REPO_REF ?? 'HEAD')
    return { source, paths: await source.listPaths() }
  }
  try {
    return { source: githubSource, paths: await githubSource.listPaths() }
  } catch (error) {
    // Anything at all: an unreachable api.github.com (corporate proxy that lets
    // git through but blocks Node's fetch), a spent rate limit, a 5xx. None of
    // those say anything about the map's correctness, so don't fail on them.
    console.log(`Could not read the tree from api.github.com: ${(error as Error).message.split('\n')[0]}`)
    if (!haveGit()) {
      throw new Error(
        'GitHub is unreachable and git is not available to fall back to. ' +
          'Point RAVENDB_REPO_DIR at a ravendb/ravendb clone and re-run.',
      )
    }
    console.log('Falling back to git, which usually works where fetch does not (proxies, firewalls, rate limits).')
    const source = ensureClone()
    return { source, paths: await source.listPaths() }
  }
}

function checkStructure() {
  const byId = new Map<string, MapNode>()
  for (const node of nodes) {
    if (byId.has(node.id)) fail(`duplicate node id: ${node.id}`)
    byId.set(node.id, node)
  }

  const macro = nodes.filter((n) => !n.parentId).map((n) => n.id)
  const positioned = Object.keys(MACRO_POSITIONS)

  for (const id of macro) {
    if (!positioned.includes(id)) fail(`macro node "${id}" has no position in layout.ts`)
  }
  for (const id of positioned) {
    if (!macro.includes(id)) fail(`layout.ts positions "${id}", which is not a macro node`)
  }

  // Two cards at the same spot would silently hide one of them.
  const seen = new Map<string, string>()
  for (const [id, { x, y }] of Object.entries(MACRO_POSITIONS)) {
    const key = `${x}:${y}`
    const other = seen.get(key)
    if (other) fail(`"${id}" and "${other}" share the position ${key} in layout.ts`)
    seen.set(key, id)
  }

  for (const node of nodes) {
    if (node.parentId && !byId.has(node.parentId)) {
      fail(`node "${node.id}" has parentId "${node.parentId}", which does not exist`)
    }
    if (node.codeRef && !node.codeRef.expectSymbol) {
      fail(`node "${node.id}" has a codeRef without expectSymbol - add one so CI can verify the line`)
    }
  }

  for (const edge of edges) {
    for (const side of ['source', 'target'] as const) {
      const id = edge[side]
      if (!byId.has(id)) fail(`edge "${edge.id}" ${side} "${id}" does not exist`)
      else if (byId.get(id)!.parentId) fail(`edge "${edge.id}" ${side} "${id}" is a micro node - edges connect macro nodes`)
    }
  }

  for (const flow of FLOWS) {
    for (const step of flow.steps) {
      if (!byId.has(step.nodeId)) fail(`flow "${flow.id}" references unknown node "${step.nodeId}"`)
    }
    for (let i = 0; i + 1 < flow.steps.length; i++) {
      const from = flow.steps[i].nodeId
      const to = flow.steps[i + 1].nodeId
      const connected = edges.some(
        (e) => (e.source === from && e.target === to) || (e.source === to && e.target === from),
      )
      if (!connected) fail(`flow "${flow.id}" steps "${from}" -> "${to}" are not connected by any edge`)
    }
  }
}

async function checkPaths(source: Source, paths: Set<string> | null) {
  const wanted = [...new Set(nodes.map((n) => n.githubPath))]
  if (paths) {
    for (const path of wanted) {
      if (!paths.has(path)) fail(`githubPath does not exist on ${REF}: ${path}`)
    }
    return
  }
  console.log('The tree listing came back truncated - falling back to per-path lookups.')
  const results = await Promise.all(wanted.map(async (p) => [p, await source.pathExists(p)] as const))
  for (const [path, exists] of results) {
    if (!exists) fail(`githubPath does not exist on ${REF}: ${path}`)
  }
}

async function readFileCached(source: Source, path: string): Promise<string[] | null> {
  const cached = fileCache.get(path)
  if (cached !== undefined) return cached
  const lines = await source.readFile(path)
  fileCache.set(path, lines)
  return lines
}

async function checkCodeRefs(source: Source) {
  const refs = nodes.filter((n) => n.codeRef).map((n) => ({ id: n.id, ref: n.codeRef! }))
  await Promise.all(
    refs.map(async ({ id, ref }) => {
      const lines = await readFileCached(source, ref.file)
      if (lines === null) {
        fail(`codeRef file of "${id}" could not be read on ${REF}: ${ref.file}`)
        return
      }
      const start = ref.startLine ?? 1
      if (start > lines.length) {
        fail(`codeRef of "${id}" points at line ${start} but ${ref.file} has ${lines.length} lines`)
        return
      }
      if (ref.endLine && ref.endLine > lines.length) {
        fail(`codeRef of "${id}" ends at line ${ref.endLine} but ${ref.file} has ${lines.length} lines`)
      }
      const line = lines[start - 1]
      if (ref.expectSymbol && !line.includes(ref.expectSymbol)) {
        fail(
          `codeRef of "${id}" expects "${ref.expectSymbol}" on ${ref.file}:${start}, found:\n      ${line.trim()}`,
        )
      }
    }),
  )
}

checkStructure()
const { source, paths } = await pickSource()
console.log(`Validating ${nodes.length} nodes against ${source.describe}`)
await checkPaths(source, paths)
await checkCodeRefs(source)

const reviewCount = nodes.filter((n) => n.needsReview).length
console.log(`Nodes still awaiting a subsystem-expert review: ${reviewCount}/${nodes.length}`)

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s) found:`)
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}
console.log('All paths, code references and graph relationships check out.')
