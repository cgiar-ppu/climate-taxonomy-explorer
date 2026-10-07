import { useMemo, useState } from 'react'
import { CONCEPTS, FACET_ORDER, facetColor, fmt, pct, RULES, shortFacet, tagKind, VOCAB, type Rule } from '../data'
import { go, hrefFor } from '../router'
import { ConceptChip, FacetDot, PageHead, Seg, useTip } from '../components/ui'

const KINDS = ['specific', 'conditional', 'na'] as const
const KIND_LABEL = { specific: 'specific', conditional: 'conditional', na: 'n/a' }

export default function Lens() {
  const tip = useTip()
  const [mode, setMode] = useState<'count' | 'share'>('count')
  const [hazardsOpen, setHazardsOpen] = useState(false)

  const rows = useMemo(
    () =>
      FACET_ORDER.map((f) => {
        const cs = CONCEPTS.filter((c) => c.facet === f)
        const a = { specific: 0, conditional: 0, na: 0 }
        const m = { specific: 0, conditional: 0, na: 0 }
        cs.forEach((c) => {
          a[tagKind(c.aTag)]++
          m[tagKind(c.mTag)]++
        })
        return { f, n: cs.length, a, m }
      }).sort((x, y) => y.n - x.n),
    [],
  )
  const maxN = Math.max(...rows.map((r) => r.n))
  const anchorsA = CONCEPTS.filter((c) => c.anchorA)
  const anchorsM = CONCEPTS.filter((c) => c.anchorM)
  const hazards = CONCEPTS.filter((c) => c.hazard).sort((a, b) => a.level - b.level || a.label.localeCompare(b.label))
  const tagDefs = Object.fromEntries([...VOCAB.adaptationTags, ...VOCAB.mitigationTags].map((t) => [t.name, t.def]))
  const totals = (lens: 'a' | 'm') => KINDS.map((k) => rows.reduce((s, r) => s + r[lens][k], 0))

  const color = (lens: 'a' | 'm', k: (typeof KINDS)[number]) =>
    k === 'na' ? 'var(--tag-na)' : lens === 'a' ? (k === 'specific' ? 'var(--tag-specific)' : 'var(--tag-conditional)') : k === 'specific' ? 'var(--mit-specific)' : 'var(--mit-conditional)'

  const Bars = ({ lens }: { lens: 'a' | 'm' }) => {
    const word = lens === 'a' ? 'Adaptation' : 'Mitigation'
    const t = totals(lens)
    return (
      <div className="panel">
        <h2 className="h-sec">{word} tag by facet</h2>
        <p className="sub mb-3">
          {fmt(t[0])} {word.toLowerCase()}-specific, {fmt(t[1])} {word.toLowerCase()}-conditional, {fmt(t[2])} not {word.toLowerCase()}-relevant. Select a segment to list the concepts.
        </p>
        <div className="flex flex-col gap-1.5">
          {rows.map((r) => (
            <div key={r.f} className="grid items-center gap-2" style={{ gridTemplateColumns: '128px 1fr 40px' }}>
              <a href={hrefFor('explore', { facet: r.f })} className="text-[12.5px] truncate no-underline hover:underline flex items-center gap-1.5">
                <FacetDot facet={r.f} /> {shortFacet(r.f)}
              </a>
              <div className="flex h-[18px] rounded overflow-hidden" style={{ width: mode === 'count' ? `${(100 * r.n) / maxN}%` : '100%', minWidth: 4, gap: 1 }}>
                {KINDS.map((k) => {
                  const n = r[lens][k]
                  if (!n) return null
                  const tag = k === 'na' ? 'n/a' : `${word}-${k}`
                  return (
                    <button
                      key={k}
                      aria-label={`${r.f}, ${tag}: ${n}`}
                      style={{ flex: n, background: color(lens, k), border: 0, padding: 0 }}
                      onClick={() => go('explore', { facet: r.f, [lens === 'a' ? 'atag' : 'mtag']: tag })}
                      onMouseMove={(e) => tip.show(e, `${r.f}: ${n} ${word.toLowerCase()}-${KIND_LABEL[k]}`, `${pct(n, r.n)} of the facet. ${tagDefs[tag] ?? ''}`)}
                      onMouseLeave={tip.hide}
                    />
                  )
                })}
              </div>
              <span className="text-[12px] muted num text-right">{r.n}</span>
            </div>
          ))}
        </div>
        <div className="legend mt-3">
          {KINDS.map((k) => (
            <span key={k}>
              <span className="sw" style={{ background: color(lens, k), border: '1px solid var(--line-2)' }} />
              {k === 'na' ? 'n/a' : `${word}-${k}`}
            </span>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="stack" style={{ gap: 20 }}>
      <PageHead
        title="Adaptation and mitigation"
        lede="The taxonomy's special feature: every concept says whether it is intrinsically about adaptation or mitigation (specific), counts only when a rule is met (conditional), or does not apply (n/a). The rules are written once per facet."
        right={<Seg label="Bar scale" value={mode} onChange={setMode} options={[{ v: 'count', l: 'Counts' }, { v: 'share', l: 'Shares' }]} />}
      />
      <div className="grid-2">
        <Bars lens="a" />
        <Bars lens="m" />
      </div>

      <section className="grid-3">
        <a className="kpi no-underline" href={hrefFor('explore', { flag: 'anchorA' })}>
          <div className="kpi-v">{anchorsA.length}</div>
          <div className="kpi-l">Adaptation anchors</div>
          <div className="kpi-n">Concepts whose presence alone makes a result adaptation-relevant</div>
        </a>
        <a className="kpi no-underline" href={hrefFor('explore', { flag: 'anchorM' })}>
          <div className="kpi-v">{anchorsM.length}</div>
          <div className="kpi-l">Mitigation anchors</div>
          <div className="kpi-n">Concepts whose presence alone makes a result mitigation-relevant</div>
        </a>
        <button className="kpi text-left" onClick={() => setHazardsOpen((o) => !o)} aria-expanded={hazardsOpen}>
          <div className="kpi-v">{hazards.length}</div>
          <div className="kpi-l">Climate hazards</div>
          <div className="kpi-n">{hazardsOpen ? 'Hide the list' : 'Show all hazards'}; conditional rules refer to them</div>
        </button>
      </section>
      <p className="sub" style={{ marginTop: -8 }}>Anchor and hazard flags are the derived fields of the source data (derived.is_anchor_adaptation, is_anchor_mitigation, is_hazard).</p>
      {hazardsOpen && (
        <div className="panel">
          <h2 className="h-sec mb-2">Climate hazards ({hazards.length})</h2>
          <div className="flex flex-wrap gap-1.5">{hazards.map((c) => <ConceptChip key={c.id} id={c.id} />)}</div>
        </div>
      )}

      {(['adaptation', 'mitigation'] as const).map((lens) => (
        <section key={lens}>
          <h2 className="h-sec">Decision rules for {lens}</h2>
          <p className="sub mb-3">
            Each rule is the condition sentence the data stores for {lens}-conditional concepts, one per facet. {RULES[lens].length} distinct rules carried by{' '}
            {RULES[lens].reduce((s, r) => s + r.concepts.length, 0)} concepts.
          </p>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))' }}>
            {RULES[lens].map((r) => <RuleCard key={r.key} r={r} />)}
          </div>
        </section>
      ))}
    </div>
  )
}

function RuleCard({ r }: { r: Rule }) {
  const facets = [...new Set(r.concepts.map((c) => c.facet))]
  const tags = new Map<string, number>()
  r.concepts.forEach((c) => {
    const t = r.lens === 'adaptation' ? c.aTag : c.mTag
    tags.set(t, (tags.get(t) ?? 0) + 1)
  })
  const lens = r.lens
  return (
    <article className="rulecard">
      <div className="flex items-center gap-2">
        <span className="inline-block w-3 h-3 rounded-sm" style={{ background: FACET_ORDER.includes(r.subject) ? facetColor(r.subject) : 'var(--muted)' }} />
        <h3 className="m-0 text-[15px] font-semibold">{r.subject}</h3>
        <span className="ml-auto chip num">{r.concepts.length} {r.concepts.length === 1 ? 'concept' : 'concepts'}</span>
      </div>
      {r.note && <div className="text-[12.5px] muted">{r.note}.</div>}
      <div className="when text-[13px]">
        <div className="muted text-[12px]">Counts as {lens} when</div>
        {r.when}
      </div>
      {r.not && (
        <div className="not text-[13px]">
          <div className="muted text-[12px]">Does not count as {lens} when</div>
          {r.not}
        </div>
      )}
      <div className="text-[12px] muted">
        {[...tags].map(([t, n]) => `${n} ${t}`).join(', ')}
        {facets.length > 1 || facets[0] !== r.subject ? `. Carried by concepts in: ${facets.join(', ')}` : ''}
      </div>
      <div>
        <a className="btn" href={hrefFor('explore', { [lens === 'adaptation' ? 'arule' : 'mrule']: r.subject })}>
          {r.concepts.length === 1 ? 'Show this concept' : `Show these ${r.concepts.length} concepts`}
        </a>
      </div>
    </article>
  )
}
