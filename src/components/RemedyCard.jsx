export default function RemedyCard({ remedy, goals, onCompare, compareDisabled, compareLabel }) {
  const names = remedy.goalIds.map((id) => goals.find((goal) => goal.id === id)?.name).filter(Boolean);
  return (
    <article className="rr-remedy-card">
      <div>
        <h3>{remedy.name}</h3>
        <p>{names.join(' · ')}</p>
      </div>
      <div className="rr-remedy-actions">
        {onCompare && (
          <button type="button" className="button button-secondary" onClick={() => onCompare(remedy.id)}
            disabled={compareDisabled}>
            {compareLabel || 'Compare'}
          </button>
        )}
      </div>
    </article>
  );
}
