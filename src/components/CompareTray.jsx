export default function CompareTray({ remedies, onRemove }) {
  return (
    <section aria-label="Compare tray">
      <h2>Compare tray ({remedies.length}/4)</h2>

      {remedies.length === 0 ? (
        <p>No remedies selected yet.</p>
      ) : (
        <div className="rr-tray">
          {remedies.map((remedy) => (
            <div className="rr-tray-item" key={remedy.id}>
              <span>{remedy.name}</span>
              <button
                type="button"
                onClick={() => onRemove(remedy.id)}
                aria-label={`Remove ${remedy.name} from compare`}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="rr-study-note">
        Choose 2 to 4 different remedies to compare.
      </p>
    </section>
  );
}
