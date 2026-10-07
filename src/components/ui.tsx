import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { BY_ID, FACET_DEF, facetColor, shortFacet, REL_DEF } from '../data'
import { openConcept } from '../router'

// ---------------------------------------------------------------- shared tooltip
interface TipState { x: number; y: number; title: ReactNode; body?: ReactNode }
const TipCtx = createContext<{ show: (e: { clientX: number; clientY: number }, title: ReactNode, body?: ReactNode) => void; hide: () => void }>({
  show: () => {},
  hide: () => {},
})
export function TipProvider({ children }: { children: ReactNode }) {
  const [tip, setTip] = useState<TipState | null>(null)
  const show = useCallback((e: { clientX: number; clientY: number }, title: ReactNode, body?: ReactNode) => {
    setTip({ x: e.clientX, y: e.clientY, title, body })
  }, [])
  const hide = useCallback(() => setTip(null), [])
  let style: React.CSSProperties = {}
  if (tip) {
    const w = 340
    const left = tip.x + 16 + w > window.innerWidth ? tip.x - w - 12 : tip.x + 16
    const top = Math.min(tip.y + 14, window.innerHeight - 120)
    style = { left: Math.max(8, left), top }
  }
  return (
    <TipCtx.Provider value={{ show, hide }}>
      {children}
      {tip && (
        <div className="tip" style={style} role="tooltip">
          <div className="tt">{tip.title}</div>
          {tip.body && <div className="td">{tip.body}</div>}
        </div>
      )}
    </TipCtx.Provider>
  )
}
export const useTip = () => useContext(TipCtx)

// ---------------------------------------------------------------- chips
export function FacetDot({ facet, size = 8 }: { facet: string; size?: number }) {
  return <span className="dot" style={{ width: size, height: size, background: facetColor(facet), borderRadius: '50%', display: 'inline-block', flex: 'none' }} />
}

export function FacetChip({ facet, onClick, pressed, all }: { facet: string; onClick?: () => void; pressed?: boolean; all?: boolean }) {
  const tip = useTip()
  const props = {
    className: 'chip' + (pressed === false ? ' dim' : '') + (all ? ' all' : ''),
    onMouseMove: (e: React.MouseEvent) => tip.show(e, facet, FACET_DEF[facet]),
    onMouseLeave: tip.hide,
  }
  const inner = (
    <>
      <FacetDot facet={facet} />
      <span className="t">{shortFacet(facet)}</span>
    </>
  )
  if (onClick)
    return (
      <button type="button" {...props} aria-pressed={pressed} onClick={onClick}>
        {inner}
      </button>
    )
  return <span {...props}>{inner}</span>
}

/** A clickable concept name that opens the drawer. */
export function ConceptLink({ id, showId = false, className = '' }: { id: string; showId?: boolean; className?: string }) {
  const c = BY_ID.get(id)
  const tip = useTip()
  if (!c) return <span className="idtag">{id}</span>
  return (
    <button
      type="button"
      className={'link inline-flex items-baseline gap-1.5 text-left ' + className}
      onClick={() => {
        tip.hide()
        openConcept(id)
      }}
      onMouseMove={(e) => tip.show(e, c.label, <>{c.def.slice(0, 220)}{c.def.length > 220 ? '…' : ''}</>)}
      onMouseLeave={tip.hide}
    >
      <FacetDot facet={c.facet} size={7} />
      <span>{c.label}</span>
      {showId && <span className="idtag">{c.id}</span>}
    </button>
  )
}

export function ConceptChip({ id }: { id: string }) {
  const c = BY_ID.get(id)
  const tip = useTip()
  if (!c) return <span className="chip">{id}</span>
  return (
    <button
      type="button"
      className="chip"
      onClick={() => {
        tip.hide()
        openConcept(id)
      }}
      onMouseMove={(e) => tip.show(e, `${c.label} (${c.id})`, <>{c.def.slice(0, 200)}{c.def.length > 200 ? '…' : ''}</>)}
      onMouseLeave={tip.hide}
    >
      <span className="dot" style={{ background: facetColor(c.facet) }} />
      <span className="t">{c.label}</span>
    </button>
  )
}

export function RelLabel({ t }: { t: string }) {
  const tip = useTip()
  return (
    <span
      className="idtag"
      style={{ borderBottom: '1px dotted var(--line-2)', cursor: 'help' }}
      onMouseMove={(e) => tip.show(e, t, REL_DEF[t])}
      onMouseLeave={tip.hide}
    >
      {t}
    </span>
  )
}

