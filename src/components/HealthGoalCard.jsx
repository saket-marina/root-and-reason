export default function HealthGoalCard({ goal, remedies, onSelect }) {
  return (
    <button type="button" className="rr-goal-card" onClick={() => onSelect(goal.id)}>
      <span className="rr-goal-name">{goal.name}</span>
      <span className="rr-goal-count">{remedies.length} remedy option{remedies.length === 1 ? '' : 's'}</span>
      <span className="rr-goal-preview">
        <strong>Preview</strong>
        {remedies.slice(0, 3).map((remedy) => (
          <span key={remedy.id}>{remedy.name}</span>
        ))}
        {!remedies.length && <span>No remedies available yet</span>}
      </span>
      <span className="rr-goal-action">Browse remedies →</span>
    </button>
  );
}
