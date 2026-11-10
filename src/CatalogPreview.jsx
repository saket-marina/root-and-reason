import { useEffect, useState } from 'react';
import { getResearchMetrics } from './lib/catalogLogic.js';

function loadCatalog() {
  if (import.meta.env.VITE_DATA_MODE === 'published') {
    return import('./data/publishedFirestore.js').then(module => module.loadPublishedFirestoreCatalog());
  }
  return import('./data/firestore.js').then(module => module.loadLocalFirestoreCatalog());
}

export default function CatalogPreview() {
  const [catalog, setCatalog] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    loadCatalog().then(data => {
      if (active) setCatalog(data);
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => { active = false; };
  }, []);

  if (failed) return <p role="alert">The remedy catalog is unavailable. Please try again later.</p>;
  if (!catalog) return <p role="status">Loading the remedy catalog…</p>;

  const remedy = catalog.getRemedy('green-kiwifruit') ?? catalog.remedies[0];
  const goal = catalog.getGoal(remedy.conditionIds[0]);
  const metrics = getResearchMetrics(remedy, goal?.id);
  const study = catalog.studyById[metrics.studies[0]?.id];
  const source = catalog.sourceById[study?.sourceIds?.[0]];
  const regions = [...new Set(remedy.culturalContexts.flatMap(context => context.regions))];

  return (
    <section className="coming-soon-card" aria-labelledby="catalog-preview-title">
      <h2 id="catalog-preview-title">Remedy catalog preview</h2>
      <p>{catalog.remedies.length} remedy records loaded from Firestore.</p>
      <h3>{remedy.shortName}</h3>
      <dl>
        <dt>Ingredients</dt>
        <dd>{remedy.ingredients.map(ingredient => ingredient.name).join(', ')}</dd>
        <dt>Health goal</dt>
        <dd>{goal?.displayName ?? 'Unavailable'}</dd>
        <dt>Documented regions</dt>
        <dd>{regions.join(', ') || 'Unavailable'}</dd>
        <dt>Primary studies in the catalog</dt>
        <dd>{metrics.studyCount}</dd>
        <dt>Analyzed participants</dt>
        <dd>{metrics.participantCount ?? 'Unavailable'}</dd>
        {source && <><dt>Research source</dt><dd><a href={source.url}>{source.title}</a></dd></>}
      </dl>
    </section>
  );
}
