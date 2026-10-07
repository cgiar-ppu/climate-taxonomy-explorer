import { useMemo } from 'react'
import { BY_ID, CONCEPTS, countBy, degree, DATA, fmtDate, FACET_DEF, FACET_ORDER, facetColor, fmt, META, pct, SCOPE_COLOR, shortFacet, VOCAB, versionLabel } from '../data'
import { go, hrefFor, openConcept } from '../router'
import { ConceptLink, useTip } from '../components/ui'

export default function Overview() {
  const tip = useTip()
  const s = useMemo(() => {
    const n = CONCEPTS.length
    const facets = countBy(CONCEPTS, (c) => c.facet)
    const scopes = countBy(CONCEPTS, (c) => c.scope)
    const synonyms = CONCEPTS.reduce((a, c) => a + c.syn.length, 0)
    const withSyn = CONCEPTS.filter((c) => c.syn.length).length
    const edges = CONCEPTS.reduce((a, c) => a + c.rels.length, 0)
    const withRels = CONCEPTS.filter((c) => c.rels.length).length
    const top = CONCEPTS.filter((c) => !c.parent).length
    const maxDepth = Math.max(...CONCEPTS.map((c) => c.level))
    const external = CONCEPTS.filter((c) => c.defSrc && c.srcFamily !== 'CGIAR (no external source)').length
    const domains = new Set(CONCEPTS.map((c) => c.domain)).size
    const sortedFacets = FACET_ORDER.map((f) => [f, facets.get(f) ?? 0] as const).sort((a, b) => b[1] - a[1])
    const fams = [...countBy(CONCEPTS, (c) => c.srcFamily)].sort((a, b) => b[1] - a[1])
    const mostConnected = [...CONCEPTS].sort((a, b) => degree(b) - degree(a))[0]
    const deepest = CONCEPTS.filter((c) => c.level === maxDepth)
    const conditionalA = CONCEPTS.filter((c) => c.aTag === 'Adaptation-conditional').length
    const examples = CONCEPTS.filter((c) => c.example.trim()).length
    return { n, facets, scopes, synonyms, withSyn, edges, withRels, top, maxDepth, external, domains, sortedFacets, fams, mostConnected, deepest, conditionalA, examples }
  }, [])

  // waffle: concepts ordered by facet (largest first), then by path so siblings sit together
  const waffle = useMemo(() => {
    const order = new Map(s.sortedFacets.map(([f], i) => [f, i]))
    return [...CONCEPTS].sort((a, b) => order.get(a.facet)! - order.get(b.facet)! || a.root.localeCompare(b.root) || a.level - b.level || a.label.localeCompare(b.label))
  }, [s])

  const [largestF, largestN] = s.sortedFacets[0]
  const adaptOnly = s.scopes.get('Adaptation') ?? 0
  const deepest = s.deepest[0]

  return (
    <div className="stack" style={{ gap: 22 }}>
      <section className="panel" style={{ padding: '26px 26px 22px', background: 'linear-gradient(160deg, var(--panel) 0%, var(--bg-2) 100%)' }}>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="badge">{versionLabel}</span>
          <span className="badge badge-draft">Draft</span>
          <span className="badge">Content built {fmtDate(META.contentBuiltAt)}</span>
        </div>
        <h1 className="m-0" style={{ fontSize: 'clamp(26px, 3.2vw, 40px)', fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.08, maxWidth: '22ch' }}>
          CGIAR Climate Adaptation and Mitigation Taxonomy
        </h1>
        <p className="lede" style={{ fontSize: 15.5, marginTop: 10 }}>
          {fmt(s.n)} concepts in {FACET_ORDER.length} facets for describing climate adaptation and mitigation in agricultural research results. Each concept has a
          definition with its source, synonyms, its place in a hierarchy, and the rule for when it counts as adaptation or mitigation. Every square below is one concept,
          coloured by facet; select one to read it.
        </p>
        <div className="waffle mt-5" role="list" aria-label={`All ${s.n} concepts, grouped by facet`}>
          {waffle.map((c) => (
            <button
              key={c.id}
              role="listitem"
              aria-label={`${c.label} (${c.facet})`}
              style={{ background: facetColor(c.facet) }}
              onClick={() => {
                tip.hide()
                openConcept(c.id)
              }}
              onMouseMove={(e) => tip.show(e, <>{c.label} <span className="idtag">{c.id}</span></>, <>{shortFacet(c.facet)}, level {c.level}. {c.def.slice(0, 140)}{c.def.length > 140 ? '…' : ''}</>)}
              onMouseLeave={tip.hide}
            />
          ))}
        </div>
        <div className="legend mt-4">
          {s.sortedFacets.map(([f, n]) => (
            <a key={f} href={hrefFor('explore', { facet: f })} className="no-underline hover:underline" onMouseMove={(e) => tip.show(e, f, FACET_DEF[f])} onMouseLeave={tip.hide}>
              <span className="sw" style={{ background: facetColor(f) }} />
              {shortFacet(f)} <span className="muted num">{n}</span>
            </a>
          ))}
        </div>
      </section>

      <section className="kpis" aria-label="Key figures">
        <Kpi v={fmt(s.n)} l="Concepts" n={`${VOCAB.levels.length} hierarchy levels`} />
        <Kpi v={fmt(s.top)} l="Top-level concepts" n={`${pct(s.top, s.n)} have no broader concept`} />
        <Kpi v={fmt(s.synonyms)} l="Synonyms" n={`on ${fmt(s.withSyn)} concepts (${pct(s.withSyn, s.n)})`} />
        <Kpi v={fmt(s.edges)} l="Typed relations" n={`from ${fmt(s.withRels)} concepts`} href={hrefFor('relations')} />
        <Kpi v={String(FACET_ORDER.length)} l="Facets" n={`${s.facets.get(largestF)} in the largest, ${Math.min(...s.facets.values())} in the smallest`} />
        <Kpi v={String(s.domains)} l="Domains" n={`plus ${new Set(CONCEPTS.map((c) => c.impact)).size} CGIAR impact areas`} href={hrefFor('heatmap')} />
        <Kpi v={`L${s.maxDepth}`} l="Maximum depth" n={`${s.deepest.length} concepts at level ${s.maxDepth}`} href={hrefFor('hierarchy')} />
        <Kpi v={pct(s.external, s.n)} l="Definitions with an external source" n={`${fmt(s.external)} of ${fmt(s.n)}`} href={hrefFor('sources')} />
      </section>

      <section className="grid-2">
        <div className="panel">
          <h2 className="h-sec">Facet composition</h2>
          <p className="sub mb-3">Share of the {fmt(s.n)} concepts in each facet. Select a segment to list its concepts.</p>
          <div className="fbar" role="list">
            {s.sortedFacets.map(([f, n]) => (
              <button
                key={f}
                role="listitem"
                aria-label={`${f}: ${n} concepts`}
                style={{ flex: n, background: facetColor(f) }}
                onClick={() => go('explore', { facet: f })}
                onMouseMove={(e) => tip.show(e, `${f}: ${n} concepts (${pct(n, s.n, 1)})`, FACET_DEF[f])}
                onMouseLeave={tip.hide}
              />
            ))}
          </div>
          <div className="mt-4 grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
            {s.sortedFacets.map(([f, n]) => (
              <a key={f} href={hrefFor('explore', { facet: f })} className="flex items-center gap-2 text-[13px] no-underline hover:underline">
                <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: facetColor(f) }} />
                <span className="flex-1 truncate">{f}</span>
                <span className="num muted">{n}</span>
                <span className="num muted w-11 text-right">{pct(n, s.n, 1)}</span>
              </a>
            ))}
          </div>
        </div>
        <div className="panel">
          <h2 className="h-sec">Climate scope</h2>
          <p className="sub mb-3">Whether a concept serves adaptation, mitigation or both.</p>
          <div className="fbar" style={{ height: 44 }}>
            {VOCAB.scopes.map((sc) => {
              const n = s.scopes.get(sc.name) ?? 0
              return (
                <button
                  key={sc.name}
                  style={{ flex: n, background: SCOPE_COLOR[sc.name] }}
                  aria-label={`${sc.name}: ${n}`}
                  onClick={() => go('explore', { scope: sc.name })}
                  onMouseMove={(e) => tip.show(e, `${sc.name}: ${n} (${pct(n, s.n, 1)})`, sc.def)}
                  onMouseLeave={tip.hide}
                />
              )
            })}
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4">
            {VOCAB.scopes.map((sc) => {
              const n = s.scopes.get(sc.name) ?? 0
              return (
                <a key={sc.name} href={hrefFor('explore', { scope: sc.name })} className="no-underline">
                  <div className="flex items-center gap-2 text-[12.5px] text-[color:var(--text-2)]">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: SCOPE_COLOR[sc.name] }} />
                    {sc.name}
                  </div>
                  <div className="kpi-v" style={{ fontSize: 24 }}>{n}</div>
                  <div className="kpi-n">{pct(n, s.n, 1)}</div>
                </a>
              )
            })}
          </div>
          <p className="sub mt-4">
            {fmt(s.conditionalA)} concepts are adaptation-conditional: they count as adaptation only when a facet rule is met. See{' '}
            <a className="link" href={hrefFor('lens')}>Adaptation & mitigation</a>.
          </p>
        </div>
      </section>

      <section>
        <h2 className="h-sec mb-2">What the data shows</h2>
        <div className="grid-3">
          <div className="insight">
            <b>{largestF}</b> is the largest facet: {largestN} concepts, {pct(largestN, s.n)} of the taxonomy. The next two are{' '}
            {s.sortedFacets[1][0]} ({s.sortedFacets[1][1]}) and {s.sortedFacets[2][0]} ({s.sortedFacets[2][1]}).
          </div>
          <div className="insight">
            The taxonomy leans to adaptation: <b>{pct(adaptOnly, s.n)}</b> of concepts are adaptation-only, against {pct(s.scopes.get('Mitigation') ?? 0, s.n)} mitigation-only and{' '}
            {pct(s.scopes.get('Adaptation + Mitigation') ?? 0, s.n)} serving both.
          </div>
          <div className="insight">
            <b>{s.fams[0][0]}</b> is the most cited definition source ({s.fams[0][1]} concepts), followed by {s.fams[1][0]} ({s.fams[1][1]}) and {s.fams[2][0]} ({s.fams[2][1]}).
          </div>
          <div className="insight">
            The most connected concept is <ConceptLink id={s.mostConnected.id} /> with {degree(s.mostConnected)} typed relations
            ({s.mostConnected.rels.length} outgoing, {s.mostConnected.inRels.length} incoming).
          </div>
          <div className="insight">
            The deepest branch reaches level {s.maxDepth}: {[...deepest.path, deepest.id].map((id, i) => (
              <span key={id}>{i > 0 && ' / '}{i === deepest.path.length ? <ConceptLink id={id} /> : BY_ID.get(id)!.label}</span>
            ))}.
          </div>
          <div className="insight">
            {fmt(s.examples)} concepts ({pct(s.examples, s.n)}) carry a CGIAR example, and the change log records <b>{fmt(DATA.changes.length)}</b> concept-level changes since v4.{' '}
            <a className="link" href={hrefFor('evolution')}>See the changes</a>.
          </div>
        </div>
      </section>
    </div>
  )
}

function Kpi({ v, l, n, href }: { v: string; l: string; n?: string; href?: string }) {
  const body = (
    <>
      <div className="kpi-v">{v}</div>
      <div className="kpi-l">{l}</div>
      {n && <div className="kpi-n">{n}</div>}
    </>
  )
  return href ? (
    <a className="kpi no-underline block hover:border-[color:var(--line-2)]" href={href}>
      {body}
    </a>
  ) : (
    <div className="kpi">{body}</div>
  )
}
