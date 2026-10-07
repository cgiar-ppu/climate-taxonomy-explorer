import * as d3 from 'd3'
import { useMemo } from 'react'
import { CONCEPTS, FACET_ORDER, facetColor, fmt, pct, shortFacet, VOCAB } from '../data'
import { go, hrefFor } from '../router'
import { PageHead, useTip } from '../components/ui'

const PROV_NOTE: Record<string, string> = {
  'Domain expert': 'Proposed or shaped by a domain expert of the taxonomy team.',
  'Lexicon consensus': 'Matches the consensus wording of the Lexicon.',
  'Restructure (v5)': 'Created or split during the version 5 restructure.',
  'PRMS pilot': 'Came from the first PRMS pilot.',
}

export default function Sources() {
  const tip = useTip()
  const n = CONCEPTS.length
  const s = useMemo(() => {
    const fam = d3.rollups(CONCEPTS, (v) => v, (c) => c.srcFamily).sort((a, b) => b[1].length - a[1].length)
    const ipcc = d3.rollups(CONCEPTS.filter((c) => c.srcFamily === 'IPCC'), (v) => v.length, (c) => c.srcSub).sort((a, b) => b[1] - a[1])
    const specific = d3
      .rollups(CONCEPTS, (v) => v.length, (c) => c.defSrc.split(';')[0].split(':')[0].replace(/\s*\(.*\)\s*$/, '').trim() || '(none)')
      .sort((a, b) => b[1] - a[1])
      .slice(0, 16)
    const multi = CONCEPTS.filter((c) => c.defSrc.includes(';')).length
    const prov = d3.rollups(CONCEPTS.flatMap((c) => c.prov.map((p) => ({ p, c }))), (v) => v.length, (x) => x.p).sort((a, b) => b[1] - a[1])
    const combos = d3.rollups(CONCEPTS, (v) => v.length, (c) => (c.prov.length ? c.prov.join(' + ') : '(none)')).sort((a, b) => b[1] - a[1])
    const external = CONCEPTS.filter((c) => c.defSrc && c.srcFamily !== 'CGIAR (no external source)').length
    return { fam, ipcc, specific, multi, prov, combos, external }
  }, [])
  const maxFam = s.fam[0][1].length
  const maxSpec = s.specific[0][1]
  const maxProv = s.prov[0][1]

  return (
    <div className="stack" style={{ gap: 20 }}>
      <PageHead
        title="Sources and provenance"
        lede={`Where definitions come from, and how each concept entered the taxonomy. ${fmt(s.external)} of ${fmt(n)} definitions (${pct(s.external, n)}) cite an external source; ${fmt(s.multi)} cite more than one. Families are grouped from the first source listed.`}
      />
      <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', alignItems: 'start' }} data-src-grid>
        <div className="panel">
          <h2 className="h-sec">Definition source families</h2>
          <p className="sub mb-3">Bars are split by facet. Select a bar to list its concepts.</p>
          <div className="flex flex-col gap-2">
            {s.fam.map(([f, cs]) => {
              const byFacet = d3.rollup(cs, (v) => v.length, (c) => c.facet)
              return (
                <div key={f} className="grid items-center gap-3" style={{ gridTemplateColumns: '190px 1fr 64px' }}>
                  <a className="text-[13px] truncate no-underline hover:underline" href={hrefFor('explore', { src: f })}>{f}</a>
                  <div className="flex h-5 rounded overflow-hidden" style={{ width: `${(100 * cs.length) / maxFam}%`, gap: 1 }}>
                    {FACET_ORDER.filter((x) => byFacet.get(x)).map((x) => (
                      <button
                        key={x}
                        aria-label={`${f}, ${x}: ${byFacet.get(x)}`}
                        style={{ flex: byFacet.get(x), background: facetColor(x), border: 0, padding: 0 }}
                        onClick={() => go('explore', { src: f, facet: x })}
                        onMouseMove={(e) => tip.show(e, `${f}: ${byFacet.get(x)} ${shortFacet(x)} concepts`, `${cs.length} concepts in this family`)}
                        onMouseLeave={tip.hide}
                      />
                    ))}
                  </div>
                  <span className="text-[12.5px] num text-right"><span>{cs.length}</span> <span className="muted">{pct(cs.length, n)}</span></span>
                </div>
              )
            })}
          </div>
          <p className="sub mt-3">“CGIAR (no external source)” groups definitions written against internal CGIAR categories (portfolio, partnership and actor categories) rather than a published glossary.</p>
        </div>
        <div className="stack" style={{ gap: 16 }}>
          <div className="panel">
            <h2 className="h-sec">IPCC, by report</h2>
            <p className="sub mb-3">{s.ipcc.reduce((a, b) => a + b[1], 0)} concepts cite the IPCC first.</p>
            <div className="flex flex-col gap-1.5">
              {s.ipcc.map(([k, v]) => (
                <div key={k} className="grid items-center gap-2" style={{ gridTemplateColumns: '170px 1fr 30px' }}>
                  <span className="text-[12.5px] truncate">{k}</span>
                  <div className="h-3.5 rounded" style={{ width: `${(100 * v) / s.ipcc[0][1]}%`, background: 'var(--tag-specific)' }} />
                  <span className="text-[12px] num muted text-right">{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="panel">
            <h2 className="h-sec">Most cited sources</h2>
            <p className="sub mb-3">First-listed source, without the entry name.</p>
            <div className="flex flex-col gap-1.5">
              {s.specific.map(([k, v]) => (
                <div key={k} className="grid items-center gap-2" style={{ gridTemplateColumns: '200px 1fr 30px' }}>
                  <span className="text-[12.5px] truncate" title={k}>{k}</span>
                  <div className="h-3.5 rounded" style={{ width: `${(100 * v) / maxSpec}%`, background: 'var(--line-2)' }} />
                  <span className="text-[12px] num muted text-right">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <h2 className="h-sec">Provenance classes</h2>
          <p className="sub mb-3">How concepts entered the taxonomy, as controlled classes. A concept can carry more than one class, so the bars add up to more than {fmt(n)}.</p>
          <div className="flex flex-col gap-2.5">
            {s.prov.map(([p, v]) => (
              <div key={p}>
                <div className="flex items-baseline justify-between text-[13px]">
                  <a className="no-underline hover:underline" href={hrefFor('explore', { prov: p })}>{p}</a>
                  <span className="num"><span>{v}</span> <span className="muted">{pct(v, n)}</span></span>
                </div>
                <div className="h-2.5 rounded mt-1" style={{ width: `${(100 * v) / maxProv}%`, background: 'var(--accent)', opacity: 0.85 }} />
                {PROV_NOTE[p] && <div className="text-[12px] muted mt-0.5">{PROV_NOTE[p]}</div>}
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <h2 className="h-sec">Combinations of classes</h2>
          <p className="sub mb-3">Each concept counted once.</p>
          <table className="tbl" style={{ fontSize: 13 }}>
            <thead>
              <tr><th>Provenance classes</th><th className="text-right">Concepts</th><th className="text-right">Share</th></tr>
            </thead>
            <tbody>
              {s.combos.map(([k, v]) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td className="text-right num">{v}</td>
                  <td className="text-right num muted">{pct(v, n, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="sub mt-3">The {VOCAB.provClasses.length} classes come from the custodians' provenance map; the working notes behind them are not shown.</p>
        </div>
      </div>
      <style>{`@media (max-width: 1100px){ [data-src-grid]{ grid-template-columns: 1fr !important; } }`}</style>
    </div>
  )
}