/** Turn concept IDs inside free text into clickable links. */
export function LinkifyIds({ text }: { text: string }) {
  const parts: ReactNode[] = []
  const re = /\b(?:CRK|CDI|SYS|INT|OUT|OTC|IMP|ADP|TRT|STK|CCC)_\d+\b/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const id = m[0]
    parts.push(
      BY_ID.has(id) ? (
        <button key={i++} type="button" className="link idtag" style={{ color: 'var(--text)' }} onClick={() => openConcept(id)}>
          {id}
        </button>
      ) : (
        <span key={i++}>{id}</span>
      ),
    )
    last = m.index + id.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}

export function PageHead({ title, lede, right }: { title: string; lede?: ReactNode; right?: ReactNode }) {
  return (
    <div className="pagehead">
      <div>
        <h1 className="h-page">{title}</h1>
        {lede && <p className="lede">{lede}</p>}
      </div>
      {right}
    </div>
  )
}

export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.v} type="button" aria-pressed={value === o.v} onClick={() => onChange(o.v)}>
          {o.l}
        </button>
      ))}
    </div>
  )
}

export function Highlight({ text, q }: { text: string; q: string }) {
  if (!q.trim()) return <>{text}</>
  const terms = q.trim().split(/\s+/).filter((t) => t.length > 1).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (!terms.length) return <>{text}</>
  const re = new RegExp(`(${terms.join('|')})`, 'ig')
  return (
    <>
      {text.split(re).map((p, i) => (i % 2 === 1 ? <mark key={i} className="hl">{p}</mark> : p))}
    </>
  )
}

// ---------------------------------------------------------------- icons (inline, 16px stroke)
const P = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
)
export const ICONS: Record<string, ReactNode> = {
  overview: P('M4 13h6V4H4zM14 20h6v-9h-6zM14 8h6V4h-6zM4 20h6v-3H4z'),
  hierarchy: P('M12 3a9 9 0 1 0 9 9h-9zM12 3v9M15 3.5A9 9 0 0 1 20.5 9H15z'),
  relations: P('M6 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M18 7m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M12 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M8 6.5l8 .5M7 8l4 8.2M17 9l-4 7.3'),
  lens: P('M12 3v18M5 7c3 0 4 2 7 2s4-2 7-2M5 17c3 0 4-2 7-2s4 2 7 2'),
  flow: P('M3 6h4c5 0 5 12 10 12h4M3 18h4c2 0 3-2 4-4M21 6h-4c-2 0-3 2-4 4'),
  heatmap: P('M4 4h4v4H4zM10 4h4v4h-4zM16 4h4v4h-4zM4 10h4v4H4zM10 10h4v4h-4zM16 10h4v4h-4zM4 16h4v4H4zM10 16h4v4h-4zM16 16h4v4h-4z'),
  sources: P('M5 4h10l4 4v12H5zM15 4v4h4M8 12h8M8 16h6'),
  evolution: P('M4 18l5-6 4 3 7-9M15 6h5v5'),
  governance: P('M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6zM8.5 12l2.5 2.5 4.5-5'),
  explore: P('M4 5h16M4 10h16M4 15h10M4 20h7M17 17m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M19.2 19.2L21 21'),
  text: P('M5 5h14M5 9h14M5 13h9M5 17h6M15 15l2 2 4-4'),
  about: P('M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 11v6M12 7.5v.5'),
  search: P('M11 11m-7 0a7 7 0 1 0 14 0a7 7 0 1 0-14 0M16 16l4 4'),
  sun: P('M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'),
  moon: P('M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z'),
  close: P('M6 6l12 12M18 6L6 18'),
  ext: P('M14 4h6v6M20 4l-9 9M18 14v5H5V6h5'),
  down: P('M12 4v12M6 11l6 6 6-6M5 20h14'),
  chevR: P('M9 6l6 6-6 6'),
  chevD: P('M6 9l6 6 6-6'),
}
export const Icon = ({ name, size = 16 }: { name: string; size?: number }) => (
  <span style={{ width: size, height: size, display: 'inline-flex' }} className="[&>svg]:w-full [&>svg]:h-full">
    {ICONS[name]}
  </span>
)
