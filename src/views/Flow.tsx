import * as d3 from 'd3'
import { sankey, sankeyLinkHorizontal, type SankeyGraph } from 'd3-sankey'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CONCEPTS, FACET_ORDER, facetColor, fmt, SCOPE_COLOR, shortFacet, VOCAB, type Concept } from '../data'
import { go, replaceParams } from '../router'
import { PageHead, Seg, useTip } from '../components/ui'

type Dim = { key: string; label: string; param: string; get: (c: Concept) => string; order: string[] }
const DIMS: Record<string, Dim> = {
  domain: { key: 'domain', label: 'Domain', param: 'domain', get: (c) => c.domain, order: VOCAB.domains.map((d) => d.name) },
  facet: { key: 'facet', label: 'Facet', param: 'facet', get: (c) => c.facet, order: FACET_ORDER },
  scope: { key: 'scope', label: 'Climate scope', param: 'scope', get: (c) => c.scope, order: VOCAB.scopes.map((d) => d.name) },
  stage: { key: 'stage', label: 'Pathway stage', param: 'stage', get: (c) => c.stage, order: VOCAB.pathwayStages.map((d) => d.name) },
  impact: { key: 'impact', label: 'Impact area', param: 'impact', get: (c) => c.impact, order: VOCAB.impactAreas.map((d) => d.name) },
  atag: { key: 'atag', label: 'Adaptation tag', param: 'atag', get: (c) => c.aTag, order: VOCAB.adaptationTags.map((d) => d.name) },
}
const PRESETS: Record<string, { label: string; dims: string[]; note: string }> = {
  dfs: { label: 'Domain, facet, scope', dims: ['domain', 'facet', 'scope'], note: 'Which subject domains feed which facets, and whether they end in adaptation, mitigation or both.' },
  sfi: { label: 'Stage, facet, impact area', dims: ['stage', 'facet', 'impact'], note: 'The results chain (rationale, intervention, output, outcome, impact) against facets and CGIAR impact areas.' },
  fsa: { label: 'Facet, scope, adaptation tag', dims: ['facet', 'scope', 'atag'], note: 'How each facet splits into scope and into specific or conditional adaptation.' },
}

interface SN { name: string; dim: string; value?: number; x0?: number; x1?: number; y0?: number; y1?: number; index?: number }
interface SL { source: number | SN; target: number | SN; value: number; width?: number; y0?: number; y1?: number }

export default function Flow({ params }: { params: URLSearchParams }) {
  const [preset, setPreset] = useState<string>(() => (PRESETS[params.get('p') ?? ''] ? params.get('p')! : 'dfs'))
  useEffect(() => replaceParams('flow', new URLSearchParams(preset === 'dfs' ? {} : { p: preset })), [preset])
  const p = PRESETS[preset]
  return (
    <div>
      <PageHead
        title="Pathway flow"
        lede={<>{p.note} Band width is the number of concepts. Hover a band for its count; select a band or a node to list those concepts in the explorer.</>}
        right={<Seg label="Flow" value={preset} onChange={setPreset} options={Object.entries(PRESETS).map(([v, o]) => ({ v, l: o.label }))} />}
      />
      <div className="panel" style={{ padding: 16 }}>
        <Sankey dims={p.dims.map((d) => DIMS[d])} />
      </div>
    </div>
  )
}

function colorFor(dim: string, value: string) {
  if (dim === 'facet') return facetColor(value)
  if (dim === 'scope') return SCOPE_COLOR[value]
  if (dim === 'atag') return value.endsWith('specific') ? 'var(--tag-specific)' : value.endsWith('conditional') ? 'var(--tag-conditional)' : 'var(--muted)'
  return 'var(--line-2)'
}

