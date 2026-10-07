import { useEffect, useRef, useState } from 'react'
import { BY_ID, CHANGES_BY_ID, SYN_CHANGES_BY_ID, officialUrl, tagKind, RULES, VOCAB, shortFacet, DATA } from '../data'
import { closeConcept, hrefFor } from '../router'
import { ConceptChip, ConceptLink, FacetChip, Icon, LinkifyIds, RelLabel, useTip } from './ui'

const CTL_DEF = (list: { name: string; def: string }[], v: string) => list.find((x) => x.name === v)?.def ?? ''

function TagLine({ lens, tag, cond }: { lens: 'adaptation' | 'mitigation'; tag: string; cond: string }) {
  const kind = tagKind(tag)
  const rule = RULES[lens].find((r) => r.text === cond)
  const color = kind === 'specific' ? (lens === 'adaptation' ? 'var(--tag-specific)' : 'var(--mit-specific)') : kind === 'conditional' ? (lens === 'adaptation' ? 'var(--tag-conditional)' : 'var(--mit-conditional)') : 'var(--tag-na)'
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: color, border: '1px solid var(--line-2)' }} />
        <span>{tag}</span>
      </div>
      {rule ? (
        <div className="mt-1 text-[12.5px] text-[color:var(--text-2)]">
          <div>Counts as {lens} when {lowerFirst(rule.when)}.</div>
          {rule.not && <div className="mt-0.5">Not {lens} when {rule.not}.</div>}
        </div>
      ) : cond === 'Intrinsic' ? (
        <div className="mt-1 text-[12.5px] muted">Intrinsic: always counts as {lens}.</div>
      ) : null}
    </div>
  )
}
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

