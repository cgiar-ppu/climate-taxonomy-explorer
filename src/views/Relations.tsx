import * as d3 from 'd3'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BY_ID, CONCEPTS, FACET_ORDER, facetColor, REL_DEF, REL_FAMILY_LABEL, REL_TYPES, relFamily, shortFacet, type Concept } from '../data'
import { openConcept, replaceParams } from '../router'
import { ConceptLink, FacetChip, PageHead, useTip } from '../components/ui'

interface N extends d3.SimulationNodeDatum { id: string; c: Concept; deg: number }
interface L extends d3.SimulationLinkDatum<N> { t: string; source: N | string; target: N | string }

const DASH: Record<string, number[]> = { chain: [], mitigation: [6, 4], partitive: [1.5, 3] }

export default function Relations({ params }: { params: URLSearchParams }) {
  const allEdges = useMemo(() => CONCEPTS.flatMap((c) => c.rels.map((r) => ({ s: c.id, t: r.t, o: r.to }))), [])
  const relCounts = useMemo(() => d3.rollup(allEdges, (v) => v.length, (e) => e.t), [allEdges])
  const [types, setTypes] = useState<Set<string>>(() => new Set(params.getAll('rel').length ? params.getAll('rel') : REL_TYPES))
  const [facets, setFacets] = useState<Set<string>>(() => new Set(params.getAll('facet').length ? params.getAll('facet') : FACET_ORDER))
  useEffect(() => {
    const q = new URLSearchParams()
    if (types.size !== REL_TYPES.length) types.forEach((t) => q.append('rel', t))
    if (facets.size !== FACET_ORDER.length) facets.forEach((f) => q.append('facet', f))
    replaceParams('relations', q)
  }, [types, facets])

  const edges = allEdges.filter((e) => types.has(e.t) && facets.has(BY_ID.get(e.s)!.facet) && facets.has(BY_ID.get(e.o)!.facet))
  const nodeIds = new Set(edges.flatMap((e) => [e.s, e.o]))
  const nodeFacetCounts = d3.rollup([...new Set(allEdges.flatMap((e) => [e.s, e.o]))], (v) => v.length, (id) => BY_ID.get(id)!.facet)
  const topNodes = useMemo(() => {
    const deg = new Map<string, number>()
    for (const e of edges) {
      deg.set(e.s, (deg.get(e.s) ?? 0) + 1)
      deg.set(e.o, (deg.get(e.o) ?? 0) + 1)
    }
    return [...deg].sort((a, b) => b[1] - a[1]).slice(0, 10)
  }, [edges.length, types, facets])

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, v: string, all: string[]) => {
    // first click on a full set isolates the value; later clicks toggle
    if (set.size === all.length) return setter(new Set([v]))
    const ns = new Set(set)
    if (ns.has(v)) ns.delete(v)
    else ns.add(v)
    setter(ns.size === 0 ? new Set(all) : ns)
  }

  return (
    <div>
      <PageHead
        title="Relations network"
        lede={`The ${allEdges.length} typed relations between concepts: ${nodeIds.size} concepts are shown with the current filters. Node size reflects the number of relations; colour is the facet. Hover a node to highlight its neighbours, select it to open it. Drag to pan, scroll to zoom.`}
      />
      <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(0, 1fr) 320px' }} data-rel-grid>
        <div className="panel" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
          <Graph edges={edges} />
          <div className="absolute left-3 bottom-3 text-[12px] muted pointer-events-none" style={{ background: 'color-mix(in srgb, var(--panel) 80%, transparent)', padding: '4px 8px', borderRadius: 6 }}>
            {nodeIds.size} concepts, {edges.length} relations
          </div>
        </div>
        <aside className="stack" style={{ gap: 12 }}>
          <div className="panel" style={{ padding: 14 }}>
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="h-sec">Relation types</h2>
              <button className="link text-[12px]" onClick={() => setTypes(new Set(REL_TYPES))}>Show all</button>
            </div>
            {(['chain', 'mitigation', 'partitive'] as const).map((fam) => (
              <div key={fam} className="mb-2.5">
                <div className="flex items-center gap-2 text-[12px] muted mb-1">
                  <svg width="34" height="8" aria-hidden><line x1="0" y1="4" x2="34" y2="4" stroke="var(--text-2)" strokeWidth="1.6" strokeDasharray={DASH[fam].join(' ')} /></svg>
                  {REL_FAMILY_LABEL[fam]}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {REL_TYPES.filter((t) => relFamily(t) === fam).map((t) => (
                    <RelChip key={t} t={t} n={relCounts.get(t) ?? 0} pressed={types.has(t)} all={types.size === REL_TYPES.length} onClick={() => toggle(types, setTypes, t, REL_TYPES)} />
                  ))}
                </div>
              </div>
            ))}
            <p className="sub mt-1">Hover a type for its definition. Select one to show only that type; select more to add them.</p>
          </div>
          <div className="panel" style={{ padding: 14 }}>
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="h-sec">Facets</h2>
              <button className="link text-[12px]" onClick={() => setFacets(new Set(FACET_ORDER))}>Show all</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FACET_ORDER.filter((f) => nodeFacetCounts.get(f)).map((f) => (
                <FacetChip key={f} facet={f} pressed={facets.has(f)} all={facets.size === FACET_ORDER.length} onClick={() => toggle(facets, setFacets, f, FACET_ORDER)} />
              ))}
            </div>
            <p className="sub mt-2">A relation is shown when both of its concepts are in a selected facet.</p>
          </div>
          <div className="panel" style={{ padding: 14 }}>
            <h2 className="h-sec mb-2">Most connected here</h2>
            <ol className="m-0 pl-5 text-[13px] flex flex-col gap-1">
              {topNodes.map(([id, n]) => (
                <li key={id}>
                  <ConceptLink id={id} /> <span className="muted num">{n}</span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
      <style>{`@media (max-width: 1100px){ [data-rel-grid]{ grid-template-columns: 1fr !important; } }`}</style>
    </div>
  )
}

function RelChip({ t, n, pressed, all, onClick }: { t: string; n: number; pressed: boolean; all: boolean; onClick: () => void }) {
  const tip = useTip()
  return (
    <button type="button" className={'chip' + (pressed ? '' : ' dim') + (all ? ' all' : '')} aria-pressed={pressed} onClick={onClick} onMouseMove={(e) => tip.show(e, t, REL_DEF[t])} onMouseLeave={tip.hide}>
      <span className="t">{t}</span>
      <span className="muted num">{n}</span>
    </button>
  )
}

function Graph({ edges }: { edges: { s: string; t: string; o: string }[] }) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const tip = useTip()
  const state = useRef<{ hover: N | null; transform: d3.ZoomTransform; draw: () => void }>({ hover: null, transform: d3.zoomIdentity, draw: () => {} })
  const key = edges.map((e) => e.s + e.t + e.o).join('|')

  useEffect(() => {
    const el = canvas.current!
    const ctx = el.getContext('2d')!
    let W = wrap.current!.clientWidth
    let H = Math.max(520, Math.min(window.innerHeight - 190, 820))
    const dpr = window.devicePixelRatio || 1
    const resize = () => {
      if (!wrap.current) return
      W = wrap.current.clientWidth
      el.width = W * dpr
      el.height = H * dpr
      el.style.width = W + 'px'
      el.style.height = H + 'px'
      draw()
    }

    const deg = new Map<string, number>()
    edges.forEach((e) => {
      deg.set(e.s, (deg.get(e.s) ?? 0) + 1)
      deg.set(e.o, (deg.get(e.o) ?? 0) + 1)
    })
    const nodes: N[] = [...deg.keys()].map((id) => ({ id, c: BY_ID.get(id)!, deg: deg.get(id)! }))
    const byId = new Map(nodes.map((n) => [n.id, n]))
    const links: L[] = edges.map((e) => ({ source: byId.get(e.s)!, target: byId.get(e.o)!, t: e.t }))
    const nbrs = new Map<string, Set<string>>()
    links.forEach((l) => {
      const s = (l.source as N).id, t = (l.target as N).id
      if (!nbrs.has(s)) nbrs.set(s, new Set())
      if (!nbrs.has(t)) nbrs.set(t, new Set())
      nbrs.get(s)!.add(t)
      nbrs.get(t)!.add(s)
    })
    const r = (n: N) => 3 + Math.sqrt(n.deg) * 2.3

    const sim = d3
      .forceSimulation(nodes)
      .force('link', d3.forceLink<N, L>(links).distance(34).strength(0.7))
      .force('charge', d3.forceManyBody<N>().strength(-46).distanceMax(320))
      .force('collide', d3.forceCollide<N>().radius((n) => r(n) + 2))
      .force('x', d3.forceX(0).strength(0.045))
      .force('y', d3.forceY(0).strength(0.06))
      .alphaDecay(0.035)

    const css = () => {
      const s = getComputedStyle(document.documentElement)
      return { text: s.getPropertyValue('--text').trim(), muted: s.getPropertyValue('--muted').trim(), line: s.getPropertyValue('--line-2').trim(), bg: s.getPropertyValue('--panel').trim(), accent: s.getPropertyValue('--accent').trim() }
    }
    let colors = css()
    const mo = new MutationObserver(() => {
      colors = css()
      draw()
    })
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    let fitted = false
    function fit() {
      const xs = d3.extent(nodes, (n) => n.x!) as [number, number]
      const ys = d3.extent(nodes, (n) => n.y!) as [number, number]
      const k = Math.min(2.2, 0.9 * Math.min(W / (xs[1] - xs[0] + 60), H / (ys[1] - ys[0] + 60)))
      const t = d3.zoomIdentity.translate(W / 2 - (k * (xs[0] + xs[1])) / 2, H / 2 - (k * (ys[0] + ys[1])) / 2).scale(k)
      d3.select(el).call(zoom.transform, t)
    }

    function draw() {
      const t = state.current.transform
      const hover = state.current.hover
      const hn = hover ? nbrs.get(hover.id) : null
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)
      ctx.translate(t.x, t.y)
      ctx.scale(t.k, t.k)
      // edges
      for (const l of links) {
        const s = l.source as N, o = l.target as N
        const on = !hover || s === hover || o === hover
        ctx.globalAlpha = on ? (hover ? 0.95 : 0.5) : 0.06
        ctx.strokeStyle = on && hover ? colors.text : colors.muted
        ctx.lineWidth = (on && hover ? 1.6 : 1) / Math.sqrt(t.k)
        ctx.setLineDash(DASH[relFamily(l.t)].map((d) => d / Math.sqrt(t.k)))
        ctx.beginPath()
        ctx.moveTo(s.x!, s.y!)
        ctx.lineTo(o.x!, o.y!)
        ctx.stroke()
        // arrowhead at target edge
        const ang = Math.atan2(o.y! - s.y!, o.x! - s.x!)
        const tr = r(o) + 1.5
        const ax = o.x! - Math.cos(ang) * tr, ay = o.y! - Math.sin(ang) * tr
        const ah = 4.5 / Math.sqrt(t.k)
        ctx.setLineDash([])
        ctx.fillStyle = ctx.strokeStyle
        ctx.beginPath()
        ctx.moveTo(ax, ay)
        ctx.lineTo(ax - ah * Math.cos(ang - 0.45), ay - ah * Math.sin(ang - 0.45))
        ctx.lineTo(ax - ah * Math.cos(ang + 0.45), ay - ah * Math.sin(ang + 0.45))
        ctx.closePath()
        ctx.fill()
      }
      ctx.setLineDash([])
      // nodes
      for (const n of nodes) {
        const on = !hover || n === hover || hn?.has(n.id)
        ctx.globalAlpha = on ? 1 : 0.15
        ctx.fillStyle = facetColor(n.c.facet)
        ctx.beginPath()
        ctx.arc(n.x!, n.y!, r(n), 0, 2 * Math.PI)
        ctx.fill()
        ctx.lineWidth = (n === hover ? 2.5 : 1) / t.k
        ctx.strokeStyle = n === hover ? colors.text : colors.bg
        ctx.stroke()
      }
      // labels
      ctx.globalAlpha = 1
      const fs = 11.5 / t.k
      ctx.font = `500 ${fs}px Plex, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      for (const n of nodes) {
        const on = hover ? n === hover || hn?.has(n.id) : n.deg >= 9 || t.k > 2.2 || (t.k > 1.4 && n.deg >= 4)
        if (!on) continue
        const label = n.c.label.length > 28 ? n.c.label.slice(0, 27) + '…' : n.c.label
        const y = n.y! + r(n) + 2 / t.k
        ctx.lineWidth = 3 / t.k
        ctx.strokeStyle = colors.bg
        ctx.globalAlpha = 0.9
        ctx.strokeText(label, n.x!, y)
        ctx.globalAlpha = 1
        ctx.fillStyle = n === hover ? colors.accent : colors.text
        ctx.fillText(label, n.x!, y)
      }
    }
    state.current.draw = draw

    const zoom = d3
      .zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.3, 8])
      .on('zoom', (e) => {
        state.current.transform = e.transform
        draw()
      })
    d3.select(el).call(zoom).on('dblclick.zoom', null)

    const pick = (e: MouseEvent) => {
      const [mx, my] = d3.pointer(e, el)
      const [x, y] = state.current.transform.invert([mx, my])
      let best: N | null = null
      let bd = Infinity
      for (const n of nodes) {
        const d = Math.hypot(n.x! - x, n.y! - y)
        if (d < r(n) + 4 / state.current.transform.k && d < bd) {
          best = n
          bd = d
        }
      }
      return best
    }
    el.onmousemove = (e) => {
      const n = pick(e)
      if (n !== state.current.hover) {
        state.current.hover = n
        el.style.cursor = n ? 'pointer' : 'grab'
        draw()
      }
      if (n) {
        const outs = n.c.rels.length, ins = n.c.inRels.length
        tip.show(e, <>{n.c.label} <span className="idtag">{n.id}</span></>, <>{shortFacet(n.c.facet)}. {outs} outgoing and {ins} incoming relations in the taxonomy.</>)
      } else tip.hide()
    }
    el.onmouseleave = () => {
      state.current.hover = null
      tip.hide()
      draw()
    }
    el.onclick = (e) => {
      const n = pick(e)
      if (n) {
        tip.hide()
        openConcept(n.id)
      }
    }

    sim.on('tick', () => {
      if (!fitted && sim.alpha() < 0.3) {
        fitted = true
        fit()
      }
      draw()
    })
    // warm up so the first frame is already laid out
    sim.tick(120)
    fit()
    fitted = true
    resize()
    const ro = new ResizeObserver(() => resize())
    ro.observe(wrap.current!)
    return () => {
      sim.stop()
      ro.disconnect()
      mo.disconnect()
      el.onmousemove = el.onmouseleave = el.onclick = null
      d3.select(el).on('.zoom', null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return (
    <div ref={wrap} style={{ width: '100%' }}>
      <canvas ref={canvas} role="img" aria-label="Force-directed network of typed relations between concepts" style={{ display: 'block', cursor: 'grab' }} />
    </div>
  )
}
