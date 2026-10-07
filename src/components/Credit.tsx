import { META } from '../data'

export function Credit({ compact = false }: { compact?: boolean }) {
  return (
    <>
      <strong style={{ color: 'var(--text-2)', fontWeight: 600 }}>CGIAR Climate Adaptation and Mitigation Taxonomy v{META.version}</strong> by Andreea Nowak and Lolita Muller
      (Alliance of Bioversity International and CIAT) for the CGIAR MELIAF Climate Adaptation Activator. Licence: CC BY 4.0{' '}
      <em>intended, pending custodian confirmation (not a granted licence)</em>. Source:{' '}
      <a href={META.repo} target="_blank" rel="noreferrer noopener">github.com/Mlolita26/cgiar-climate-taxonomy</a> @ {META.sourceCommit}
      {compact ? '. ' : <>; official site: <a href={META.site} target="_blank" rel="noreferrer noopener">mlolita26.github.io/cgiar-climate-taxonomy</a>. </>}
      Explorer: Synapsis Analytics.
    </>
  )
}

