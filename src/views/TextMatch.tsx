import { useMemo, useState } from 'react'
import { BY_ID, CONCEPTS, FACET_ORDER, facetColor, shortFacet } from '../data'
import { openConcept } from '../router'
import { ConceptChip, PageHead, useTip } from '../components/ui'

const SAMPLE =
  'Smallholder farmers in drought-prone areas adopted drought-tolerant maize varieties and conservation agriculture. ' +
  'The project also set up an early warning system, trained extension agents on climate information services, ' +
  'and supported index insurance for women and youth. Agroforestry plots increased soil organic carbon and reduced methane emissions from livestock.'

interface Pat { re: string; id: string; text: string; syn: boolean }
const PATTERNS: Pat[] = (() => {
  const out: Pat[] = []
  const seen = new Set<string>()
  for (const c of CONCEPTS) {
    for (const [t, syn] of [[c.label, false] as const, ...c.syn.map((s) => [s, true] as const)]) {
      const k = t.trim().toLowerCase()
      if (k.length < 3 || seen.has(k + '|' + c.id)) continue
      seen.add(k + '|' + c.id)
      out.push({ re: k, id: c.id, text: t, syn })
    }
  }
  // longest first, so "drought-tolerant maize" wins over "maize"
  return out.sort((a, b) => b.re.length - a.re.length)
})()

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

interface Hit { start: number; end: number; ids: string[]; via: { id: string; text: string; syn: boolean }[] }

function findHits(text: string): Hit[] {
  const lower = text.toLowerCase()
  const taken = new Uint8Array(text.length)
  const hits: Hit[] = []
  const byKey = new Map<string, Pat[]>()
  for (const p of PATTERNS) {
    if (!byKey.has(p.re)) byKey.set(p.re, [])
    byKey.get(p.re)!.push(p)
  }
  for (const [key, pats] of byKey) {
    if (!lower.includes(key)) continue
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${esc(key)}(?![\\p{L}\\p{N}])`, 'giu')
    let m: RegExpExecArray | null
    while ((m = re.exec(lower))) {
      const s = m.index, e = s + m[0].length
      let free = true
      for (let i = s; i < e; i++) if (taken[i]) { free = false; break }
      if (!free) continue
      for (let i = s; i < e; i++) taken[i] = 1
      hits.push({ start: s, end: e, ids: [...new Set(pats.map((p) => p.id))], via: pats.map((p) => ({ id: p.id, text: p.text, syn: p.syn })) })
    }
  }
  return hits.sort((a, b) => a.start - b.start)
}

export default function TextMatch() {
  const [text, setText] = useState(SAMPLE)
  const tip = useTip()
  const hits = useMemo(() => findHits(text), [text])
  const matched = useMemo(() => {
    const m = new Map<string, number>()
    hits.forEach((h) => h.ids.forEach((id) => m.set(id, (m.get(id) ?? 0) + 1)))
    return m
  }, [hits])
  const byFacet = FACET_ORDER.map((f) => [f, [...matched.keys()].filter((id) => BY_ID.get(id)!.facet === f)] as const).filter(([, ids]) => ids.length)

  const parts: React.ReactNode[] = []
  let last = 0
  hits.forEach((h, i) => {
    if (h.start > last) parts.push(text.slice(last, h.start))
    const c = BY_ID.get(h.ids[0])!
    parts.push(
      <mark
        key={i}
        style={{ borderColor: facetColor(c.facet) }}
        tabIndex={0}
        role="button"
        onClick={() => openConcept(c.id)}
        onKeyDown={(e) => e.key === 'Enter' && openConcept(c.id)}
        onMouseMove={(e) =>
          tip.show(
            e,
            h.ids.map((id) => BY_ID.get(id)!.label).join(' / '),
            <>
              {h.via.map((v, j) => (
                <div key={j}>
                  {shortFacet(BY_ID.get(v.id)!.facet)}, {v.id}: matched the {v.syn ? `synonym “${v.text}”` : 'concept label'}
                </div>
              ))}
            </>,
          )
        }
        onMouseLeave={tip.hide}
      >
        {text.slice(h.start, h.end)}
      </mark>,
    )
    last = h.end
  })
  if (last < text.length) parts.push(text.slice(last))

  return (
    <div className="stack">
      <PageHead
        title="Find concepts in a text"
        lede="Paste a paragraph, such as a result description. Simple label and synonym matching, no AI: exact, case-insensitive, whole-word matches of concept labels and synonyms, longest match first. Nothing leaves your browser."
      />
      <div className="grid-2">
        <div className="panel">
          <label htmlFor="tm-input" className="h-sec block mb-2">Your text</label>
          <textarea
            id="tm-input"
            className="input w-full"
            style={{ height: 260, padding: 12, lineHeight: 1.6, resize: 'vertical' }}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex gap-2 mt-2">
            <button className="btn" onClick={() => setText(SAMPLE)}>Use the sample text</button>
            <button className="btn" onClick={() => setText('')}>Clear</button>
          </div>
        </div>
        <div className="panel">
          <h2 className="h-sec mb-2">Matches highlighted</h2>
          <div className="textmatch" aria-live="polite">{text ? parts : <span className="muted">Paste or type a text on the left.</span>}</div>
        </div>
      </div>
      <div className="panel">
        <h2 className="h-sec">Matched concepts by facet</h2>
        <p className="sub mb-3">{matched.size} concepts matched in {hits.length} places.</p>
        {byFacet.length === 0 && <p className="muted text-[13px]">No concept label or synonym appears in this text.</p>}
        <div className="flex flex-col gap-3">
          {byFacet.map(([f, ids]) => (
            <div key={f} className="grid gap-3 items-start" style={{ gridTemplateColumns: '170px 1fr' }}>
              <div className="flex items-center gap-2 text-[13px]"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: facetColor(f) }} /> {f} <span className="muted num">{ids.length}</span></div>
              <div className="flex flex-wrap gap-1.5">{ids.map((id) => <ConceptChip key={id} id={id} />)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
