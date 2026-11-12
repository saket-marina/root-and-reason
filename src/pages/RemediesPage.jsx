import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import HealthGoalCard from '../components/HealthGoalCard.jsx';
import RemedyCard from '../components/RemedyCard.jsx';
import { fetchRemedyCatalog, findRemediesForGoal, searchCatalog } from '../data/remedyService.js';

export default function RemediesPage({ selectedIds = [], addToCompare = null }) {
  const [catalog, setCatalog] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [activeGoalId, setActiveGoalId] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchRemedyCatalog(controller.signal).then(({ catalog: data }) => {
        if (!controller.signal.aborted) {
            setCatalog(data);
            setError('');
        }
    })
    .catch(() => {
      if (!controller.signal.aborted) setError('Unable to load remedies. Please check the data connection.');
    });
    return () => controller.abort();
  }, [attempt]);

  if (error) return <main className="page-main subpage" role="alert"><p>{error}</p><button className="button button-secondary" onClick={() => { setCatalog(null); setError(''); setAttempt((n) => n + 1); }}>Retry</button></main>;
  if (!catalog) return <main className="page-main subpage">Loading remedies…</main>;

  const sortedGoals = [...catalog.goals].sort((a, b) => a.name.localeCompare(b.name));
  const found = searchCatalog(catalog, submitted);
  const chosenGoal = catalog.goals.find((goal) => goal.id === activeGoalId);
  const visibleRemedies = activeGoalId ? findRemediesForGoal(catalog, activeGoalId) :
    submitted ? found.remedies : [];

  function handleSubmit(event) {
    event.preventDefault();
    setActiveGoalId(null);
    setSubmitted(query.trim());
  }

  function compareProps(remedy) {
    const isSelected = selectedIds.includes(remedy.id);
    return {
      onCompare: addToCompare,
      compareDisabled: isSelected || selectedIds.length >= 4,
      compareLabel: isSelected ? 'Added to compare' : 'Compare',
    };
  }

  return (
    <main className="page-main subpage rr-discover-page">
      <p className="eyebrow">Root &amp; Remedy</p>
      <h1>Remedies</h1>
      <p className="subpage-intro">
        Browse remedies by health goal and explore the information and research behind each one.
      </p>
      <form className="rr-search-form" role="search" onSubmit={handleSubmit}>
        <label htmlFor="rr-remedy-search">Search remedies or health goals</label>
        <div className="search-row">
          <input id="rr-remedy-search" type="search" value={query}
            onChange={(event) => setQuery(event.target.value)} placeholder="e.g., constipation" />
          <button className="button button-primary" type="submit">Search</button>
          {(submitted || activeGoalId) && <button className="button button-secondary" type="button"
            onClick={() => { setQuery(''); setSubmitted(''); setActiveGoalId(null); }}>Clear</button>}
        </div>
      </form>

      {chosenGoal ? (
        <section aria-labelledby="rr-selected-goal">
          <button className="rr-back-link" type="button" onClick={() => setActiveGoalId(null)}>← All health goals</button>
          <h2 id="rr-selected-goal">{chosenGoal.name}</h2>
          <p>{visibleRemedies.length} linked remedy option{visibleRemedies.length === 1 ? '' : 's'}</p>
          <div className="rr-remedy-grid">{visibleRemedies.map((remedy) =>
            <RemedyCard key={remedy.id} remedy={remedy} goals={catalog.goals} {...compareProps(remedy)} />)}</div>
        </section>
      ) : submitted ? (
        <section aria-live="polite" aria-label="Search results">
          {found.kind === 'none' ? (
            <p className="rr-feedback">No results found for “{submitted}”. Try another remedy or health goal.</p>
          ) : (
            <>
              <h2>Results for “{submitted}”</h2>
              {found.kind === 'partial' && (
                <div className="rr-feedback">
                  <p>Partial matches found. You might be looking for:</p>
                  <ul>{found.suggestions.map((name) => <li key={name}>{name}</li>)}</ul>
                </div>
              )}
              {!!found.goals.length && <div className="rr-goal-grid">{found.goals.map((goal) =>
                <HealthGoalCard key={goal.id} goal={goal}
                  remedies={findRemediesForGoal(catalog, goal.id)} onSelect={setActiveGoalId} />)}</div>}
              <div className="rr-remedy-grid">{visibleRemedies.map((remedy) =>
                <RemedyCard key={remedy.id} remedy={remedy} goals={catalog.goals} {...compareProps(remedy)} />)}</div>
            </>
          )}
        </section>
      ) : (
        <section aria-labelledby="rr-goals-title">
          <h2 id="rr-goals-title">Browse by health goal</h2>
          <div className="rr-goal-grid">{sortedGoals.map((goal) =>
            <HealthGoalCard key={goal.id} goal={goal}
              remedies={findRemediesForGoal(catalog, goal.id)} onSelect={setActiveGoalId} />)}</div>
        </section>
      )}
      {addToCompare && <p className="rr-compare-link"><Link to="/compare">View compare tray ({selectedIds.length}/4) →</Link></p>}
    </main>
  );
}
