import type { NodeCategory } from '../data/architecture'

// Derived from the real ravendb.net brand palette (--brand-blue, --brand-purple,
// --brand-turquoise, ... pulled from the site's own CSS custom properties), then
// re-spaced in OKLCH so the categories stay tell-apart-able (see the dataviz
// palette validator) and every badge keeps enough contrast for the white label
// text on top of it, while each hue is kept close to an actual brand/accent
// color found on the site. `infra` is the one deliberate exception: it's
// brand-carbon-gray, used as-is, because "infra" is meant to read as
// neutral/foundational rather than a distinct feature color.
export const CATEGORY_COLORS: Record<NodeCategory, string> = {
  client: '#2576c9',
  server: '#7151d3',
  storage: '#a74a00',
  indexing: '#0086a4',
  cluster: '#b0419d',
  studio: '#00866e',
  infra: '#545557',
  integration: '#706600',
  security: '#bd2c49',
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
