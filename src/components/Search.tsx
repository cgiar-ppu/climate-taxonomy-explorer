import MiniSearch from 'minisearch'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CONCEPTS, BY_ID, facetColor, shortFacet, type Concept } from '../data'
import { openConcept } from '../router'
import { Highlight } from './ui'

let index: MiniSearch | null = null
export function getIndex() {
  if (!index) {
    index = new MiniSearch({
      fields: ['label', 'syn', 'def', 'id'],
      storeFields: ['id'],
      extractField: (doc: any, f: string) => (f === 'syn' ? (doc.syn as string[]).join(' ; ') : doc[f]),
      searchOptions: { boost: { label: 4, id: 4, syn: 2, def: 0.6 }, prefix: true, fuzzy: 0.18, combineWith: 'AND' },
    })
    index.addAll(CONCEPTS)
  }
  return index
}

export function searchConcepts(q: string, limit = 50): Concept[] {
  const s = q.trim()
  if (!s) return []
  const exactId = BY_ID.get(s.toUpperCase())
  let res = getIndex().search(s).map((r) => BY_ID.get(r.id as string)!)
  if (!res.length) res = getIndex().search(s, { combineWith: 'OR' }).map((r) => BY_ID.get(r.id as string)!)
  // exact label or synonym matches first, then labels that start with the query, then MiniSearch order
  const sl = s.toLowerCase()
  const tier = (c: Concept) => (c.label.toLowerCase() === sl ? 0 : c.syn.some((x) => x.toLowerCase() === sl) ? 1 : c.label.toLowerCase().startsWith(sl) ? 2 : 3)
  res = res.map((c, i) => [c, i] as const).sort((a, b) => tier(a[0]) - tier(b[0]) || a[1] - b[1]).map((x) => x[0])
  if (exactId) res = [exactId, ...res.filter((c) => c.id !== exactId.id)]
  return res.slice(0, limit)
}

function matchedSyn(c: Concept, q: string) {
  const t = q.trim().toLowerCase()
  if (!t || c.label.toLowerCase().includes(t)) return null
  return c.syn.find((s) => s.toLowerCase().includes(t)) ?? null
}

export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const results = useMemo(() => searchConcepts(q, 40), [q])

  useEffect(() => {
    if (open) {
      setSel(0)
      setQ('')
    }
  }, [open])
  useEffect(() => setSel(0), [q])
  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${sel}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  if (!open) return null
  const pick = (c: Concept) => {
    onClose()
    openConcept(c.id)
  }
  return (
    <div className="pal-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pal" role="dialog" aria-modal="true" aria-label="Search concepts">
        <input
          ref={inputRef}
          autoFocus
          value={q}
          placeholder="Search 739 concepts by name, synonym, definition or ID"
          aria-label="Search concepts"
          role="combobox"
          aria-expanded="true"
          aria-controls="pal-list"
          aria-activedescendant={results[sel] ? `pal-${results[sel].id}` : undefined}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose()
            else if (e.key === 'ArrowDown') {
              e.preventDefault()
              setSel((s) => Math.min(s + 1, results.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setSel((s) => Math.max(s - 1, 0))
            } else if (e.key === 'Enter' && results[sel]) pick(results[sel])
          }}
        />
        <div className="pal-list" id="pal-list" role="listbox" ref={listRef}>
          {!q.trim() && <div className="p-4 muted text-[13px]">Type a word such as drought, insurance, rice or methane. Use the arrow keys and Enter to open a concept.</div>}
          {q.trim() && !results.length && <div className="p-4 muted text-[13px]">No concept matches “{q}”. Try a shorter word or a synonym.</div>}
          {results.map((c, i) => {
            const syn = matchedSyn(c, q)
            return (
              <div
                key={c.id}
                id={`pal-${c.id}`}
                data-i={i}
                role="option"
                aria-selected={i === sel}
                className="pal-item"
                onMouseEnter={() => setSel(i)}
                onClick={() => pick(c)}
              >
                <span className="dot mt-[7px]" style={{ width: 9, height: 9, borderRadius: 9, background: facetColor(c.facet), flex: 'none' }} />
                <div className="min-w-0 flex-1">
                  <div className="flex gap-2 items-baseline">
                    <span className="font-medium"><Highlight text={c.label} q={q} /></span>
                    <span className="idtag">{c.id}</span>
                    <span className="idtag ml-auto whitespace-nowrap">{shortFacet(c.facet)} · L{c.level}</span>
                  </div>
                  {syn && <div className="text-[12px] muted">synonym: <Highlight text={syn} q={q} /></div>}
                  <div className="pd">{c.def}</div>
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex gap-4 px-4 py-2 text-[11.5px] muted" style={{ borderTop: '1px solid var(--line)' }}>
          <span><span className="kbd">↑</span> <span className="kbd">↓</span> move</span>
          <span><span className="kbd">Enter</span> open</span>
          <span><span className="kbd">Esc</span> close</span>
          <span className="ml-auto">{q.trim() ? `${results.length}${results.length === 40 ? '+' : ''} matches` : ''}</span>
        </div>
      </div>
    </div>
  )
}
