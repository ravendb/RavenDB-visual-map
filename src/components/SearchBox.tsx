import { useMemo, useState } from 'react'
import { nodes } from '../data/architecture'

interface SearchBoxProps {
  onJumpTo: (nodeId: string) => void
}

export default function SearchBox({ onJumpTo }: SearchBoxProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return nodes
      .filter(
        (n) =>
          n.label.toLowerCase().includes(q) ||
          n.references.source.some((link) => link.name.toLowerCase().includes(q)),
      )
      .slice(0, 8)
  }, [query])

  return (
    <div className="search-box">
      <input
        type="text"
        placeholder="Search a component (e.g. attachments, cluster, Voron)…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && results.length > 0 && (
        <ul className="search-box__results">
          {results.map((n) => (
            <li key={n.id}>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onJumpTo(n.id)
                  setQuery('')
                  setOpen(false)
                }}
              >
                <strong>{n.label}</strong>
                <span>{n.references.source.map((link) => link.name).join(', ')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
