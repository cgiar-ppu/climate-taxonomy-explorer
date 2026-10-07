import * as d3 from 'd3'
import { useEffect, useMemo, useState } from 'react'
import { CONCEPTS, FACET_ORDER, facetColor, fmt, shortFacet, VOCAB, type Concept } from '../data'
import { hrefFor, replaceParams } from '../router'
import { ConceptChip, PageHead, Seg, useTip } from '../components/ui'

const ROWS: Record<string, { label: string; param: string; get: (c: Concept) => string; order: string[] }> = {
  domain: { label: 'Domain', param: 'domain', get: (c) => c.domain, order: VOCAB.domains.map((d) => d.name) },
  impact: { label: 'Impact area', param: 'impact', get: (c) => c.impact, order: VOCAB.impactAreas.map((d) => d.name) },
  stage: { label: 'Pathway stage', param: 'stage', get: (c) => c.stage, order: VOCAB.pathwayStages.map((d) => d.name) },
}

export default function Heatmap({ params }: { params: URLSearchParams }) {
  const tip = useTip()
  const [rowKey, setRowKey] = useState(() => (ROWS[params.get('rows') ?? ''] ? params.get('rows')! : 'domain'))
  const [sel, setSel] = useState<{ r: string; f: string } | null>(() => (params.get('r') && params.get('f') ? { r: params.get('r')!, f: params.get('f')! } : null))
  useEffect(() => {
    const q = new URLSearchParams()
    if (rowKey !== 'domain') q.set('rows', rowKey)
    if (sel) {
      q.set('r', sel.r)
      q.set('f', sel.f)
    }
    replaceParams('heatmap', q)
  }, [rowKey, sel])
  const R = ROWS[rowKey]
  const defs = Object.fromEntries([...VOCAB.domains, ...VOCAB.impactAreas, ...VOCAB.pathwayStages].map((d) => [d.name, d.def]))

  const { m, rowTot, colTot, max, rows, cols } = useMemo(() => {
    const m = d3.rollup(CONCEPTS, (v) => v, R.get, (c) => c.facet)
    const rowTot = d3.rollup(CONCEPTS, (v) => v.length, R.get)
    const colTot = d3.rollup(CONCEPTS, (v) => v.length, (c) => c.facet)
    let max = 0
    for (const [, mm] of m) for (const [, v] of mm) max = Math.max(max, v.length)
    const rows = R.order.filter((r) => rowTot.get(r)).sort((a, b) => rowTot.get(b)! - rowTot.get(a)!)
    const cols = FACET_ORDER.filter((f) => colTot.get(f)).sort((a, b) => colTot.get(b)! - colTot.get(a)!)
    return { m, rowTot, colTot, max, rows, cols }
  }, [rowKey])

  const scale = d3.scaleSqrt().domain([0, max]).range([0, 1])
  const selected = sel ? m.get(sel.r)?.get(sel.f) ?? [] : []

  return (
    <div className="stack">
      <PageHead
        title="Domains and impact areas"
        lede={`How the ${fmt(CONCEPTS.length)} concepts spread across ${R.label.toLowerCase()}s and facets. Darker cells hold more concepts. Select a cell to list its concepts.`}
        right={
          <Seg
            label="Rows"
            value={rowKey}
            onChange={(v) => {
              setRowKey(v)
              setSel(null)
            }}
            options={Object.entries(ROWS).map(([v, o]) => ({ v, l: o.label }))}
          />
        }
      />
      <div className="panel" style={{ padding: 14, overflowX: 'auto' }}>
        <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 3, minWidth: 820 }}>
          <thead>
            <tr>
              <th className="text-left text-[12px] font-medium muted" style={{ width: 230 }}>{R.label} / facet</th>
              {cols.map((f) => (
                <th key={f} className="text-[11.5px] font-medium align-bottom" style={{ color: 'var(--text-2)' }}>
                  <a href={hrefFor('explore', { facet: f })} className="no-underline hover:underline flex flex-col items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: facetColor(f) }} />
                    <span style={{ lineHeight: 1.15 }}>{shortFacet(f)}</span>
                  </a>
                </th>
              ))}
              <th className="text-[11.5px] font-medium muted align-bottom">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r}>
                <th scope="row" className="text-left text-[12.5px] font-normal pr-2" style={{ color: 'var(--text-2)' }}>
                  <a href={hrefFor('explore', { [R.param]: r })} className="no-underline hover:underline" onMouseMove={(e) => tip.show(e, r, defs[r])} onMouseLeave={tip.hide}>
                    {r}
                  </a>
                </th>
                {cols.map((f) => {
                  const v = m.get(r)?.get(f)?.length ?? 0
                  const isSel = sel?.r === r && sel?.f === f
                  const t = scale(v)
                  return (
                    <td key={f} style={{ padding: 0 }}>
                      <button
                        className="w-full num"
                        disabled={!v}
                        aria-label={`${r}, ${f}: ${v} concepts`}
                        aria-pressed={isSel}
                        onClick={() => setSel(isSel ? null : { r, f })}
                        onMouseMove={(e) => tip.show(e, `${v} concepts`, <>{R.label}: {r}<br />Facet: {f}</>)}
                        onMouseLeave={tip.hide}
                        style={{
                          height: 34,
                          border: isSel ? '2px solid var(--accent)' : '1px solid transparent',
                          borderRadius: 6,
                          background: v ? `color-mix(in srgb, var(--heat-1) ${Math.round(12 + t * 88)}%, var(--heat-0))` : 'transparent',
                          color: t > 0.55 ? '#06201c' : 'var(--text-2)',
                          fontSize: 12.5,
                          fontWeight: 500,
                          cursor: v ? 'pointer' : 'default',
                          outline: v ? undefined : '1px dashed var(--line)',
                          outlineOffset: -1,
                        }}
                      >
                        {v || ''}
                      </button>
                    </td>
                  )
                })}
                <td className="text-center text-[12.5px] muted num">{rowTot.get(r)}</td>
              </tr>
            ))}
            <tr>
              <th className="text-left text-[12px] font-medium muted">Total</th>
              {cols.map((f) => <td key={f} className="text-center text-[12.5px] muted num">{colTot.get(f)}</td>)}
              <td className="text-center text-[12.5px] num" style={{ color: 'var(--text)' }}>{CONCEPTS.length}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {sel && (
        <div className="panel">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
            <h2 className="h-sec">
              {sel.r} and {sel.f}: {selected.length} concepts
            </h2>
            <a className="btn" href={hrefFor('explore', { [R.param]: sel.r, facet: sel.f })}>Open in the explorer</a>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[...selected].sort((a, b) => a.label.localeCompare(b.label)).map((c) => <ConceptChip key={c.id} id={c.id} />)}
          </div>
        </div>
      )}
      {!sel && <p className="sub">Select any cell to see its concepts here.</p>}
    </div>
  )
}
