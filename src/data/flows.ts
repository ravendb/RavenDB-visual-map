// Illustrative request/data flows through the macro architecture, used to
// animate "how does X actually happen" walkthroughs on top of the static map.
// Each step is a macro node id; consecutive steps must be connected by a real
// MapEdge in architecture.ts (validated by getFlowEdge below) so a flow can
// never imply a relationship the map itself doesn't show.

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
    id: 'auto-indexing',
    label: 'Auto-indexing on write',
    description: "How a document change makes it from the client into a searchable index.",
    steps: [
      { nodeId: 'client', note: 'The client SDK sends a document change (session.Store + SaveChanges).' },
      { nodeId: 'http', note: 'The HTTP layer routes the write to the right document handler.' },
      { nodeId: 'documents-core', note: 'DocumentsStorage persists the change and feeds it onward.' },
      { nodeId: 'indexing', note: 'Corax picks up the change and updates the relevant auto-indexes.' },
      { nodeId: 'storage', note: 'The updated index pages are persisted through the Voron storage engine.' },
    ],
  },
  {
    id: 'document-write',
    label: 'Document write & persistence',
    description: 'The core path a plain document write takes to reach durable storage.',
    steps: [
      { nodeId: 'client', note: 'The client SDK sends a document change (session.Store + SaveChanges).' },
      { nodeId: 'http', note: 'The HTTP layer routes the write to the right document handler.' },
      { nodeId: 'documents-core', note: 'DocumentsStorage validates and applies the change.' },
      { nodeId: 'storage', note: 'The change is persisted through the Voron storage engine.' },
    ],
  },
  {
    id: 'cluster-replication',
    label: 'Cluster-wide replication',
    description: 'How a write that affects cluster-wide state reaches the rest of the cluster.',
    steps: [
      { nodeId: 'client', note: 'The client SDK sends a request that touches cluster-wide state.' },
      { nodeId: 'http', note: 'The HTTP layer routes it to the right handler.' },
      { nodeId: 'documents-core', note: 'The database core raises it as a cluster-wide operation.' },
      { nodeId: 'cluster', note: 'Rachis replicates the command to the rest of the cluster via Raft consensus.' },
    ],
  },
  {
    id: 'etl-export',
    label: 'ETL export to external systems',
    description: 'How ongoing changes reach an external database via ETL.',
    steps: [
      { nodeId: 'documents-core', note: 'A document change is raised on the internal change feed.' },
      { nodeId: 'integrations', note: 'An ETL process picks it up and streams it out to the destination system.' },
    ],
  },
]

export function getFlowEdgeId(sourceId: string, targetId: string, edges: { id: string; source: string; target: string }[]): string | undefined {
  return edges.find(
    (e) => (e.source === sourceId && e.target === targetId) || (e.source === targetId && e.target === sourceId),
  )?.id
}
