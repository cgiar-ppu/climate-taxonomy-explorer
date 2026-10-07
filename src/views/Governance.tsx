import * as d3 from 'd3'
import { useEffect, useMemo, useState } from 'react'
import { DATA, fmt, fmtDate } from '../data'
import { replaceParams } from '../router'
import { ConceptLink, Highlight, LinkifyIds, PageHead } from '../components/ui'

const PRINCIPLE: Record<string, string> = { F: 'Findable', A: 'Accessible', I: 'Interoperable', R: 'Reusable' }

export default function Governance({ params }: { params: URLSearchParams }) {
  const [type, setType] = useState(params.get('type') ?? '')
  const [q, setQ] = useState(params.get('q') ?? '')
  const [limit, setLimit] = useState(120)
  useEffect(() => {
    const p = new URLSearchParams()
    if (type) p.set('type', type)
    if (q) p.set('q', q)
    replaceParams('governance', p)
    setLimit(120)
  }, [type, q])

  const counts = useMemo(() => d3.rollups(DATA.dna, (v) => v.length, (d) => d.type).sort((a, b) => b[1] - a[1]), [])
  const absent = DATA.dna.filter((d) => d.status === 'absent').length
  const max = counts[0][1]
  const ql = q.trim().toLowerCase()
  const rows = DATA.dna.filter((d) => (!type || d.type === type) && (!ql || [d.word, d.type, d.reason, d.status].some((x) => x.toLowerCase().includes(ql))))
  const fairBy = d3.group(DATA.fair, (f) => f.principle)
  const fairYes = DATA.fair.filter((f) => f.state === 'Yes').length

  return (
    <div className="stack" style={{ gap: 20 }}>
      <PageHead
        title="Governance and FAIR"
        lede={`How the vocabulary is kept in shape: a register of ${fmt(DATA.dna.length)} words and IDs that must not be added, the log of decisions on change requests, and the FAIR self-assessment (${fairYes} of ${DATA.fair.length} tests met).`}
      />

      <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', alignItems: 'start' }} data-gov-grid>
        <div className="stack" style={{ gap: 16 }}>
        <div className="panel">
          <h2 className="h-sec">DO-NOT-ADD register by exclusion type</h2>
          <p className="sub mb-3">
            {fmt(DATA.dna.length)} entries; {fmt(absent)} are absent from v5 today, the rest live on as a label or synonym of another concept. Select a type to filter the table.
          </p>
          <div className="flex flex-col gap-1.5">
            {counts.map(([t, n]) => (
              <button
                key={t}
                className="grid items-center gap-3 text-left rounded-md px-1 py-0.5"
                style={{ gridTemplateColumns: '250px 1fr 36px', background: type === t ? 'var(--panel-2)' : 'transparent', border: 0 }}
                aria-pressed={type === t}
                onClick={() => setType(type === t ? '' : t)}
              >
                <span className="text-[12px] truncate" title={t}>{t}</span>
                <span className="h-3.5 rounded" style={{ width: `${(100 * n) / max}%`, background: type === t ? 'var(--accent)' : 'var(--line-2)' }} />
                <span className="text-[12.5px] num text-right">{n}</span>
              </button>
            ))}
          </div>
        </div>
          <div className="panel">
            <h2 className="h-sec">Decision log</h2>
            <p className="sub mb-3">{DATA.decisions.length} recorded {DATA.decisions.length === 1 ? 'decision' : 'decisions'} on change requests.</p>
            {DATA.decisions.map((d, i) => (
              <article key={i} className="text-[13px] flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip">{fmtDate(d.date)}</span>
                  <span className="chip">{d.kind}</span>
                  <span className="badge" style={{ color: '#e07b6a', borderColor: '#e07b6a' }}>{d.decision}</span>
                </div>
                <div><span className="muted">Proposal:</span> {d.proposal}</div>
                <div><span className="muted">Reason:</span> <LinkifyIds text={d.reason} /></div>
                <div><span className="muted">Redirect:</span> <LinkifyIds text={d.redirect} /></div>
                <div><span className="muted">Change to the vocabulary:</span> {d.change}. <span className="muted">Decided by the {d.decidedByRole}.</span></div>
                <div><a className="link" href={d.issue} target="_blank" rel="noreferrer noopener">Open the request on GitHub</a></div>
              </article>
            ))}
          </div>
        </div>
        <div className="stack" style={{ gap: 16 }}>
          <div className="panel">
            <h2 className="h-sec">FAIR self-assessment</h2>
            <p className="sub mb-3">The custodians' own checklist: {fairYes} met, {DATA.fair.length - fairYes} pending or proposed.</p>
            <div className="flex flex-col gap-3">
              {[...fairBy].map(([p, items]) => (
                <div key={p}>
                  <div className="text-[12.5px] font-semibold mb-1" style={{ color: 'var(--text-2)' }}>{PRINCIPLE[p] ?? p}</div>
                  <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
                    {items.map((f, i) => {
                      const yes = f.state === 'Yes'
                      return (
                        <li key={i} className="flex gap-2.5 text-[13px]">
                          <span aria-hidden className={yes ? 'fair-yes' : 'fair-pending'} style={{ width: 18, flex: 'none', fontWeight: 700 }}>{yes ? '✓' : '○'}</span>
                          <div>
                            <div>{f.test}</div>
                            <div className="text-[12.5px] muted">
                              <span className={yes ? 'fair-yes' : 'fair-pending'} style={{ fontWeight: 500 }}>{f.state || 'Status'}</span>: {f.text}
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <h2 className="h-sec mr-auto">Register entries</h2>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)} aria-label="Exclusion type">
            <option value="">All exclusion types</option>
            {counts.map(([t, n]) => <option key={t} value={t}>{t} ({n})</option>)}
          </select>
          <input className="input" style={{ width: 260 }} placeholder="Search word, reason or status" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the register" />
          <span className="text-[12.5px] muted num">{fmt(rows.length)} rows</span>
        </div>
        <div className="tbl-wrap" style={{ maxHeight: 600 }}>
          <table className="tbl">
            <thead><tr><th>Word or ID</th><th>Exclusion type</th><th>Reason</th><th>Status in v5</th></tr></thead>
            <tbody>
              {rows.slice(0, limit).map((d, i) => (
                <tr key={i}>
                  <td className="font-medium" style={{ minWidth: 150 }}><Highlight text={d.word} q={q} /></td>
                  <td className="text-[12px] whitespace-nowrap">{d.type}</td>
                  <td className="wrap text-[12.5px]"><LinkifyIds text={d.reason} /></td>
                  <td className="text-[12.5px]" style={{ minWidth: 170 }}>
                    {d.statusIds.length ? (
                      <span>
                        {d.status.replace(/\b[A-Z]{3}_\d+\b.*$/, '').replace(/^the label of\s*$/, 'Label of ').trim() || 'See'}{' '}
                        {d.statusIds.map((id) => <ConceptLink key={id} id={id} />)}
                      </span>
                    ) : (
                      <span className="muted">{d.status}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > limit && <button className="btn mt-3" onClick={() => setLimit((l) => l + 300)}>Show more rows</button>}
      </div>
      <style>{`@media (max-width: 1100px){ [data-gov-grid]{ grid-template-columns: 1fr !important; } }`}</style>
    </div>
  )
}
