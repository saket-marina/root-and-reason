import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import SaveRemedyButton from '../components/SaveRemedyButton.jsx';
import { fetchRemedyCatalog } from '../data/remedyService.js';

const tabs = ['About', 'Research', 'Ingredients', 'Guided Use'];

function SourceLinks({ ids, catalog }) {
  const found = [...new Set(ids || [])].map((id) => catalog.sources.find((source) => source.id === id)).filter(Boolean);
  if (!found.length) return <p>No sources are listed for this section yet.</p>;
  return (
    <ul className="detail-source-list">
      {found.map((source) => (
        <li key={source.id}>
          {source.url ? <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a> : source.title}
          {source.publisher && <span> — {source.publisher}</span>}
        </li>
      ))}
    </ul>
  );
}

function ClaimList({ remedy, ids, catalog }) {
  const claims = (ids || []).map((id) => remedy.claims?.find((claim) => claim.id === id)).filter(Boolean);
  if (!claims.length) return <p>No additional information is available for this section.</p>;
  return (
    <div className="detail-claim-list">
      {claims.map((claim) => (
        <div className="detail-claim" key={claim.id}>
          <p>{claim.text}</p>
          <SourceLinks ids={(claim.citations || []).map((citation) => citation.sourceId)} catalog={catalog} />
        </div>
      ))}
    </div>
  );
}

