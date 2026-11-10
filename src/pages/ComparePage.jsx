import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import CompareTray from '../components/CompareTray.jsx';
import { fetchRemedyCatalog } from '../data/remedyService.js';
import { getSharedGoals, getRemedyResearch } from '../data/comparisonLogic.js';

function BarChart({ title, rows, field }) {
  const values = rows.map((row) => row[field] ?? 0);
  const highest = Math.max(1, ...values);

  return (
    <div className="rr-chart">
      <h3>{title}</h3>

      {rows.map((row) => {
        const value = row[field];
        const width = value == null ? 0 : (value / highest) * 100;

        return (
          <div className="rr-chart-row" key={row.id}>
            <span>{row.name}</span>
            <div className="rr-chart-track">
              <div className="rr-chart-bar" style={{ width: `${width}%` }} />
            </div>
            <span>{value == null ? 'N/A' : value}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function ComparePage({ selectedIds, onRemove }) {
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [comparedIds, setComparedIds] = useState([]);
  const [goalId, setGoalId] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    fetchRemedyCatalog(controller.signal)
      .then(({ catalog: data }) => {
        if (!controller.signal.aborted) {
          setCatalog(data);
          setError('');
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError('Unable to load comparison data.');
        }
      });

    return () => controller.abort();
  }, [attempt]);

  if (error) {
    return (
      <main className="page-main subpage" role="alert">
        <p>{error}</p>
        <button
          className="button button-secondary"
          onClick={() => {
            setError('');
            setCatalog(null);
            setAttempt((n) => n + 1);
          }}
        >
          Retry
        </button>
      </main>
    );
  }

  if (!catalog) {
    return <main className="page-main subpage">Loading comparison…</main>;
  }

  const selectedRemedies = selectedIds
    .map((id) => catalog.remedies.find((remedy) => remedy.id === id))
    .filter(Boolean);

  const sharedGoalIds = getSharedGoals(selectedRemedies);
  const sharedGoals = catalog.goals.filter((goal) =>
    sharedGoalIds.includes(goal.id)
  );

  const canCompare = selectedRemedies.length >= 2 &&
    selectedRemedies.length <= 4 && sharedGoals.length > 0;

  const showingResults =
    canCompare &&
    comparedIds.join(',') === selectedIds.join(',');

  const currentGoalId = sharedGoalIds.includes(goalId)
    ? goalId
    : sharedGoalIds[0];

  const currentGoal = catalog.goals.find((goal) =>
    goal.id === currentGoalId
  );

  const results = selectedRemedies.map((remedy) => ({
    id: remedy.id,
    name: remedy.name,
    remedy,
    ...getRemedyResearch(remedy, catalog.studies, currentGoalId),
  }));

  function handleCompare() {
    if (canCompare) {
      setGoalId(currentGoalId);
      setComparedIds([...selectedIds]);
    }
  }

  return (
    <main className="page-main subpage rr-compare-page">
      <p className="eyebrow">Root &amp; Remedy</p>
      <h1>Compare</h1>
      <p className="subpage-intro">
        Choose remedies to compare their shared health goals, study counts,
        participant counts, and cited research notes.
      </p>

      <CompareTray remedies={selectedRemedies} onRemove={onRemove} />

      <p>
        <Link className="text-link" to="/remedies">
          Browse remedies
        </Link>
      </p>

      {selectedRemedies.length < 2 && (
        <p className="rr-feedback">Select at least 2 remedies to compare.</p>
      )}

      {selectedRemedies.length >= 2 && sharedGoals.length === 0 && (
        <p className="rr-feedback">
          These remedies don't share a health goal and cannot be compared.
          Remove a remedy or choose a different combination.
        </p>
      )}

      {sharedGoals.length > 0 && (
        <div className="rr-goal-picker">
          <label htmlFor="rr-compare-goal">Shared health goal</label>
          <select
            id="rr-compare-goal"
            value={currentGoalId}
            onChange={(event) => {
              setGoalId(event.target.value);
              setComparedIds([]);
            }}
          >
            {sharedGoals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <button
        className="button button-primary"
        type="button"
        onClick={handleCompare}
        disabled={!canCompare}
      >
        Compare remedies
      </button>

      {showingResults && (
        <section aria-label="Comparison results">
          <h2>Comparison for {currentGoal.name}</h2>
          <h3>Shared health goals</h3>
          <ul>
            {sharedGoals.map((goal) => (
              <li key={goal.id}>{goal.name}</li>
            ))}
          </ul>


          <BarChart
            title="Research studies"
            rows={results}
            field="studyCount"
          />

          <BarChart
            title="Participants in human studies"
            rows={results}
            field="participantCount"
          />

          <p className="rr-study-note">
            Participant numbers are taken from the linked studies.
            The same study may cover multiple remedies, so counts
            can overlap. N/A means the participant count is not available.
          </p>

          {results.some((result) => result.missingParticipants) && (
            <p className="rr-study-note">
              Some human studies do not report participant counts,
              so the totals shown may be incomplete.
            </p>
          )}

          <h2>Research summaries</h2>

          {results.map((result) => (
            <article className="rr-research-item" key={result.id}>
              <h3>{result.name}</h3>
              <p>
                {result.remedy.researchNote ||
                  'No research summary available yet.'}
              </p>

              {result.studies.length === 0 ? (
                <p>No linked studies available for this health goal.</p>
              ) : (
                <ul>
                  {result.studies.map((study) => {
                    const source = catalog.sources.find((item) =>
                      study.sourceIds.includes(item.id)
                    );

                    return (
                      <li key={study.id}>
                        {study.summary && <p>{study.summary}</p>}
                        {source?.url || study.sourceUrl ? (
                          <a
                            href={source?.url || study.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {study.title || 'Read study'}
                          </a>
                        ) : (
                          <span>{study.title || 'Source unavailable'}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
