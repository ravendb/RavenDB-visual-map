// Illustrative request/data flows through the macro architecture, used to
// animate "how does X actually happen" walkthroughs on top of the static map.
// Each step is a macro node id; consecutive steps must be connected by a real
// MapEdge in architecture.ts (validated by getFlowEdgeId below, and enforced by
// scripts/validate-content.ts) so a flow can never imply a relationship the map
// itself doesn't show.

export interface FlowStep {
  nodeId: string
  note: string
}

export interface Flow {
  id: string
  label: string
  description: string
  steps: FlowStep[]
}

export const FLOWS: Flow[] = [
  {
    id: 'document-write',
    label: 'Write a document',
    description: 'The core path a plain document write takes to reach durable storage.',
    steps: [
      { nodeId: 'client', note: 'The client SDK sends a document change (session.Store + SaveChanges).' },
      { nodeId: 'http', note: 'The HTTP layer routes the write to the right document handler.' },
      { nodeId: 'documents-core', note: 'DocumentsStorage validates the change and hands it to the TransactionMerger.' },
      { nodeId: 'core-tx-merger', note: 'TransactionMerger batches the write with other pending operations into one shared transaction.' },
      { nodeId: 'storage', note: 'The batch is committed as one Voron transaction and written to the journal.' },
    ],
  },
  {
    id: 'document-write-attachment',
    label: 'Write a document with an attachment',
    description: 'The same write path, plus what changes when the document carries a binary attachment.',
    steps: [
      { nodeId: 'client', note: 'The client SDK sends the document change together with the attachment stream (session.Advanced.Attachments.Store).' },
      { nodeId: 'http', note: 'The HTTP layer routes the write to the right document handler.' },
      {
        nodeId: 'documents-core',
        note: "DocumentsStorage writes the document JSON as usual; AttachmentsStorage stores the binary separately, keyed by a content hash - so identical attachments stored on several documents are kept once, not duplicated.",
      },
      { nodeId: 'core-tx-merger', note: 'The document PUT and the attachment PUT are batched into the same shared transaction, so both commit atomically or not at all.' },
      { nodeId: 'storage', note: 'Document, attachment, and hash-reference all commit in the one Voron transaction and are written to the journal together.' },
    ],
  },
  {
    id: 'query-index',
    label: 'Query an existing index',
    description: 'The path a query takes when it matches an index that already exists.',
    steps: [
      { nodeId: 'client', note: 'The client SDK sends an RQL query (session.Query<T>() or a raw query).' },
      { nodeId: 'http', note: 'The HTTP layer routes the request to the query handler.' },
      { nodeId: 'core-queries', note: 'AbstractQueryRunner parses the RQL and matches it against an existing static or auto-index - no new index is needed.' },
      { nodeId: 'documents-core', note: 'The database hands the parsed query to IndexStore to run it against the matched index.' },
      { nodeId: 'indexing', note: 'The matched index is already up to date, so the query can be answered from it immediately.' },
      { nodeId: 'search-engines', note: 'Corax or Lucene executes the query against the index and returns the matching entries.' },
      { nodeId: 'storage', note: "The index's pages are read back from Voron to build the result." },
    ],
  },
  {
    id: 'auto-indexing',
    label: 'Query with no matching index (auto-indexing)',
    description: 'How a query that matches no existing index gets one created for it on the fly.',
    steps: [
      { nodeId: 'client', note: 'The client SDK sends an RQL query shaped in a way no existing index covers.' },
      { nodeId: 'http', note: 'The HTTP layer routes the request to the query handler.' },
      { nodeId: 'core-queries', note: "AbstractQueryRunner parses the RQL and finds no static or auto-index that already matches it." },
      { nodeId: 'documents-core', note: 'The database hands the query to IndexStore, which creates a new auto-index definition for exactly this query shape, on demand.' },
      { nodeId: 'indexing', note: "The new auto-index runs its initial indexing pass over the collection's existing documents before the query can be answered from it." },
      { nodeId: 'search-engines', note: 'The auto-index is written through Corax or Lucene like any other index, static or automatic.' },
      { nodeId: 'storage', note: "The new index's pages are persisted through Voron as it catches up." },
    ],
  },
  {
    id: 'sharded-request',
    label: 'Request against a sharded database',
    description: 'How one client request is fanned out across shards and merged back.',
    steps: [
      { nodeId: 'client', note: 'The client talks to a sharded database exactly like a non-sharded one.' },
      { nodeId: 'http', note: 'Routing recognises the database as sharded and hands the request to the sharded handler.' },
      { nodeId: 'sharding', note: 'ShardLocator resolves the bucket(s); the executors fan the operation out and merge the per-shard results.' },
      { nodeId: 'documents-core', note: 'Each shard is a database of its own and serves its slice of the work.' },
      { nodeId: 'storage', note: 'Every shard commits into its own Voron environment.' },
    ],
  },
  {
    id: 'vector-search',
    label: 'Embeddings & vector search',
    description: 'How document text becomes a vector you can search by similarity.',
    steps: [
      { nodeId: 'documents-core', note: 'A document change is picked up by the embeddings ongoing task.' },
      { nodeId: 'ai', note: 'TextChunker splits the text and EmbeddingsGenerator asks the configured provider for vectors.' },
      { nodeId: 'vector-search', note: 'The vectors are indexed as fields, independent of whichever AI provider produced them.' },
      { nodeId: 'indexing', note: 'The vector field is written through the index like any other field.' },
      { nodeId: 'search-engines', note: 'The search engine stores the vector data and answers similarity queries against it.' },
      { nodeId: 'storage', note: 'Index and vector data are persisted through Voron.' },
    ],
  },
  {
    id: 'cluster-replication',
    label: 'Cluster-wide operation (Raft)',
    description: 'How an operation that affects cluster-wide state reaches the rest of the cluster.',
    steps: [
      { nodeId: 'client', note: 'The client sends a request that touches cluster-wide state (e.g. compare-exchange, a cluster transaction).' },
      { nodeId: 'http', note: 'The HTTP layer routes it to the right handler.' },
      { nodeId: 'documents-core', note: 'The database core raises it as a cluster-wide command instead of a local write.' },
      { nodeId: 'cluster', note: 'Rachis appends the command to the Raft log and commits it once a majority of nodes acknowledged it.' },
      { nodeId: 'storage', note: 'The Raft log itself lives in Voron, which is what makes it ACID.' },
    ],
  },
  {
    id: 'data-replication',
    label: 'Document replication between nodes',
    description: 'How document data (not cluster state) travels to the other members of a database group.',
    steps: [
      { nodeId: 'documents-core', note: 'A committed change is exposed on the internal change feed with its change vector.' },
      { nodeId: 'replication', note: 'The outgoing replication connection streams it to the destination, which applies it or raises a conflict.' },
    ],
  },
  {
    id: 'etl-export',
    label: 'ETL export to external systems',
    description: 'How ongoing changes reach an external database or queue via ETL.',
    steps: [
      { nodeId: 'documents-core', note: 'A document change is raised on the internal change feed.' },
      { nodeId: 'etl', note: 'The matching ETL process transforms it and streams it out to the destination system.' },
    ],
  },
  {
    id: 'backup-task',
    label: 'Periodic backup',
    description: 'How a scheduled backup of a database is produced.',
    steps: [
      { nodeId: 'documents-core', note: 'The scheduled backup task starts on the responsible node.' },
      { nodeId: 'backup', note: 'BackupTask writes a full or incremental backup (logical export or Voron snapshot) and uploads it to the configured destinations.' },
    ],
  },
]

export function getFlowEdgeId(sourceId: string, targetId: string, edges: { id: string; source: string; target: string }[]): string | undefined {
  return edges.find(
    (e) => (e.source === sourceId && e.target === targetId) || (e.source === targetId && e.target === sourceId),
  )?.id
}