export function Drawer({ id }: { id: string | null }) {
  const c = id ? BY_ID.get(id) : null
  const ref = useRef<HTMLDivElement>(null)
  const tip = useTip()
  const [showAllChanges, setShowAllChanges] = useState(false)

  useEffect(() => {
    if (!id) return
    tip.hide()
    setShowAllChanges(false)
    const prev = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeConcept()
    }
    window.addEventListener('keydown', onKey)
    ref.current?.querySelector('.drawer-body')?.scrollTo(0, 0)
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [id])

  if (!id) return null
  if (!c) {
    const retired = DATA.retired.find((r) => r.id === id)
    return (
      <>
        <div className="scrim" onClick={closeConcept} />
        <aside className="drawer" ref={ref} tabIndex={-1} aria-label="Concept details" role="dialog">
          <div className="drawer-head flex justify-between">
            <h2 className="h-page" style={{ fontSize: 20 }}>{id}</h2>
            <button className="iconbtn" onClick={closeConcept} aria-label="Close"><Icon name="close" /></button>
          </div>
          <div className="drawer-body">
            {retired ? (
              <p>
                {retired.label} ({retired.facet}) was retired in v5. Successor: <LinkifyIds text={retired.successor} />. Reason: {retired.reason}
              </p>
            ) : (
              <p>No concept with the ID {id} exists in v5.</p>
            )}
          </div>
        </aside>
      </>
    )
  }

  const changes = CHANGES_BY_ID.get(c.id) ?? []
  const synChanges = SYN_CHANGES_BY_ID.get(c.id) ?? []
  const allChanges = [
    ...changes.map((ch) => ({ k: ch.type, d: ch.field === '(new concept)' ? 'New in v5' : ch.type === 'RETIRED' ? '' : `${ch.field}: ${ch.v4 || '(empty)'}  ⟶  ${ch.v5 || '(empty)'}`, why: ch.why })),
    ...synChanges.map((s) => ({
      k: `SYNONYM ${s.type}`,
      d: s.type === 'MOVED' ? `“${s.syn}” moved from ${s.fromId} to ${s.toId}` : `“${s.syn}”`,
      why: s.why,
    })),
  ]
  const shownChanges = showAllChanges ? allChanges : allChanges.slice(0, 6)

  return (
    <>
      <div className="scrim" onClick={closeConcept} />
      <aside className="drawer" ref={ref} tabIndex={-1} aria-label={`Concept ${c.label}`} role="dialog" aria-modal="true">
        <div className="drawer-head">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <nav aria-label="Path" className="flex flex-wrap items-center gap-1 text-[12px] muted mb-1.5">
                <a className="link muted" href={hrefFor('explore', { facet: c.rootFacet })} style={{ color: 'var(--muted)' }}>{shortFacet(c.rootFacet)}</a>
                {c.path.map((p) => (
                  <span key={p} className="inline-flex items-center gap-1">
                    <span aria-hidden>/</span>
                    <ConceptLink id={p} className="text-[12px]" />
                  </span>
                ))}
              </nav>
              <h2 className="h-page" style={{ fontSize: 22 }}>{c.label}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="idtag">{c.id}</span>
                <FacetChip facet={c.facet} />
                <span className="chip">Level {c.level}</span>
                <span className="chip">{c.scope}</span>
              </div>
            </div>
            <button className="iconbtn" onClick={closeConcept} aria-label="Close concept details"><Icon name="close" /></button>
          </div>
        </div>
        <div className="drawer-body">
          <section className="dsec">
            <h4>Definition</h4>
            <p className="m-0" style={{ lineHeight: 1.6 }}>{c.def || <span className="muted">No definition.</span>}</p>
            <p className="m-0 mt-1.5 text-[12.5px] muted">Source: {c.defSrc || 'none given'} <span className="opacity-70">({c.srcFamily})</span></p>
          </section>

          {c.syn.length > 0 && (
            <section className="dsec">
              <h4>Synonyms ({c.syn.length})</h4>
              <div className="flex flex-wrap gap-1.5">{c.syn.map((s) => <span key={s} className="chip">{s}</span>)}</div>
            </section>
          )}

          {c.children.length > 0 && (
            <section className="dsec">
              <h4>Narrower concepts ({c.children.length})</h4>
              <div className="flex flex-wrap gap-1.5">{c.children.map((ch) => <ConceptChip key={ch} id={ch} />)}</div>
            </section>
          )}

          {(c.rels.length > 0 || c.inRels.length > 0) && (
            <section className="dsec">
              <h4>Typed relations</h4>
              <div className="flex flex-col gap-1.5 text-[13px]">
                {c.rels.map((r, i) => (
                  <div key={'o' + i} className="flex items-baseline gap-2 flex-wrap">
                    <span className="muted">this</span> <RelLabel t={r.t} /> <ConceptLink id={r.to} />
                  </div>
                ))}
                {c.inRels.map((r, i) => (
                  <div key={'i' + i} className="flex items-baseline gap-2 flex-wrap">
                    <ConceptLink id={r.from} /> <RelLabel t={r.t} /> <span className="muted">this</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="dsec">
            <h4>Adaptation and mitigation</h4>
            <div className="grid gap-3">
              <TagLine lens="adaptation" tag={c.aTag} cond={c.aCond} />
              <TagLine lens="mitigation" tag={c.mTag} cond={c.mCond} />
              {(c.anchorA || c.anchorM || c.hazard) && (
                <div className="flex gap-1.5 flex-wrap">
                  {c.anchorA && <span className="chip">Adaptation anchor</span>}
                  {c.anchorM && <span className="chip">Mitigation anchor</span>}
                  {c.hazard && <span className="chip">Climate hazard</span>}
                </div>
              )}
            </div>
          </section>

          <section className="dsec">
            <h4>Classification</h4>
            <dl className="dl">
              <dt>Domain</dt>
              <dd><a className="link" href={hrefFor('explore', { domain: c.domain })} title={CTL_DEF(VOCAB.domains, c.domain)}>{c.domain}</a></dd>
              <dt>Impact area</dt>
              <dd><a className="link" href={hrefFor('explore', { impact: c.impact })}>{c.impact}</a></dd>
              <dt>Pathway stage</dt>
              <dd><a className="link" href={hrefFor('explore', { stage: c.stage })} title={CTL_DEF(VOCAB.pathwayStages, c.stage)}>{c.stage}</a> <span className="muted text-[12px]">{CTL_DEF(VOCAB.pathwayStages, c.stage)}</span></dd>
              <dt>Climate scope</dt>
              <dd>{c.scope} <span className="muted text-[12px]">{CTL_DEF(VOCAB.scopes, c.scope)}</span></dd>
              <dt>Provenance</dt>
              <dd>{c.prov.length ? c.prov.join(', ') : '—'}</dd>
            </dl>
          </section>

          {c.example && (
            <section className="dsec">
              <h4>CGIAR example</h4>
              <p className="m-0 text-[13.5px]" style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>{c.example}</p>
            </section>
          )}

          {c.refs.length > 0 && (
            <section className="dsec">
              <h4>References</h4>
              <ul className="m-0 pl-4 text-[12.5px]">
                {c.refs.map((u) => (
                  <li key={u} className="break-all"><a className="link" href={u} target="_blank" rel="noreferrer noopener">{u}</a></li>
                ))}
              </ul>
            </section>
          )}

          {allChanges.length > 0 && (
            <section className="dsec">
              <h4>Changes from v4 to v5 ({allChanges.length})</h4>
              <ul className="m-0 p-0 list-none flex flex-col gap-2">
                {shownChanges.map((ch, i) => (
                  <li key={i} className="text-[12.5px]" style={{ borderLeft: '2px solid var(--line-2)', paddingLeft: 10 }}>
                    <div className="font-medium" style={{ color: 'var(--text)' }}>{ch.k.charAt(0) + ch.k.slice(1).toLowerCase()}</div>
                    {ch.d && <div style={{ color: 'var(--text-2)' }} className="break-words"><LinkifyIds text={ch.d} /></div>}
                    {ch.why && <div className="muted break-words">Why: <LinkifyIds text={ch.why} /></div>}
                  </li>
                ))}
              </ul>
              {allChanges.length > 6 && (
                <button className="btn mt-2" onClick={() => setShowAllChanges((s) => !s)}>{showAllChanges ? 'Show fewer' : `Show all ${allChanges.length} changes`}</button>
              )}
            </section>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <a className="btn btn-primary" href={officialUrl(c.id)} target="_blank" rel="noreferrer noopener">
              Open on the official site <Icon name="ext" size={14} />
            </a>
            <button className="btn" onClick={() => { try { navigator.clipboard?.writeText(`${location.href.split('#')[0]}#/concept/${c.id}`).catch(() => {}) } catch { /* clipboard unavailable */ } }}>Copy link</button>
          </div>
        </div>
      </aside>
    </>
  )
}
