import { useEffect, useState } from 'react';
import { getSavedComparisons, saveComparison } from '../data/shelfStorage.js';

export default function SaveComparisonButton({ remedyIds, goalId }) {
  const key = `${goalId}:${[...remedyIds].sort().join('|')}`;
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const update = () => setSaved(getSavedComparisons().some((item) => item.id === key));
    update();
    window.addEventListener('storage', update);
    window.addEventListener('remedy-shelf-change', update);
    return () => {
      window.removeEventListener('storage', update);
      window.removeEventListener('remedy-shelf-change', update);
    };
  }, [key]);

  function handleSave() {
    if (saved) return;
    if (saveComparison(remedyIds, goalId)) {
      setSaved(true);
      setError('');
    } else {
      setError('Unable to save this comparison on your browser.');
    }
  }

  return (
    <>
      <button className="button button-secondary" type="button" disabled={saved} onClick={handleSave}>
        {saved ? 'Comparison saved' : 'Save comparison'}
      </button>
      {error && <p className="rr-feedback" role="alert">{error}</p>}
    </>
  );
}
