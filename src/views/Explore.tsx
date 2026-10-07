import { useEffect, useMemo, useState } from 'react'
import { BY_ID, CONCEPTS, FACET_ORDER, fmt, officialUrl, RULES, shortFacet, VOCAB, type Concept } from '../data'
import { openConcept, replaceParams } from '../router'
import { FacetDot, Highlight, Icon, PageHead } from '../components/ui'

interface Dim { key: string; label: string; get: (c: Concept) => string | string[]; order: string[]; fmt?: (v: string) => string }
const yesNo = (b: boolean) => (b ? 'Yes' : 'No')
const SRC_ORDER = [...new Set(CONCEPTS.map((c) => c.srcFamily))].sort()

const DIMS: Dim[] = [
  { key: 'facet', label: 'Facet', get: (c) => c.facet, order: FACET_ORDER },
  { key: 'level', label: 'Level', get: (c) => String(c.level), order: VOCAB.levels.map((l) => l.name.slice(1)), fmt: (v) => `Level ${v}` },
  { key: 'scope', label: 'Climate scope', get: (c) => c.scope, order: VOCAB.scopes.map((s) => s.name) },
  { key: 'atag', label: 'Adaptation tag', get: (c) => c.aTag, order: VOCAB.adaptationTags.map((s) => s.name) },
  { key: 'mtag', label: 'Mitigation tag', get: (c) => c.mTag, order: VOCAB.mitigationTags.map((s) => s.name) },
  { key: 'domain', label: 'Domain', get: (c) => c.domain, order: VOCAB.domains.map((s) => s.name) },
  { key: 'impact', label: 'Impact area', get: (c) => c.impact, order: VOCAB.impactAreas.map((s) => s.name) },
  { key: 'stage', label: 'Pathway stage', get: (c) => c.stage, order: VOCAB.pathwayStages.map((s) => s.name) },
  { key: 'prov', label: 'Provenance class', get: (c) => c.prov, order: VOCAB.provClasses },
  { key: 'src', label: 'Definition source family', get: (c) => c.srcFamily, order: SRC_ORDER },
  { key: 'rel', label: 'Has typed relations', get: (c) => yesNo(c.rels.length + c.inRels.length > 0), order: ['Yes', 'No'] },
  { key: 'ex', label: 'Has a CGIAR example', get: (c) => yesNo(!!c.example.trim()), order: ['Yes', 'No'] },
  { key: 'flag', label: 'Anchors and hazards', get: (c) => [c.anchorA ? 'anchorA' : '', c.anchorM ? 'anchorM' : '', c.hazard ? 'hazard' : ''].filter(Boolean), order: ['anchorA', 'anchorM', 'hazard'], fmt: (v) => ({ anchorA: 'Adaptation anchor', anchorM: 'Mitigation anchor', hazard: 'Climate hazard' })[v] ?? v },
  { key: 'arule', label: 'Adaptation rule', get: (c) => RULES.adaptation.find((r) => r.text === c.aCond)?.subject ?? '', order: RULES.adaptation.map((r) => r.subject), fmt: (v) => `${v} rule` },
  { key: 'mrule', label: 'Mitigation rule', get: (c) => RULES.mitigation.find((r) => r.text === c.mCond)?.subject ?? '', order: RULES.mitigation.map((r) => r.subject), fmt: (v) => `${v} rule` },
]
const DIM = Object.fromEntries(DIMS.map((d) => [d.key, d]))
const DEFAULT_OPEN = new Set(['facet', 'level', 'scope', 'atag', 'mtag'])

