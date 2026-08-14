// Content model for the RavenDB architecture map.
//
// This is a first pass, written from the real ravendb/ravendb folder structure
// (checked against the v7.2 branch) plus general RavenDB architecture knowledge.
// It has NOT had a subsystem-expert review pass yet - the same review discipline
// the team applies to ravendb-kb should eventually be applied here too. Nodes
// that would most benefit from that review are marked `needsReview: true`.
//
// To extend: add a MapNode (and MapEdge if it connects to something) below.
// `codeRef` line numbers must point at real, verified lines - do not guess them.

export const REPO = 'ravendb/ravendb'
export const REF = 'v7.2'

export type NodeCategory =
  | 'client'
  | 'server'
  | 'storage'
  | 'indexing'
  | 'cluster'
  | 'studio'
  | 'infra'
  | 'integration'
  | 'security'

export interface CodeRef {
  file: string
  startLine?: number
  endLine?: number
}

export interface MapNode {
  id: string
  label: string
  category: NodeCategory
  /** 1-3 sentences, shown in the macro view / node tooltip. */
  summary: string
  /** Longer text for the detail panel. */
  description?: string
  /** Path (folder or file) in the ravendb/ravendb repo, relative to repo root. */
  githubPath: string
  /** A specific file + line range to preview inline, when one exists. */
  codeRef?: CodeRef
  /** Set for micro nodes that live inside a macro node's drill-down view. */
  parentId?: string
  /** First-pass content that hasn't been checked by a subsystem expert yet. */
  needsReview?: boolean
}

export interface MapEdge {
  id: string
  source: string
  target: string
  label?: string
}