function Sankey({ dims }: { dims: Dim[] }) {
  const wrap = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(1100)
  const tip = useTip()
  useEffect(() => {
    const ro = new ResizeObserver(() => wrap.current && setW(wrap.current.clientWidth))
    ro.observe(wrap.current!)
    return () => ro.disconnect()
  }, [])
  const H = Math.max(560, dims[0].order.length * 34)
  const graph = useMemo(() => {
    const nodes: SN[] = []
    const idx = new Map<string, number>()
    dims.forEach((d, i) => {
      const present = new Set(CONCEPTS.map(d.get))
      d.order.filter((v) => present.has(v)).forEach((v) => {
        idx.set(`${i}|${v}`, nodes.length)
        nodes.push({ name: v, dim: d.key })
      })
    })
    const links: SL[] = []
    for (let i = 0; i < dims.length - 1; i++) {
      const roll = d3.rollup(CONCEPTS, (v) => v.length, dims[i].get, dims[i + 1].get)
      for (const [a, m] of roll) for (const [b, n] of m) links.push({ source: idx.get(`${i}|${a}`)!, target: idx.get(`${i + 1}|${b}`)!, value: n })
    }
    const labelW = Math.min(210, w * 0.2)
    const gen = sankey<SN, SL>()
      .nodeWidth(12)
      .nodePadding(9)
      .nodeSort(null as any)
      .extent([[labelW, 10], [w - labelW, H - 10]])
    return gen({ nodes: nodes.map((n) => ({ ...n })), links: links.map((l) => ({ ...l })) }) as SankeyGraph<SN, SL>
  }, [dims, w, H])

  const [hover, setHover] = useState<SL | SN | null>(null)
  const isOn = (l: SL) => !hover || hover === l || (!('source' in hover) && ((l.source as SN) === hover || (l.target as SN) === hover))

  const linkGo = (l: SL) => {
    const s = l.source as SN, t = l.target as SN
    go('explore', { [DIMS[s.dim].param]: s.name, [DIMS[t.dim].param]: t.name })
  }
  const linkColor = (l: SL) => {
    const s = l.source as SN, t = l.target as SN
    if (s.dim === 'facet') return facetColor(s.name)
    if (t.dim === 'facet') return facetColor(t.name)
    return colorFor(s.dim, s.name)
  }

  return (
    <div ref={wrap}>
      <div className="flex justify-between text-[12px] muted mb-1 px-1">
        {dims.map((d) => <span key={d.key}>{d.label}</span>)}
      </div>
      <svg width={w} height={H} role="img" aria-label={`Sankey diagram: ${dims.map((d) => d.label).join(', ')}`} style={{ display: 'block' }}>
        <g fill="none">
          {graph.links.map((l, i) => (
            <path
              key={i}
              d={sankeyLinkHorizontal()(l as any) ?? ''}
              stroke={linkColor(l)}
              strokeOpacity={isOn(l) ? (hover ? 0.75 : 0.38) : 0.06}
              strokeWidth={Math.max(1, l.width ?? 1)}
              style={{ cursor: 'pointer', transition: 'stroke-opacity .15s' }}
              onMouseMove={(e) => {
                setHover(l)
                const s = l.source as SN, t = l.target as SN
                tip.show(e, `${fmt(l.value)} concepts`, <>{DIMS[s.dim].label}: {s.name}<br />{DIMS[t.dim].label}: {t.name}</>)
              }}
              onMouseLeave={() => {
                setHover(null)
                tip.hide()
              }}
              onClick={() => {
                tip.hide()
                linkGo(l)
              }}
            />
          ))}
        </g>
        {graph.nodes.map((n, i) => {
          const total = n.value ?? 0
          const leftSide = (n.x0 ?? 0) < w / 2
          const last = n.dim === dims[dims.length - 1].key
          const first = n.dim === dims[0].key
          const tx = first ? (n.x0 ?? 0) - 6 : last ? (n.x1 ?? 0) + 6 : leftSide ? (n.x0 ?? 0) - 6 : (n.x1 ?? 0) + 6
          const anchor = first ? 'end' : last ? 'start' : leftSide ? 'end' : 'start'
          const h = (n.y1 ?? 0) - (n.y0 ?? 0)
          return (
            <g
              key={i}
              style={{ cursor: 'pointer' }}
              onMouseMove={(e) => {
                setHover(n)
                tip.show(e, `${n.name}: ${fmt(total)} concepts`, DIMS[n.dim].label)
              }}
              onMouseLeave={() => {
                setHover(null)
                tip.hide()
              }}
              onClick={() => {
                tip.hide()
                go('explore', { [DIMS[n.dim].param]: n.name })
              }}
            >
              <rect x={n.x0} y={n.y0} width={(n.x1 ?? 0) - (n.x0 ?? 0)} height={Math.max(1, h)} rx={2} fill={colorFor(n.dim, n.name)} stroke="var(--line-2)" strokeWidth={n.dim === 'domain' || n.dim === 'stage' || n.dim === 'impact' ? 1 : 0} />
              <text x={tx} y={((n.y0 ?? 0) + (n.y1 ?? 0)) / 2} dy="0.35em" textAnchor={anchor} fontSize={12} fill="var(--text)" className="halo">
                {n.dim === 'facet' ? shortFacet(n.name) : n.name}
                <tspan fill="var(--muted)" fontSize={11}> {fmt(total)}</tspan>
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