type Sel = Record<string, Set<string>>
const has = (d: Dim, c: Concept, set: Set<string>) => {
  const v = d.get(c)
  return Array.isArray(v) ? v.some((x) => set.has(x)) : set.has(v)
}
const COLS: { key: string; label: string; get: (c: Concept) => string | number }[] = [
  { key: 'id', label: 'ID', get: (c) => c.id },
  { key: 'label', label: 'Concept', get: (c) => c.label.toLowerCase() },
  { key: 'facet', label: 'Facet', get: (c) => FACET_ORDER.indexOf(c.facet) },
  { key: 'level', label: 'Level', get: (c) => c.level },
  { key: 'scope', label: 'Scope', get: (c) => c.scope },
  { key: 'atag', label: 'Adaptation', get: (c) => c.aTag },
  { key: 'mtag', label: 'Mitigation', get: (c) => c.mTag },
  { key: 'domain', label: 'Domain', get: (c) => c.domain },
  { key: 'syn', label: 'Synonyms', get: (c) => c.syn.length },
  { key: 'rels', label: 'Relations', get: (c) => c.rels.length + c.inRels.length },
]

export default function Explore({ params }: { params: URLSearchParams }) {
  const [sel, setSel] = useState<Sel>(() => {
    const s: Sel = {}
    for (const d of DIMS) {
      const v = params.getAll(d.key)
      if (v.length) s[d.key] = new Set(v)
    }
    return s
  })
  const [q, setQ] = useState(params.get('q') ?? '')
  const [sort, setSort] = useState<{ k: string; dir: 1 | -1 }>(() => ({ k: params.get('sort') ?? 'facet', dir: params.get('dir') === 'desc' ? -1 : 1 }))
  const [open, setOpen] = useState<Set<string>>(() => new Set([...DEFAULT_OPEN, ...Object.keys(sel)]))
  const [limit, setLimit] = useState(200)

  useEffect(() => {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    for (const d of DIMS) sel[d.key]?.forEach((v) => p.append(d.key, v))
    if (sort.k !== 'facet') p.set('sort', sort.k)
    if (sort.dir === -1) p.set('dir', 'desc')
    replaceParams('explore', p)
    setLimit(200)
  }, [sel, q, sort])

  const tokens = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const textOk = (c: Concept) => {
    if (!tokens.length) return true
    const hay = (c.id + ' ' + c.label + ' ' + c.syn.join(' ') + ' ' + c.def).toLowerCase()
    return tokens.every((t) => hay.includes(t))
  }
  const passExcept = (c: Concept, skip: string | null) => {
    for (const d of DIMS) {
      if (d.key === skip) continue
      const s = sel[d.key]
      if (s && s.size && !has(d, c, s)) return false
    }
    return true
  }
  const textMatched = useMemo(() => CONCEPTS.filter(textOk), [q])
  const rows = useMemo(() => {
    const r = textMatched.filter((c) => passExcept(c, null))
    const col = COLS.find((c) => c.key === sort.k) ?? COLS[2]
    return r.sort((a, b) => {
      const va = col.get(a), vb = col.get(b)
      const cmp = va < vb ? -1 : va > vb ? 1 : 0
      return cmp * sort.dir || (tokens.length ? rank(b) - rank(a) : 0) || a.label.localeCompare(b.label)
    })
  }, [textMatched, sel, sort])
  function rank(c: Concept) {
    const l = c.label.toLowerCase()
    return tokens.every((t) => l.includes(t)) ? 2 : tokens.every((t) => c.syn.join(' ').toLowerCase().includes(t)) ? 1 : 0
  }

  const toggle = (k: string, v: string) =>
    setSel((s) => {
      const ns = { ...s, [k]: new Set(s[k] ?? []) }
      if (ns[k].has(v)) ns[k].delete(v)
      else ns[k].add(v)
      if (!ns[k].size) delete ns[k]
      return ns
    })
  const activeCount = Object.values(sel).reduce((a, s) => a + s.size, 0)

  const exportCsv = () => {
    const head = ['id', 'concept', 'facet', 'level', 'parent_id', 'parent', 'climate_scope', 'adaptation_tag', 'mitigation_tag', 'domain', 'impact_area', 'pathway_stage', 'synonyms', 'definition', 'definition_source', 'provenance_classes', 'typed_relations_out', 'cgiar_example', 'official_page']
    const esc = (v: string | number) => {
      const s = String(v ?? '')
      return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
    }
    const lines = [head.join(',')]
    for (const c of rows)
      lines.push(
        [c.id, c.label, c.facet, c.level, c.parent ?? '', c.parent ? BY_ID.get(c.parent)!.label : '', c.scope, c.aTag, c.mTag, c.domain, c.impact, c.stage, c.syn.join('; '), c.def, c.defSrc, c.prov.join('; '), c.rels.map((r) => `${r.t}: ${r.to}`).join('; '), c.example, officialUrl(c.id)]
          .map(esc)
          .join(','),
      )
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `climate-taxonomy-v5-concepts-${rows.length}.csv`
    document.body.appendChild(a)
    a.click()
    setTimeout(() => {
      URL.revokeObjectURL(a.href)
      a.remove()
    }, 500)
  }

  return (
    <div>
      <PageHead
        title="Explore"
        lede="Filter, search and sort all concepts. Counts next to each option show how many concepts you would get by adding it. The address bar keeps your filters, so you can share the link."
      />
      <div className="grid gap-4" style={{ gridTemplateColumns: '270px minmax(0, 1fr)' }} data-exp-grid>
        <aside className="panel" style={{ padding: 12, alignSelf: 'start', position: 'sticky', top: 70, maxHeight: 'calc(100vh - 86px)', overflowY: 'auto' }} aria-label="Filters">
          <div className="flex items-center justify-between mb-1 px-1">
            <span className="text-[13px] font-semibold">Filters</span>
            {activeCount > 0 && <button className="link text-[12px]" onClick={() => setSel({})}>Clear {activeCount}</button>}
          </div>
          {DIMS.map((d) => {
            const isOpen = open.has(d.key)
            const base = textMatched.filter((c) => passExcept(c, d.key))
            const counts = new Map<string, number>()
            for (const c of base) {
              const v = d.get(c)
              for (const x of Array.isArray(v) ? v : [v]) if (x) counts.set(x, (counts.get(x) ?? 0) + 1)
            }
            const n = sel[d.key]?.size ?? 0
            return (
              <div key={d.key} style={{ borderTop: '1px solid var(--line)' }} className="py-1">
                <button
                  className="w-full flex items-center gap-1.5 px-1 py-1.5 text-[13px] text-left"
                  style={{ background: 'none', border: 0 }}
                  aria-expanded={isOpen}
                  onClick={() => setOpen((o) => { const s = new Set(o); if (s.has(d.key)) s.delete(d.key); else s.add(d.key); return s })}
                >
                  <Icon name={isOpen ? 'chevD' : 'chevR'} size={14} />
                  <span className="flex-1">{d.label}</span>
                  {n > 0 && <span className="chip" style={{ height: 20 }}>{n}</span>}
                </button>
                {isOpen && (
                  <div className="flex flex-col pb-1">
                    {d.order.filter((v, i, a) => a.indexOf(v) === i).map((v) => {
                      const cnt = counts.get(v) ?? 0
                      const checked = sel[d.key]?.has(v) ?? false
                      return (
                        <label key={v} className="flex items-center gap-2 px-2 py-[3px] rounded text-[12.5px] cursor-pointer hover:bg-[color:var(--panel-2)]" style={{ opacity: cnt || checked ? 1 : 0.45 }}>
                          <input type="checkbox" checked={checked} onChange={() => toggle(d.key, v)} style={{ accentColor: 'var(--accent)' }} />
                          {d.key === 'facet' && <FacetDot facet={v} />}
                          <span className="flex-1 truncate" title={d.fmt ? d.fmt(v) : v}>{d.fmt ? d.fmt(v) : d.key === 'facet' ? shortFacet(v) : v}</span>
                          <span className="num muted text-[11.5px]">{cnt}</span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </aside>
        <section className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="relative flex-1" style={{ minWidth: 240 }}>
              <input className="input w-full" style={{ paddingLeft: 32, height: 38 }} placeholder="Search concept, synonyms, definition or ID" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the table" data-testid="explore-search" />
              <span className="absolute left-2.5 top-[11px] muted"><Icon name="search" size={15} /></span>
            </div>
            <span className="text-[13px] num" data-testid="explore-count"><b>{fmt(rows.length)}</b> <span className="muted">of {fmt(CONCEPTS.length)} concepts</span></span>
            <button className="btn" onClick={exportCsv} disabled={!rows.length}><Icon name="down" size={14} /> Export CSV</button>
          </div>
          {activeCount > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {DIMS.flatMap((d) =>
                [...(sel[d.key] ?? [])].map((v) => (
                  <button key={d.key + v} className="chip" aria-pressed="true" onClick={() => toggle(d.key, v)} aria-label={`Remove filter ${d.label}: ${v}`}>
                    <span className="muted">{d.label}:</span> <span className="t">{d.fmt ? d.fmt(v) : v}</span> <Icon name="close" size={12} />
                  </button>
                )),
              )}
            </div>
          )}
          <div className="tbl-wrap" style={{ maxHeight: 'calc(100vh - 210px)' }}>
            <table className="tbl">
              <thead>
                <tr>
                  {COLS.map((c) => (
                    <th key={c.key} aria-sort={sort.k === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                      <button onClick={() => setSort((s) => ({ k: c.key, dir: s.k === c.key ? ((-s.dir) as 1 | -1) : 1 }))}>
                        {c.label}
                        <span className="muted" style={{ width: 10 }}>{sort.k === c.key ? (sort.dir === 1 ? '▲' : '▼') : ''}</span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, limit).map((c) => (
                  <tr key={c.id} onClick={() => openConcept(c.id)} style={{ cursor: 'pointer' }}>
                    <td className="idtag whitespace-nowrap">{c.id}</td>
                    <td style={{ minWidth: 220 }}>
                      <button className="link text-left" onClick={(e) => { e.stopPropagation(); openConcept(c.id) }}><Highlight text={c.label} q={q} /></button>
                      {tokens.length > 0 && !tokens.every((t) => c.label.toLowerCase().includes(t)) && (
                        <div className="text-[12px] muted">{matchHint(c, tokens)}</div>
                      )}
                    </td>
                    <td className="whitespace-nowrap"><span className="inline-flex items-center gap-1.5"><FacetDot facet={c.facet} /> {shortFacet(c.facet)}</span></td>
                    <td className="num">L{c.level}</td>
                    <td className="whitespace-nowrap text-[12.5px]">{c.scope}</td>
                    <td className="whitespace-nowrap text-[12.5px]">{c.aTag.replace('Adaptation-', '')}</td>
                    <td className="whitespace-nowrap text-[12.5px]">{c.mTag.replace('Mitigation-', '')}</td>
                    <td className="text-[12.5px]" style={{ minWidth: 150 }}>{c.domain}</td>
                    <td className="num text-right">{c.syn.length || ''}</td>
                    <td className="num text-right">{c.rels.length + c.inRels.length || ''}</td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr><td colSpan={COLS.length} className="p-6 muted">No concept matches these filters. Remove a filter or shorten the search.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {rows.length > limit && <button className="btn mt-3" onClick={() => setLimit((l) => l + 400)}>Show {Math.min(400, rows.length - limit)} more rows</button>}
        </section>
      </div>
      <style>{`@media (max-width: 900px){ [data-exp-grid]{ grid-template-columns: 1fr !important; } [data-exp-grid] > aside { position: static !important; max-height: none !important; } }`}</style>
    </div>
  )
}

function matchHint(c: Concept, tokens: string[]) {
  const syn = c.syn.find((s) => tokens.some((t) => s.toLowerCase().includes(t)))
  if (syn) return `synonym: ${syn}`
  const d = c.def.toLowerCase()
  const t = tokens.find((x) => d.includes(x))
  if (!t) return ''
  const i = d.indexOf(t)
  return 'definition: …' + c.def.slice(Math.max(0, i - 30), i + 50) + '…'
}
export { DIM }