export const nodes: MapNode[] = [
  // ---------------------------------------------------------------------
  // Macro nodes
  // ---------------------------------------------------------------------
  {
    id: 'client',
    label: 'Client SDK',
    category: 'client',
    summary: 'The .NET client library applications use to talk to RavenDB: sessions, queries, bulk inserts, subscriptions.',
    description:
      'Raven.Client is what application code links against. It builds HTTP requests for the server API, tracks entities in a session (unit of work), and mirrors the wire protocol implemented by the eight other official SDKs.',
    githubPath: 'src/Raven.Client',
  },
  {
    id: 'http',
    label: 'HTTP / Routing Layer',
    category: 'server',
    summary: 'The web server front door: request routing, authentication, and the handlers that turn HTTP calls into database operations.',
    description:
      'Every client request (and every Studio request) lands here first. The actual dispatcher (RequestRouter, RouteScanner) lives in the sibling src/Raven.Server/Routing folder; Web itself holds the per-resource-type Handlers it dispatches to (documents, attachments, indexes, ...) plus the Authentication middleware that runs before routing.',
    githubPath: 'src/Raven.Server/Web',
  },
  {
    id: 'documents-core',
    label: 'Document Database Core',
    category: 'server',
    summary: "The core per-database engine: documents, revisions, counters, time series, conflicts, subscriptions, replication, ETL.",
    description:
      'This is the largest subsystem in the server: DocumentsStorage and its siblings (CountersStorage, ConflictsStorage, ...) sit on top of a Voron storage environment and are what most database operations ultimately touch.',
    githubPath: 'src/Raven.Server/Documents',
    codeRef: { file: 'src/Raven.Server/Documents/DocumentsStorage.cs', startLine: 50 },
  },
  {
    id: 'attachments',
    label: 'Attachments',
    category: 'server',
    summary: 'Binary blobs attached to documents, stored as streams alongside the owning document, plus cross-node "remote attachment" fetch.',
    description:
      'Attachments are stored and streamed through AttachmentsStorage (a Voron-backed tree of chunks), separately from document JSON so large binaries do not bloat document reads. RemoteAttachmentsStorage/RemoteAttachmentsSender and the RemoteAttachmentHandler implement fetching an attachment from another cluster node on demand, instead of replicating every attachment eagerly to every node.',
    githubPath: 'src/Raven.Server/Documents',
    codeRef: { file: 'src/Raven.Server/Documents/AttachmentsStorage.cs', startLine: 52 },
  },
  {
    id: 'indexing',
    label: 'Indexing & Search (Corax)',
    category: 'indexing',
    summary: "RavenDB's search/indexing engine: analyzers, the inverted index, and query execution.",
    description:
      'Corax is the newer of RavenDB\'s two indexing engines (alongside the older Lucene-based path). It tokenizes and analyzes field values, builds an inverted index persisted via Voron, and executes queries against it.',
    githubPath: 'src/Corax',
    codeRef: { file: 'src/Corax/Querying/IndexSearcher.cs', startLine: 31 },
  },
  {
    id: 'storage',
    label: 'Storage Engine (Voron)',
    category: 'storage',
    summary: 'The transactional, memory-mapped, page-based storage engine every other subsystem persists through.',
    description:
      'Voron is an embedded key-value storage engine (conceptually similar to LMDB): pages, a write-ahead journal, B+Trees, and MVCC-style transactions. Everything else in RavenDB - documents, indexes, cluster state - ultimately reads and writes through a Voron StorageEnvironment.',
    githubPath: 'src/Voron',
    codeRef: { file: 'src/Voron/StorageEnvironment.cs', startLine: 50, endLine: 140 },
  },
  {
    id: 'cluster',
    label: 'Clustering (Rachis)',
    category: 'cluster',
    summary: 'Raft-based consensus between cluster nodes: leader election, log replication, and cluster-wide state (compare-exchange, cluster transactions).',
    description:
      "Rachis is RavenDB's implementation of the Raft consensus algorithm. It elects a cluster leader, replicates a command log to followers, and drives ServerWide state such as the cluster's database topology and compare-exchange values that must agree across every node.",
    githubPath: 'src/Raven.Server/Rachis',
    codeRef: { file: 'src/Raven.Server/Rachis/Leader.cs', startLine: 34 },
  },
  {
    id: 'integrations',
    label: 'ETL & Integrations',
    category: 'integration',
    summary: 'Ongoing tasks that move data in and out of RavenDB: ETL to other databases, SQL migration, PostgreSQL protocol support, import/export.',
    description:
      "The main edge/integration extension points, each in its own top-level folder rather than under one shared parent: ETL (Documents/ETL) processes stream document changes out to relational databases or other RavenDB instances, Smuggler (Smuggler, plus a sharding-aware companion under Documents/Smuggler) handles bulk import/export, SqlMigration (SqlMigration) pulls data in from existing SQL databases, and the PostgreSQL integration (Integrations/PostgreSQL) lets Postgres-wire clients query RavenDB directly.",
    githubPath: 'src/Raven.Server',
  },
  {
    id: 'security',
    label: 'Security & HTTPS',
    category: 'security',
    summary: 'Certificate-based authentication and transport security for client/server and server/server communication.',
    description:
      'RavenDB authenticates connections using X.509 client certificates rather than username/password, enforced at the HTTPS layer before a request reaches routing.',
    githubPath: 'src/Raven.Server/Https',
  },
  {
    id: 'studio',
    label: 'Studio (Management UI)',
    category: 'studio',
    summary: "RavenDB's built-in web management interface, bundled with the server.",
    description: 'A single-page app served by the server itself, talking to the same HTTP API as any other client - used for administration, querying, and monitoring.',
    githubPath: 'src/Raven.Studio',
  },
  {
    id: 'infra',
    label: 'Low-level Infra (Sparrow)',
    category: 'infra',
    summary: 'Shared low-level building blocks used across the server and storage engine: buffers, memory management, threading primitives.',
    description:
      'Sparrow (and Sparrow.Server) is not a feature area but the foundation the rest of the server is built on - things like unmanaged memory pooling and low-level JSON parsing live here because Voron and Raven.Server both depend on them.',
    githubPath: 'src/Sparrow',
  },

  // ---------------------------------------------------------------------
  // Micro nodes: Storage Engine (Voron)
  // ---------------------------------------------------------------------
  {
    id: 'storage-impl',
    label: 'Impl (pager, journal, trees)',
    category: 'storage',
    summary: 'The actual mechanics: paging, the write-ahead journal, and B+Tree implementations.',
    githubPath: 'src/Voron/Impl',
    parentId: 'storage',
  },
  {
    id: 'storage-data',
    label: 'Data structures',
    category: 'storage',
    summary: 'On-disk data structure and storage format definitions.',
    githubPath: 'src/Voron/Data',
    parentId: 'storage',
  },
  {
    id: 'storage-schema',
    label: 'Schema',
    category: 'storage',
    summary: 'Structural/schema definitions for what is stored in a Voron environment.',
    githubPath: 'src/Voron/Schema',
    parentId: 'storage',
  },
  {
    id: 'storage-page',
    label: 'Page / PageHeader',
    category: 'storage',
    summary: 'The fixed-size page is the fundamental unit Voron reads and writes.',
    githubPath: 'src/Voron/Page.cs',
    codeRef: { file: 'src/Voron/Page.cs', startLine: 8 },
    parentId: 'storage',
  },
  {
    id: 'storage-slice',
    label: 'Slice',
    category: 'storage',
    summary: 'The key/value byte-range abstraction used throughout Voron\'s trees.',
    githubPath: 'src/Voron/Slice.cs',
    codeRef: { file: 'src/Voron/Slice.cs', startLine: 14 },
    parentId: 'storage',
  },

  // ---------------------------------------------------------------------
  // Micro nodes: Attachments
  // ---------------------------------------------------------------------
  {
    id: 'attachments-storage',
    label: 'AttachmentsStorage',
    category: 'server',
    summary: 'Core read/write logic for attachment streams, backed by Voron.',
    githubPath: 'src/Raven.Server/Documents/AttachmentsStorage.cs',
    codeRef: { file: 'src/Raven.Server/Documents/AttachmentsStorage.cs', startLine: 52 },
    parentId: 'attachments',
  },
  {
    id: 'attachments-remote-storage',
    label: 'RemoteAttachmentsStorage / Sender',
    category: 'server',
    summary: 'Fetches/sends an attachment from another cluster node on demand, instead of eager replication of binary content.',
    githubPath: 'src/Raven.Server/Documents/RemoteAttachmentsStorage.cs',
    parentId: 'attachments',
  },
  {
    id: 'attachments-handler',
    label: 'AttachmentHandler',
    category: 'server',
    summary: 'The HTTP handler exposing attachment upload/download/delete endpoints.',
    githubPath: 'src/Raven.Server/Documents/Handlers/AttachmentHandler.cs',
    parentId: 'attachments',
  },
  {
    id: 'attachments-remote-handler',
    label: 'RemoteAttachmentHandler',
    category: 'server',
    summary: 'The HTTP endpoint one cluster node calls on another to pull an attachment it does not have locally.',
    githubPath: 'src/Raven.Server/Documents/Handlers/RemoteAttachmentHandler.cs',
    parentId: 'attachments',
  },
  {
    id: 'attachments-model',
    label: 'Attachment / AttachmentOrTombstone',
    category: 'server',
    summary: 'The in-memory model for an attachment record and its deletion marker (tombstone).',
    githubPath: 'src/Raven.Server/Documents/Attachment.cs',
    parentId: 'attachments',
  },

  // ---------------------------------------------------------------------
  // Micro nodes: Clustering (Rachis)
  // ---------------------------------------------------------------------
  {
    id: 'cluster-leader',
    label: 'Leader',
    category: 'cluster',
    summary: 'Drives log replication to followers once a node has won an election.',
    githubPath: 'src/Raven.Server/Rachis/Leader.cs',
    codeRef: { file: 'src/Raven.Server/Rachis/Leader.cs', startLine: 34 },
    parentId: 'cluster',
  },
  {
    id: 'cluster-follower',
    label: 'Follower',
    category: 'cluster',
    summary: 'The steady-state role: accepts AppendEntries from the current leader.',
    githubPath: 'src/Raven.Server/Rachis/Follower.cs',
    parentId: 'cluster',
  },
  {
    id: 'cluster-candidate',
    label: 'Candidate / Elector',
    category: 'cluster',
    summary: 'Leader election: a node campaigns as Candidate, Elector orchestrates the vote.',
    githubPath: 'src/Raven.Server/Rachis/Candidate.cs',
    parentId: 'cluster',
  },
  {
    id: 'cluster-consensus',
    label: 'RachisConsensus / StateMachine',
    category: 'cluster',
    summary: 'The core consensus engine and the abstraction that applies committed log entries to cluster state.',
    githubPath: 'src/Raven.Server/Rachis/RachisConsensus.cs',
    parentId: 'cluster',
  },
  {
    id: 'cluster-commands',
    label: 'Commands',
    category: 'cluster',
    summary: 'The set of commands that can be proposed to and committed by the Raft log.',
    githubPath: 'src/Raven.Server/Rachis/Commands',
    parentId: 'cluster',
  },
  {
    id: 'cluster-network',
    label: 'Wire protocol (AppendEntries, RequestVote, ...)',
    category: 'cluster',
    summary: 'The messages nodes exchange: log replication, vote requests, snapshot install, the initial handshake.',
    githubPath: 'src/Raven.Server/Rachis/AppendEntries.cs',
    parentId: 'cluster',
  },

  // ---------------------------------------------------------------------
  // Micro nodes: Indexing (Corax)
  // ---------------------------------------------------------------------
  {
    id: 'corax-analyzers',
    label: 'Analyzers',
    category: 'indexing',
    summary: 'Tokenization and text analysis applied to field values before they are indexed.',
    githubPath: 'src/Corax/Analyzers',
    parentId: 'indexing',
  },
  {
    id: 'corax-indexing',
    label: 'Indexing',
    category: 'indexing',
    summary: 'Builds and maintains the inverted index as documents change.',
    githubPath: 'src/Corax/Indexing',
    parentId: 'indexing',
  },
  {
    id: 'corax-querying',
    label: 'Querying / IndexSearcher',
    category: 'indexing',
    summary: 'Executes queries against the inverted index and returns matching entries.',
    githubPath: 'src/Corax/Querying',
    codeRef: { file: 'src/Corax/Querying/IndexSearcher.cs', startLine: 31 },
    parentId: 'indexing',
  },
  {
    id: 'corax-pipeline',
    label: 'Pipeline',
    category: 'indexing',
    summary: 'The staged processing pipeline data passes through on its way into the index.',
    githubPath: 'src/Corax/Pipeline',
    parentId: 'indexing',
  },
  {
    id: 'corax-mappings',
    label: 'Mappings',
    category: 'indexing',
    summary: 'Field-to-index mapping and schema definitions for what gets indexed and how.',
    githubPath: 'src/Corax/Mappings',
    parentId: 'indexing',
  },
]

