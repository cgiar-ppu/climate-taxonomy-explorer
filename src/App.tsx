import { lazy, Suspense, useEffect, useState } from 'react'
import { META, versionLabel } from './data'
import { useRoute, VIEWS } from './router'
import { Drawer } from './components/Drawer'
import { SearchPalette } from './components/Search'
import { Icon, TipProvider } from './components/ui'
import Overview from './views/Overview'
import { Credit } from './components/Credit'

const Hierarchy = lazy(() => import('./views/Hierarchy'))
const Relations = lazy(() => import('./views/Relations'))
const Lens = lazy(() => import('./views/Lens'))
const Flow = lazy(() => import('./views/Flow'))
const Heatmap = lazy(() => import('./views/Heatmap'))
const Sources = lazy(() => import('./views/Sources'))
const Evolution = lazy(() => import('./views/Evolution'))
const Governance = lazy(() => import('./views/Governance'))
const Explore = lazy(() => import('./views/Explore'))
const TextMatch = lazy(() => import('./views/TextMatch'))
const About = lazy(() => import('./views/About'))

const VIEW_COMPONENTS: Record<string, React.ComponentType<{ params: URLSearchParams }>> = {
  overview: Overview, hierarchy: Hierarchy, relations: Relations, lens: Lens, flow: Flow, heatmap: Heatmap,
  sources: Sources, evolution: Evolution, governance: Governance, explore: Explore, text: TextMatch, about: About,
}

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="15" fill="var(--panel-2)" stroke="var(--line-2)" />
      <path d="M16 4a12 12 0 0 1 12 12H16z" fill="#4FBF85" />
      <path d="M28 16a12 12 0 0 1-12 12V16z" fill="#F2C14E" />
      <path d="M16 28A12 12 0 0 1 4 16h12z" fill="#3FA7D6" />
      <path d="M4 16A12 12 0 0 1 16 4v12z" fill="#E8684A" />
      <circle cx="16" cy="16" r="5" fill="var(--panel-2)" />
    </svg>
  )
}

export default function App() {
  const route = useRoute()
  const [palette, setPalette] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'))

  useEffect(() => {
    if (theme === 'light') document.documentElement.dataset.theme = 'light'
    else delete document.documentElement.dataset.theme
    try {
      localStorage.setItem('cte-theme', theme)
    } catch {
      /* storage unavailable (file://) */
    }
  }, [theme])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette((p) => !p)
      } else if (e.key === '/' && !typing) {
        e.preventDefault()
        setPalette(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const v = VIEWS.find((x) => x.id === route.view)
    document.title = `${v?.label ?? 'Overview'} | Climate Taxonomy v5 Explorer`
  }, [route.view])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [route.view])

  const View = VIEW_COMPONENTS[route.view] ?? Overview
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

  return (
    <TipProvider>
      <div className="shell">
        <nav className="side" aria-label="Views">
          <a className="brand" href="#/overview">
            <BrandMark />
            <span className="brand-text">
              <div className="brand-t">Climate Taxonomy v5</div>
              <div className="brand-s">Explorer</div>
            </span>
          </a>
          {VIEWS.map((v) => (
            <a key={v.id} className="navlink" href={`#/${v.id}`} aria-current={route.view === v.id ? 'page' : undefined}>
              <Icon name={v.id} />
              {v.label}
            </a>
          ))}
          <div className="side-foot">
            {versionLabel}. Draft content from the custodians' repository at commit {META.sourceCommit}.
          </div>
        </nav>
        <div className="main">
          <header className="topbar">
            <button className="searchbtn" onClick={() => setPalette(true)} aria-label="Search concepts" data-testid="search-open">
              <Icon name="search" />
              <span className="flex-1 truncate">Search concepts, synonyms, definitions</span>
              <span className="kbd">{isMac ? '⌘K' : 'Ctrl K'}</span>
              <span className="kbd">/</span>
            </button>
            <span className="badge badge-draft ml-auto" title="Draft content: not a final release">Draft</span>
            <button
              className="iconbtn"
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </button>
          </header>
          <main className="content" id="main">
            <Suspense fallback={<div className="muted p-8">Loading view…</div>}>
              <View key={route.view} params={route.params} />
            </Suspense>
          </main>
          <footer className="footer">
            <Credit />
          </footer>
        </div>
      </div>
      <Drawer id={route.concept} />
      <SearchPalette open={palette} onClose={() => setPalette(false)} />
    </TipProvider>
  )
}
