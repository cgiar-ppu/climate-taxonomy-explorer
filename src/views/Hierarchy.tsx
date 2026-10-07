import * as d3 from 'd3'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BY_ID, CONCEPTS, FACET_DEF, FACET_ORDER, facetColor, fmt, shortFacet, type Concept } from '../data'
import { openConcept, replaceParams } from '../router'
import { FacetDot, Icon, PageHead, useTip } from '../components/ui'

interface HNode { key: string; name: string; facet: string; concept?: Concept; children?: HNode[] }

function buildTree(): HNode {
  const kids = (c: Concept): HNode => ({
    key: c.id, name: c.label, facet: c.facet, concept: c,
    children: c.children.length ? c.children.map((id) => kids(BY_ID.get(id)!)).sort((a, b) => a.name.localeCompare(b.name)) : undefined,
  })
  return {
    key: 'root', name: 'All concepts', facet: '',
    children: FACET_ORDER.map((f) => ({
      key: 'facet:' + f, name: f, facet: f,
      children: CONCEPTS.filter((c) => !c.parent && c.rootFacet === f).sort((a, b) => a.label.localeCompare(b.label)).map(kids),
    })),
  }
}

type PN = d3.HierarchyRectangularNode<HNode> & { current?: { x0: number; x1: number; y0: number; y1: number }; target?: { x0: number; x1: number; y0: number; y1: number } }

export default function Hierarchy({ params }: { params: URLSearchParams }) {
  const tree = useMemo(buildTree, [])
  const root = useMemo(() => {
    const h = d3.hierarchy(tree).sum(() => 1)
    return d3.partition<HNode>().size([2 * Math.PI, h.height + 1])(h) as PN
  }, [tree])
  const byKey = useMemo(() => {
    const m = new Map<string, PN>()
    root.each((n) => m.set(n.data.key, n as PN))
    return m
  }, [root])
  const [focus, setFocus] = useState<string>(() => (params.get('focus') && byKey.has(params.get('focus')!) ? params.get('focus')! : 'root'))
  useEffect(() => {
    const q = new URLSearchParams()
    if (focus !== 'root') q.set('focus', focus)
    replaceParams('hierarchy', q)
  }, [focus])

  const focusNode = byKey.get(focus) ?? root
  const crumbs = focusNode.ancestors().reverse()

  return (
    <div>
      <PageHead
        title="Hierarchy"
        lede="Facets, then top-level concepts, then narrower concepts down to level 6. Select a ring segment to zoom in, the centre to zoom out, and an outer concept to open it. The outline on the right follows the same focus."
      />
      <nav aria-label="Hierarchy breadcrumb" className="flex flex-wrap items-center gap-1.5 mb-3 text-[13px]">
        {crumbs.map((n, i) => (
          <span key={n.data.key} className="inline-flex items-center gap-1.5">
            {i > 0 && <span className="muted" aria-hidden>/</span>}
            <button className="chip" aria-current={i === crumbs.length - 1 ? 'true' : undefined} onClick={() => setFocus(n.data.key)}>
              {n.data.facet && <FacetDot facet={n.data.facet} />}
              <span className="t">{n.data.name}</span>
            </button>
          </span>
        ))}
        {focusNode.data.concept && (
          <button className="btn ml-1" onClick={() => openConcept(focusNode.data.key)}>Open “{focusNode.data.name}”</button>
        )}
      </nav>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(0, 1.25fr) minmax(300px, 1fr)' }} data-hier-grid>
        <div className="panel" style={{ padding: 10 }}>
          <Sunburst root={root} byKey={byKey} focus={focus} onFocus={setFocus} />
        </div>
        <div className="panel" style={{ padding: 12 }}>
          <Outline node={focusNode} onFocus={setFocus} />
        </div>
      </div>
      <style>{`@media (max-width: 1000px){ [data-hier-grid]{ grid-template-columns: 1fr !important; } }`}</style>
    </div>
  )
}