export const edges: MapEdge[] = [
  { id: 'client-http', source: 'client', target: 'http', label: 'HTTP API' },
  { id: 'studio-http', source: 'studio', target: 'http', label: 'HTTP API' },
  { id: 'security-http', source: 'security', target: 'http', label: 'authenticates' },
  { id: 'http-documents', source: 'http', target: 'documents-core', label: 'routes to' },
  { id: 'documents-attachments', source: 'documents-core', target: 'attachments' },
  { id: 'documents-indexing', source: 'documents-core', target: 'indexing', label: 'feeds' },
  { id: 'documents-storage', source: 'documents-core', target: 'storage', label: 'persists via' },
  { id: 'indexing-storage', source: 'indexing', target: 'storage', label: 'persists via' },
  { id: 'attachments-storage-edge', source: 'attachments', target: 'storage', label: 'persists via' },
  { id: 'documents-integrations', source: 'documents-core', target: 'integrations', label: 'change feed' },
  { id: 'documents-cluster', source: 'documents-core', target: 'cluster', label: 'cluster-wide ops' },
  { id: 'http-cluster', source: 'http', target: 'cluster', label: 'server-to-server' },
  { id: 'storage-infra', source: 'storage', target: 'infra', label: 'built on' },
  { id: 'documents-infra', source: 'documents-core', target: 'infra', label: 'built on' },
]

export function getChildren(nodeId: string): MapNode[] {
  return nodes.filter((n) => n.parentId === nodeId)
}

export function getNode(id: string): MapNode | undefined {
  return nodes.find((n) => n.id === id)
}

export function githubBlobUrl(path: string, startLine?: number, endLine?: number): string {
  const base = `https://github.com/${REPO}/blob/${REF}/${path}`
  if (startLine == null) return base
  return `${base}#L${startLine}${endLine ? `-L${endLine}` : ''}`
}

export function githubTreeUrl(path: string): string {
  return `https://github.com/${REPO}/tree/${REF}/${path}`
}