export default function RemedyDetailPage() {
  const { remedyId } = useParams();
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('About');
  const location = useLocation();
  const fromShelf = location.state?.from === '/shelf';

  useEffect(() => {
    const controller = new AbortController();
    fetchRemedyCatalog(controller.signal)
      .then(({ catalog: data }) => { if (!controller.signal.aborted) setCatalog(data); })
      .catch(() => { if (!controller.signal.aborted) setError('Unable to load remedy details.'); });
    return () => controller.abort();
  }, []);

  if (error) return <main className="page-main subpage" role="alert">{error} <Link to={fromShelf ? '/shelf' : '/remedies'}>{fromShelf ? 'Back to Shelf' : 'Browse remedies'}</Link></main>;
  if (!catalog) return <main className="page-main subpage">Loading remedy details…</main>;

  const remedy = catalog.remedies.find((item) => item.id === remedyId);
  if (!remedy) return (
    <main className="page-main subpage"><h1>Remedy not found</h1><p>This remedy may have been removed from the catalog.</p><Link to={fromShelf ? '/shelf' : '/remedies'}>{fromShelf ? 'Back to Shelf' : 'Browse remedies'}</Link></main>
  );
  const goalNames = (remedy.goalIds || []).map((id) => catalog.goals.find((goal) => goal.id === id)?.name).filter(Boolean);
  const studies = (remedy.studyIds || []).map((id) => catalog.studies.find((study) => study.id === id)).filter(Boolean);
  const originRecords = (remedy.originIds || []).map((id) => catalog.origins.find((origin) => origin.id === id)).filter(Boolean);
  const image = remedy.image;

  return (
    <main className="page-main subpage rr-detail-page">
      <Link className="text-link" to={fromShelf ? '/shelf' : '/remedies'}>← {fromShelf ? 'Back to Shelf' : 'Browse remedies'}</Link>
      <p className="eyebrow">Remedy details</p>
      <h1>{remedy.name}</h1>
      {!!goalNames.length && <p className="detail-goals">{goalNames.join(' · ')}</p>}
      <div className="detail-overview">
        {image?.src && <figure className="detail-photo">
          <img src={image.src} alt={image.alt || ''} />
          {image.caption && <figcaption>{image.caption}</figcaption>}
          {image.credit?.sourceUrl && <a href={image.credit.sourceUrl} target="_blank" rel="noopener noreferrer">Image credit: {image.credit.artist || 'View source'}</a>}
        </figure>}
        <div>
          <p>{remedy.summary}</p>
          <p className="detail-disclaimer">For learning only. This is not medical advice or a recommendation to use a remedy. Ask a healthcare professional about your own situation.</p>
          <SaveRemedyButton remedy={remedy} />
        </div>
      </div>

      <div className="detail-tabs" role="tablist" aria-label="Remedy information">
        {tabs.map((name) => <button key={name} type="button" id={`detail-tab-${name.replace(' ', '-')}`} role="tab"
          aria-selected={tab === name} aria-controls="detail-panel" tabIndex={tab === name ? 0 : -1}
          onKeyDown={(event) => {
            const index = tabs.indexOf(name);
            if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
              event.preventDefault();
              const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
              setTab(next);
              document.getElementById(`detail-tab-${next.replace(' ', '-')}`)?.focus();
            }
          }}
          onClick={() => setTab(name)}>{name}</button>)}
      </div>

      <section className="detail-panel" id="detail-panel" role="tabpanel" aria-labelledby={`detail-tab-${tab.replace(' ', '-')}`}>
        {tab === 'About' && <>
          <h2>About {remedy.name}</h2>
          <p>{remedy.summary}</p>
          <h3>Traditional and regional context</h3>
          {originRecords.length ? originRecords.map((origin) => <div key={origin.id}>
            <p>{origin.summary || 'No background recorded.'}</p>
            <SourceLinks ids={origin.sourceIds} catalog={catalog} />
          </div>) : <p>Background information is not available.</p>}
        </>}
        {tab === 'Research' && <>
          <h2>Research and evidence</h2>
          <p>These sources describe the research behind this entry. Evidence may be limited or specific to the formulation studied.</p>
          <ClaimList remedy={remedy} ids={remedy.summaryClaimIds} catalog={catalog} />
          <h3>Linked studies</h3>
          {studies.length ? <ul className="detail-studies">{studies.map((study) => <li key={study.id}>
            <strong>{study.title}</strong>
            {study.summary && <p>{study.summary}</p>}
            <p>Participants analyzed: {study.participantCount ?? 'Not available'}</p>
            {study.participantScope && <p>{study.participantScope}</p>}
            {study.limitations?.length > 0 && <ul>{study.limitations.map((limit, i) => <li key={i}>{limit}</li>)}</ul>}
            <SourceLinks ids={study.sourceIds} catalog={catalog} />
            {study.sourceUrl && <a href={study.sourceUrl} target="_blank" rel="noopener noreferrer">Read study</a>}
          </li>)}</ul> : <p>No individual study is linked to this record. The research sources below may include reviews or guidelines.</p>}
          <h3>Research sources</h3>
          <SourceLinks ids={remedy.researchSourceIds} catalog={catalog} />
        </>}
        {tab === 'Ingredients' && <>
          <h2>Ingredients</h2>
          <ul>{(remedy.ingredients || []).map((ingredient, i) => <li key={i}>{ingredient}</li>)}</ul>
          <SourceLinks ids={remedy.ingredientSourceIds} catalog={catalog} />
          <h3>Formulations in the evidence</h3>
          {(remedy.preparation || []).map((item, i) => <div key={i} className="detail-claim">
            <h4>{item.name}</h4><p>{item.description}</p>
            <ClaimList remedy={remedy} ids={item.claimIds} catalog={catalog} />
          </div>)}
        </>}
        {tab === 'Guided Use' && <>
          <h2>Guided use</h2>
          <p>This section helps you understand what was studied, not how to treat a condition yourself.</p>
          {(remedy.preparation || []).map((item, i) => <div key={i} className="detail-claim"><h3>{item.name}</h3><p>{item.description}</p></div>)}
          <p>{remedy.preparationNote || 'No verified preparation time is available.'}</p>
          <p className="detail-disclaimer">Do not use these research descriptions as dosage or treatment instructions.</p>
        </>}
      </section>

      <section className="detail-panel" aria-labelledby="detail-help-heading">
        <h2 id="detail-help-heading">Questions and cautions</h2>
        <p>Could this affect my medicines, allergies, or health conditions? Does the research apply to my age and situation? When should I seek medical care?</p>
        <ClaimList remedy={remedy} ids={remedy.cautionClaimIds} catalog={catalog} />
        {remedy.medicalReviewStatus === 'not_reviewed' && <p className="detail-disclaimer">This entry has not been medically reviewed.</p>}
      </section>
    </main>
  );
}
