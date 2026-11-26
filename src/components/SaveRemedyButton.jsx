import { useEffect, useState } from 'react';
import { isRemedySaved, saveRemedy } from '../data/shelfStorage.js';

export default function SaveRemedyButton({ remedy }) {
  const [saved, setSaved] = useState(() => isRemedySaved(remedy.id));
  const [error, setError] = useState('');

  useEffect(() => {
    const update = () => setSaved(isRemedySaved(remedy.id));
    window.addEventListener('storage', update);
    window.addEventListener('remedy-shelf-change', update);
    return () => {
      window.removeEventListener('storage', update);
      window.removeEventListener('remedy-shelf-change', update);
    };
  }, [remedy.id]);

  function handleSave() {
    if (saved) return;
    if (saveRemedy(remedy.id)) {
      setSaved(true);
      setError('');
    } else {
      setError('Unable to save on this browser. Check your storage settings.');
    }
  }

  return (
    <>
      <button className="button button-secondary" type="button" onClick={handleSave} disabled={saved}>
        {saved ? 'Saved to Shelf' : 'Save remedy'}
      </button>
      {error && <p className="rr-feedback" role="alert">{error}</p>}
    </>
  );
}
