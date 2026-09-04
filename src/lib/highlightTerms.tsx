import type { ReactNode } from 'react'

// Wraps class/type names, protocol acronyms, and domain jargon (etag, change
// vector, Voron, Rachis, ...) in <code> wherever prose text is rendered, so
// readers can tell "this is a specific identifier or term of art" from
// ordinary words at a glance - without hand-marking every occurrence in
// architecture.ts.

// Brand/language/vendor names happen to match the PascalCase-hump pattern
// below but aren't RavenDB identifiers, so they're excluded explicitly.
const EXCLUDE_TOKENS = new Set(['RavenDB', 'JavaScript'])

// Single-word subsystem names and class names with no internal capital hump
// (so the generic pattern below can't catch them). Matched case-sensitively -
// on purpose, since the lowercase form of most of these (page, tree, slice,
// index, attachment, leader, ...) is also an ordinary English word used
// throughout the prose in its generic sense.
const SINGLE_WORD_TERMS = [
  'Voron',
  'Rachis',
  'Corax',
  'Lucene',
  'Sparrow',
  'Smuggler',
  'Jint',
  'Leader',
  'Follower',
  'Candidate',
  'Tree',
  'Page',
  'Slice',
  'Index',
  'Attachment',
]

// Protocol/format/technique acronyms - always written uppercase, so matching
// them case-sensitively carries no risk of catching ordinary words.
const ACRONYMS = [
  'ACID',
  'AI',
  'API',
  'BI',
  'ETL',
  'FTP',
  'HTML',
  'HTTPS',
  'HTTP',
  'JSON',
  'OLAP',
  'RQL',
  'SQL',
  'SSE',
  'TCP',
  'TLS',
  'URL',
  'ONNX',
  'BERT',
  'RAFT',
  'TRXN',
  'SINK',
  'MOVE',
]

// Lowercase/hyphenated domain jargon - distinctive enough that matching them
// case-insensitively (so a sentence-initial "Tombstones..." still counts)
// carries no real risk of catching unrelated prose. Dotted namespace/method
// references (session.Store, Raven.Client, ...) land here too, since the
// "." isn't a word character and would otherwise split them out of the
// PascalCase pattern above.
const PHRASES = [
  'write-ahead journal',
  'snapshot isolation',
  'unit of work',
  'wire protocol',
  'cold storage',
  'content hash',
  'compare-exchange',
  'change vectors',
  'change vector',
  'blittable JSON',
  'term vectors',
  'term vector',
  'single-writer',
  'tombstones',
  'tombstone',
  'blittable',
  'base-26',
  'dry-run',
  'etags',
  'etag',
  'session.Store',
  'session.Query<T>()',
  'session.Advanced.Attachments.Store',
  'Raven.Client',
  'Raven.Server',
  'Raven.Studio',
]

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Multi-hump PascalCase/camelCase identifiers (DocumentsStorage,
// ShardedDatabaseContext, changeVectorParser, ...) are caught generically;
// everything else here needs an explicit list.
//
// Each hump after the first must contain a real lowercase run - not just
// another capital - so a bare run of capitals (an acronym typed inline, or
// example letters like "AA, AB") doesn't get mistaken for an identifier.
// The leading `[A-Z]{1,2}` allows the "I"/"IO"-style interface prefix
// (ITokenizer, IIndexingWork) without opening the door to longer runs.
const CASE_SENSITIVE_RE = new RegExp(
  `\\b(?:[A-Z]{1,2}[a-z0-9]*(?:[A-Z][a-z0-9]+)+|[a-z]+(?:[A-Z][a-z0-9]+)+|${ACRONYMS.map(escapeRegExp).join('|')}|${SINGLE_WORD_TERMS.map(escapeRegExp).join('|')})\\b`,
  'g',
)
// (?<!\w)/(?!\w) rather than \b at the edges: a phrase like "session.Query<T>()"
// ends in a non-word character, so the \b transition test (word <-> non-word)
// never fires right after it - these lookarounds just check "no word char here"
// on either side, which matches trailing punctuation correctly while still
// blocking a match mid-identifier.
const PHRASE_RE = new RegExp(`(?<!\\w)(?:${PHRASES.map(escapeRegExp).join('|')})(?!\\w)`, 'gi')

interface Span {
  start: number
  end: number
  text: string
}

function collectMatches(text: string, re: RegExp): Span[] {
  const spans: Span[] = []
  const r = new RegExp(re)
  let m: RegExpExecArray | null
  while ((m = r.exec(text))) {
    if (!EXCLUDE_TOKENS.has(m[0])) spans.push({ start: m.index, end: m.index + m[0].length, text: m[0] })
  }
  return spans
}

let keySeed = 0

// Manual override: wrap any word/phrase in backticks in architecture.ts prose
// (e.g. `write batch`) to force it into a <code> span even if it doesn't
// match any of the automatic patterns above.
const MANUAL_TAG_RE = /`([^`\n]+)`/g

function highlightAutoTerms(text: string): ReactNode[] {
  const spans = [...collectMatches(text, CASE_SENSITIVE_RE), ...collectMatches(text, PHRASE_RE)]
  // Earliest match first; on a tie, the longer one wins (so "change vectors"
  // beats a would-be shorter overlapping match starting at the same spot).
  spans.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start))

  const parts: ReactNode[] = []
  let cursor = 0
  for (const span of spans) {
    if (span.start < cursor) continue // overlaps a match already taken
    if (span.start > cursor) parts.push(text.slice(cursor, span.start))
    parts.push(
      <code key={`term-${keySeed++}`} className="inline-code">
        {span.text}
      </code>,
    )
    cursor = span.end
  }
  if (cursor < text.length) parts.push(text.slice(cursor))
  return parts
}

/**
 * Renders `text` as plain strings interleaved with <code> spans around
 * recognized terms, plus any span the author manually wrapped in backticks.
 */
export function highlightTerms(text: string): ReactNode[] {
  const re = new RegExp(MANUAL_TAG_RE)
  const parts: ReactNode[] = []
  let cursor = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > cursor) parts.push(...highlightAutoTerms(text.slice(cursor, m.index)))
    parts.push(
      <code key={`term-${keySeed++}`} className="inline-code">
        {m[1]}
      </code>,
    )
    cursor = m.index + m[0].length
  }
  if (cursor < text.length) parts.push(...highlightAutoTerms(text.slice(cursor)))
  return parts
}
