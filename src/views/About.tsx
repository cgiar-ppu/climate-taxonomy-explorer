import { CONCEPTS, META, fmtDate, versionLabel } from '../data'
import { Credit } from '../components/Credit'
import { PageHead } from '../components/ui'

export default function About() {
  return (
    <div className="stack" style={{ maxWidth: 860 }}>
      <PageHead title="About and credit" />
      <div className="panel" style={{ lineHeight: 1.65 }}>
        <h2 className="h-sec mb-2">Credit and licence</h2>
        <p className="m-0" style={{ color: 'var(--text-2)' }}><Credit /></p>
        <p className="mt-3 mb-0 text-[13px] muted">
          The licence is the custodians' intended licence for the vocabulary. It has not yet been confirmed by the custodian, so it is not a granted licence. Definitions quoted from
          published sources (for example the IPCC glossaries, AGROVOC, FAO, WMO and UNFCCC) remain subject to their own terms; every definition names its source.
        </p>
      </div>
      <div className="panel" style={{ lineHeight: 1.65 }}>
        <h2 className="h-sec mb-2">What this is</h2>
        <p className="m-0" style={{ color: 'var(--text-2)' }}>
          An interactive explorer for the CGIAR Climate Adaptation and Mitigation Taxonomy, {versionLabel}. It shows all {CONCEPTS.length} concepts, their hierarchy, typed
          relations, adaptation and mitigation rules, sources, provenance classes, the changes from version 4, and the governance records. The version is a draft. The taxonomy is
          also encoded in SKOS, the W3C vocabulary standard; those files are in the custodians' repository.
        </p>
        <dl className="dl mt-4">
          <dt>Source repository</dt>
          <dd><a className="link" href={META.repo} target="_blank" rel="noreferrer noopener">{META.repo.replace('https://', '')}</a></dd>
          <dt>Source commit</dt>
          <dd>{META.sourceCommit} ({fmtDate(META.sourceCommitDate.slice(0, 10))})</dd>
          <dt>Official site</dt>
          <dd><a className="link" href={META.site} target="_blank" rel="noreferrer noopener">{META.site.replace('https://', '')}</a></dd>
          <dt>Content built</dt>
          <dd>{fmtDate(META.contentBuiltAt.slice(0, 10))}</dd>
          <dt>Data prepared</dt>
          <dd>{META.preparedAt.replace('T', ' ').replace('Z', ' UTC')}</dd>
          <dt>Validation</dt>
          <dd>{META.validation.errors} errors, {META.validation.warnings} warnings, {META.validation.info} information notes in the source build</dd>
        </dl>
      </div>
      <div className="panel" style={{ lineHeight: 1.65 }}>
        <h2 className="h-sec mb-2">How to read it</h2>
        <ul className="m-0 pl-5" style={{ color: 'var(--text-2)' }}>
          <li>Every number is computed from the source files when the data is prepared or when the page loads. Nothing is typed by hand.</li>
          <li>Provenance is shown only as controlled classes (Domain expert, Lexicon consensus, Restructure (v5), PRMS pilot), mapped with the custodians' provenance map.</li>
          <li>Free-text notes in the change log and the register name roles (domain expert, custodian) instead of people.</li>
          <li>Definition source families are grouped from the first source listed for each definition.</li>
          <li>The explorer works offline. It makes no network calls; links to the official site and to references open only when you select them.</li>
        </ul>
      </div>
    </div>
  )
}
