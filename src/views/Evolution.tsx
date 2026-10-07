import * as d3 from 'd3'
import { useEffect, useMemo, useState } from 'react'
import { BY_ID, DATA, facetColor, fmt } from '../data'
import { replaceParams } from '../router'
import { ConceptLink, FacetDot, Highlight, LinkifyIds, PageHead, Seg, useTip } from '../components/ui'

const TYPE_NOTE: Record<string, string> = {
  'DEFINITION CHANGED': 'The definition text changed.',
  'LEVEL CHANGED': 'The concept moved up or down the hierarchy.',
  ADDED: 'New concept in v5.',
  'RE-PARENTED': 'The broader (parent) concept changed.',
  'DESCRIPTOR CHANGED': 'A descriptor changed: related IDs, adaptation or mitigation tag, pathway stage or provenance.',
  RENAMED: 'The concept label changed.',
  'SOURCE CHANGED': 'The definition source changed.',
  RETIRED: 'The concept was removed in v5.',
  'FACET CHANGED': 'The concept moved to another facet.',
}

export default function Evolution({ params }: { params: URLSearchParams }) {
  const tip = useTip()
  const [type, setType] = useState(params.get('type') ?? '')
  const [q, setQ] = useState(params.get('q') ?? '')
  const [table, setTable] = useState<'terms' | 'synonyms'>(params.get('t') === 'synonyms' ? 'synonyms' : 'terms')
  const [limit, setLimit] = useState(150)
  useEffect(() => {
    const p = new URLSearchParams()
    if (type) p.set('type', type)
    if (q) p.set('q', q)
    if (table !== 'terms') p.set('t', table)
    replaceParams('evolution', p)
    setLimit(150)
  }, [type, q, table])

  const counts = useMemo(() => d3.rollups(DATA.changes, (v) => v.length, (c) => c.type).sort((a, b) => b[1] - a[1]), [])
  const synCounts = useMemo(() => d3.rollups(DATA.synChanges, (v) => v.length, (c) => c.type).sort((a, b) => b[1] - a[1]), [])
  const max = counts[0][1]
  const conceptsTouched = new Set(DATA.changes.map((c) => c.id)).size
  const ql = q.trim().toLowerCase()

  const rows = useMemo(
    () =>
      DATA.changes.filter(
        (c) => (!type || c.type === type) && (!ql || [c.id, c.label, c.facet, c.field, c.v4, c.v5, c.why].some((x) => x.toLowerCase().includes(ql))),
      ),
    [type, ql],
  )
  const synRows = useMemo(
    () => DATA.synChanges.filter((s) => (!type || s.type === type) && (!ql || [s.syn, s.fromId, s.fromLabel, s.toId, s.toLabel, s.why].some((x) => x.toLowerCase().includes(ql)))),
    [type, ql],
  )

  return (
    <div className="stack" style={{ gap: 20 }}>
      <PageHead
        title="Changes from v4 to v5"
        lede={`The change log records ${fmt(DATA.changes.length)} concept-level changes touching ${fmt(conceptsTouched)} IDs, ${fmt(DATA.synChanges.length)} synonym changes, and ${DATA.retired.length} retired IDs.`}
      />
      <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', alignItems: 'start' }} data-evo-grid>
        <div className="panel">
          <h2 className="h-sec">Concept-level changes by type</h2>
          <p className="sub mb-3">Select a type to filter the table below.</p>
          <div className="flex flex-col gap-1.5">
            {counts.map(([t, n]) => (
              <button
                key={t}
                className="grid items-center gap-3 text-left rounded-md px-1 py-0.5"
                style={{ gridTemplateColumns: '170px 1fr 40px', background: type === t ? 'var(--panel-2)' : 'transparent', border: 0 }}
                aria-pressed={type === t}
                onClick={() => {
                  setTable('terms')
                  setType(type === t ? '' : t)
                }}
                onMouseMove={(e) => tip.show(e, `${t}: ${n}`, TYPE_NOTE[t])}
                onMouseLeave={tip.hide}
              >
                <span className="text-[12.5px]">{sentence(t)}</span>
                <span className="h-4 rounded" style={{ width: `${(100 * n) / max}%`, background: type === t ? 'var(--accent)' : t === 'ADDED' ? 'var(--tag-specific)' : t === 'RETIRED' ? '#d46a5a' : 'var(--line-2)' }} />
                <span className="text-[12.5px] num text-right">{n}</span>
              </button>
            ))}
          </div>
          <div className="mt-4 text-[12.5px] muted">
            Synonym changes:{' '}
            {synCounts.map(([t, n], i) => (
              <span key={t}>
                {i > 0 && ', '}
                <button className="link" onClick={() => { setTable('synonyms'); setType(t) }}>{n} {t.toLowerCase()}</button>
              </span>
            ))}
            .
          </div>
        </div>
        <div className="panel">
          <h2 className="h-sec">Retired IDs ({DATA.retired.length})</h2>
          <p className="sub mb-3">Retired identifiers are never reused. Successors open in the concept panel.</p>
          <div className="overflow-y-auto" style={{ maxHeight: 360 }}>
            <table className="tbl">
              <thead><tr><th>Retired</th><th>Successor</th><th>Reason</th></tr></thead>
              <tbody>
                {DATA.retired.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="flex items-center gap-1.5"><FacetDot facet={r.facet} size={7} /> {r.label}</div>
                      <div className="idtag">{r.id}</div>
                    </td>
                    <td className="text-[12.5px]" style={{ minWidth: 150 }}>
                      {r.successorIds.length ? (
                        <div className="flex flex-col gap-0.5">
                          {r.successorIds.map((id) => <ConceptLink key={id} id={id} />)}
                          {/\(.*\)/.test(r.successor) && <span className="muted text-[12px]">{r.successor.match(/\(.*\)/)![0]}</span>}
                          {/\/\d/.test(r.successor) && <span className="muted text-[12px]">{r.successor.split(' ')[0]}</span>}
                        </div>
                      ) : (
                        <span className="muted">{r.successor}</span>
                      )}
                    </td>
                    <td className="text-[12.5px]" style={{ color: 'var(--text-2)' }}>{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <h2 className="h-sec mr-auto">{table === 'terms' ? 'Concept-level changes' : 'Synonym changes'}</h2>
          <Seg label="Table" value={table} onChange={(v) => { setTable(v); setType('') }} options={[{ v: 'terms', l: `Concepts (${DATA.changes.length})` }, { v: 'synonyms', l: `Synonyms (${DATA.synChanges.length})` }]} />
          <select className="input" value={type} onChange={(e) => setType(e.target.value)} aria-label="Change type">
            <option value="">All types</option>
            {(table === 'terms' ? counts : synCounts).map(([t, n]) => <option key={t} value={t}>{sentence(t)} ({n})</option>)}
          </select>
          <input className="input" style={{ width: 260 }} placeholder="Search ID, concept, value or reason" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search changes" />
          <span className="text-[12.5px] muted num">{fmt(table === 'terms' ? rows.length : synRows.length)} rows</span>
        </div>
        <div className="tbl-wrap" style={{ maxHeight: 640 }}>
          {table === 'terms' ? (
            <table className="tbl">
              <thead><tr><th>Change</th><th>Concept</th><th>Field</th><th>v4</th><th>v5</th><th>Why</th></tr></thead>
              <tbody>
                {rows.slice(0, limit).map((c, i) => (
                  <tr key={i}>
                    <td className="whitespace-nowrap text-[12.5px]">{sentence(c.type)}</td>
                    <td style={{ minWidth: 180 }}>
                      {BY_ID.has(c.id) ? <ConceptLink id={c.id} /> : <span className="flex items-center gap-1.5"><span className="dot inline-block w-[7px] h-[7px] rounded-full" style={{ background: facetColor(c.facet) }} />{c.label}</span>}
                      <div className="idtag">{c.id}</div>
                    </td>
                    <td className="text-[12.5px] whitespace-nowrap">{c.field}</td>
                    <td className="wrap text-[12.5px]" style={{ minWidth: 180, maxWidth: 320 }}><Highlight text={clip(c.v4)} q={q} /></td>
                    <td className="wrap text-[12.5px]" style={{ minWidth: 180, maxWidth: 320 }}><Highlight text={clip(c.v5)} q={q} /></td>
                    <td className="wrap text-[12.5px]" style={{ minWidth: 200, maxWidth: 340 }}><LinkifyIds text={clip(c.why)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="tbl">
              <thead><tr><th>Change</th><th>Synonym</th><th>From (v4)</th><th>To (v5)</th><th>Why</th></tr></thead>
              <tbody>
                {synRows.slice(0, limit).map((s, i) => (
                  <tr key={i}>
                    <td className="text-[12.5px]">{sentence(s.type)}</td>
                    <td><Highlight text={s.syn} q={q} /></td>
                    <td className="text-[12.5px]">{s.fromId ? (BY_ID.has(s.fromId) ? <ConceptLink id={s.fromId} /> : `${s.fromLabel} (${s.fromId})`) : <span className="muted">–</span>}</td>
                    <td className="text-[12.5px]">{s.toId ? (BY_ID.has(s.toId) ? <ConceptLink id={s.toId} /> : `${s.toLabel} (${s.toId})`) : <span className="muted">–</span>}</td>
                    <td className="wrap text-[12.5px]"><LinkifyIds text={clip(s.why)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {(table === 'terms' ? rows.length : synRows.length) > limit && (
          <button className="btn mt-3" onClick={() => setLimit((l) => l + 300)}>Show more rows</button>
        )}
      </div>
      <style>{`@media (max-width: 1100px){ [data-evo-grid]{ grid-template-columns: 1fr !important; } }`}</style>
    </div>
  )
}

const sentence = (t: string) => t.charAt(0) + t.slice(1).toLowerCase()
const clip = (s: string) => (s.length > 420 ? s.slice(0, 419) + '…' : s)
