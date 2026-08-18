/**
 * Validates the map's content against the real ravendb/ravendb repository.
 *
 * Run with `npm run validate:content`. Checks, for the pinned REF:
 *   1. every `githubPath` exists (file or folder),
 *   2. every `codeRef.file` exists and `codeRef.startLine` really contains
 *      `codeRef.expectSymbol` (so a line number can never drift unnoticed),
 *   3. every `codeRef` declares an `expectSymbol` in the first place,
 *   4. internal consistency: unique node ids, `parentId` resolves, edges point at
 *      existing nodes, every macro node has a layout position (and vice versa),
 *      and every pair of consecutive flow steps is connected by a real edge.
 *
 * Exits non-zero on the first category that fails, printing every problem found.
 * Set GITHUB_TOKEN to raise GitHub's rate limit (CI does this automatically).
 */
import { execFileSync } from 'node:child_process'
import { REPO, REF, nodes, edges, type MapNode } from '../src/data/architecture'
import { FLOWS } from '../src/data/flows'
import { MACRO_POSITIONS } from '../src/lib/layout'

const token = process.env.GITHUB_TOKEN
const headers: Record<string, string> = token ? { authorization: `Bearer ${token}` } : {}

// Set RAVENDB_REPO_DIR to a local ravendb/ravendb clone to validate offline,
// without touching GitHub's API at all - handy behind a rate-limited IP.
// A blobless clone is enough:
//   git clone --filter=blob:none --no-checkout --depth 1 -b v7.2 \
//     https://github.com/ravendb/ravendb.git
const localRepo = process.env.RAVENDB_REPO_DIR
const localRef = localRepo ? (process.env.RAVENDB_REPO_REF ?? 'HEAD') : null

function git(args: string[]): string {
  return execFileSync('git', ['-C', localRepo!, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

const problems: string[] = []
const fileCache = new Map<string, string[] | null>()

function fail(message: string) {
  problems.push(message)
}

/**
 * One request for the whole file tree instead of one per path: the map has
 * dozens of paths and GitHub's unauthenticated limit is 60 requests/hour, so
 * per-path lookups would fail on a laptop without a token.
 * Falls back to per-path lookups if GitHub truncates the tree.
 */
async function loadTree(): Promise<Set<string> | null> {
  if (localRepo) {
    return new Set(
      git(['ls-tree', '-r', '-t', '--name-only', localRef!]).split('\n').filter(Boolean),
    )
  }
  const url = `https://api.github.com/repos/${REPO}/git/trees/${REF}?recursive=1`
  const response = await fetch(url, { headers })
  if (!response.ok) {
    throw new Error(`GitHub returned ${response.status} for ${url} - ${await response.text()}`)
  }
  const body = (await response.json()) as { truncated?: boolean; tree: { path: string }[] }
  if (body.truncated) return null
  return new Set(body.tree.map((entry) => entry.path))
}

async function pathExistsViaApi(path: string): Promise<boolean> {
  const url = `https://api.github.com/repos/${REPO}/contents/${path}?ref=${REF}`
  const response = await fetch(url, { headers })
  if (response.status === 200) return true
  if (response.status === 404) return false
  throw new Error(`GitHub returned ${response.status} for ${url} - ${await response.text()}`)
}

async function fileLines(path: string): Promise<string[] | null> {
  const cached = fileCache.get(path)
  if (cached !== undefined) return cached
  let lines: string[] | null
  if (localRepo) {
    try {
      lines = git(['show', `${localRef}:${path}`]).split('\n')
    } catch {
      lines = null
    }
  } else {
    const url = `https://raw.githubusercontent.com/${REPO}/${REF}/${path}`
    const response = await fetch(url)
    lines = response.ok ? (await response.text()).split('\n') : null
  }
  fileCache.set(path, lines)
  return lines
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

async function checkPaths() {
  const paths = [...new Set(nodes.map((n) => n.githubPath))]
  const tree = await loadTree()
  if (tree) {
    for (const path of paths) {
      if (!tree.has(path)) fail(`githubPath does not exist on ${REF}: ${path}`)
    }
    return
  }
  console.log('GitHub truncated the tree listing - falling back to per-path lookups.')
  const results = await Promise.all(paths.map(async (p) => [p, await pathExistsViaApi(p)] as const))
  for (const [path, exists] of results) {
    if (!exists) fail(`githubPath does not exist on ${REF}: ${path}`)
  }
}

async function checkCodeRefs() {
  const refs = nodes.filter((n) => n.codeRef).map((n) => ({ id: n.id, ref: n.codeRef! }))
  await Promise.all(
    refs.map(async ({ id, ref }) => {
      const lines = await fileLines(ref.file)
      if (lines === null) {
        fail(`codeRef file of "${id}" does not exist on ${REF}: ${ref.file}`)
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

console.log(
  localRepo
    ? `Validating ${nodes.length} nodes against local clone ${localRepo} @ ${localRef}`
    : `Validating ${nodes.length} nodes against ${REPO}@${REF}${token ? '' : ' (no GITHUB_TOKEN - lower rate limit)'}`,
)
checkStructure()
await checkPaths()
await checkCodeRefs()

const reviewCount = nodes.filter((n) => n.needsReview).length
console.log(`Nodes still awaiting a subsystem-expert review: ${reviewCount}/${nodes.length}`)

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s) found:`)
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}
console.log('All paths, code references and graph relationships check out.')
