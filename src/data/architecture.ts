// Content model for the RavenDB architecture map.
//
// Every `githubPath` and every `codeRef` in this file is verified automatically
// against the real repository by `npm run validate:content`
// (scripts/validate-content.ts, also run in CI): the path must exist on REF, and
// the line `codeRef.startLine` points at must contain `codeRef.expectSymbol`.
// That is what keeps the map from silently rotting when the code moves - so when
// you add a node, add the `expectSymbol` too instead of trusting a line number.
//
// Coverage is deliberately aligned with how the official documentation
// (github.com/ravendb/docs) splits RavenDB into areas, so that a reader who
// knows the docs finds the same subsystems here.
//
// Nodes whose text was written from folder structure + general RavenDB knowledge
// and still needs a subsystem-expert pass carry `needsReview: true`; the UI shows
// a warning on those.

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
  /**
   * Text that must appear on `startLine` (usually the type declaration).
   * Checked by scripts/validate-content.ts so a line number can never drift
   * unnoticed when the file changes upstream.
   */
  expectSymbol?: string
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
  /** Related article in the official documentation, when one exists. */
  docsUrl?: string
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
      'Raven.Client is what .NET application code links against. It builds HTTP requests for the server API and tracks entities in a session (unit of work). RavenDB ships official clients for seven languages in total - .NET, Java, Node.js, Python, PHP, Ruby and Go - and they all speak the same wire protocol this one implements.',
    githubPath: 'src/Raven.Client',
    docsUrl: 'https://docs.ravendb.net/7.2/client-api/what-is-a-document-store',
  },
  {
    id: 'http',
    label: 'HTTP / Routing Layer',
    category: 'server',
    summary: 'The web server front door: request routing and the handlers that turn HTTP calls into database operations.',
    description:
      'Every client request (and every Studio request) lands here first. The dispatcher itself (RequestRouter, RouteScanner) lives in the sibling src/Raven.Server/Routing folder; Web holds the per-resource-type Handlers it dispatches to (documents, attachments, indexes, ...), the shared RequestHandler base class, and the endpoints under Web/Authentication for managing client certificates and two-factor authentication. Connection-level authentication happens earlier, at the HTTPS layer - see the Security node.',
    githubPath: 'src/Raven.Server/Web',
    needsReview: true,
  },
  {
    id: 'sharding',
    label: 'Sharding',
    category: 'server',
    summary: 'Splits one database across several shards and fans requests out to them, presenting a single database to the client.',
    description:
      'A sharded database is orchestrated by ShardedDatabaseContext: ShardLocator decides which shard a document id (bucket) belongs to, the Executors fan a request out to the relevant shards, and Queries merges the per-shard results back into one answer. Clients talk to a sharded database the same way they talk to a non-sharded one.',
    githubPath: 'src/Raven.Server/Documents/Sharding',
    codeRef: {
      file: 'src/Raven.Server/Documents/Sharding/ShardedDatabaseContext.cs',
      startLine: 33,
      expectSymbol: 'class ShardedDatabaseContext',
    },
    needsReview: true,
    docsUrl: 'https://docs.ravendb.net/7.2/sharding/overview',
  },
  {
    id: 'documents-core',
    label: 'Document Database Core',
    category: 'server',
    summary: 'The core per-database engine: documents, revisions, counters, time series, conflicts, subscriptions, queries, patching.',
    description:
      'DocumentsStorage and its siblings (CountersStorage, ConflictsStorage, RevisionsStorage, TimeSeriesStorage, ...) sit on top of a Voron storage environment and are what most database operations ultimately touch. Writes do not each open their own Voron write transaction: they are queued through the TransactionMerger, which batches many operations into one transaction - the mechanism the documentation credits for RavenDB\'s write throughput on top of Voron\'s single-writer model.',
    githubPath: 'src/Raven.Server/Documents',
    codeRef: {
      file: 'src/Raven.Server/Documents/DocumentsStorage.cs',
      startLine: 51,
      expectSymbol: 'class DocumentsStorage',
    },
  },
  {
    id: 'attachments',
    label: 'Attachments',
    category: 'server',
    summary: 'Binary blobs attached to documents, stored as streams alongside the owning document, plus cross-node "remote attachment" fetch.',
    description:
      'AttachmentsStorage keeps attachments in their own Voron table, separately from document JSON, so large binaries do not bloat document reads. An attachment record references its content by hash (AttachmentHashSize = 44), so identical content stored on several documents is kept once. RemoteAttachmentsStorage/RemoteAttachmentsSender and RemoteAttachmentHandler implement fetching an attachment from another node on demand, instead of replicating every attachment eagerly everywhere.',
    githubPath: 'src/Raven.Server/Documents/AttachmentsStorage.cs',
    codeRef: {
      file: 'src/Raven.Server/Documents/AttachmentsStorage.cs',
      startLine: 52,
      expectSymbol: 'class AttachmentsStorage',
    },
    needsReview: true,
    docsUrl: 'https://docs.ravendb.net/7.2/document-extensions/attachments/what-are-attachments',
  },
  {
    id: 'indexing',
    label: 'Indexing (Auto, Static, Map-Reduce)',
    category: 'indexing',
    summary: 'The server-side indexing subsystem: index definitions, the workers that keep indexes up to date, and the choice of search engine per index.',
    description:
      'IndexStore owns every index in a database; each Index instance runs its own indexing thread, pulling changed documents through the Workers pipeline. This layer is engine-agnostic: Persistence/Corax and Persistence/Lucene are the two backends an index can be written through. Auto-indexes are created here on demand for queries that match no existing index; Static indexes come from user-supplied definitions.',
    githubPath: 'src/Raven.Server/Documents/Indexes',
    codeRef: {
      file: 'src/Raven.Server/Documents/Indexes/IndexStore.cs',
      startLine: 51,
      expectSymbol: 'class IndexStore',
    },
    needsReview: true,
    docsUrl: 'https://docs.ravendb.net/7.2/indexes/what-are-indexes',
  },
  {
    id: 'search-engines',
    label: 'Search Engines (Corax / Lucene)',
    category: 'indexing',
    summary: 'The two interchangeable search engines an index can be built on: the in-house Corax and the older Lucene path.',
    description:
      'Corax is RavenDB\'s in-house search engine: it analyzes field values, builds an inverted index persisted through Voron, and executes queries against it. Lucene remains fully supported, running on Voron through the LuceneVoronDirectory in src/Raven.Server/Indexing. Which one a new index uses is configurable server-wide, per database and per static index; when nothing is configured the default depends on the license - Community, Developer and unlicensed servers default to Corax, Professional and Enterprise default to Lucene.',
    githubPath: 'src/Corax',
    codeRef: {
      file: 'src/Corax/Querying/IndexSearcher.cs',
      startLine: 31,
      expectSymbol: 'class IndexSearcher',
    },
    docsUrl: 'https://docs.ravendb.net/7.2/indexes/search-engine/corax',
  },
  {
    id: 'ai',
    label: 'AI Integration & Vector Search',
    category: 'integration',
    summary: 'Embeddings generation, vector fields in indexes, and the chat/assistant integrations with external AI providers.',
    description:
      'EmbeddingsGenerator is a background task that turns document text into vectors through an external provider, chunking it first with TextChunker; ChatCompletionClient and AiAssistant cover the conversational integrations. The vectors themselves are indexed as vector fields (Documents/Indexes/VectorSearch) and queried like any other index field.',
    githubPath: 'src/Raven.Server/Documents/AI',
    codeRef: {
      file: 'src/Raven.Server/Documents/AI/Embeddings/EmbeddingsGenerator.cs',
      startLine: 37,
      expectSymbol: 'class EmbeddingsGenerator',
    },
    needsReview: true,
    docsUrl: 'https://docs.ravendb.net/7.2/ai-integration/overview',
  },
  {
    id: 'storage',
    label: 'Storage Engine (Voron)',
    category: 'storage',
    summary: 'The transactional, memory-mapped, page-based storage engine every other subsystem persists through.',
    description:
      'Voron is RavenDB\'s in-house embedded storage engine: fixed-size pages, a write-ahead journal that is the recovery source after a crash, B+Trees (variable-size keys) and fixed-size B+Trees, raw data sections and tables. It is fully ACID, allows a single write transaction at a time (many concurrent readers), and provides snapshot isolation via scratch files and page translation tables.',
    githubPath: 'src/Voron',
    codeRef: {
      file: 'src/Voron/StorageEnvironment.cs',
      startLine: 50,
      endLine: 140,
      expectSymbol: 'class StorageEnvironment',
    },
    docsUrl: 'https://docs.ravendb.net/7.2/server/storage/storage-engine',
  },
  {
    id: 'cluster',
    label: 'Clustering (Rachis)',
    category: 'cluster',
    summary: 'Raft-based consensus between cluster nodes: leader election, log replication, and cluster-wide state (compare-exchange, cluster transactions).',
    description:
      "Rachis is RavenDB's implementation of the Raft consensus algorithm. It elects a cluster leader, replicates a command log to followers, and drives ServerWide state such as the cluster's database topology and compare-exchange values that must agree across every node. Its own log is kept ACID by storing it in Voron. Note the split: Rachis handles cluster-wide consensus, while document data between databases/nodes moves through the separate Replication subsystem.",
    githubPath: 'src/Raven.Server/Rachis',
    codeRef: {
      file: 'src/Raven.Server/Rachis/Leader.cs',
      startLine: 34,
      expectSymbol: 'class Leader',
    },
    docsUrl: 'https://docs.ravendb.net/7.2/server/clustering/rachis/what-is-rachis',
  },
  {
    id: 'replication',
    label: 'Replication',
    category: 'cluster',
    summary: 'Streams document data between database group members and to external destinations, with change vectors and conflict resolution.',
    description:
      'ReplicationLoader manages the outgoing and incoming replication connections of a database. Every item carries a change vector, which is how a node decides whether an incoming item is newer, older, or in conflict; ConflictManager applies the configured resolution. This is a different mechanism from Rachis: replication moves document data and is eventually consistent, Rachis moves cluster commands and needs a majority.',
    githubPath: 'src/Raven.Server/Documents/Replication',
    codeRef: {
      file: 'src/Raven.Server/Documents/Replication/ReplicationLoader.cs',
      startLine: 46,
      expectSymbol: 'class ReplicationLoader',
    },
    needsReview: true,
    docsUrl: 'https://docs.ravendb.net/7.2/server/clustering/replication/replication',
  },
  {
    id: 'backup',
    label: 'Backup & Restore',
    category: 'server',
    summary: 'Periodic full and incremental backups, snapshots, and restore - to local disk or cloud destinations.',
    description:
      'BackupTask runs a database backup as an ongoing task, either as a logical export or as a Voron snapshot, optionally encrypted. Uploaders exist per destination (local, S3/Glacier, Azure, Google Cloud, FTP), and the Restore folder holds the counterpart that brings a database back from each of them.',
    githubPath: 'src/Raven.Server/Documents/PeriodicBackup',
    codeRef: {
      file: 'src/Raven.Server/Documents/PeriodicBackup/BackupTask.cs',
      startLine: 38,
      expectSymbol: 'class BackupTask',
    },
    needsReview: true,
    docsUrl: 'https://docs.ravendb.net/7.2/server/ongoing-tasks/backup-overview',
  },
  {
    id: 'integrations',
    label: 'ETL & Integrations',
    category: 'integration',
    summary: 'Moving data in and out of RavenDB: ETL to other systems, queue sinks, bulk import/export, SQL migration, PostgreSQL wire protocol.',
    description:
      'EtlLoader runs the outgoing ETL processes (Providers covers RavenDB, SQL, OLAP, Elasticsearch and queue destinations such as Kafka and RabbitMQ), while QueueSink is the inbound direction: consuming messages from a queue into documents. Alongside them sit Smuggler (bulk import/export, plus a sharding-aware companion), SqlMigration (pulling data in from an existing SQL database) and Integrations/PostgreSQL (letting Postgres-wire clients query RavenDB).',
    githubPath: 'src/Raven.Server/Documents/ETL',
    codeRef: {
      file: 'src/Raven.Server/Documents/ETL/EtlLoader.cs',
      startLine: 42,
      expectSymbol: 'class EtlLoader',
    },
    needsReview: true,
    docsUrl: 'https://docs.ravendb.net/7.2/server/ongoing-tasks/etl/basics',
  },
  {
    id: 'security',
    label: 'Security & HTTPS',
    category: 'security',
    summary: 'Transport security and certificate-based authentication for client/server and server/server communication.',
    description:
      'RavenDB authenticates connections with X.509 client certificates rather than username/password. HttpsConnectionMiddleware inspects the certificate as the TLS connection is established and ExternalCertificateValidator validates it, before routing sees the request; the resulting authorization level then gates every handler. Certificate management and two-factor authentication are exposed as endpoints under Web/Authentication, and the certificate definitions themselves are cluster-wide state.',
    githubPath: 'src/Raven.Server/Https',
    codeRef: {
      file: 'src/Raven.Server/Https/HttpsConnectionMiddleware.cs',
      startLine: 17,
      expectSymbol: 'class HttpsConnectionMiddleware',
    },
    needsReview: true,
    docsUrl: 'https://docs.ravendb.net/7.2/server/security/overview',
  },
  {
    id: 'studio',
    label: 'Studio (Management UI)',
    category: 'studio',
    summary: "RavenDB's built-in web management interface, bundled with the server.",
    description:
      'A single-page app served by the server itself, talking to the same HTTP API as any other client - used for administration, querying, and monitoring.',
    githubPath: 'src/Raven.Studio',
    docsUrl: 'https://docs.ravendb.net/7.2/studio/overview',
  },
  {
    id: 'infra',
    label: 'Low-level Infra (Sparrow)',
    category: 'infra',
    summary: 'Shared low-level building blocks used across the server and storage engine: buffers, memory management, threading primitives, blittable JSON.',
    description:
      'Sparrow (and Sparrow.Server) is not a feature area but the foundation the rest of the server is built on - unmanaged memory pooling, the blittable JSON representation in Sparrow/Json, hashing and threading primitives live here because Voron and Raven.Server both depend on them.',
    githubPath: 'src/Sparrow',
  },

  // ---------------------------------------------------------------------
  // Micro nodes: Document Database Core
  // ---------------------------------------------------------------------
  {
    id: 'core-tx-merger',
    label: 'TransactionMerger',
    category: 'server',
    summary: 'Batches many write operations into a single Voron write transaction - the throughput trick on top of Voron\'s single-writer model.',
    githubPath: 'src/Raven.Server/Documents/TransactionMerger',
    codeRef: {
      file: 'src/Raven.Server/Documents/TransactionMerger/AbstractTransactionOperationsMerger.cs',
      startLine: 36,
      expectSymbol: 'class AbstractTransactionOperationsMerger',
    },
    parentId: 'documents-core',
  },
  {
    id: 'core-revisions',
    label: 'Revisions',
    category: 'server',
    summary: 'Versioning: keeps previous versions of a document according to the revisions configuration.',
    githubPath: 'src/Raven.Server/Documents/Revisions',
    parentId: 'documents-core',
    docsUrl: 'https://docs.ravendb.net/7.2/document-extensions/revisions/overview',
  },
  {
    id: 'core-counters',
    label: 'Counters',
    category: 'server',
    summary: 'Distributed counters attached to a document, mergeable across nodes without conflicts.',
    githubPath: 'src/Raven.Server/Documents/CountersStorage.cs',
    codeRef: {
      file: 'src/Raven.Server/Documents/CountersStorage.cs',
      startLine: 32,
      expectSymbol: 'class CountersStorage',
    },
    parentId: 'documents-core',
    docsUrl: 'https://docs.ravendb.net/7.2/document-extensions/counters/overview',
  },
  {
    id: 'core-timeseries',
    label: 'Time Series',
    category: 'server',
    summary: 'Append-only numeric series attached to a document, stored in compressed segments.',
    githubPath: 'src/Raven.Server/Documents/TimeSeries',
    parentId: 'documents-core',
    docsUrl: 'https://docs.ravendb.net/7.2/document-extensions/timeseries/overview',
  },
  {
    id: 'core-subscriptions',
    label: 'Data Subscriptions',
    category: 'server',
    summary: 'Server-side, resumable push of matching documents to a worker over a long-lived TCP connection.',
    githubPath: 'src/Raven.Server/Documents/Subscriptions',
    codeRef: {
      file: 'src/Raven.Server/Documents/Subscriptions/SubscriptionStorage.cs',
      startLine: 22,
      expectSymbol: 'class SubscriptionStorage',
    },
    parentId: 'documents-core',
    docsUrl: 'https://docs.ravendb.net/7.2/client-api/data-subscriptions/what-are-data-subscriptions',
  },
  {
    id: 'core-queries',
    label: 'Queries (RQL)',
    category: 'server',
    summary: 'Parsing and execution of RQL queries, including projections, facets and includes.',
    githubPath: 'src/Raven.Server/Documents/Queries',
    parentId: 'documents-core',
    docsUrl: 'https://docs.ravendb.net/7.2/client-api/session/querying/what-is-rql',
  },
  {
    id: 'core-patch',
    label: 'Patch (JavaScript)',
    category: 'server',
    summary: 'Server-side document modification by running a JavaScript patch script inside the write transaction.',
    githubPath: 'src/Raven.Server/Documents/Patch',
    parentId: 'documents-core',
  },
  {
    id: 'core-handlers',
    label: 'Handlers',
    category: 'server',
    summary: 'The HTTP handlers (and their sharded/non-sharded Processors) for every document-level endpoint.',
    githubPath: 'src/Raven.Server/Documents/Handlers',
    parentId: 'documents-core',
  },

  // ---------------------------------------------------------------------
  // Micro nodes: Storage Engine (Voron)
  // ---------------------------------------------------------------------
  {
    id: 'storage-impl',
    label: 'Impl (pager, journal, trees)',
    category: 'storage',
    summary: 'The actual mechanics: paging, the write-ahead journal, scratch buffers and transactions.',
    githubPath: 'src/Voron/Impl',
    parentId: 'storage',
  },
  {
    id: 'storage-data',
    label: 'Data structures',
    category: 'storage',
    summary: 'On-disk data structures: B+Trees, fixed-size trees, tables, raw data sections, compact trees.',
    githubPath: 'src/Voron/Data',
    parentId: 'storage',
  },
  {
    id: 'storage-schema',
    label: 'Schema',
    category: 'storage',
    summary: 'Schema versioning and upgrade transactions for a Voron environment.',
    githubPath: 'src/Voron/Schema',
    parentId: 'storage',
  },
  {
    id: 'storage-page',
    label: 'Page / PageHeader',
    category: 'storage',
    summary: 'The fixed-size page is the fundamental unit Voron reads and writes.',
    githubPath: 'src/Voron/Page.cs',
    codeRef: { file: 'src/Voron/Page.cs', startLine: 8, expectSymbol: 'struct Page' },
    parentId: 'storage',
  },
  {
    id: 'storage-slice',
    label: 'Slice',
    category: 'storage',
    summary: 'The key/value byte-range abstraction used throughout Voron\'s trees.',
    githubPath: 'src/Voron/Slice.cs',
    codeRef: { file: 'src/Voron/Slice.cs', startLine: 14, expectSymbol: 'struct Slice' },
    parentId: 'storage',
  },

  // ---------------------------------------------------------------------
  // Micro nodes: Attachments
  // ---------------------------------------------------------------------
  {
    id: 'attachments-storage',
    label: 'AttachmentsStorage',
    category: 'server',
    summary: 'Core read/write logic for attachment streams, backed by a Voron table and content hashes.',
    githubPath: 'src/Raven.Server/Documents/AttachmentsStorage.cs',
    codeRef: {
      file: 'src/Raven.Server/Documents/AttachmentsStorage.cs',
      startLine: 52,
      expectSymbol: 'class AttachmentsStorage',
    },
    parentId: 'attachments',
  },
  {
    id: 'attachments-remote-storage',
    label: 'RemoteAttachmentsStorage / Sender',
    category: 'server',
    summary: 'Fetches/sends an attachment from another cluster node on demand, instead of eager replication of binary content.',
    githubPath: 'src/Raven.Server/Documents/RemoteAttachmentsStorage.cs',
    parentId: 'attachments',
    needsReview: true,
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
    summary: 'The endpoint used for remote attachment configuration and cross-node fetch.',
    githubPath: 'src/Raven.Server/Documents/Handlers/RemoteAttachmentHandler.cs',
    parentId: 'attachments',
    needsReview: true,
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
  // Micro nodes: Sharding
  // ---------------------------------------------------------------------
  {
    id: 'sharding-context',
    label: 'ShardedDatabaseContext',
    category: 'server',
    summary: 'The per-sharded-database orchestrator: owns the shard executors, topology and sharded subsystems.',
    githubPath: 'src/Raven.Server/Documents/Sharding/ShardedDatabaseContext.cs',
    codeRef: {
      file: 'src/Raven.Server/Documents/Sharding/ShardedDatabaseContext.cs',
      startLine: 33,
      expectSymbol: 'class ShardedDatabaseContext',
    },
    parentId: 'sharding',
  },
  {
    id: 'sharding-locator',
    label: 'ShardLocator',
    category: 'server',
    summary: 'Maps a document id to its bucket and the bucket to the shard that owns it.',
    githubPath: 'src/Raven.Server/Documents/Sharding/ShardLocator.cs',
    parentId: 'sharding',
    needsReview: true,
  },
  {
    id: 'sharding-executors',
    label: 'Executors',
    category: 'server',
    summary: 'Fan-out execution of an operation across the relevant shards, with per-shard commands.',
    githubPath: 'src/Raven.Server/Documents/Sharding/Executors',
    parentId: 'sharding',
    needsReview: true,
  },
  {
    id: 'sharding-queries',
    label: 'Queries',
    category: 'server',
    summary: 'Query orchestration across shards: sending sub-queries out and merging/sorting the results.',
    githubPath: 'src/Raven.Server/Documents/Sharding/Queries',
    parentId: 'sharding',
    needsReview: true,
  },
  {
    id: 'sharding-handlers',
    label: 'Handlers',
    category: 'server',
    summary: 'The sharded counterparts of the database HTTP handlers, sitting in front of the shards.',
    githubPath: 'src/Raven.Server/Documents/Sharding/Handlers',
    parentId: 'sharding',
  },

  // ---------------------------------------------------------------------
  // Micro nodes: Indexing
  // ---------------------------------------------------------------------
  {
    id: 'indexing-index',
    label: 'Index (base class)',
    category: 'indexing',
    summary: 'One running index: its own thread, batching, priority/state, and the indexing loop.',
    githubPath: 'src/Raven.Server/Documents/Indexes/Index.cs',
    codeRef: {
      file: 'src/Raven.Server/Documents/Indexes/Index.cs',
      startLine: 109,
      expectSymbol: 'abstract class Index',
    },
    parentId: 'indexing',
  },
  {
    id: 'indexing-auto',
    label: 'Auto indexes',
    category: 'indexing',
    summary: 'Indexes RavenDB creates by itself for queries that match no existing index.',
    githubPath: 'src/Raven.Server/Documents/Indexes/Auto',
    parentId: 'indexing',
    docsUrl: 'https://docs.ravendb.net/7.2/indexes/creating-and-deploying',
  },
  {
    id: 'indexing-static',
    label: 'Static indexes',
    category: 'indexing',
    summary: 'User-defined index definitions, compiled from their map/reduce functions.',
    githubPath: 'src/Raven.Server/Documents/Indexes/Static',
    parentId: 'indexing',
  },
  {
    id: 'indexing-mapreduce',
    label: 'Map-Reduce',
    category: 'indexing',
    summary: 'Aggregation indexes: the reduce tree and how partial aggregations are persisted and updated.',
    githubPath: 'src/Raven.Server/Documents/Indexes/MapReduce',
    parentId: 'indexing',
    needsReview: true,
  },
  {
    id: 'indexing-workers',
    label: 'Workers',
    category: 'indexing',
    summary: 'The staged workers of one indexing batch: map documents, handle references, clean up tombstones.',
    githubPath: 'src/Raven.Server/Documents/Indexes/Workers',
    parentId: 'indexing',
    needsReview: true,
  },
  {
    id: 'indexing-persistence',
    label: 'Persistence (engine backends)',
    category: 'indexing',
    summary: 'The seam between the indexing subsystem and a search engine - one implementation for Corax, one for Lucene.',
    githubPath: 'src/Raven.Server/Documents/Indexes/Persistence',
    parentId: 'indexing',
  },
  {
    id: 'indexing-vector',
    label: 'VectorSearch',
    category: 'indexing',
    summary: 'Vector fields: turning text/embeddings into indexable vectors for similarity search.',
    githubPath: 'src/Raven.Server/Documents/Indexes/VectorSearch',
    codeRef: {
      file: 'src/Raven.Server/Documents/Indexes/VectorSearch/GenerateEmbeddings.cs',
      startLine: 27,
      expectSymbol: 'class GenerateEmbeddings',
    },
    parentId: 'indexing',
    needsReview: true,
  },

  // ---------------------------------------------------------------------
  // Micro nodes: Search engines
  // ---------------------------------------------------------------------
  {
    id: 'corax-analyzers',
    label: 'Corax: Analyzers',
    category: 'indexing',
    summary: 'Tokenization and text analysis applied to field values before they are indexed.',
    githubPath: 'src/Corax/Analyzers',
    parentId: 'search-engines',
  },
  {
    id: 'corax-indexing',
    label: 'Corax: Indexing (IndexWriter)',
    category: 'indexing',
    summary: 'Builds and maintains the inverted index as entries are added, updated and deleted.',
    githubPath: 'src/Corax/Indexing',
    codeRef: {
      file: 'src/Corax/Indexing/IndexWriter.cs',
      startLine: 38,
      expectSymbol: 'class IndexWriter',
    },
    parentId: 'search-engines',
  },
  {
    id: 'corax-querying',
    label: 'Corax: Querying (IndexSearcher)',
    category: 'indexing',
    summary: 'Executes queries against the inverted index and returns matching entries.',
    githubPath: 'src/Corax/Querying',
    codeRef: {
      file: 'src/Corax/Querying/IndexSearcher.cs',
      startLine: 31,
      expectSymbol: 'class IndexSearcher',
    },
    parentId: 'search-engines',
  },
  {
    id: 'corax-pipeline',
    label: 'Corax: Pipeline',
    category: 'indexing',
    summary: 'The staged token processing pipeline (tokenizers and transformers) data passes through.',
    githubPath: 'src/Corax/Pipeline',
    parentId: 'search-engines',
  },
  {
    id: 'corax-mappings',
    label: 'Corax: Mappings',
    category: 'indexing',
    summary: 'Field-to-index mapping and schema definitions for what gets indexed and how.',
    githubPath: 'src/Corax/Mappings',
    parentId: 'search-engines',
  },
  {
    id: 'lucene-persistence',
    label: 'Lucene: index persistence',
    category: 'indexing',
    summary: 'The Lucene backend of an index: writers, readers, analyzer adapters, faceted and suggestion reads.',
    githubPath: 'src/Raven.Server/Documents/Indexes/Persistence/Lucene',
    codeRef: {
      file: 'src/Raven.Server/Documents/Indexes/Persistence/Lucene/LuceneIndexPersistence.cs',
      startLine: 38,
      expectSymbol: 'class LuceneIndexPersistence',
    },
    parentId: 'search-engines',
  },
  {
    id: 'lucene-voron-directory',
    label: 'Lucene: LuceneVoronDirectory',
    category: 'indexing',
    summary: 'Lucene\'s Directory implemented on top of Voron, so Lucene indexes are stored transactionally too.',
    githubPath: 'src/Raven.Server/Indexing',
    parentId: 'search-engines',
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
    codeRef: {
      file: 'src/Raven.Server/Rachis/Leader.cs',
      startLine: 34,
      expectSymbol: 'class Leader',
    },
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
    summary: 'Leader election: a node campaigns as Candidate, Elector answers votes on the other side.',
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
  // Micro nodes: Replication
  // ---------------------------------------------------------------------
  {
    id: 'replication-loader',
    label: 'ReplicationLoader',
    category: 'cluster',
    summary: 'Owns a database\'s replication connections and reacts to topology and configuration changes.',
    githubPath: 'src/Raven.Server/Documents/Replication/ReplicationLoader.cs',
    codeRef: {
      file: 'src/Raven.Server/Documents/Replication/ReplicationLoader.cs',
      startLine: 46,
      expectSymbol: 'class ReplicationLoader',
    },
    parentId: 'replication',
  },
  {
    id: 'replication-outgoing',
    label: 'Outgoing',
    category: 'cluster',
    summary: 'The sending side: streams documents, tombstones, attachments, counters and time series onward.',
    githubPath: 'src/Raven.Server/Documents/Replication/Outgoing',
    parentId: 'replication',
    needsReview: true,
  },
  {
    id: 'replication-incoming',
    label: 'Incoming',
    category: 'cluster',
    summary: 'The receiving side: applies an incoming batch inside a write transaction and reports back.',
    githubPath: 'src/Raven.Server/Documents/Replication/Incoming',
    parentId: 'replication',
    needsReview: true,
  },
  {
    id: 'replication-changevector',
    label: 'Change vectors',
    category: 'cluster',
    summary: 'The per-node etag vector that decides newer / older / conflict for every replicated item.',
    githubPath: 'src/Raven.Server/Documents/Replication/ChangeVectorParser.cs',
    parentId: 'replication',
    docsUrl: 'https://docs.ravendb.net/7.2/server/clustering/replication/change-vector',
  },
  {
    id: 'replication-conflicts',
    label: 'ConflictManager',
    category: 'cluster',
    summary: 'Applies the configured conflict resolution when two nodes changed the same document concurrently.',
    githubPath: 'src/Raven.Server/Documents/Replication/ConflictManager.cs',
    parentId: 'replication',
    needsReview: true,
  },

  // ---------------------------------------------------------------------
  // Micro nodes: Backup & Restore
  // ---------------------------------------------------------------------
  {
    id: 'backup-task',
    label: 'BackupTask',
    category: 'server',
    summary: 'Runs one backup: full or incremental, logical export or Voron snapshot, optionally encrypted.',
    githubPath: 'src/Raven.Server/Documents/PeriodicBackup/BackupTask.cs',
    codeRef: {
      file: 'src/Raven.Server/Documents/PeriodicBackup/BackupTask.cs',
      startLine: 38,
      expectSymbol: 'class BackupTask',
    },
    parentId: 'backup',
  },
  {
    id: 'backup-status',
    label: 'BackupStatusStorage',
    category: 'server',
    summary: 'Tracks what was backed up and when, so incremental backups know where to resume.',
    githubPath: 'src/Raven.Server/Documents/PeriodicBackup/BackupStatusStorage.cs',
    parentId: 'backup',
    needsReview: true,
  },
  {
    id: 'backup-destinations',
    label: 'Destinations (S3, Azure, GCS, FTP)',
    category: 'server',
    summary: 'The uploaders for each supported backup destination, plus direct upload/download paths.',
    githubPath: 'src/Raven.Server/Documents/PeriodicBackup/BackupUploader.cs',
    parentId: 'backup',
  },
  {
    id: 'backup-restore',
    label: 'Restore',
    category: 'server',
    summary: 'Bringing a database back from a backup - per source (local, S3, Azure, GCS) and per backup kind.',
    githubPath: 'src/Raven.Server/Documents/PeriodicBackup/Restore',
    parentId: 'backup',
  },

  // ---------------------------------------------------------------------
  // Micro nodes: AI Integration
  // ---------------------------------------------------------------------
  {
    id: 'ai-embeddings',
    label: 'Embeddings generation',
    category: 'integration',
    summary: 'The background task that sends text to an embeddings provider and stores the resulting vectors.',
    githubPath: 'src/Raven.Server/Documents/AI/Embeddings',
    codeRef: {
      file: 'src/Raven.Server/Documents/AI/Embeddings/EmbeddingsGenerator.cs',
      startLine: 37,
      expectSymbol: 'class EmbeddingsGenerator',
    },
    parentId: 'ai',
    needsReview: true,
  },
  {
    id: 'ai-chunker',
    label: 'TextChunker',
    category: 'integration',
    summary: 'Splits document text into chunks small enough to embed, before generation.',
    githubPath: 'src/Raven.Server/Documents/AI/TextChunker.cs',
    parentId: 'ai',
    needsReview: true,
  },
  {
    id: 'ai-chat',
    label: 'ChatCompletionClient',
    category: 'integration',
    summary: 'The client for chat/completion calls to an external AI provider, including SSE streaming.',
    githubPath: 'src/Raven.Server/Documents/AI/ChatCompletionClient.cs',
    parentId: 'ai',
    needsReview: true,
  },
  {
    id: 'ai-assistant',
    label: 'AiAssistant',
    category: 'integration',
    summary: 'The assistant endpoints layered on top of the chat client.',
    githubPath: 'src/Raven.Server/Documents/AI/AiAssistant',
    parentId: 'ai',
    needsReview: true,
  },
  {
    id: 'ai-settings',
    label: 'Settings / connection strings',
    category: 'integration',
    summary: 'Provider configuration: which AI service, which model, which credentials.',
    githubPath: 'src/Raven.Server/Documents/AI/Settings',
    parentId: 'ai',
    needsReview: true,
  },

  // ---------------------------------------------------------------------
  // Micro nodes: ETL & Integrations
  // ---------------------------------------------------------------------
  {
    id: 'etl-loader',
    label: 'EtlLoader',
    category: 'integration',
    summary: 'Starts and supervises the ETL processes configured on a database.',
    githubPath: 'src/Raven.Server/Documents/ETL/EtlLoader.cs',
    codeRef: {
      file: 'src/Raven.Server/Documents/ETL/EtlLoader.cs',
      startLine: 42,
      expectSymbol: 'class EtlLoader',
    },
    parentId: 'integrations',
  },
  {
    id: 'etl-providers',
    label: 'ETL providers',
    category: 'integration',
    summary: 'One implementation per destination: RavenDB, SQL, OLAP, Elasticsearch, Kafka/RabbitMQ queues.',
    githubPath: 'src/Raven.Server/Documents/ETL/Providers',
    parentId: 'integrations',
  },
  {
    id: 'queue-sink',
    label: 'Queue Sink (inbound)',
    category: 'integration',
    summary: 'The inbound direction: consuming Kafka / RabbitMQ / Azure Service Bus messages into documents.',
    githubPath: 'src/Raven.Server/Documents/QueueSink',
    codeRef: {
      file: 'src/Raven.Server/Documents/QueueSink/QueueSinkLoader.cs',
      startLine: 21,
      expectSymbol: 'class QueueSinkLoader',
    },
    parentId: 'integrations',
    needsReview: true,
  },
  {
    id: 'smuggler',
    label: 'Smuggler (import / export)',
    category: 'integration',
    summary: 'Bulk import and export of a database, with a sharding-aware companion under Documents/Smuggler.',
    githubPath: 'src/Raven.Server/Smuggler',
    parentId: 'integrations',
  },
  {
    id: 'sql-migration',
    label: 'SqlMigration',
    category: 'integration',
    summary: 'Pulls data in from an existing relational database and turns rows into documents.',
    githubPath: 'src/Raven.Server/SqlMigration',
    parentId: 'integrations',
  },
  {
    id: 'postgres-protocol',
    label: 'PostgreSQL protocol',
    category: 'integration',
    summary: 'Speaks the Postgres wire protocol so Postgres clients and BI tools can query RavenDB.',
    githubPath: 'src/Raven.Server/Integrations/PostgreSQL',
    parentId: 'integrations',
  },
  {
    id: 'cdc-sink',
    label: 'CdcSink',
    category: 'integration',
    summary: 'Ingests change-data-capture streams from an external system.',
    githubPath: 'src/Raven.Server/Documents/CdcSink',
    parentId: 'integrations',
    needsReview: true,
  },
]

export const edges: MapEdge[] = [
  { id: 'client-http', source: 'client', target: 'http', label: 'HTTP API' },
  { id: 'studio-http', source: 'studio', target: 'http', label: 'HTTP API' },
  { id: 'security-http', source: 'security', target: 'http', label: 'authenticates' },
  { id: 'http-sharding', source: 'http', target: 'sharding', label: 'sharded databases' },
  { id: 'sharding-documents', source: 'sharding', target: 'documents-core', label: 'per-shard requests' },
  { id: 'http-documents', source: 'http', target: 'documents-core', label: 'routes to' },
  { id: 'http-cluster', source: 'http', target: 'cluster', label: 'server-to-server' },
  { id: 'documents-attachments', source: 'documents-core', target: 'attachments' },
  { id: 'documents-indexing', source: 'documents-core', target: 'indexing', label: 'feeds' },
  { id: 'indexing-engines', source: 'indexing', target: 'search-engines', label: 'Corax or Lucene' },
  { id: 'documents-ai', source: 'documents-core', target: 'ai', label: 'embeddings tasks' },
  { id: 'ai-indexing', source: 'ai', target: 'indexing', label: 'vector fields' },
  { id: 'documents-storage', source: 'documents-core', target: 'storage', label: 'persists via' },
  { id: 'engines-storage', source: 'search-engines', target: 'storage', label: 'persists via' },
  { id: 'attachments-storage-edge', source: 'attachments', target: 'storage', label: 'persists via' },
  { id: 'cluster-storage', source: 'cluster', target: 'storage', label: 'ACID Raft log' },
  { id: 'documents-integrations', source: 'documents-core', target: 'integrations', label: 'change feed' },
  { id: 'documents-replication', source: 'documents-core', target: 'replication', label: 'change feed' },
  { id: 'documents-backup', source: 'documents-core', target: 'backup', label: 'ongoing task' },
  { id: 'documents-cluster', source: 'documents-core', target: 'cluster', label: 'cluster-wide ops' },
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