function Sunburst({ root, byKey, focus, onFocus }: { root: PN; byKey: Map<string, PN>; focus: string; onFocus: (k: string) => void }) {
  const ref = useRef<SVGSVGElement>(null)
  const tip = useTip()
  const api = useRef<{ zoomTo: (p: PN, animate: boolean) => void } | null>(null)
  const RINGS = 3
  const size = 760
  const radius = size / (2 * (RINGS + 1))

  useEffect(() => {
    const svg = d3.select(ref.current!)
    svg.selectAll('*').remove()
    root.each((d) => ((d as PN).current = { x0: d.x0, x1: d.x1, y0: d.y0, y1: d.y1 }))
    const arc = d3
      .arc<{ x0: number; x1: number; y0: number; y1: number }>()
      .startAngle((d) => d.x0)
      .endAngle((d) => d.x1)
      .padAngle((d) => Math.min((d.x1 - d.x0) / 2, 0.004))
      .padRadius(radius * 1.5)
      .innerRadius((d) => d.y0 * radius)
      .outerRadius((d) => Math.max(d.y0 * radius, d.y1 * radius - 1.5))
    const arcVisible = (d: { x0: number; x1: number; y0: number; y1: number }) => d.y1 <= RINGS + 1 && d.y0 >= 1 && d.x1 > d.x0
    const labelVisible = (d: { x0: number; x1: number; y0: number; y1: number }) => d.y1 <= RINGS + 1 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.045
    const labelTransform = (d: { x0: number; x1: number; y0: number; y1: number }) => {
      const x = (((d.x0 + d.x1) / 2) * 180) / Math.PI
      const y = ((d.y0 + d.y1) / 2) * radius
      return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`
    }
    const g = svg.append('g').attr('transform', `translate(${size / 2},${size / 2})`)
    const nodes = root.descendants().slice(1) as PN[]
    let depthNow = 0
    const opacity = (d: PN, base: number) => {
      const rel = d.depth - base
      if (!arcVisible(d.current!)) return 0
      return rel <= 1 ? 0.95 : rel === 2 ? 0.8 : 0.64
    }
    const path = g
      .append('g')
      .selectAll('path')
      .data(nodes)
      .join('path')
      .attr('fill', (d) => facetColor(d.data.facet))
      .attr('fill-opacity', (d) => opacity(d, 0))
      .attr('pointer-events', (d) => (arcVisible(d.current!) ? 'auto' : 'none'))
      .attr('d', (d) => arc(d.current!))
      .style('cursor', 'pointer')
      .attr('stroke', 'var(--panel)')
      .attr('stroke-width', 0.6)

    path
      .on('mousemove', (e: MouseEvent, d) => {
        const c = d.data.concept
        const n = d.descendants().filter((x) => x.data.concept && x !== d).length
        tip.show(
          e,
          <>
            {d.data.name} {c && <span className="idtag">{c.id}</span>}
          </>,
          c ? (
            <>
              {c.def.slice(0, 200)}
              {c.def.length > 200 ? '…' : ''}
              {d.children ? <div className="mt-1 muted">{d.descendants().length - 1} narrower concepts. Select to zoom in.</div> : <div className="mt-1 muted">Select to open.</div>}
            </>
          ) : (
            <>
              {fmt(n)} concepts. {FACET_DEF[d.data.facet]}
            </>
          ),
        )
      })
      .on('mouseleave', () => tip.hide())
      .on('click', (_e: MouseEvent, d) => {
        tip.hide()
        if (d.children) onFocus(d.data.key)
        else if (d.data.concept) openConcept(d.data.key)
      })

    const label = g
      .append('g')
      .attr('pointer-events', 'none')
      .attr('text-anchor', 'middle')
      .style('user-select', 'none')
      .selectAll('text')
      .data(nodes)
      .join('text')
      .attr('dy', '0.35em')
      .attr('fill', '#0c1a20')
      .attr('font-size', (d) => (d.depth === 1 ? 12.5 : 11))
      .attr('font-weight', (d) => (d.depth === 1 ? 600 : 500))
      .attr('fill-opacity', (d) => +labelVisible(d.current!))
      .attr('transform', (d) => labelTransform(d.current!))
      .text((d) => trunc(d.data.facet && d.depth === 1 ? shortFacet(d.data.name) : d.data.name, 17))

    const parent = g
      .append('circle')
      .attr('r', radius - 2)
      .attr('fill', 'var(--panel-2)')
      .attr('stroke', 'var(--line-2)')
      .style('cursor', 'pointer')
      .on('click', () => {
        const p = byKey.get(currentKey)
        if (p?.parent) onFocus(p.parent.data.key)
      })
    const centerT = g.append('text').attr('text-anchor', 'middle').attr('pointer-events', 'none')
    const ct1 = centerT.append('tspan').attr('x', 0).attr('dy', '-0.3em').attr('fill', 'var(--text)').attr('font-size', 15).attr('font-weight', 600)
    const ct2 = centerT.append('tspan').attr('x', 0).attr('dy', '1.5em').attr('fill', 'var(--muted)').attr('font-size', 12)
    const ct3 = centerT.append('tspan').attr('x', 0).attr('dy', '1.4em').attr('fill', 'var(--muted)').attr('font-size', 11)
    let currentKey = 'root'

    const zoomTo = (p: PN, animate: boolean) => {
      currentKey = p.data.key
      depthNow = p.depth
      ct1.text(trunc(p.data.key === 'root' ? 'All concepts' : p.data.name, 20))
      ct2.text(p.data.concept ? `${fmt(p.descendants().length - 1)} narrower concepts` : `${fmt(p.descendants().filter((d) => d.data.concept).length)} concepts`)
      ct3.text(p.parent ? 'select to zoom out' : '')
      parent.style('cursor', p.parent ? 'pointer' : 'default')
      root.each((dd) => {
        const d = dd as PN
        d.target = {
          x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
          x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
          y0: Math.max(0, d.y0 - p.depth),
          y1: Math.max(0, d.y1 - p.depth),
        }
      })
      const t = svg.transition().duration(animate ? 650 : 0).ease(d3.easeCubicInOut)
      path
        .transition(t as any)
        .tween('data', (d) => {
          const i = d3.interpolate(d.current!, d.target!)
          return (tt: number) => (d.current = i(tt))
        })
        .filter(function (d) {
          return !!(+(this as SVGPathElement).getAttribute('fill-opacity')! || arcVisible(d.target!))
        })
        .attr('fill-opacity', (d) => (arcVisible(d.target!) ? (d.depth - depthNow <= 1 ? 0.95 : d.depth - depthNow === 2 ? 0.8 : 0.64) : 0))
        .attr('pointer-events', (d) => (arcVisible(d.target!) ? 'auto' : 'none'))
        .attrTween('d', (d) => () => arc(d.current!) ?? '')
      label
        .filter(function (d) {
          return !!(+(this as SVGTextElement).getAttribute('fill-opacity')! || labelVisible(d.target!))
        })
        .transition(t as any)
        .attr('fill-opacity', (d) => +labelVisible(d.target!))
        .attrTween('transform', (d) => () => labelTransform(d.current!))
    }
    api.current = { zoomTo }
    zoomTo(byKey.get(focus) ?? root, false)
    return () => {
      svg.interrupt()
      svg.selectAll('*').interrupt()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root])

  useEffect(() => {
    api.current?.zoomTo(byKey.get(focus) ?? root, true)
  }, [focus])

  return <svg ref={ref} viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', maxHeight: '78vh', display: 'block' }} role="img" aria-label="Zoomable sunburst of the concept hierarchy" />
}

const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

function Outline({ node, onFocus }: { node: PN; onFocus: (k: string) => void }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Set<string>>(new Set())
  useEffect(() => setOpen(new Set()), [node])
  const ql = q.trim().toLowerCase()
  const matches = useMemo(() => {
    if (!ql) return null
    const keep = new Set<string>()
    node.each((n) => {
      const c = n.data.concept
      const hit = n.data.name.toLowerCase().includes(ql) || (c && c.syn.some((s) => s.toLowerCase().includes(ql)))
      if (hit) n.ancestors().forEach((a) => keep.add(a.data.key))
    })
    return keep
  }, [ql, node])

  const rows: { n: PN; depth: number }[] = []
  const walk = (n: PN, depth: number) => {
    for (const ch of (n.children ?? []) as PN[]) {
      if (matches && !matches.has(ch.data.key)) continue
      rows.push({ n: ch, depth })
      if (ch.children && (matches || open.has(ch.data.key))) walk(ch, depth + 1)
    }
  }
  walk(node, 0)

  const toggle = (k: string) => setOpen((s) => {
    const ns = new Set(s)
    if (ns.has(k)) ns.delete(k)
    else ns.add(k)
    return ns
  })

  return (
    <div className="flex flex-col h-full" style={{ maxHeight: '78vh' }}>
      <div className="flex items-center gap-2 mb-2">
        <input className="input flex-1" placeholder={`Filter within ${node.data.name}`} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter the outline" />
        <button className="btn" onClick={() => setOpen(new Set(node.descendants().map((d) => d.data.key)))}>Expand all</button>
        <button className="btn" onClick={() => setOpen(new Set())}>Collapse</button>
      </div>
      <div className="overflow-y-auto flex-1 pr-1" role="tree" aria-label="Concept outline">
        {rows.length === 0 && <div className="muted p-3 text-[13px]">{matches ? 'Nothing matches this filter here.' : 'This concept has no narrower concepts.'}</div>}
        {rows.slice(0, 1500).map(({ n, depth }) => {
          const hasKids = !!n.children?.length
          const isOpen = !!matches || open.has(n.data.key)
          const count = n.descendants().length - 1
          return (
            <div key={n.data.key} className="tree-row" style={{ paddingLeft: 6 + depth * 16 }} role="treeitem" aria-expanded={hasKids ? isOpen : undefined} aria-level={depth + 1}>
              {hasKids ? (
                <button className="tw" onClick={() => toggle(n.data.key)} aria-label={(isOpen ? 'Collapse ' : 'Expand ') + n.data.name}>
                  <Icon name={isOpen ? 'chevD' : 'chevR'} size={14} />
                </button>
              ) : (
                <span className="tw" />
              )}
              <FacetDot facet={n.data.facet} size={8} />
              <button className="tl" onClick={() => (n.data.concept ? openConcept(n.data.key) : onFocus(n.data.key))}>
                {matches ? <HL s={n.data.name} q={ql} /> : n.data.name}
              </button>
              {n.data.concept && <span className="idtag">L{n.data.concept.level}</span>}
              {hasKids && (
                <button className="tw" title="Zoom the sunburst here" aria-label={`Zoom to ${n.data.name}`} onClick={() => onFocus(n.data.key)}>
                  <Icon name="search" size={12} />
                </button>
              )}
              <span className="tc">{count > 0 ? count : ''}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function HL({ s, q }: { s: string; q: string }) {
  const i = s.toLowerCase().indexOf(q)
  if (i < 0) return <>{s}</>
  return (
    <>
      {s.slice(0, i)}
      <mark className="hl">{s.slice(i, i + q.length)}</mark>
      {s.slice(i + q.length)}
    </>
  )
}
