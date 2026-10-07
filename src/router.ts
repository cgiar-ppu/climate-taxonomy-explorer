import { useEffect, useState } from 'react'

// Hash routing: #/<view>?k=v&k2=v2   and   #/concept/<ID>  (deep link to the concept drawer)
export interface Route { view: string; params: URLSearchParams; concept: string | null }

export const VIEWS = [
  { id: 'overview', label: 'Overview' },
  { id: 'hierarchy', label: 'Hierarchy' },
  { id: 'relations', label: 'Relations network' },
  { id: 'lens', label: 'Adaptation & mitigation' },
  { id: 'flow', label: 'Pathway flow' },
  { id: 'heatmap', label: 'Domains & impact areas' },
  { id: 'sources', label: 'Sources & provenance' },
  { id: 'evolution', label: 'Changes v4 to v5' },
  { id: 'governance', label: 'Governance & FAIR' },
  { id: 'explore', label: 'Explore table' },
  { id: 'text', label: 'Find concepts in a text' },
  { id: 'about', label: 'About & credit' },
] as const

let lastView = 'overview'
let lastViewHash = '#/overview'

export function parseHash(h: string = window.location.hash): Route {
  const s = h.replace(/^#\/?/, '')
  const [path, query = ''] = s.split('?')
  const parts = path.split('/').filter(Boolean)
  if (parts[0] === 'concept' && parts[1]) {
    return { view: lastView, params: new URLSearchParams(lastViewHash.split('?')[1] ?? ''), concept: decodeURIComponent(parts[1]) }
  }
  const view = VIEWS.some((v) => v.id === parts[0]) ? parts[0] : 'overview'
  return { view, params: new URLSearchParams(query), concept: null }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash())
  useEffect(() => {
    const on = () => {
      const r = parseHash()
      if (!r.concept) {
        lastView = r.view
        lastViewHash = window.location.hash || '#/overview'
      }
      setRoute(r)
    }
    on()
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

export const openConcept = (id: string) => {
  window.location.hash = `#/concept/${encodeURIComponent(id)}`
}
export const closeConcept = () => {
  window.location.hash = lastViewHash
}
export const go = (view: string, params?: Record<string, string | string[] | undefined>) => {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v === undefined || v === '') continue
    if (Array.isArray(v)) v.forEach((x) => q.append(k, x))
    else q.set(k, v)
  }
  const qs = q.toString()
  window.location.hash = `#/${view}${qs ? '?' + qs : ''}`
}
export const hrefFor = (view: string, params?: Record<string, string>) => {
  const qs = new URLSearchParams(params ?? {}).toString()
  return `#/${view}${qs ? '?' + qs : ''}`
}
/** Replace the query string of the current view without adding a history entry. */
export const replaceParams = (view: string, q: URLSearchParams) => {
  const qs = q.toString()
  const h = `#/${view}${qs ? '?' + qs : ''}`
  if (window.location.hash !== h) {
    history.replaceState(null, '', h)
    lastViewHash = h
  }
}
