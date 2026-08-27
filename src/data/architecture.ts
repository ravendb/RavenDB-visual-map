// Content model for the RavenDB architecture map.
//
// Every `references.source` URL and every `codeRef` in this file is verified
// automatically against the real repository by `npm run validate:content`
// (scripts/validate-content.ts, also run in CI): the path must exist on REF, and
// the line `codeRef.startLine` points at must contain `codeRef.expectSymbol`.
// That is what keeps the map from silently rotting when the code moves - so when
// you add a node, add the `expectSymbol` too instead of trusting a line number.
//
// Coverage is deliberately aligned with how the official documentation
// (github.com/ravendb/docs) splits RavenDB into areas, so that a reader who
// knows the docs finds the same subsystems here.

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

export interface Link {
  name: string
  url: string
}

export type LinkArray = Link[]

export interface NodeReferences {
  /** Related articles in the official documentation, when any exist. */
  docs?: LinkArray
  /** Where this node lives in the ravendb/ravendb repo - a folder, a file, or several. */
  source: LinkArray
}

export interface MapNode {
  id: string
  label: string
  category: NodeCategory
  /** 1-3 sentences, shown in the macro view / node tooltip. */
  summary: string
  /** Longer text for the detail panel. */
  description?: string
  references: NodeReferences
  /** A specific file + line range to preview inline, when one exists. */
  codeRef?: CodeRef
  /** Set for micro nodes that live inside a macro node's drill-down view. */
  parentId?: string
  /** Set for a macro node whose children are always shown expanded in place - it cannot be collapsed and has no close (x). */
  permanent?: boolean
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
    references: {
      docs: [
        { name: 'Client SDK', url: 'https://docs.ravendb.net/7.2/client-api/what-is-a-document-store' },
        { name: 'Sessions', url: 'https://docs.ravendb.net/7.2/client-api/session/what-is-a-session-and-how-does-it-work' },
        { name: 'Bulk Insert', url: 'https://docs.ravendb.net/7.2/client-api/bulk-insert/how-to-work-with-bulk-insert-operation' },
      ],
      source: [{ name: 'src/Raven.Client', url: githubTreeUrl('src/Raven.Client') }],
    },
  },
  {
    id: 'http',
    label: 'HTTP / Routing Layer',
    category: 'server',
    summary: 'The web server front door: request routing and the handlers that turn HTTP calls into database operations.',
    description:
      'Every client request (and every Studio request) lands here first. The dispatcher itself (RequestRouter, RouteScanner) lives in the sibling src/Raven.Server/Routing folder; Web holds the per-resource-type Handlers it dispatches to (documents, attachments, indexes, ...), the shared RequestHandler base class, and the endpoints under Web/Authentication for managing client certificates and two-factor authentication. Connection-level authentication happens earlier, at the HTTPS layer - see the Security node.',
    references: {
      docs: [
        { name: 'Introduction to the REST API', url: 'https://docs.ravendb.net/7.2/client-api/rest-api/rest-api-intro/' },
        { name: 'Query the Database (REST API)', url: 'https://docs.ravendb.net/7.2/client-api/rest-api/queries/query-the-database' },
        { name: 'Get All Documents (REST API)', url: 'https://docs.ravendb.net/7.2/client-api/rest-api/document-commands/get-all-documents' },
      ],
      source: [{ name: 'src/Raven.Server/Web', url: githubTreeUrl('src/Raven.Server/Web') }],
    },
  },
  {
    id: 'sharding',
    label: 'Sharding',
    category: 'server',
    summary: 'Splits one database across several shards and fans requests out to them, presenting a single database to the client.',
    description:
      'A sharded database is orchestrated by ShardedDatabaseContext: ShardLocator decides which shard a document id (bucket) belongs to, the Executors fan a request out to the relevant shards, and Queries merges the per-shard results back into one answer. Clients talk to a sharded database the same way they talk to a non-sharded one.',
    references: {
      docs: [
        { name: 'Sharding', url: 'https://docs.ravendb.net/7.2/sharding/overview' },
        { name: 'Sharding: Querying', url: 'https://docs.ravendb.net/7.2/sharding/querying/' },
        { name: 'Sharding: Resharding', url: 'https://docs.ravendb.net/7.2/sharding/resharding' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/Sharding', url: githubTreeUrl('src/Raven.Server/Documents/Sharding') }],
    },
  },
  {
    id: 'documents-core',
    label: 'Storages',
    category: 'server',
    summary: 'The per-database storage subsystems: documents, attachments, revisions, counters, time series, conflicts, refresh and archival.',
    description:
      'Every one of these lives directly on top of a Voron storage environment and is what most database operations ultimately touch - each gets its own micro node here rather than being folded into one generic "storage" box, since they are separate classes with separate on-disk tables and separate size/retention rules. DocumentsStorage is the hub: every write is stamped with a new change vector there, independent of whether replication is even configured - it is the general-purpose causality/versioning primitive the rest of the server builds on, which is why Revisions, Subscriptions, ETL and incremental Backup each key off it.',
    references: {
      docs: [
        { name: 'Documents and Collections', url: 'https://docs.ravendb.net/7.2/studio/database/documents/documents-and-collections' },
        { name: 'What is a Document Store', url: 'https://docs.ravendb.net/7.2/client-api/what-is-a-document-store' },
        { name: 'Transaction Support (FAQ)', url: 'https://docs.ravendb.net/7.2/client-api/faq/transaction-support/' },
      ],
      source: [{ name: 'src/Raven.Server/Documents', url: githubTreeUrl('src/Raven.Server/Documents') }],
    },
    permanent: true,
  },
  {
    id: 'indexing',
    label: 'Indexing',
    category: 'indexing',
    summary: 'The server-side indexing subsystem: index definitions, the workers that keep indexes up to date, and the choice of search engine per index.',
    description:
      'IndexStore owns every index in a database; each Index instance runs its own indexing thread, pulling changed documents through the Workers pipeline. This layer is engine-agnostic: Persistence/Corax and Persistence/Lucene are the two backends an index can be written through. Auto-indexes are created here on demand for queries that match no existing index; Static indexes come from user-supplied definitions.',
    references: {
      docs: [
        { name: 'What are Indexes', url: 'https://docs.ravendb.net/7.2/indexes/what-are-indexes' },
        { name: 'Indexing Basics', url: 'https://docs.ravendb.net/7.2/indexes/indexing-basics' },
        { name: 'Index Administration', url: 'https://docs.ravendb.net/7.2/indexes/index-administration' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/Indexes', url: githubTreeUrl('src/Raven.Server/Documents/Indexes') }],
    },
    codeRef: {
      file: 'src/Raven.Server/Documents/Indexes/IndexStore.cs',
      startLine: 51,
      expectSymbol: 'class IndexStore',
    },
  },
  {
    id: 'search-engines',
    label: 'Search Engines',
    category: 'indexing',
    summary: 'The two interchangeable search engines an index can be built on: the in-house Corax and the older Lucene path.',
    description:
      'Corax is RavenDB\'s in-house search engine: it analyzes field values, builds an inverted index persisted through Voron, and executes queries against it. Lucene remains fully supported, running on Voron through the LuceneVoronDirectory in src/Raven.Server/Indexing. Which one a new index uses is configurable server-wide, per database and per static index; when nothing is configured the default depends on the license - Community, Developer and unlicensed servers default to Corax, Professional and Enterprise default to Lucene.',
    references: {
      docs: [
        { name: 'Search Engines (Corax / Lucene)', url: 'https://docs.ravendb.net/7.2/indexes/search-engine/corax' },
        { name: 'Configuration: Indexing', url: 'https://docs.ravendb.net/7.2/server/configuration/indexing-configuration/' },
      ],
      source: [{ name: 'src/Corax', url: githubTreeUrl('src/Corax') }],
    },
    permanent: true,
  },
  {
    id: 'ai',
    label: 'AI & Vector Search',
    category: 'integration',
    summary: 'Embeddings generation, vector fields in indexes, and the chat/assistant integrations with external AI providers.',
    description:
      'EmbeddingsGenerator is a background task that turns document text into vectors through an external provider, chunking it first with TextChunker. ChatCompletionClient is the client for the user\'s own configured AI provider; AiAssistant is a separate, license-gated proxy to RavenDB\'s own cloud-hosted assistant at api.ravendb.net and does not use ChatCompletionClient or the user\'s provider config. The vectors themselves are indexed as vector fields (Documents/Indexes/VectorSearch) and queried like any other index field.',
    references: {
      docs: [
        { name: 'AI Integration & Vector Search', url: 'https://docs.ravendb.net/7.2/ai-integration/overview' },
        { name: 'Vector Search - Overview', url: 'https://docs.ravendb.net/7.2/ai-integration/vector-search/overview/' },
        { name: 'The Embeddings Generation Task', url: 'https://docs.ravendb.net/7.2/ai-integration/generating-embeddings/embeddings-generation-task/' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/AI', url: githubTreeUrl('src/Raven.Server/Documents/AI') }],
    },
  },
  {
    id: 'storage',
    label: 'Storage Engine (Voron)',
    category: 'storage',
    summary: 'The transactional, memory-mapped, page-based storage engine every other subsystem persists through.',
    description:
      'Voron is RavenDB\'s in-house embedded storage engine: fixed-size pages, a write-ahead journal that is the recovery source after a crash, B+Trees (variable-size keys) and fixed-size B+Trees, raw data sections and tables. It is fully ACID, allows a single write transaction at a time (many concurrent readers), and provides snapshot isolation via scratch files and page translation tables.',
    references: {
      docs: [
        { name: 'Storage Engine (Voron)', url: 'https://docs.ravendb.net/7.2/server/storage/storage-engine' },
        { name: 'Storage: Directory Structure', url: 'https://docs.ravendb.net/7.2/server/storage/directory-structure/' },
        { name: 'Voron Recovery Tool', url: 'https://docs.ravendb.net/7.2/server/troubleshooting/voron-recovery-tool' },
      ],
      source: [{ name: 'src/Voron', url: githubTreeUrl('src/Voron') }],
    },
    codeRef: {
      file: 'src/Voron/StorageEnvironment.cs',
      startLine: 50,
      endLine: 140,
      expectSymbol: 'class StorageEnvironment',
    },
  },
  {
    id: 'cluster',
    label: 'Clustering (Rachis)',
    category: 'cluster',
    summary: 'Raft-based consensus between cluster nodes: leader election, log replication, and cluster-wide state (compare-exchange, cluster transactions).',
    description:
      "Rachis is RavenDB's implementation of the Raft consensus algorithm. It elects a cluster leader, replicates a command log to followers, and drives ServerWide state such as the cluster's database topology and compare-exchange values that must agree across every node. Its own log is kept ACID by storing it in Voron. Note the split: Rachis handles cluster-wide consensus, while document data between databases/nodes moves through the separate Replication subsystem.",
    references: {
      docs: [
        { name: "Rachis - RavenDB's Raft Implementation", url: 'https://docs.ravendb.net/7.2/server/clustering/rachis/what-is-rachis' },
        { name: 'Cluster: Overview', url: 'https://docs.ravendb.net/7.2/server/clustering/overview' },
        { name: 'Cluster-Wide Transactions', url: 'https://docs.ravendb.net/7.2/server/clustering/cluster-transactions/' },
      ],
      source: [{ name: 'src/Raven.Server/Rachis', url: githubTreeUrl('src/Raven.Server/Rachis') }],
    },
  },
  {
    id: 'replication',
    label: 'Replication',
    category: 'cluster',
    summary: 'Streams document data between database group members and to external destinations, with change vectors and conflict resolution.',
    description:
      'ReplicationLoader manages the outgoing and incoming replication connections of a database. Every item carries a change vector, which is how a node decides whether an incoming item is newer, older, or in conflict; ConflictManager applies the configured resolution. This is a different mechanism from Rachis: replication moves document data and is eventually consistent, Rachis moves cluster commands and needs a majority.',
    references: {
      docs: [
        { name: 'Replication Overview', url: 'https://docs.ravendb.net/7.2/server/clustering/replication/replication' },
        { name: 'External Replication', url: 'https://docs.ravendb.net/7.2/server/ongoing-tasks/external-replication' },
        { name: 'Replication Conflicts', url: 'https://docs.ravendb.net/7.2/server/clustering/replication/replication-conflicts' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/Replication', url: githubTreeUrl('src/Raven.Server/Documents/Replication') }],
    },
  },
  {
    id: 'backup',
    label: 'Backup & Restore',
    category: 'server',
    summary: 'Periodic full and incremental backups, snapshots, and restore - to local disk or cloud destinations.',
    description:
      'BackupTask runs a database backup as an ongoing task, either as a logical export or as a Voron snapshot, optionally encrypted. Uploaders exist per destination (local, S3/Glacier, Azure, Google Cloud, FTP), and the Restore folder holds the counterpart that brings a database back from each of them.',
    references: {
      docs: [
        { name: 'Backup & Restore Overview', url: 'https://docs.ravendb.net/7.2/server/ongoing-tasks/backup-overview' },
        { name: 'Restore from Backup', url: 'https://docs.ravendb.net/7.2/backup/restore' },
        { name: 'Periodic Database Backup Tasks', url: 'https://docs.ravendb.net/7.2/backup/create/periodic-tasks/database-backup' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/PeriodicBackup', url: githubTreeUrl('src/Raven.Server/Documents/PeriodicBackup') }],
    },
  },
  {
    id: 'etl',
    label: 'ETL',
    category: 'integration',
    summary: 'Outgoing data movement: transforms document changes and streams them out to external systems as they happen.',
    description:
      'EtlLoader runs the outgoing ETL processes configured on a database; Providers covers one implementation per destination - RavenDB, SQL, OLAP, Elasticsearch, AI embeddings generation, and queue destinations such as Kafka and RabbitMQ.',
    references: {
      docs: [
        { name: 'Ongoing Tasks: ETL Basics', url: 'https://docs.ravendb.net/7.2/server/ongoing-tasks/etl/basics' },
        { name: 'Ongoing Tasks: RavenDB ETL', url: 'https://docs.ravendb.net/7.2/server/ongoing-tasks/etl/raven' },
        { name: 'Ongoing Tasks: SQL ETL', url: 'https://docs.ravendb.net/7.2/server/ongoing-tasks/etl/sql/' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/ETL', url: githubTreeUrl('src/Raven.Server/Documents/ETL') }],
    },
  },
  {
    id: 'sinks',
    label: 'Sinks',
    category: 'integration',
    summary: 'Incoming data movement: consumes an external stream - a message queue or a database\'s change-data-capture feed - into documents.',
    description:
      'QueueSink consumes Kafka/RabbitMQ messages into documents; CdcSink ingests change-data-capture streams from an external relational database (PostgreSQL, SQL Server, MySQL). Both mirror EtlLoader\'s shape almost exactly - one process per configured source - just running the data transfer in the opposite direction.',
    references: {
      docs: [
        { name: 'Queue Sink: Apache Kafka', url: 'https://docs.ravendb.net/7.2/server/ongoing-tasks/queue-sink/kafka-queue-sink' },
        { name: 'CDC Sink: Overview', url: 'https://docs.ravendb.net/7.2/server/ongoing-tasks/cdc-sink/overview' },
      ],
      source: [
        { name: 'src/Raven.Server/Documents/QueueSink', url: githubTreeUrl('src/Raven.Server/Documents/QueueSink') },
        { name: 'src/Raven.Server/Documents/CdcSink', url: githubTreeUrl('src/Raven.Server/Documents/CdcSink') },
      ],
    },
  },
  {
    id: 'integrations',
    label: 'Integrations',
    category: 'integration',
    summary: 'Bulk import/export, one-time SQL migration, and the PostgreSQL wire protocol - each a different way of moving data in or out, or letting other tools query RavenDB directly.',
    description:
      'Smuggler is RavenDB\'s bulk import/export format, with sharding-aware companions; SqlMigration is a one-time pull from an existing relational database into documents; Integrations/PostgreSQL lets Postgres-wire clients (BI tools, pgAdmin) query RavenDB directly - independent of both the ETL and Sinks ongoing tasks.',
    references: {
      docs: [
        { name: 'What is Smuggler', url: 'https://docs.ravendb.net/7.2/client-api/smuggler/what-is-smuggler' },
        { name: 'Import from SQL', url: 'https://docs.ravendb.net/7.2/studio/database/tasks/import-data/import-from-sql/' },
        { name: 'PostgreSQL Protocol: Overview', url: 'https://docs.ravendb.net/7.2/integrations/postgresql-protocol/overview' },
      ],
      source: [{ name: 'src/Raven.Server/Smuggler', url: githubTreeUrl('src/Raven.Server/Smuggler') }],
    },
  },
  {
    id: 'security',
    label: 'Security & HTTPS',
    category: 'security',
    summary: 'Transport security and certificate-based authentication for client/server and server/server communication.',
    description:
      'RavenDB authenticates connections with X.509 client certificates rather than username/password. HttpsConnectionMiddleware inspects the certificate as the TLS connection is established and ExternalCertificateValidator validates it, before routing sees the request; the resulting authorization level then gates every handler. Certificate management and two-factor authentication are exposed as endpoints under Web/Authentication, and the certificate definitions themselves are cluster-wide state.',
    references: {
      docs: [
        { name: 'Security & HTTPS', url: 'https://docs.ravendb.net/7.2/server/security/overview' },
        { name: 'Certificate Management', url: 'https://docs.ravendb.net/7.2/server/security/authentication/certificate-management' },
        { name: 'Security Clearance and Permissions', url: 'https://docs.ravendb.net/7.2/server/security/authorization/security-clearance-and-permissions/' },
      ],
      source: [{ name: 'src/Raven.Server/Https', url: githubTreeUrl('src/Raven.Server/Https') }],
    },
    codeRef: {
      file: 'src/Raven.Server/Https/HttpsConnectionMiddleware.cs',
      startLine: 17,
      expectSymbol: 'class HttpsConnectionMiddleware',
    },
  },
  {
    id: 'studio',
    label: 'Studio (Management UI)',
    category: 'studio',
    summary: "RavenDB's built-in web management interface, bundled with the server.",
    description:
      'A single-page app served by the server itself, talking to the same HTTP API as any other client - used for administration, querying, and monitoring.',
    references: {
      docs: [
        { name: 'Studio (Management UI)', url: 'https://docs.ravendb.net/7.2/studio/overview' },
        { name: 'Studio Query View', url: 'https://docs.ravendb.net/7.2/studio/database/queries/query-view' },
        { name: 'Index Administration', url: 'https://docs.ravendb.net/7.2/indexes/index-administration' },
      ],
      source: [{ name: 'src/Raven.Studio', url: githubTreeUrl('src/Raven.Studio') }],
    },
  },
  {
    id: 'infra',
    label: 'Low-level Infra (Sparrow)',
    category: 'infra',
    summary: 'Shared low-level building blocks used across the server and storage engine: buffers, memory management, threading primitives, blittable JSON.',
    description:
      'Sparrow (and Sparrow.Server) is not a feature area but the foundation the rest of the server is built on - unmanaged memory pooling, the blittable JSON representation in Sparrow/Json, hashing and threading primitives live here because Voron and Raven.Server both depend on them.',
    references: {
      docs: [{ name: 'BlittableJsonReaderObject', url: 'https://docs.ravendb.net/7.2/glossary/blittable-json-reader-object' }],
      source: [{ name: 'src/Sparrow', url: githubTreeUrl('src/Sparrow') }],
    },
  },
  {
    id: 'core-tx-merger',
    label: 'TransactionMerger',
    category: 'server',
    summary:
      'Batches many write operations into a single Voron write transaction - the throughput trick on top of Voron\'s single-writer model. Commands sit on a lock-free queue and run on one dedicated long-running thread, so callers merge into that shared transaction without ever blocking each other on it directly.',
    references: {
      docs: [
        { name: 'Configuration: Transaction Merger Options', url: 'https://docs.ravendb.net/7.2/server/configuration/transaction-merger-configuration/' },
        { name: 'Storage Engine (Voron)', url: 'https://docs.ravendb.net/7.2/server/storage/storage-engine/' },
        { name: 'Transaction Support (FAQ)', url: 'https://docs.ravendb.net/7.2/client-api/faq/transaction-support/' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/TransactionMerger', url: githubTreeUrl('src/Raven.Server/Documents/TransactionMerger') }],
    },
    codeRef: {
      file: 'src/Raven.Server/Documents/TransactionMerger/AbstractTransactionOperationsMerger.cs',
      startLine: 36,
      expectSymbol: 'class AbstractTransactionOperationsMerger',
    },
  },
  {
    id: 'core-queries',
    label: 'Queries (RQL)',
    category: 'server',
    summary:
      'Parsing and execution of RQL queries, including projections, facets and includes. AbstractQueryRunner tracks every currently-executing query in a concurrent set, which is what lets the server list or cancel a long-running query while it\'s still running.',
    references: {
      docs: [
        { name: 'Queries (RQL)', url: 'https://docs.ravendb.net/7.2/client-api/session/querying/what-is-rql' },
        { name: 'Query Overview', url: 'https://docs.ravendb.net/7.2/querying/overview' },
        { name: 'Query the Database (REST API)', url: 'https://docs.ravendb.net/7.2/client-api/rest-api/queries/query-the-database' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/Queries', url: githubTreeUrl('src/Raven.Server/Documents/Queries') }],
    },
    codeRef: {
      file: 'src/Raven.Server/Documents/Queries/AbstractQueryRunner.cs',
      startLine: 9,
      expectSymbol: 'class AbstractQueryRunner',
    },
  },
  {
    id: 'core-subscriptions',
    label: 'Data Subscriptions',
    category: 'server',
    summary:
      'Server-side, resumable push of matching documents to a worker over a long-lived TCP connection. MaxNumberOfConcurrentConnections is a single database-wide cap (default 1000) shared across every subscription, not a per-subscription limit; SubscriptionStorage raises events as connections open, end, or a batch completes. "Resumable" is change-vector-backed: each acknowledged batch records the change vector it ended on, which is what a worker reconnects from instead of replaying everything.',
    references: {
      docs: [
        { name: 'Data Subscriptions', url: 'https://docs.ravendb.net/7.2/client-api/data-subscriptions/what-are-data-subscriptions' },
        { name: 'Data Subscription Creation Examples', url: 'https://docs.ravendb.net/7.2/client-api/data-subscriptions/creation/examples/' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/Subscriptions', url: githubTreeUrl('src/Raven.Server/Documents/Subscriptions') }],
    },
    codeRef: {
      file: 'src/Raven.Server/Documents/Subscriptions/SubscriptionStorage.cs',
      startLine: 22,
      expectSymbol: 'class SubscriptionStorage',
    },
  },

  // ---------------------------------------------------------------------
  // Micro nodes: Storages
  // ---------------------------------------------------------------------
  {
    id: 'core-document',
    label: 'Document',
    category: 'server',
    summary: 'The document read/write core: get, put, delete by id, and the change-vector bookkeeping every write goes through.',
    description:
      'DocumentsStorage handles document CRUD directly against Voron and stamps a new change vector on every write, regardless of whether replication is even configured - Revisions keys each stored revision by it, Subscriptions and ETL use it as their resume checkpoint, and Backup compares it to the last run\'s to detect incremental changes.',
    references: {
      docs: [
        { name: 'Documents and Collections', url: 'https://docs.ravendb.net/7.2/studio/database/documents/documents-and-collections' },
        { name: 'What is a Document Store', url: 'https://docs.ravendb.net/7.2/client-api/what-is-a-document-store' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/DocumentsStorage.cs', url: githubBlobUrl('src/Raven.Server/Documents/DocumentsStorage.cs') }],
    },
    codeRef: {
      file: 'src/Raven.Server/Documents/DocumentsStorage.cs',
      startLine: 51,
      expectSymbol: 'class DocumentsStorage',
    },
    parentId: 'documents-core',
  },
  {
    id: 'core-attachments',
    label: 'Attachments',
    category: 'server',
    summary: 'Binary blobs attached to documents, stored as streams alongside the owning document, plus cross-node "remote attachment" fetch.',
    description:
      'AttachmentsStorage keeps attachments in their own Voron table, separately from document JSON, so large binaries do not bloat document reads - every record is keyed by a 44-byte content hash (AttachmentHashSize), so identical content stored on several documents is kept once. RemoteAttachmentsStorage/RemoteAttachmentsSender and RemoteAttachmentHandler implement cold-storage tiering on top of that: an attachment\'s stream can be moved out to external storage (e.g. S3/Azure, typically as part of a backup) and deleted locally, then fetched back on demand by its external identifier instead of staying resident forever - this derives from the same AbstractBackgroundWorkStorage used for document expiration. The in-memory model for a record and its deletion marker (Attachment / tombstone) is a flat set of fields (StorageId, Key, Etag, ChangeVector, content hash, size, stream) - RevisionVersion is only populated on the copy kept for a revision, not on the live document\'s.',
    references: {
      docs: [
        { name: 'Attachments Overview', url: 'https://docs.ravendb.net/7.2/document-extensions/attachments/overview' },
        { name: 'Store Attachments Locally (Deduplication)', url: 'https://docs.ravendb.net/7.2/document-extensions/attachments/store-attachments/store-attachments-local' },
        { name: 'Store Attachments Remotely', url: 'https://docs.ravendb.net/7.2/document-extensions/attachments/store-attachments/store-attachments-remote' },
      ],
      source: [
        { name: 'src/Raven.Server/Documents/AttachmentsStorage.cs', url: githubBlobUrl('src/Raven.Server/Documents/AttachmentsStorage.cs') },
        { name: 'src/Raven.Server/Documents/RemoteAttachmentsStorage.cs', url: githubBlobUrl('src/Raven.Server/Documents/RemoteAttachmentsStorage.cs') },
        { name: 'src/Raven.Server/Documents/Attachment.cs', url: githubBlobUrl('src/Raven.Server/Documents/Attachment.cs') },
      ],
    },
    codeRef: {
      file: 'src/Raven.Server/Documents/AttachmentsStorage.cs',
      startLine: 52,
      expectSymbol: 'class AttachmentsStorage',
    },
    parentId: 'documents-core',
  },
  {
    id: 'core-revisions',
    label: 'Revisions',
    category: 'server',
    summary:
      'Versioning: keeps previous versions of a document according to the revisions configuration. RevisionsStorage keeps a plain and a compressed Voron table side by side, and rejects any single revision larger than SizeLimitInBytes (32MB by default, 2MB on 32-bit builds, not currently configurable). Each stored revision is keyed by the change vector the document had at that point, not by a timestamp or sequence number.',
    references: {
      docs: [
        { name: 'Revisions', url: 'https://docs.ravendb.net/7.2/document-extensions/revisions/overview' },
        { name: 'Document Revisions (Studio)', url: 'https://docs.ravendb.net/7.2/studio/database/settings/document-revisions' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/Revisions', url: githubTreeUrl('src/Raven.Server/Documents/Revisions') }],
    },
    codeRef: {
      file: 'src/Raven.Server/Documents/Revisions/RevisionsStorage.cs',
      startLine: 45,
      expectSymbol: 'class RevisionsStorage',
    },
    parentId: 'documents-core',
  },
  {
    id: 'core-counters',
    label: 'Counters',
    category: 'server',
    summary:
      'Distributed counters attached to a document, mergeable across nodes without conflicts. A counters document caps out at 2048 bytes (MaxCounterDocumentSize), and each counter\'s value is stored per originating node so merging across nodes only ever needs a sum, never a lock.',
    references: {
      docs: [
        { name: 'Counters', url: 'https://docs.ravendb.net/7.2/document-extensions/counters/overview' },
        { name: 'Counters and Other Features', url: 'https://docs.ravendb.net/7.2/document-extensions/counters/counters-and-other-features' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/CountersStorage.cs', url: githubBlobUrl('src/Raven.Server/Documents/CountersStorage.cs') }],
    },
    codeRef: {
      file: 'src/Raven.Server/Documents/CountersStorage.cs',
      startLine: 32,
      expectSymbol: 'class CountersStorage',
    },
    parentId: 'documents-core',
  },
  {
    id: 'core-timeseries',
    label: 'Time Series',
    category: 'server',
    summary:
      'Append-only numeric series attached to a document, stored in compressed segments. Each segment is capped at 2048 bytes (MaxSegmentSize) before a new one starts; TimeSeriesRollups only marks a rollup as needing recomputation, while the separate TimeSeriesPolicyRunner background worker is what actually downsamples and purges data per the configured retention policy.',
    references: {
      docs: [
        { name: 'Time Series', url: 'https://docs.ravendb.net/7.2/document-extensions/timeseries/overview' },
        { name: 'Time Series Rollups and Retention', url: 'https://docs.ravendb.net/7.2/document-extensions/timeseries/rollup-and-retention' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/TimeSeries', url: githubTreeUrl('src/Raven.Server/Documents/TimeSeries') }],
    },
    codeRef: {
      file: 'src/Raven.Server/Documents/TimeSeries/TimeSeriesStorage.cs',
      startLine: 41,
      expectSymbol: 'class TimeSeriesStorage',
    },
    parentId: 'documents-core',
  },
  {
    id: 'core-conflicts',
    label: 'Conflicts',
    category: 'server',
    summary: 'Persists the competing document versions RavenDB keeps on disk when two nodes changed the same document concurrently and no automatic resolution has run yet.',
    description:
      'ConflictsStorage owns a dedicated Voron table (ConflictsSchema) holding every unresolved version of a conflicted document, tracked via the ConflictsCount field; AddConflict writes an incoming version alongside the existing one instead of overwriting it, and GetConflictsFor/GetAllConflictsBySameId read them back for Studio or resolution logic. It is distinct from ConflictManager (under Replication), which decides whether and how to resolve a conflict and then calls into ConflictsStorage to persist the outcome - this is the storage layer, ConflictManager is the policy layer built on top of it.',
    references: {
      docs: [
        { name: 'Replication Conflicts', url: 'https://docs.ravendb.net/7.2/server/clustering/replication/replication-conflicts' },
        { name: 'Change Vector', url: 'https://docs.ravendb.net/7.2/server/clustering/replication/change-vector' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/ConflictsStorage.cs', url: githubBlobUrl('src/Raven.Server/Documents/ConflictsStorage.cs') }],
    },
    codeRef: {
      file: 'src/Raven.Server/Documents/ConflictsStorage.cs',
      startLine: 33,
      expectSymbol: 'class ConflictsStorage',
    },
    parentId: 'documents-core',
  },
  {
    id: 'core-refresh',
    label: 'Refresh',
    category: 'server',
    summary: 'Periodically re-writes a document once its @refresh metadata time has passed, bumping its change vector without changing its data.',
    description:
      'RefreshStorage derives from the same DocumentBackgroundWorkStorage base as Expiration and Archival, and drives documents through the DocumentsByRefresh tree keyed on the @refresh metadata property. ProcessDocument checks whether that time has passed, strips the @refresh tag, then calls DocumentsStorage.Put with the same content - the point is a fresh change vector and etag, not a content change, so anything watching for updates (indexes, subscriptions, ETL) re-triggers on it. A still-conflicted document is only treated as refreshed once every conflicted copy has itself passed its refresh time.',
    references: {
      docs: [
        { name: 'Document Refresh', url: 'https://docs.ravendb.net/7.2/server/extensions/refresh' },
        { name: 'Document Refresh (Studio)', url: 'https://docs.ravendb.net/7.2/studio/database/settings/document-refresh' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/Refresh', url: githubTreeUrl('src/Raven.Server/Documents/Refresh') }],
    },
    codeRef: {
      file: 'src/Raven.Server/Documents/Refresh/RefreshStorage.cs',
      startLine: 15,
      expectSymbol: 'class RefreshStorage',
    },
    parentId: 'documents-core',
  },
  {
    id: 'core-archival',
    label: 'Archival',
    category: 'server',
    summary: 'Marks documents past their scheduled @archive-at time as archived, so other subsystems, like indexing, can skip them.',
    description:
      'DataArchivalStorage walks the DocumentsByArchiveAtDateTime tree keyed on the @archive-at metadata property; once a document\'s time has passed, it sets the Archived metadata flag, removes @archive-at, and ORs in DocumentFlags.Archived before writing the document back - unlike Refresh and Expiration it explicitly ignores conflicts. DataArchivist is the background loop: it wakes every ArchiveFrequencyInSec (default 60s), pulls a batch from DataArchivalStorage, and applies it transactionally through ArchiveDocumentsCommand.',
    references: {
      docs: [
        { name: 'Data Archival: Overview', url: 'https://docs.ravendb.net/7.2/data-archival/overview' },
        { name: 'Data Archival: Schedule Document Archiving', url: 'https://docs.ravendb.net/7.2/data-archival/schedule-document-archiving' },
        { name: 'Data Archival and Other Features', url: 'https://docs.ravendb.net/7.2/data-archival/archived-documents-and-other-features' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/DataArchival', url: githubTreeUrl('src/Raven.Server/Documents/DataArchival') }],
    },
    codeRef: {
      file: 'src/Raven.Server/Documents/DataArchival/DataArchivalStorage.cs',
      startLine: 13,
      expectSymbol: 'class DataArchivalStorage',
    },
    parentId: 'documents-core',
  },

  // ---------------------------------------------------------------------
  // Micro nodes: Storage Engine (Voron)
  // ---------------------------------------------------------------------
  {
    id: 'storage-impl',
    label: 'Pager & Journal',
    category: 'storage',
    summary:
      'The actual mechanics: paging, the write-ahead journal, scratch buffers and transactions. LowLevelTransaction is the class every read or write transaction ultimately runs on: it owns the data pager, tracks how many pages it modified, and hands off to the WriteAheadJournal on commit.',
    references: {
      docs: [
        { name: 'Storage Engine (Voron)', url: 'https://docs.ravendb.net/7.2/server/storage/storage-engine/' },
        { name: 'Storage: Directory Structure', url: 'https://docs.ravendb.net/7.2/server/storage/directory-structure/' },
        { name: 'Voron Recovery Tool', url: 'https://docs.ravendb.net/7.2/server/troubleshooting/voron-recovery-tool' },
      ],
      source: [{ name: 'src/Voron/Impl', url: githubTreeUrl('src/Voron/Impl') }],
    },
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
    references: {
      docs: [
        { name: 'Storage Engine (Voron)', url: 'https://docs.ravendb.net/7.2/server/storage/storage-engine/' },
        { name: 'Documents Compression', url: 'https://docs.ravendb.net/7.2/server/storage/documents-compression' },
      ],
      source: [{ name: 'src/Voron/Data', url: githubTreeUrl('src/Voron/Data') }],
    },
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
    references: {
      source: [{ name: 'src/Voron/Schema', url: githubTreeUrl('src/Voron/Schema') }],
    },
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
    references: {
      docs: [{ name: 'Storage Engine (Voron)', url: 'https://docs.ravendb.net/7.2/server/storage/storage-engine/' }],
      source: [{ name: 'src/Voron/Page.cs', url: githubBlobUrl('src/Voron/Page.cs') }],
    },
    codeRef: { file: 'src/Voron/Page.cs', startLine: 8, expectSymbol: 'struct Page' },
    parentId: 'storage',
  },
  {
    id: 'storage-slice',
    label: 'Slice',
    category: 'storage',
    summary:
      'The key/value byte-range abstraction used throughout Voron\'s trees. Slice is a thin wrapper around a ByteString and converts implicitly to a ReadOnlySpan<byte>, so most Voron code can compare and hash keys without ever allocating a managed byte array.',
    references: {
      source: [{ name: 'src/Voron/Slice.cs', url: githubBlobUrl('src/Voron/Slice.cs') }],
    },
    codeRef: { file: 'src/Voron/Slice.cs', startLine: 14, expectSymbol: 'struct Slice' },
    parentId: 'storage',
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
    references: {
      docs: [
        { name: 'Sharding Overview', url: 'https://docs.ravendb.net/7.2/sharding/overview' },
        { name: 'Sharding: Querying', url: 'https://docs.ravendb.net/7.2/sharding/querying/' },
        { name: 'Sharding: Resharding', url: 'https://docs.ravendb.net/7.2/sharding/resharding' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/Sharding/ShardedDatabaseContext.cs', url: githubBlobUrl('src/Raven.Server/Documents/Sharding/ShardedDatabaseContext.cs') }],
    },
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
    references: {
      docs: [
        { name: 'Sharding: Resharding', url: 'https://docs.ravendb.net/7.2/sharding/resharding' },
        { name: 'Sharding by Prefix', url: 'https://docs.ravendb.net/7.2/sharding/administration/sharding-by-prefix/' },
        { name: 'Sharding Overview', url: 'https://docs.ravendb.net/7.2/sharding/overview' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/Sharding/ShardLocator.cs', url: githubBlobUrl('src/Raven.Server/Documents/Sharding/ShardLocator.cs') }],
    },
    codeRef: {
      file: 'src/Raven.Server/Documents/Sharding/ShardLocator.cs',
      startLine: 8,
      expectSymbol: 'class ShardLocator',
    },
    parentId: 'sharding',
  },
  {
    id: 'sharding-executors',
    label: 'Executors',
    category: 'server',
    summary:
      'Fan-out execution of an operation across the relevant shards, with per-shard commands. ShardExecutor keeps one lazily-created RequestExecutor per shard, indexed by shard number, and reuses it for every subsequent command sent to that shard.',
    references: {
      docs: [
        { name: 'Sharding: Import and Export', url: 'https://docs.ravendb.net/7.2/sharding/import-and-export' },
        { name: 'Sharding: Querying', url: 'https://docs.ravendb.net/7.2/sharding/querying/' },
        { name: 'Sharding: Indexing', url: 'https://docs.ravendb.net/7.2/sharding/indexing' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/Sharding/Executors', url: githubTreeUrl('src/Raven.Server/Documents/Sharding/Executors') }],
    },
    codeRef: {
      file: 'src/Raven.Server/Documents/Sharding/Executors/ShardExecutor.cs',
      startLine: 18,
      expectSymbol: 'class ShardExecutor',
    },
    parentId: 'sharding',
  },
  {
    id: 'sharding-queries',
    label: 'Queries',
    category: 'server',
    summary:
      'Query orchestration across shards: sending sub-queries out and merging/sorting the results. ShardedQueryProcessor fans the query out as parallel per-shard commands through ShardExecutor, then merges the results - falling back to a not-modified response when nothing changed.',
    references: {
      docs: [
        { name: 'Sharding: Querying', url: 'https://docs.ravendb.net/7.2/sharding/querying/' },
        { name: 'Sharding: Indexing', url: 'https://docs.ravendb.net/7.2/sharding/indexing' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/Sharding/Queries', url: githubTreeUrl('src/Raven.Server/Documents/Sharding/Queries') }],
    },
    codeRef: {
      file: 'src/Raven.Server/Documents/Sharding/Queries/ShardedQueryProcessor.cs',
      startLine: 28,
      expectSymbol: 'class ShardedQueryProcessor',
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
    references: {
      docs: [
        { name: 'Index Administration', url: 'https://docs.ravendb.net/7.2/indexes/index-administration' },
        { name: 'Debugging Index Errors', url: 'https://docs.ravendb.net/7.2/indexes/troubleshooting/debugging-index-errors' },
        { name: 'Set Index Priority Operation', url: 'https://docs.ravendb.net/7.2/client-api/operations/maintenance/indexes/set-index-priority' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/Indexes/Index.cs', url: githubBlobUrl('src/Raven.Server/Documents/Indexes/Index.cs') }],
    },
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
    references: {
      docs: [
        { name: 'Query Overview (Dynamic Queries)', url: 'https://docs.ravendb.net/7.2/querying/overview' },
        { name: 'Creating and Deploying Indexes', url: 'https://docs.ravendb.net/7.2/indexes/creating-and-deploying/' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/Indexes/Auto', url: githubTreeUrl('src/Raven.Server/Documents/Indexes/Auto') }],
    },
    codeRef: {
      file: 'src/Raven.Server/Documents/Indexes/Auto/AutoMapIndex.cs',
      startLine: 21,
      expectSymbol: 'class AutoMapIndex',
    },
    parentId: 'indexing',
  },
  {
    id: 'indexing-static',
    label: 'Static indexes',
    category: 'indexing',
    summary:
      'User-defined index definitions, compiled from their map/reduce functions. IndexCompiler turns those functions into a generated .NET assembly at runtime, under a generated Static.Generated namespace; the in-memory assembly doesn\'t survive a restart, but the IndexCompilationCache still avoids recompiling the same definition twice within one running process.',
    references: {
      docs: [
        { name: 'Creating and Deploying Indexes', url: 'https://docs.ravendb.net/7.2/indexes/creating-and-deploying/' },
        { name: 'JavaScript Indexes', url: 'https://docs.ravendb.net/7.2/indexes/javascript-indexes' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/Indexes/Static', url: githubTreeUrl('src/Raven.Server/Documents/Indexes/Static') }],
    },
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
    references: {
      docs: [
        { name: 'Map-Reduce Indexes', url: 'https://docs.ravendb.net/7.2/indexes/map-reduce-indexes' },
        { name: 'Multi-Map-Reduce Indexes', url: 'https://docs.ravendb.net/7.2/indexes/multi-map-indexes/' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/Indexes/MapReduce', url: githubTreeUrl('src/Raven.Server/Documents/Indexes/MapReduce') }],
    },
    codeRef: {
      file: 'src/Raven.Server/Documents/Indexes/MapReduce/MapReduceIndexBase.cs',
      startLine: 24,
      expectSymbol: 'class MapReduceIndexBase',
    },
    parentId: 'indexing',
  },
  {
    id: 'indexing-workers',
    label: 'Workers',
    category: 'indexing',
    summary:
      'The staged workers of one indexing batch: map documents, handle references, clean up tombstones. Every worker implements the same IIndexingWork interface, so the batch loop can run them in a fixed order without knowing what each one actually does.',
    references: {
      docs: [
        { name: 'Tombstones: Overview', url: 'https://docs.ravendb.net/7.2/monitoring/tombstones/overview' },
        { name: 'Indexing Basics', url: 'https://docs.ravendb.net/7.2/indexes/indexing-basics' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/Indexes/Workers', url: githubTreeUrl('src/Raven.Server/Documents/Indexes/Workers') }],
    },
    codeRef: {
      file: 'src/Raven.Server/Documents/Indexes/Workers/IIndexingWork.cs',
      startLine: 8,
      expectSymbol: 'interface IIndexingWork',
    },
    parentId: 'indexing',
  },
  {
    id: 'indexing-persistence',
    label: 'Persistence',
    category: 'indexing',
    summary:
      'The seam between the indexing subsystem and a search engine - one implementation for Corax, one for Lucene. IndexPersistenceBase declares the abstract surface - opening writers and readers, cache publishing, cleanup - that both backends implement independently.',
    references: {
      docs: [
        { name: 'Search Engine: Corax', url: 'https://docs.ravendb.net/7.2/indexes/search-engine/corax' },
        { name: 'Filter with Lucene Syntax', url: 'https://docs.ravendb.net/7.2/querying/filtering-query-results/filter-with-lucene-syntax' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/Indexes/Persistence', url: githubTreeUrl('src/Raven.Server/Documents/Indexes/Persistence') }],
    },
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
    references: {
      docs: [
        { name: 'Vector Search using a Static Index', url: 'https://docs.ravendb.net/7.2/ai-integration/vector-search/vector-search-using-static-index' },
        { name: 'Vector Search using a Dynamic Query', url: 'https://docs.ravendb.net/7.2/ai-integration/vector-search/vector-search-using-dynamic-query' },
        { name: 'Connection String to bge-micro-v2 (Embedded)', url: 'https://docs.ravendb.net/7.2/ai-integration/connection-strings/embedded' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/Indexes/VectorSearch', url: githubTreeUrl('src/Raven.Server/Documents/Indexes/VectorSearch') }],
    },
    codeRef: {
      file: 'src/Raven.Server/Documents/Indexes/VectorSearch/GenerateEmbeddings.cs',
      startLine: 27,
      expectSymbol: 'class GenerateEmbeddings',
    },
    parentId: 'indexing',
  },

  // ---------------------------------------------------------------------
  // Micro nodes: Search engines
  // ---------------------------------------------------------------------
  {
    id: 'search-engines-corax',
    label: 'Corax',
    category: 'indexing',
    summary:
      'The in-house engine. Analyzer composes a tokenizer (ITokenizer) with transformers like lower-casing in a staged pipeline that can resume tokenization across steps; IndexWriter then builds the inverted index - explicitly single-threaded and caller-synchronized rather than internally locked - while IndexFieldsMapping resolves each field by Slice, string or integer id. IndexSearcher executes queries against that index, switching to a bitmap representation once a term\'s postings cross a 32MB threshold, trading memory for faster set operations.',
    references: {
      docs: [
        { name: 'Search Engine: Corax', url: 'https://docs.ravendb.net/7.2/indexes/search-engine/corax' },
        { name: 'Indexing Basics', url: 'https://docs.ravendb.net/7.2/indexes/indexing-basics' },
        { name: 'Query Overview', url: 'https://docs.ravendb.net/7.2/querying/overview' },
      ],
      source: [{ name: 'src/Corax', url: githubTreeUrl('src/Corax') }],
    },
    codeRef: {
      file: 'src/Corax/Indexing/IndexWriter.cs',
      startLine: 38,
      expectSymbol: 'class IndexWriter',
    },
    parentId: 'search-engines',
  },
  {
    id: 'search-engines-lucene',
    label: 'Lucene',
    category: 'indexing',
    summary:
      'The older, still fully supported engine. LuceneIndexPersistence layers Lucene\'s own IndexWriter and per-field suggestion writers on top of LuceneVoronDirectory, Lucene\'s Directory implementation on Voron, which refuses to be constructed outside a write transaction - so a Lucene-backed index still persists transactionally through Voron rather than the OS filesystem.',
    references: {
      docs: [
        { name: 'Indexes: Term Vectors', url: 'https://docs.ravendb.net/7.2/indexes/using-term-vectors' },
        { name: 'Filter with Lucene Syntax', url: 'https://docs.ravendb.net/7.2/querying/filtering-query-results/filter-with-lucene-syntax' },
        { name: 'Query by Facets', url: 'https://docs.ravendb.net/7.2/indexes/querying/faceted-search' },
      ],
      source: [
        { name: 'src/Raven.Server/Documents/Indexes/Persistence/Lucene', url: githubTreeUrl('src/Raven.Server/Documents/Indexes/Persistence/Lucene') },
        { name: 'src/Raven.Server/Indexing', url: githubTreeUrl('src/Raven.Server/Indexing') },
      ],
    },
    codeRef: {
      file: 'src/Raven.Server/Documents/Indexes/Persistence/Lucene/LuceneIndexPersistence.cs',
      startLine: 38,
      expectSymbol: 'class LuceneIndexPersistence',
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
    references: {
      docs: [
        { name: 'Cluster Topology', url: 'https://docs.ravendb.net/7.2/server/clustering/rachis/cluster-topology' },
        { name: "Rachis - RavenDB's Raft Implementation", url: 'https://docs.ravendb.net/7.2/server/clustering/rachis/what-is-rachis' },
        { name: 'Consensus Operations', url: 'https://docs.ravendb.net/7.2/server/clustering/rachis/consensus-operations/' },
      ],
      source: [{ name: 'src/Raven.Server/Rachis/Leader.cs', url: githubBlobUrl('src/Raven.Server/Rachis/Leader.cs') }],
    },
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
    references: {
      docs: [
        { name: 'Cluster Topology', url: 'https://docs.ravendb.net/7.2/server/clustering/rachis/cluster-topology' },
        { name: "Rachis - RavenDB's Raft Implementation", url: 'https://docs.ravendb.net/7.2/server/clustering/rachis/what-is-rachis' },
      ],
      source: [{ name: 'src/Raven.Server/Rachis/Follower.cs', url: githubBlobUrl('src/Raven.Server/Rachis/Follower.cs') }],
    },
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
    references: {
      docs: [
        { name: 'Cluster Topology', url: 'https://docs.ravendb.net/7.2/server/clustering/rachis/cluster-topology' },
        { name: "Rachis - RavenDB's Raft Implementation", url: 'https://docs.ravendb.net/7.2/server/clustering/rachis/what-is-rachis' },
      ],
      source: [{ name: 'src/Raven.Server/Rachis/Candidate.cs', url: githubBlobUrl('src/Raven.Server/Rachis/Candidate.cs') }],
    },
    codeRef: {
      file: 'src/Raven.Server/Rachis/Candidate.cs',
      startLine: 17,
      expectSymbol: 'class Candidate',
    },
    parentId: 'cluster',
  },
  {
    id: 'cluster-consensus',
    label: 'RachisConsensus',
    category: 'cluster',
    summary:
      'The core consensus engine and the abstraction that applies committed log entries to cluster state. RachisConsensus tracks the node\'s current role (Follower, Candidate, Leader) via a RachisState value and drives the transitions between them as elections happen and terms change.',
    references: {
      docs: [
        { name: "Rachis - RavenDB's Raft Implementation", url: 'https://docs.ravendb.net/7.2/server/clustering/rachis/what-is-rachis' },
        { name: 'Consensus Operations', url: 'https://docs.ravendb.net/7.2/server/clustering/rachis/consensus-operations/' },
        { name: 'Cluster: Overview', url: 'https://docs.ravendb.net/7.2/server/clustering/overview' },
      ],
      source: [{ name: 'src/Raven.Server/Rachis/RachisConsensus.cs', url: githubBlobUrl('src/Raven.Server/Rachis/RachisConsensus.cs') }],
    },
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
    references: {
      docs: [
        { name: 'Consensus Operations', url: 'https://docs.ravendb.net/7.2/server/clustering/rachis/consensus-operations/' },
        { name: 'Cluster-Wide Transactions', url: 'https://docs.ravendb.net/7.2/server/clustering/cluster-transactions/' },
        { name: 'Compare-Exchange Overview', url: 'https://docs.ravendb.net/7.2/compare-exchange/overview' },
      ],
      source: [{ name: 'src/Raven.Server/Rachis/Commands', url: githubTreeUrl('src/Raven.Server/Rachis/Commands') }],
    },
    codeRef: {
      file: 'src/Raven.Server/Rachis/Commands/CastVoteInTermCommand.cs',
      startLine: 8,
      expectSymbol: 'class CastVoteInTermCommand',
    },
    parentId: 'cluster',
  },
  {
    id: 'cluster-network',
    label: 'Wire Protocol',
    category: 'cluster',
    summary:
      'The messages nodes exchange: log replication, vote requests, snapshot install, the initial handshake. AppendEntries itself carries no log entries - just the term, the previous index/term to validate against, and how many RachisEntry records follow it on the wire.',
    references: {
      source: [{ name: 'src/Raven.Server/Rachis/AppendEntries.cs', url: githubBlobUrl('src/Raven.Server/Rachis/AppendEntries.cs') }],
    },
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
    references: {
      docs: [
        { name: 'Cluster: Overview', url: 'https://docs.ravendb.net/7.2/server/clustering/overview' },
        { name: 'External Replication', url: 'https://docs.ravendb.net/7.2/server/ongoing-tasks/external-replication' },
        { name: 'Replication Overview', url: 'https://docs.ravendb.net/7.2/server/clustering/replication/replication-overview' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/Replication/ReplicationLoader.cs', url: githubBlobUrl('src/Raven.Server/Documents/Replication/ReplicationLoader.cs') }],
    },
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
    references: {
      docs: [
        { name: 'Replication Overview', url: 'https://docs.ravendb.net/7.2/server/clustering/replication/replication-overview' },
        { name: 'Attachments and Other Features', url: 'https://docs.ravendb.net/7.2/document-extensions/attachments/attachments-and-other-features' },
        { name: 'Counters and Other Features', url: 'https://docs.ravendb.net/7.2/document-extensions/counters/counters-and-other-features' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/Replication/Outgoing', url: githubTreeUrl('src/Raven.Server/Documents/Replication/Outgoing') }],
    },
    codeRef: {
      file: 'src/Raven.Server/Documents/Replication/Outgoing/AbstractOutgoingReplicationHandler.cs',
      startLine: 47,
      expectSymbol: 'class AbstractOutgoingReplicationHandler',
    },
    parentId: 'replication',
  },
  {
    id: 'replication-incoming',
    label: 'Incoming',
    category: 'cluster',
    summary:
      'The receiving side: applies an incoming batch inside a write transaction and reports back. IncomingReplicationHandler raises separate DocumentsReceived, AttachmentStreamsReceived and Failed events so callers can react to a batch without polling.',
    references: {
      docs: [
        { name: 'Replication Overview', url: 'https://docs.ravendb.net/7.2/server/clustering/replication/replication' },
        { name: 'Replication Conflicts', url: 'https://docs.ravendb.net/7.2/server/clustering/replication/replication-conflicts' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/Replication/Incoming', url: githubTreeUrl('src/Raven.Server/Documents/Replication/Incoming') }],
    },
    codeRef: {
      file: 'src/Raven.Server/Documents/Replication/Incoming/IncomingReplicationHandler.cs',
      startLine: 35,
      expectSymbol: 'class IncomingReplicationHandler',
    },
    parentId: 'replication',
  },
  {
    id: 'replication-changevector',
    label: 'Change vectors',
    category: 'cluster',
    summary:
      'The per-node etag vector stamped on every write in DocumentsStorage, not something replication adds on top - replication (and Subscriptions, ETL, PeriodicBackup, RevisionsStorage) just reads the one already there to decide newer / older / conflict. Most entries carry a node tag encoded in base-26 (A-Z, then AA, AB, ...); four special tags - RAFT, TRXN, SINK and MOVE - are recognized as literal string constants instead, ahead of the numeric etag that follows.',
    references: {
      docs: [
        { name: 'Change Vectors', url: 'https://docs.ravendb.net/7.2/server/clustering/replication/change-vector' },
        { name: 'Replication Conflicts', url: 'https://docs.ravendb.net/7.2/server/clustering/replication/replication-conflicts' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/Replication/ChangeVectorParser.cs', url: githubBlobUrl('src/Raven.Server/Documents/Replication/ChangeVectorParser.cs') }],
    },
    codeRef: {
      file: 'src/Raven.Server/Documents/Replication/ChangeVectorParser.cs',
      startLine: 8,
      expectSymbol: 'class ChangeVectorParser',
    },
    parentId: 'replication',
  },
  {
    id: 'replication-conflicts',
    label: 'ConflictManager',
    category: 'cluster',
    summary:
      'Applies the configured conflict resolution when two nodes changed the same document concurrently. ConflictManager runs a fixed sequence of gates - HiLo special-case, identical-content merge, same-collection check, a scripted JavaScript resolver, then latest-wins (via ResolveConflictOnReplicationConfigurationChange) - falling back to a manual conflict only if none of them resolve it.',
    references: {
      docs: [
        { name: 'Replication Conflicts', url: 'https://docs.ravendb.net/7.2/server/clustering/replication/replication-conflicts' },
        { name: 'Change Vectors', url: 'https://docs.ravendb.net/7.2/server/clustering/replication/change-vector' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/Replication/ConflictManager.cs', url: githubBlobUrl('src/Raven.Server/Documents/Replication/ConflictManager.cs') }],
    },
    codeRef: {
      file: 'src/Raven.Server/Documents/Replication/ConflictManager.cs',
      startLine: 17,
      expectSymbol: 'class ConflictManager',
    },
    parentId: 'replication',
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
    references: {
      docs: [
        { name: 'Periodic Database Backup Tasks', url: 'https://docs.ravendb.net/7.2/backup/create/periodic-tasks/database-backup' },
        { name: 'Backup Overview', url: 'https://docs.ravendb.net/7.2/backup/overview' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/PeriodicBackup/BackupTask.cs', url: githubBlobUrl('src/Raven.Server/Documents/PeriodicBackup/BackupTask.cs') }],
    },
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
    references: {
      docs: [
        { name: 'Backup Overview', url: 'https://docs.ravendb.net/7.2/backup/overview' },
        { name: 'Periodic Database Backup Tasks', url: 'https://docs.ravendb.net/7.2/backup/create/periodic-tasks/database-backup' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/PeriodicBackup/BackupStatusStorage.cs', url: githubBlobUrl('src/Raven.Server/Documents/PeriodicBackup/BackupStatusStorage.cs') }],
    },
    codeRef: {
      file: 'src/Raven.Server/Documents/PeriodicBackup/BackupStatusStorage.cs',
      startLine: 21,
      expectSymbol: 'class BackupStatusStorage',
    },
    parentId: 'backup',
  },
  {
    id: 'backup-destinations',
    label: 'Destinations',
    category: 'server',
    summary:
      'The uploaders for each supported backup destination, plus direct upload/download paths. BackupUploader fires off one upload task per configured destination in parallel and joins on all of their background threads before reporting the backup complete.',
    references: {
      docs: [
        { name: 'Periodic Database Backup Tasks', url: 'https://docs.ravendb.net/7.2/backup/create/periodic-tasks/database-backup' },
        { name: 'Backup Configuration Options', url: 'https://docs.ravendb.net/7.2/backup/configuration' },
        { name: 'Backup Overview', url: 'https://docs.ravendb.net/7.2/backup/overview' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/PeriodicBackup/BackupUploader.cs', url: githubBlobUrl('src/Raven.Server/Documents/PeriodicBackup/BackupUploader.cs') }],
    },
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
    references: {
      docs: [
        { name: 'Restore from Backup', url: 'https://docs.ravendb.net/7.2/backup/restore' },
        { name: 'Backup Overview', url: 'https://docs.ravendb.net/7.2/backup/overview' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/PeriodicBackup/Restore', url: githubTreeUrl('src/Raven.Server/Documents/PeriodicBackup/Restore') }],
    },
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
    references: {
      docs: [
        { name: 'The Embeddings Generation Task', url: 'https://docs.ravendb.net/7.2/ai-integration/generating-embeddings/embeddings-generation-task/' },
        { name: 'Vector Search - Overview', url: 'https://docs.ravendb.net/7.2/ai-integration/vector-search/overview/' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/AI/Embeddings', url: githubTreeUrl('src/Raven.Server/Documents/AI/Embeddings') }],
    },
    codeRef: {
      file: 'src/Raven.Server/Documents/AI/Embeddings/EmbeddingsGenerator.cs',
      startLine: 37,
      expectSymbol: 'class EmbeddingsGenerator',
    },
    parentId: 'ai',
  },
  {
    id: 'ai-chunker',
    label: 'TextChunker',
    category: 'integration',
    summary:
      'Splits document text into chunks small enough to embed, before generation. TextChunker supports six chunking strategies - plain text, line-based, HTML-stripped, or Markdown, with or without paragraph awareness - all budgeted against a token count that already accounts for the configured prefix.',
    references: {
      docs: [{ name: 'The Embeddings Generation Task (Chunking Methods)', url: 'https://docs.ravendb.net/7.2/ai-integration/generating-embeddings/embeddings-generation-task/' }],
      source: [{ name: 'src/Raven.Server/Documents/AI/TextChunker.cs', url: githubBlobUrl('src/Raven.Server/Documents/AI/TextChunker.cs') }],
    },
    codeRef: {
      file: 'src/Raven.Server/Documents/AI/TextChunker.cs',
      startLine: 13,
      expectSymbol: 'class TextChunker',
    },
    parentId: 'ai',
  },
  {
    id: 'ai-chat',
    label: 'ChatCompletionClient',
    category: 'integration',
    summary:
      'The client for chat/completion calls to an external AI provider, including SSE streaming. It goes through a pooled HttpClient rather than opening a fresh connection per call, and is created through a factory that picks the right settings implementation - OpenAI, Azure OpenAI, Google, Ollama - for the connection string\'s provider.',
    references: {
      docs: [
        { name: 'Connection String to OpenAI and OpenAI-Compatible Providers', url: 'https://docs.ravendb.net/7.2/ai-integration/connection-strings/open-ai' },
        { name: 'Connection String to Azure OpenAI', url: 'https://docs.ravendb.net/7.2/ai-integration/connection-strings/azure-open-ai/' },
        { name: 'Connection String to Ollama', url: 'https://docs.ravendb.net/7.2/ai-integration/connection-strings/ollama' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/AI/ChatCompletionClient.cs', url: githubBlobUrl('src/Raven.Server/Documents/AI/ChatCompletionClient.cs') }],
    },
    codeRef: {
      file: 'src/Raven.Server/Documents/AI/ChatCompletionClient.cs',
      startLine: 41,
      expectSymbol: 'class ChatCompletionClient',
    },
    parentId: 'ai',
  },
  {
    id: 'ai-assistant',
    label: 'AiAssistant',
    category: 'integration',
    summary:
      'A license-gated proxy to RavenDB\'s own cloud-hosted assistant at api.ravendb.net, independent of ChatCompletionClient and the user\'s configured AI provider. AiAssistantHandler exposes separate endpoints for consent, usage and the actual assist call - the consent split lets the UI gate the feature before the first real request goes out.',
    references: {
      docs: [{ name: 'Studio AI Assistant', url: 'https://docs.ravendb.net/7.2/studio/ai-assistant' }],
      source: [{ name: 'src/Raven.Server/Documents/AI/AiAssistant', url: githubTreeUrl('src/Raven.Server/Documents/AI/AiAssistant') }],
    },
    codeRef: {
      file: 'src/Raven.Server/Documents/AI/AiAssistant/Handlers/AiAssistantHandler.cs',
      startLine: 11,
      expectSymbol: 'class AiAssistantHandler',
    },
    parentId: 'ai',
  },
  {
    id: 'ai-settings',
    label: 'Connection Strings',
    category: 'integration',
    summary:
      'Provider configuration: which AI service, which model, which credentials. AbstractChatCompletionClientSettings hides each provider\'s actual completions URL and request-shaping quirks, like whether it accepts strict tool schemas, behind the same virtual surface the chat client calls.',
    references: {
      docs: [
        { name: 'Connection String to OpenAI and OpenAI-Compatible Providers', url: 'https://docs.ravendb.net/7.2/ai-integration/connection-strings/open-ai' },
        { name: 'Connection String to bge-micro-v2 (Embedded)', url: 'https://docs.ravendb.net/7.2/ai-integration/connection-strings/embedded' },
        { name: 'Connection String to Google AI', url: 'https://docs.ravendb.net/7.2/ai-integration/connection-strings/google-ai/' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/AI/Settings', url: githubTreeUrl('src/Raven.Server/Documents/AI/Settings') }],
    },
    codeRef: {
      file: 'src/Raven.Server/Documents/AI/Settings/AbstractChatCompletionClientSettings.cs',
      startLine: 12,
      expectSymbol: 'class AbstractChatCompletionClientSettings',
    },
    parentId: 'ai',
  },

  // ---------------------------------------------------------------------
  // Micro nodes: ETL, Sinks, Integrations
  // ---------------------------------------------------------------------
  {
    id: 'etl-loader',
    label: 'EtlLoader',
    category: 'integration',
    summary:
      'Starts and supervises the ETL processes configured on a database. It tracks separately whether it\'s currently subscribed to document, counter or time-series changes, so it only pays for the change feeds a configured transformation script actually touches.',
    references: {
      docs: [
        { name: 'Ongoing Tasks: ETL Basics', url: 'https://docs.ravendb.net/7.2/server/ongoing-tasks/etl/basics' },
        { name: 'Ongoing Tasks: RavenDB ETL', url: 'https://docs.ravendb.net/7.2/server/ongoing-tasks/etl/raven' },
        { name: 'Ongoing Tasks: SQL ETL', url: 'https://docs.ravendb.net/7.2/server/ongoing-tasks/etl/sql/' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/ETL/EtlLoader.cs', url: githubBlobUrl('src/Raven.Server/Documents/ETL/EtlLoader.cs') }],
    },
    codeRef: {
      file: 'src/Raven.Server/Documents/ETL/EtlLoader.cs',
      startLine: 42,
      expectSymbol: 'class EtlLoader',
    },
    parentId: 'etl',
  },
  {
    id: 'etl-providers',
    label: 'ETL providers',
    category: 'integration',
    summary:
      'One implementation per destination: RavenDB, SQL (RelationalDatabase), OLAP, Elasticsearch, AI (embeddings generation), Kafka/RabbitMQ queues. RavenEtl is the RavenDB-to-RavenDB case, and is the only provider that keeps a dedicated RequestExecutor to the destination and re-creates it if the destination\'s server certificate changes mid-run - the others don\'t use mutual TLS, so they have no equivalent cert-rotation hook.',
    references: {
      docs: [
        { name: 'Ongoing Tasks: RavenDB ETL', url: 'https://docs.ravendb.net/7.2/server/ongoing-tasks/etl/raven' },
        { name: 'Ongoing Tasks: SQL ETL', url: 'https://docs.ravendb.net/7.2/server/ongoing-tasks/etl/sql/' },
        { name: 'OLAP ETL Task', url: 'https://docs.ravendb.net/7.2/studio/database/tasks/ongoing-tasks/olap-etl-task/' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/ETL/Providers', url: githubTreeUrl('src/Raven.Server/Documents/ETL/Providers') }],
    },
    codeRef: {
      file: 'src/Raven.Server/Documents/ETL/Providers/Raven/RavenEtl.cs',
      startLine: 23,
      expectSymbol: 'class RavenEtl',
    },
    parentId: 'etl',
  },
  {
    id: 'queue-sink',
    label: 'Queue Sink (inbound)',
    category: 'integration',
    summary:
      'The inbound direction: consuming Kafka / RabbitMQ messages into documents (Azure Queue Storage and Amazon SQS exist as configuration options but aren\'t actually supported yet - CreateInstance throws for them). QueueSinkLoader mirrors EtlLoader\'s shape almost exactly - one process array, one set of unique configuration names - just running the data transfer in the opposite direction.',
    references: {
      docs: [
        { name: 'Queue Sink: Apache Kafka', url: 'https://docs.ravendb.net/7.2/server/ongoing-tasks/queue-sink/kafka-queue-sink' },
        { name: 'Queue Sink: RabbitMQ', url: 'https://docs.ravendb.net/7.2/server/ongoing-tasks/queue-sink/rabbit-mq-queue-sink' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/QueueSink', url: githubTreeUrl('src/Raven.Server/Documents/QueueSink') }],
    },
    codeRef: {
      file: 'src/Raven.Server/Documents/QueueSink/QueueSinkLoader.cs',
      startLine: 21,
      expectSymbol: 'class QueueSinkLoader',
    },
    parentId: 'sinks',
  },
  {
    id: 'smuggler',
    label: 'Smuggler (import / export)',
    category: 'integration',
    summary:
      'Bulk import and export of a database, with sharding-aware companions sitting next to the main implementation. DatabaseSmuggler (Smuggler/Documents) is the non-sharded case; ShardedDatabaseSmuggler and SingleShardDatabaseSmuggler live right beside it for the sharded paths.',
    references: {
      docs: [
        { name: 'What is Smuggler', url: 'https://docs.ravendb.net/7.2/client-api/smuggler/what-is-smuggler' },
        { name: 'Sharding: Import and Export', url: 'https://docs.ravendb.net/7.2/sharding/import-and-export' },
      ],
      source: [{ name: 'src/Raven.Server/Smuggler', url: githubTreeUrl('src/Raven.Server/Smuggler') }],
    },
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
    references: {
      docs: [{ name: 'Import from SQL', url: 'https://docs.ravendb.net/7.2/studio/database/tasks/import-data/import-from-sql/' }],
      source: [{ name: 'src/Raven.Server/SqlMigration', url: githubTreeUrl('src/Raven.Server/SqlMigration') }],
    },
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
    references: {
      docs: [
        { name: 'PostgreSQL Protocol: Overview', url: 'https://docs.ravendb.net/7.2/integrations/postgresql-protocol/overview' },
        { name: 'PostgreSQL Protocol: Power BI', url: 'https://docs.ravendb.net/7.2/integrations/postgresql-protocol/power-bi' },
      ],
      source: [{ name: 'src/Raven.Server/Integrations/PostgreSQL', url: githubTreeUrl('src/Raven.Server/Integrations/PostgreSQL') }],
    },
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
    references: {
      docs: [
        { name: 'CDC Sink: Overview', url: 'https://docs.ravendb.net/7.2/server/ongoing-tasks/cdc-sink/overview' },
        { name: 'From Tables to Documents: Connecting PostgreSQL to RavenDB with CDC Sink', url: 'https://docs.ravendb.net/guides/cdc-sink-in-ravendb' },
      ],
      source: [{ name: 'src/Raven.Server/Documents/CdcSink', url: githubTreeUrl('src/Raven.Server/Documents/CdcSink') }],
    },
    codeRef: {
      file: 'src/Raven.Server/Documents/CdcSink/CdcSinkLoader.cs',
      startLine: 17,
      expectSymbol: 'class CdcSinkLoader',
    },
    parentId: 'sinks',
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
  { id: 'documents-indexing', source: 'documents-core', target: 'indexing', label: 'feeds' },
  { id: 'indexing-engines', source: 'indexing', target: 'search-engines', label: 'written through' },
  { id: 'documents-ai', source: 'documents-core', target: 'ai', label: 'embeddings tasks' },
  { id: 'ai-indexing', source: 'ai', target: 'indexing', label: 'vector fields' },
  { id: 'documents-storage', source: 'documents-core', target: 'storage', label: 'persists via' },
  { id: 'engines-storage', source: 'search-engines', target: 'storage', label: 'persists via' },
  { id: 'cluster-storage', source: 'cluster', target: 'storage', label: 'ACID Raft log' },
  { id: 'documents-etl', source: 'documents-core', target: 'etl', label: 'change feed' },
  { id: 'sinks-documents', source: 'sinks', target: 'documents-core', label: 'writes documents' },
  { id: 'documents-integrations', source: 'documents-core', target: 'integrations', label: 'bulk ops & migration' },
  { id: 'documents-replication', source: 'documents-core', target: 'replication', label: 'change feed' },
  { id: 'documents-backup', source: 'documents-core', target: 'backup', label: 'ongoing task' },
  { id: 'documents-cluster', source: 'documents-core', target: 'cluster', label: 'cluster-wide ops' },
  { id: 'storage-infra', source: 'storage', target: 'infra', label: 'built on' },
  { id: 'documents-infra', source: 'documents-core', target: 'infra', label: 'built on' },
  { id: 'documents-tx-merger', source: 'documents-core', target: 'core-tx-merger', label: 'batches writes' },
  { id: 'tx-merger-storage', source: 'core-tx-merger', target: 'storage', label: 'commits via' },
  { id: 'http-queries', source: 'http', target: 'core-queries', label: 'routes to' },
  { id: 'queries-documents', source: 'core-queries', target: 'documents-core', label: 'reads via' },
  { id: 'documents-subscriptions', source: 'documents-core', target: 'core-subscriptions', label: 'change feed' },
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
