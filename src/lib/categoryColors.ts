import type { NodeCategory } from '../data/architecture'

export const CATEGORY_COLORS: Record<NodeCategory, string> = {
  client: '#2563eb',
  server: '#7c3aed',
  storage: '#b45309',
  indexing: '#0f766e',
  cluster: '#be123c',
  studio: '#4338ca',
  infra: '#57534e',
  integration: '#0369a1',
  security: '#a16207',
}

export const CATEGORY_LABELS: Record<NodeCategory, string> = {
  client: 'Client',
  server: 'Server',
  storage: 'Storage',
  indexing: 'Indexing',
  cluster: 'Cluster',
  studio: 'Studio',
  infra: 'Infra',
  integration: 'Integration',
  security: 'Security',
}
