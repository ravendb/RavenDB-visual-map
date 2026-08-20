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
      'Raven.Client is what .NET application code links against. It builds HTTP requests for the server API and tracks entities in a session (unit of work). RavenDB also ships official clients for other languages - including Java, Node.js, Python, PHP, Ruby and Go - all speaking the same wire protocol this one implements; none of that lives in this repository, so the exact list needs a subsystem expert to confirm rather than this repo\'s source.',
    githubPath: 'src/Raven.Client',
    needsReview: true,
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
      'AttachmentsStorage keeps attachments in their own Voron table, separately from document JSON, so large binaries do not bloat document reads. An attachment record references its content by hash (AttachmentHashSize = 44), so identical content stored on several documents is kept once. RemoteAttachmentsStorage/RemoteAttachmentsSender and RemoteAttachmentHandler implement cold-storage tiering: an attachment\'s stream can be moved out to external storage (e.g. S3/Azure, typically as part of a backup) and deleted locally, then fetched back on demand by its external identifier instead of staying resident forever.',
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
      'EmbeddingsGenerator is a background task that turns document text into vectors through an external provider, chunking it first with TextChunker. ChatCompletionClient is the client for the user\'s own configured AI provider; AiAssistant is a separate, license-gated proxy to RavenDB\'s own cloud-hosted assistant at api.ravendb.net and does not use ChatCompletionClient or the user\'s provider config. The vectors themselves are indexed as vector fields (Documents/Indexes/VectorSearch) and queried like any other index field.',
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
      'EtlLoader runs the outgoing ETL processes (Providers covers RavenDB, SQL, OLAP, Elasticsearch, AI embeddings generation, and queue destinations such as Kafka and RabbitMQ), while QueueSink is the inbound direction: consuming messages from a queue into documents. Alongside them sit Smuggler (bulk import/export, plus sharding-aware companions), SqlMigration (pulling data in from an existing SQL database) and Integrations/PostgreSQL (letting Postgres-wire clients query RavenDB).',
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
    summary:
      'Batches many write operations into a single Voron write transaction - the throughput trick on top of Voron\'s single-writer model. Commands sit on a lock-free queue and run on one dedicated long-running thread, so callers merge into that shared transaction without ever blocking each other on it directly.',
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
    summary:
      'Versioning: keeps previous versions of a document according to the revisions configuration. RevisionsStorage keeps a plain and a compressed Voron table side by side, and rejects any single revision larger than SizeLimitInBytes (32MB by default, 2MB on 32-bit builds, not currently configurable).',
    githubPath: 'src/Raven.Server/Documents/Revisions',
    codeRef: {
      file: 'src/Raven.Server/Documents/Revisions/RevisionsStorage.cs',
      startLine: 45,
      expectSymbol: 'class RevisionsStorage',
    },
    parentId: 'documents-core',
    docsUrl: 'https://docs.ravendb.net/7.2/document-extensions/revisions/overview',
  },
  {
    id: 'core-counters',
    label: 'Counters',
    category: 'server',
    summary:
      'Distributed counters attached to a document, mergeable across nodes without conflicts. A counters document caps out at 2048 bytes (MaxCounterDocumentSize), and each counter\'s value is stored per originating node so merging across nodes only ever needs a sum, never a lock.',
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
    summary:
      'Append-only numeric series attached to a document, stored in compressed segments. Each segment is capped at 2048 bytes (MaxSegmentSize) before a new one starts; TimeSeriesRollups only marks a rollup as needing recomputation, while the separate TimeSeriesPolicyRunner background worker is what actually downsamples and purges data per the configured retention policy.',
    githubPath: 'src/Raven.Server/Documents/TimeSeries',
    codeRef: {
      file: 'src/Raven.Server/Documents/TimeSeries/TimeSeriesStorage.cs',
      startLine: 41,
      expectSymbol: 'class TimeSeriesStorage',
    },
    parentId: 'documents-core',
    docsUrl: 'https://docs.ravendb.net/7.2/document-extensions/timeseries/overview',
  },
  {
    id: 'core-subscriptions',
    label: 'Data Subscriptions',
    category: 'server',
    summary:
      'Server-side, resumable push of matching documents to a worker over a long-lived TCP connection. MaxNumberOfConcurrentConnections is a single database-wide cap (default 1000) shared across every subscription, not a per-subscription limit; SubscriptionStorage raises events as connections open, end, or a batch completes.',
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
    summary:
      'Parsing and execution of RQL queries, including projections, facets and includes. AbstractQueryRunner tracks every currently-executing query in a concurrent set, which is what lets the server list or cancel a long-running query while it\'s still running.',
    githubPath: 'src/Raven.Server/Documents/Queries',
    codeRef: {
      file: 'src/Raven.Server/Documents/Queries/AbstractQueryRunner.cs',
      startLine: 9,
      expectSymbol: 'class AbstractQueryRunner',
    },
    parentId: 'documents-core',
    docsUrl: 'https://docs.ravendb.net/7.2/client-api/session/querying/what-is-rql',
  },
  {
    id: 'core-patch',
    label: 'Patch (JavaScript)',
    category: 'server',
    summary:
      'Server-side document modification by running a JavaScript patch script inside the write transaction. ScriptRunner pools a Jint JavaScript engine per script behind a Holder that can fall back to a weak reference under memory pressure, so a patch doesn\'t pay the engine\'s start-up cost on every run.',
    githubPath: 'src/Raven.Server/Documents/Patch',
    codeRef: {
      file: 'src/Raven.Server/Documents/Patch/ScriptRunner.cs',
      startLine: 51,
      expectSymbol: 'class ScriptRunner',
    },
    parentId: 'documents-core',
  },
  {
    id: 'core-handlers',
    label: 'Handlers',
    category: 'server',
    summary:
      'The HTTP handlers (and their sharded/non-sharded Processors) for every document-level endpoint. Each action is a thin [RavenAction]-attributed method that immediately delegates to a dedicated Processor class, e.g. DocumentHandlerProcessorForGet, which does the actual work.',
    githubPath: 'src/Raven.Server/Documents/Handlers',
    codeRef: {
      file: 'src/Raven.Server/Documents/Handlers/DocumentHandler.cs',
      startLine: 16,
      expectSymbol: 'class DocumentHandler',
    },
    parentId: 'documents-core',
  },

  // ---------------------------------------------------------------------
  // Micro nodes: Storage Engine (Voron)
  // ---------------------------------------------------------------------
  {
    id: 'storage-impl',
    label: 'Impl (pager, journal, trees)',
    category: 'storage',
    summary:
      'The actual mechanics: paging, the write-ahead journal, scratch buffers and transactions. LowLevelTransaction is the class every read or write transaction ultimately runs on: it owns the data pager, tracks how many pages it modified, and hands off to the WriteAheadJournal on commit.',
    githubPath: 'src/Voron/Impl',
    codeRef: {
      file: 'src/Voron/Impl/LowLevelTransaction.cs',
      startLine: 37,
      expectSymbol: 'class LowLevelTransaction',
    },
    parentId: 'storage',
  },
  {
    id: 'storage-data',
    label: 'Data structures',
    category: 'storage',
    summary:
      'On-disk data structures: B+Trees, fixed-size trees, tables, raw data sections, compact trees. Tree is the B+Tree implementation itself; it keeps a small pool of recently-found pages so a repeated lookup along the same path doesn\'t have to re-walk from the root every time.',
    githubPath: 'src/Voron/Data',
    codeRef: {
      file: 'src/Voron/Data/BTrees/Tree.cs',
      startLine: 24,
      expectSymbol: 'class Tree',
    },
    parentId: 'storage',
  },
  {
    id: 'storage-schema',
    label: 'Schema',
    category: 'storage',
    summary:
      'Schema versioning and upgrade transactions for a Voron environment. VoronSchemaUpdater walks the version history one step at a time until the stored file reaches the current schema version; the per-version upgrade classes it loads by reflection live in Raven.Server (Raven.Server.Storage.Schema.Updates.<scope>.<toVersion>.From<fromVersion>), not inside Voron itself.',
    githubPath: 'src/Voron/Schema',
    codeRef: {
      file: 'src/Voron/Schema/VoronSchemaUpdater.cs',
      startLine: 7,
      expectSymbol: 'class VoronSchemaUpdater',
    },
    parentId: 'storage',
  },
  {
    id: 'storage-page',
    label: 'Page / PageHeader',
    category: 'storage',
    summary:
      'The fixed-size page is the fundamental unit Voron reads and writes. Page wraps nothing more than a raw pointer into a memory-mapped file, with helpers that view it as a Span<byte> and account for whether it\'s an overflow page bigger than the standard page size.',
    githubPath: 'src/Voron/Page.cs',
    codeRef: { file: 'src/Voron/Page.cs', startLine: 8, expectSymbol: 'struct Page' },
    parentId: 'storage',
  },
  {
    id: 'storage-slice',
    label: 'Slice',
    category: 'storage',
    summary:
      'The key/value byte-range abstraction used throughout Voron\'s trees. Slice is a thin wrapper around a ByteString and converts implicitly to a ReadOnlySpan<byte>, so most Voron code can compare and hash keys without ever allocating a managed byte array.',
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
    summary:
      'Core read/write logic for attachment streams, backed by a Voron table and content hashes. Every attachment record is keyed by a 44-byte content hash (AttachmentHashSize), which is exactly what lets several documents share one stored copy of identical content.',
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
    summary:
      'Fetches an attachment stream back from external cold storage (e.g. S3/Azure, after it was tiered out during a backup) on demand, instead of keeping every attachment resident locally forever. It derives from the same AbstractBackgroundWorkStorage used for document expiration, and walks each document\'s metadata to find attachments still flagged as remote rather than fetched.',
    githubPath: 'src/Raven.Server/Documents/RemoteAttachmentsStorage.cs',
    codeRef: {
      file: 'src/Raven.Server/Documents/RemoteAttachmentsStorage.cs',
      startLine: 38,
      expectSymbol: 'class RemoteAttachmentsStorage',
    },
    parentId: 'attachments',
    needsReview: true,
  },
  {
    id: 'attachments-handler',
    label: 'AttachmentHandler',
    category: 'server',
    summary:
      'The HTTP handler exposing attachment upload/download/delete endpoints. Its Head/Get/GetPost/bulk actions all just construct and run an AttachmentHandlerProcessorFor... class, the same delegation pattern DocumentHandler uses.',
    githubPath: 'src/Raven.Server/Documents/Handlers/AttachmentHandler.cs',
    codeRef: {
      file: 'src/Raven.Server/Documents/Handlers/AttachmentHandler.cs',
      startLine: 14,
      expectSymbol: 'class AttachmentHandler',
    },
    parentId: 'attachments',
  },
  {
    id: 'attachments-remote-handler',
    label: 'RemoteAttachmentHandler',
    category: 'server',
    summary:
      'The endpoint used for remote attachment configuration and cross-node fetch. It exposes only two admin actions - reading and writing the remote-attachments configuration - each delegating to its own Processor class.',
    githubPath: 'src/Raven.Server/Documents/Handlers/RemoteAttachmentHandler.cs',
    codeRef: {
      file: 'src/Raven.Server/Documents/Handlers/RemoteAttachmentHandler.cs',
      startLine: 7,
      expectSymbol: 'class RemoteAttachmentHandler',
    },
    parentId: 'attachments',
    needsReview: true,
  },
  {
    id: 'attachments-model',
    label: 'Attachment / AttachmentOrTombstone',
    category: 'server',
    summary:
      'The in-memory model for an attachment record and its deletion marker (tombstone). The model is a flat set of fields (StorageId, Key, Etag, ChangeVector, content hash, size, stream) - RevisionVersion is only populated on the copy kept for a revision, not on the live document\'s.',
    githubPath: 'src/Raven.Server/Documents/Attachment.cs',
    codeRef: {
      file: 'src/Raven.Server/Documents/Attachment.cs',
      startLine: 8,
      expectSymbol: 'class Attachment',
    },
    parentId: 'attachments',
  },

  // ---------------------------------------------------------------------
  // Micro nodes: Sharding
  // ---------------------------------------------------------------------
  {
    id: 'sharding-context',
    label: 'ShardedDatabaseContext',
    category: 'server',
    summary:
      'The per-sharded-database orchestrator: owns the shard executors, topology and sharded subsystems. It owns the ShardExecutor and AllOrchestratorNodesExecutor instances every other sharded component fans requests out through.',
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
    summary:
      'Maps a document id to its bucket and the bucket to the shard that owns it. ShardLocator is a static class with overloads for a single id, a batch of ids, or Slices - all of them ultimately resolve the bucket through the database context.',
    githubPath: 'src/Raven.Server/Documents/Sharding/ShardLocator.cs',
    codeRef: {
      file: 'src/Raven.Server/Documents/Sharding/ShardLocator.cs',
      startLine: 8,
      expectSymbol: 'class ShardLocator',
    },
    parentId: 'sharding',
    needsReview: true,
  },
  {
    id: 'sharding-executors',
    label: 'Executors',
    category: 'server',
    summary:
      'Fan-out execution of an operation across the relevant shards, with per-shard commands. ShardExecutor keeps one lazily-created RequestExecutor per shard, indexed by shard number, and reuses it for every subsequent command sent to that shard.',
    githubPath: 'src/Raven.Server/Documents/Sharding/Executors',
    codeRef: {
      file: 'src/Raven.Server/Documents/Sharding/Executors/ShardExecutor.cs',
      startLine: 18,
      expectSymbol: 'class ShardExecutor',
    },
    parentId: 'sharding',
    needsReview: true,
  },
  {
    id: 'sharding-queries',
    label: 'Queries',
    category: 'server',
    summary:
      'Query orchestration across shards: sending sub-queries out and merging/sorting the results. ShardedQueryProcessor fans the query out as parallel per-shard commands through ShardExecutor, then merges the results - falling back to a not-modified response when nothing changed.',
    githubPath: 'src/Raven.Server/Documents/Sharding/Queries',
    codeRef: {
      file: 'src/Raven.Server/Documents/Sharding/Queries/ShardedQueryProcessor.cs',
      startLine: 28,
      expectSymbol: 'class ShardedQueryProcessor',
    },
    parentId: 'sharding',
    needsReview: true,
  },
  {
    id: 'sharding-handlers',
    label: 'Handlers',
    category: 'server',
    summary:
      'The sharded counterparts of the database HTTP handlers, sitting in front of the shards. ShardedDatabaseRequestHandler is the abstract base every Sharded*Handler derives from; it forwards a fixed set of headers, like the last-known cluster transaction index, onto each per-shard request it issues.',
    githubPath: 'src/Raven.Server/Documents/Sharding/Handlers',
    codeRef: {
      file: 'src/Raven.Server/Documents/Sharding/Handlers/ShardedDatabaseRequestHandler.cs',
      startLine: 24,
      expectSymbol: 'class ShardedDatabaseRequestHandler',
    },
    parentId: 'sharding',
  },

  // ---------------------------------------------------------------------
  // Micro nodes: Indexing
  // ---------------------------------------------------------------------
  {
    id: 'indexing-index',
    label: 'Index (base class)',
    category: 'indexing',
    summary:
      'One running index: its own thread, batching, priority/state, and the indexing loop. It tracks its own error counters - write, unexpected, analyzer, disk-full - against fixed limits, and disables itself once one of those limits is crossed.',
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
    summary:
      'Indexes RavenDB creates by itself for queries that match no existing index. AutoMapIndex is created either fresh (for a query with no matching index) or reopened from an existing Voron environment on startup, and both paths route through the same private constructor.',
    githubPath: 'src/Raven.Server/Documents/Indexes/Auto',
    codeRef: {
      file: 'src/Raven.Server/Documents/Indexes/Auto/AutoMapIndex.cs',
      startLine: 21,
      expectSymbol: 'class AutoMapIndex',
    },
    parentId: 'indexing',
    docsUrl: 'https://docs.ravendb.net/7.2/indexes/creating-and-deploying',
  },
  {
    id: 'indexing-static',
    label: 'Static indexes',
    category: 'indexing',
    summary:
      'User-defined index definitions, compiled from their map/reduce functions. IndexCompiler turns those functions into a generated .NET assembly at runtime, under a generated Static.Generated namespace; the in-memory assembly doesn\'t survive a restart, but the IndexCompilationCache still avoids recompiling the same definition twice within one running process.',
    githubPath: 'src/Raven.Server/Documents/Indexes/Static',
    codeRef: {
      file: 'src/Raven.Server/Documents/Indexes/Static/IndexCompiler.cs',
      startLine: 39,
      expectSymbol: 'class IndexCompiler',
    },
    parentId: 'indexing',
  },
  {
    id: 'indexing-mapreduce',
    label: 'Map-Reduce',
    category: 'indexing',
    summary:
      'Aggregation indexes: the reduce tree and how partial aggregations are persisted and updated. MapReduceIndexBase keeps three named Voron trees - map phase, reduce phase, and result-store types - and flags the map tree to allow fixed-size sub-trees the first time it\'s used.',
    githubPath: 'src/Raven.Server/Documents/Indexes/MapReduce',
    codeRef: {
      file: 'src/Raven.Server/Documents/Indexes/MapReduce/MapReduceIndexBase.cs',
      startLine: 24,
      expectSymbol: 'class MapReduceIndexBase',
    },
    parentId: 'indexing',
    needsReview: true,
  },
  {
    id: 'indexing-workers',
    label: 'Workers',
    category: 'indexing',
    summary:
      'The staged workers of one indexing batch: map documents, handle references, clean up tombstones. Every worker implements the same IIndexingWork interface, so the batch loop can run them in a fixed order without knowing what each one actually does.',
    githubPath: 'src/Raven.Server/Documents/Indexes/Workers',
    codeRef: {
      file: 'src/Raven.Server/Documents/Indexes/Workers/IIndexingWork.cs',
      startLine: 8,
      expectSymbol: 'interface IIndexingWork',
    },
    parentId: 'indexing',
    needsReview: true,
  },
  {
    id: 'indexing-persistence',
    label: 'Persistence (engine backends)',
    category: 'indexing',
    summary:
      'The seam between the indexing subsystem and a search engine - one implementation for Corax, one for Lucene. IndexPersistenceBase declares the abstract surface - opening writers and readers, cache publishing, cleanup - that both backends implement independently.',
    githubPath: 'src/Raven.Server/Documents/Indexes/Persistence',
    codeRef: {
      file: 'src/Raven.Server/Documents/Indexes/Persistence/IndexPersistenceBase.cs',
      startLine: 11,
      expectSymbol: 'class IndexPersistenceBase',
    },
    parentId: 'indexing',
  },
  {
    id: 'indexing-vector',
    label: 'VectorSearch',
    category: 'indexing',
    summary:
      'Vector fields: turning text/embeddings into indexable vectors for similarity search. GenerateEmbeddings lazily constructs a BERT ONNX embedding model the first time it\'s needed - the bundled bge-micro-v2 model - and buffers its 384-dimensional output in a 1536-byte block (F32Size, 4 bytes per float).',
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
    summary:
      'Tokenization and text analysis applied to field values before they are indexed. Analyzer composes a tokenizer with one or more transformers (e.g. lower-casing); CreateDefaultAnalyzer and CreateLowercaseAnalyzer are the two built-in presets most Corax fields fall back to.',
    githubPath: 'src/Corax/Analyzers',
    codeRef: {
      file: 'src/Corax/Analyzers/Analyzer.cs',
      startLine: 12,
      expectSymbol: 'class Analyzer',
    },
    parentId: 'search-engines',
  },
  {
    id: 'corax-indexing',
    label: 'Corax: Indexing (IndexWriter)',
    category: 'indexing',
    summary:
      'Builds and maintains the inverted index as entries are added, updated and deleted. It\'s explicitly single-threaded and caller-synchronized rather than internally locked, and keeps a separate fixed-size tree just to cache per-document boost values applied during indexing.',
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
    summary:
      'Executes queries against the inverted index and returns matching entries. IndexSearcher switches to a bitmap representation once a term\'s postings cross a 32MB threshold, trading memory for faster AND/OR set operations on very common terms.',
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
    summary:
      'The staged token processing pipeline (tokenizers and transformers) data passes through. ITokenizer\'s single Tokenize method reports back how many bytes of the input it actually consumed - the hook that lets multi-step tokenization resume where the previous step left off.',
    githubPath: 'src/Corax/Pipeline',
    codeRef: {
      file: 'src/Corax/Pipeline/ITokenizer.cs',
      startLine: 5,
      expectSymbol: 'interface ITokenizer',
    },
    parentId: 'search-engines',
  },
  {
    id: 'corax-mappings',
    label: 'Corax: Mappings',
    category: 'indexing',
    summary:
      'Field-to-index mapping and schema definitions for what gets indexed and how. IndexFieldsMapping resolves a field by Slice, by string, or by an integer id through three parallel dictionaries, and also carries the default, search and exact Analyzer instances a field falls back to.',
    githubPath: 'src/Corax/Mappings',
    codeRef: {
      file: 'src/Corax/Mappings/IndexFieldsMapping.cs',
      startLine: 11,
      expectSymbol: 'class IndexFieldsMapping',
    },
    parentId: 'search-engines',
  },
  {
    id: 'lucene-persistence',
    label: 'Lucene: index persistence',
    category: 'indexing',
    summary:
      'The Lucene backend of an index: writers, readers, analyzer adapters, faceted and suggestion reads. It layers Lucene\'s own IndexWriter and per-field suggestion writers on top of a LuceneVoronDirectory, so a Lucene-backed index still persists through Voron rather than the OS filesystem.',
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
    summary:
      'Lucene\'s Directory implemented on top of Voron, so Lucene indexes are stored transactionally too. LuceneVoronDirectory refuses to be constructed outside a write transaction, and tracks how many bytes of Lucene-managed native allocations are currently outstanding for the index.',
    githubPath: 'src/Raven.Server/Indexing',
    codeRef: {
      file: 'src/Raven.Server/Indexing/LuceneVoronDirectory.cs',
      startLine: 15,
      expectSymbol: 'class LuceneVoronDirectory',
    },
    parentId: 'search-engines',
  },

  // ---------------------------------------------------------------------
  // Micro nodes: Clustering (Rachis)
  // ---------------------------------------------------------------------
  {
    id: 'cluster-leader',
    label: 'Leader',
    category: 'cluster',
    summary:
      'Drives log replication to followers once a node has won an election. Leader tracks one FollowerAmbassador per voter, promotable and non-voter node, and keeps every in-flight command in a concurrent dictionary until enough of them have acknowledged it to commit.',
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
    summary:
      'The steady-state role: accepts AppendEntries from the current leader on its own thread, replying with a success or rejection for each one.',
    githubPath: 'src/Raven.Server/Rachis/Follower.cs',
    codeRef: {
      file: 'src/Raven.Server/Rachis/Follower.cs',
      startLine: 21,
      expectSymbol: 'class Follower',
    },
    parentId: 'cluster',
  },
  {
    id: 'cluster-candidate',
    label: 'Candidate / Elector',
    category: 'cluster',
    summary:
      'Leader election: a node campaigns as Candidate, Elector answers votes on the other side. Candidate spawns one CandidateAmbassador per peer to campaign for votes in parallel, and tracks the outcome as a single ElectionResult once enough responses are in.',
    githubPath: 'src/Raven.Server/Rachis/Candidate.cs',
    codeRef: {
      file: 'src/Raven.Server/Rachis/Candidate.cs',
      startLine: 17,
      expectSymbol: 'class Candidate',
    },
    parentId: 'cluster',
  },
  {
    id: 'cluster-consensus',
    label: 'RachisConsensus / StateMachine',
    category: 'cluster',
    summary:
      'The core consensus engine and the abstraction that applies committed log entries to cluster state. RachisConsensus tracks the node\'s current role (Follower, Candidate, Leader) via a RachisState value and drives the transitions between them as elections happen and terms change.',
    githubPath: 'src/Raven.Server/Rachis/RachisConsensus.cs',
    codeRef: {
      file: 'src/Raven.Server/Rachis/RachisConsensus.cs',
      startLine: 137,
      expectSymbol: 'class RachisConsensus',
    },
    parentId: 'cluster',
  },
  {
    id: 'cluster-commands',
    label: 'Commands',
    category: 'cluster',
    summary:
      'The set of commands that can be proposed to and committed by the Raft log. CastVoteInTermCommand is one example: like every Rachis command it\'s a MergedTransactionCommand, so casting a vote runs through the same transaction-merger machinery that batches ordinary document writes.',
    githubPath: 'src/Raven.Server/Rachis/Commands',
    codeRef: {
      file: 'src/Raven.Server/Rachis/Commands/CastVoteInTermCommand.cs',
      startLine: 8,
      expectSymbol: 'class CastVoteInTermCommand',
    },
    parentId: 'cluster',
  },
  {
    id: 'cluster-network',
    label: 'Wire protocol (AppendEntries, RequestVote, ...)',
    category: 'cluster',
    summary:
      'The messages nodes exchange: log replication, vote requests, snapshot install, the initial handshake. AppendEntries itself carries no log entries - just the term, the previous index/term to validate against, and how many RachisEntry records follow it on the wire.',
    githubPath: 'src/Raven.Server/Rachis/AppendEntries.cs',
    codeRef: {
      file: 'src/Raven.Server/Rachis/AppendEntries.cs',
      startLine: 5,
      expectSymbol: 'class AppendEntries',
    },
    parentId: 'cluster',
  },

  // ---------------------------------------------------------------------
  // Micro nodes: Replication
  // ---------------------------------------------------------------------
  {
    id: 'replication-loader',
    label: 'ReplicationLoader',
    category: 'cluster',
    summary:
      'Owns a database\'s replication connections and reacts to topology and configuration changes. It separates internal, external and pull-replication destinations into their own collections, and retries a failed connection through a dedicated reconnect queue and timer rather than blocking the caller.',
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
    summary:
      'The sending side: streams documents, tombstones, attachments, counters and time series onward. AbstractOutgoingReplicationHandler is generic over the context pool and operation-context types, so the same sending logic serves both the sharded and non-sharded outgoing handlers.',
    githubPath: 'src/Raven.Server/Documents/Replication/Outgoing',
    codeRef: {
      file: 'src/Raven.Server/Documents/Replication/Outgoing/AbstractOutgoingReplicationHandler.cs',
      startLine: 47,
      expectSymbol: 'class AbstractOutgoingReplicationHandler',
    },
    parentId: 'replication',
    needsReview: true,
  },
  {
    id: 'replication-incoming',
    label: 'Incoming',
    category: 'cluster',
    summary:
      'The receiving side: applies an incoming batch inside a write transaction and reports back. IncomingReplicationHandler raises separate DocumentsReceived, AttachmentStreamsReceived and Failed events so callers can react to a batch without polling.',
    githubPath: 'src/Raven.Server/Documents/Replication/Incoming',
    codeRef: {
      file: 'src/Raven.Server/Documents/Replication/Incoming/IncomingReplicationHandler.cs',
      startLine: 35,
      expectSymbol: 'class IncomingReplicationHandler',
    },
    parentId: 'replication',
    needsReview: true,
  },
  {
    id: 'replication-changevector',
    label: 'Change vectors',
    category: 'cluster',
    summary:
      'The per-node etag vector that decides newer / older / conflict for every replicated item. Most entries carry a node tag encoded in base-26 (A-Z, then AA, AB, ...); four special tags - RAFT, TRXN, SINK and MOVE - are recognized as literal string constants instead, ahead of the numeric etag that follows.',
    githubPath: 'src/Raven.Server/Documents/Replication/ChangeVectorParser.cs',
    codeRef: {
      file: 'src/Raven.Server/Documents/Replication/ChangeVectorParser.cs',
      startLine: 8,
      expectSymbol: 'class ChangeVectorParser',
    },
    parentId: 'replication',
    docsUrl: 'https://docs.ravendb.net/7.2/server/clustering/replication/change-vector',
  },
  {
    id: 'replication-conflicts',
    label: 'ConflictManager',
    category: 'cluster',
    summary:
      'Applies the configured conflict resolution when two nodes changed the same document concurrently. ConflictManager runs a fixed sequence of gates - HiLo special-case, identical-content merge, same-collection check, a scripted JavaScript resolver, then latest-wins (via ResolveConflictOnReplicationConfigurationChange) - falling back to a manual conflict only if none of them resolve it.',
    githubPath: 'src/Raven.Server/Documents/Replication/ConflictManager.cs',
    codeRef: {
      file: 'src/Raven.Server/Documents/Replication/ConflictManager.cs',
      startLine: 17,
      expectSymbol: 'class ConflictManager',
    },
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
    summary:
      'Runs one backup: full or incremental, logical export or Voron snapshot, optionally encrypted. It tracks whether the run is full or incremental, one-time or scheduled, server-wide or per-database, and marks its output folder in-progress until the run finishes cleanly.',
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
    summary:
      'Tracks what was backed up and when, so incremental backups know where to resume. BackupStatusStorage keeps exactly one row per backup task in its own Voron table, keyed by task id.',
    githubPath: 'src/Raven.Server/Documents/PeriodicBackup/BackupStatusStorage.cs',
    codeRef: {
      file: 'src/Raven.Server/Documents/PeriodicBackup/BackupStatusStorage.cs',
      startLine: 21,
      expectSymbol: 'class BackupStatusStorage',
    },
    parentId: 'backup',
    needsReview: true,
  },
  {
    id: 'backup-destinations',
    label: 'Destinations (S3, Azure, GCS, FTP)',
    category: 'server',
    summary:
      'The uploaders for each supported backup destination, plus direct upload/download paths. BackupUploader fires off one upload task per configured destination in parallel and joins on all of their background threads before reporting the backup complete.',
    githubPath: 'src/Raven.Server/Documents/PeriodicBackup/BackupUploader.cs',
    codeRef: {
      file: 'src/Raven.Server/Documents/PeriodicBackup/BackupUploader.cs',
      startLine: 29,
      expectSymbol: 'class BackupUploader',
    },
    parentId: 'backup',
  },
  {
    id: 'backup-restore',
    label: 'Restore',
    category: 'server',
    summary:
      'Bringing a database back from a backup - per source (local, S3, Azure, GCS) and per backup kind. RestoreBackupTask restores a logical backup by handing a Smuggler destination to a shared restore routine, since that kind of backup is really just a Smuggler export the restore code re-imports.',
    githubPath: 'src/Raven.Server/Documents/PeriodicBackup/Restore',
    codeRef: {
      file: 'src/Raven.Server/Documents/PeriodicBackup/Restore/RestoreBackupTask.cs',
      startLine: 8,
      expectSymbol: 'class RestoreBackupTask',
    },
    parentId: 'backup',
  },

  // ---------------------------------------------------------------------
  // Micro nodes: AI Integration
  // ---------------------------------------------------------------------
  {
    id: 'ai-embeddings',
    label: 'Embeddings generation',
    category: 'integration',
    summary:
      'The background task that sends text to an embeddings provider and stores the resulting vectors. It runs its own work queue with separate query-time and ETL-time modes, so an ETL run\'s embedding calls don\'t compete with a live search query\'s.',
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
    summary:
      'Splits document text into chunks small enough to embed, before generation. TextChunker supports six chunking strategies - plain text, line-based, HTML-stripped, or Markdown, with or without paragraph awareness - all budgeted against a token count that already accounts for the configured prefix.',
    githubPath: 'src/Raven.Server/Documents/AI/TextChunker.cs',
    codeRef: {
      file: 'src/Raven.Server/Documents/AI/TextChunker.cs',
      startLine: 13,
      expectSymbol: 'class TextChunker',
    },
    parentId: 'ai',
    needsReview: true,
  },
  {
    id: 'ai-chat',
    label: 'ChatCompletionClient',
    category: 'integration',
    summary:
      'The client for chat/completion calls to an external AI provider, including SSE streaming. It goes through a pooled HttpClient rather than opening a fresh connection per call, and is created through a factory that picks the right settings implementation - OpenAI, Azure OpenAI, Google, Ollama - for the connection string\'s provider.',
    githubPath: 'src/Raven.Server/Documents/AI/ChatCompletionClient.cs',
    codeRef: {
      file: 'src/Raven.Server/Documents/AI/ChatCompletionClient.cs',
      startLine: 41,
      expectSymbol: 'class ChatCompletionClient',
    },
    parentId: 'ai',
    needsReview: true,
  },
  {
    id: 'ai-assistant',
    label: 'AiAssistant',
    category: 'integration',
    summary:
      'A license-gated proxy to RavenDB\'s own cloud-hosted assistant at api.ravendb.net, independent of ChatCompletionClient and the user\'s configured AI provider. AiAssistantHandler exposes separate endpoints for consent, usage and the actual assist call - the consent split lets the UI gate the feature before the first real request goes out.',
    githubPath: 'src/Raven.Server/Documents/AI/AiAssistant',
    codeRef: {
      file: 'src/Raven.Server/Documents/AI/AiAssistant/Handlers/AiAssistantHandler.cs',
      startLine: 11,
      expectSymbol: 'class AiAssistantHandler',
    },
    parentId: 'ai',
    needsReview: true,
  },
  {
    id: 'ai-settings',
    label: 'Settings / connection strings',
    category: 'integration',
    summary:
      'Provider configuration: which AI service, which model, which credentials. AbstractChatCompletionClientSettings hides each provider\'s actual completions URL and request-shaping quirks, like whether it accepts strict tool schemas, behind the same virtual surface the chat client calls.',
    githubPath: 'src/Raven.Server/Documents/AI/Settings',
    codeRef: {
      file: 'src/Raven.Server/Documents/AI/Settings/AbstractChatCompletionClientSettings.cs',
      startLine: 12,
      expectSymbol: 'class AbstractChatCompletionClientSettings',
    },
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
    summary:
      'Starts and supervises the ETL processes configured on a database. It tracks separately whether it\'s currently subscribed to document, counter or time-series changes, so it only pays for the change feeds a configured transformation script actually touches.',
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
    summary:
      'One implementation per destination: RavenDB, SQL (RelationalDatabase), OLAP, Elasticsearch, AI (embeddings generation), Kafka/RabbitMQ queues. RavenEtl is the RavenDB-to-RavenDB case, and is the only provider that keeps a dedicated RequestExecutor to the destination and re-creates it if the destination\'s server certificate changes mid-run - the others don\'t use mutual TLS, so they have no equivalent cert-rotation hook.',
    githubPath: 'src/Raven.Server/Documents/ETL/Providers',
    codeRef: {
      file: 'src/Raven.Server/Documents/ETL/Providers/Raven/RavenEtl.cs',
      startLine: 23,
      expectSymbol: 'class RavenEtl',
    },
    parentId: 'integrations',
  },
  {
    id: 'queue-sink',
    label: 'Queue Sink (inbound)',
    category: 'integration',
    summary:
      'The inbound direction: consuming Kafka / RabbitMQ messages into documents (Azure Queue Storage and Amazon SQS exist as configuration options but aren\'t actually supported yet - CreateInstance throws for them). QueueSinkLoader mirrors EtlLoader\'s shape almost exactly - one process array, one set of unique configuration names - just running the data transfer in the opposite direction.',
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
    summary:
      'Bulk import and export of a database, with sharding-aware companions sitting next to the main implementation. DatabaseSmuggler (Smuggler/Documents) is the non-sharded case; ShardedDatabaseSmuggler and SingleShardDatabaseSmuggler live right beside it for the sharded paths.',
    githubPath: 'src/Raven.Server/Smuggler',
    codeRef: {
      file: 'src/Raven.Server/Smuggler/Documents/DatabaseSmuggler.cs',
      startLine: 17,
      expectSymbol: 'class DatabaseSmuggler',
    },
    parentId: 'integrations',
  },
  {
    id: 'sql-migration',
    label: 'SqlMigration',
    category: 'integration',
    summary:
      'Pulls data in from an existing relational database and turns rows into documents. GenericDatabaseMigrator is the shared base every driver (MsSQL, MySQL, NpgSQL, Oracle) extends, and can run a dry-run test against a sample of rows before a real migration commits to a collection mapping.',
    githubPath: 'src/Raven.Server/SqlMigration',
    codeRef: {
      file: 'src/Raven.Server/SqlMigration/GenericDatabaseMigrator.cs',
      startLine: 23,
      expectSymbol: 'class GenericDatabaseMigrator',
    },
    parentId: 'integrations',
  },
  {
    id: 'postgres-protocol',
    label: 'PostgreSQL protocol',
    category: 'integration',
    summary:
      'Speaks the Postgres wire protocol so Postgres clients and BI tools can query RavenDB. PgServer accepts raw TCP connections and speaks the wire protocol itself rather than embedding a real Postgres, tracking each session\'s connection task in a concurrent dictionary for diagnostics.',
    githubPath: 'src/Raven.Server/Integrations/PostgreSQL',
    codeRef: {
      file: 'src/Raven.Server/Integrations/PostgreSQL/PgServer.cs',
      startLine: 18,
      expectSymbol: 'class PgServer',
    },
    parentId: 'integrations',
  },
  {
    id: 'cdc-sink',
    label: 'CdcSink',
    category: 'integration',
    summary:
      'Ingests change-data-capture streams from an external system. CdcSinkLoader supervises one process per configured sink and raises the same batch-completed/process-added/process-removed lifecycle events EtlLoader and QueueSinkLoader use.',
    githubPath: 'src/Raven.Server/Documents/CdcSink',
    codeRef: {
      file: 'src/Raven.Server/Documents/CdcSink/CdcSinkLoader.cs',
      startLine: 17,
      expectSymbol: 'class CdcSinkLoader',
    },
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
