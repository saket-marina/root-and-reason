import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchRemedyCatalog } from '../data/remedyService.js';
import {
  clearShelf, getSavedComparisons, getSavedRemedies,
  removeSavedComparison, removeSavedRemedy,
} from '../data/shelfStorage.js';

export default function RemedyShelfPage({ openComparison }) {
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState('');
  const [savedRemedies, setSavedRemedies] = useState(getSavedRemedies);
  const [comparisons, setComparisons] = useState(getSavedComparisons);
  const [query, setQuery] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [message, setMessage] = useState('');
  const clearDialogRef = useRef(null);

  useEffect(() => {
    const dialog = clearDialogRef.current;
    if (!dialog) return;

    if (confirmClear && !dialog.open) {
      dialog.showModal();
    } else if (!confirmClear && dialog.open) {
      dialog.close();
    }
  }, [confirmClear]);

  useEffect(() => {
    const controller = new AbortController();
    fetchRemedyCatalog(controller.signal)
      .then(({ catalog: data }) => { if (!controller.signal.aborted) setCatalog(data); })
      .catch(() => { if (!controller.signal.aborted) setError('Unable to load saved item details.'); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const update = () => {
      setSavedRemedies(getSavedRemedies());
      setComparisons(getSavedComparisons());
    };
    window.addEventListener('storage', update);
    window.addEventListener('remedy-shelf-change', update);
    return () => {
      window.removeEventListener('storage', update);
      window.removeEventListener('remedy-shelf-change', update);
    };
  }, []);

  function removeRemedy(id) {
    if (!removeSavedRemedy(id)) setMessage('Could not update browser storage.');
    else setMessage('Remedy removed from Shelf.');
  }

  function removeComparison(id) {
    if (!removeSavedComparison(id)) setMessage('Could not update browser storage.');
    else setMessage('Comparison removed from Shelf.');
  }

  function handleClear() {
    if (!clearShelf()) {
      setMessage('Could not clear browser storage.');
      return;
    }

    setMessage('Your Shelf has been cleared.');
    setConfirmClear(false);
  }

  const names = (ids) => ids.map((id) => catalog?.remedies.find((r) => r.id === id)?.name || 'Unavailable remedy').join(', ');
  const term = query.trim().toLowerCase();
  const visibleRemedies = savedRemedies.filter((id) => !term || (catalog?.remedies.find((r) => r.id === id)?.name || id).toLowerCase().includes(term));
  const visibleComparisons = comparisons.filter((item) => !term || names(item.remedyIds).toLowerCase().includes(term));
  const hasItems = savedRemedies.length + comparisons.length > 0;

  return (
    <main className="page-main subpage rr-shelf-page">
      <p className="eyebrow">Root &amp; Remedy</p>
      <h1>Remedy Shelf</h1>
      <p className="subpage-intro">Save remedies and comparisons to revisit them later.</p>
      <p className="detail-disclaimer">Saved only in this browser on this device. Items do not sync across devices or accounts and can be lost if you clear browser storage.</p>
      {message && <p role="status" className="rr-feedback">{message}</p>}
      {error && <p role="alert" className="rr-feedback">{error} Saved IDs can still be removed.</p>}
      {hasItems && <>
        <label className="shelf-search-label" htmlFor="shelf-search">
          Search saved items
        </label>
        <input
          id="shelf-search"
          className="shelf-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by remedy name"
        />
        <button type="button" className="button button-secondary shelf-clear-button" onClick={() => setConfirmClear(true)}>Clear all saved items</button>
      </>}
      {!hasItems ? <div className="coming-soon-card">
        <h2>Your Shelf is empty</h2>
        <p>You haven't saved any remedies or comparisons yet.</p>
        <Link to="/remedies" className="button button-primary">Browse remedies</Link>
      </div> : <>
        {term && visibleRemedies.length + visibleComparisons.length === 0 && <p className="rr-feedback">No saved items match “{query}”.</p>}
        <section aria-labelledby="shelf-remedies-heading">
          <h2 id="shelf-remedies-heading">Saved remedies ({savedRemedies.length})</h2>
          {!savedRemedies.length && <p>No remedies saved yet.</p>}
          <div className="shelf-list">{visibleRemedies.map((id) => {
            const remedy = catalog?.remedies.find((item) => item.id === id);
            return <article key={id} className="shelf-item">
              <div><h3>{remedy?.name || 'Remedy unavailable'}</h3>
                {remedy ? <p>{remedy.summary}</p> : <p>This saved remedy is no longer in the catalog.</p>}</div>
              <div className="shelf-actions">
                {remedy && <Link to={`/remedies/${encodeURIComponent(id)}`} state={{ from: '/shelf' }} className="button button-primary">View details</Link>}
                <button type="button" className="button button-secondary" onClick={() => removeRemedy(id)} aria-label={`Remove ${remedy?.name || id} from Shelf`}>Remove</button>
              </div>
            </article>;
          })}</div>
        </section>
        <section aria-labelledby="shelf-comparisons-heading">
          <h2 id="shelf-comparisons-heading">Saved comparisons ({comparisons.length})</h2>
          {!comparisons.length && <p>No comparisons saved yet.</p>}
          <div className="shelf-list">{visibleComparisons.map((item) => {
            const missing = item.remedyIds.some((id) => !catalog?.remedies.some((remedy) => remedy.id === id));
            const goal = catalog?.goals.find((g) => g.id === item.goalId);
            return <article key={item.id} className="shelf-item">
              <div><h3>{names(item.remedyIds)}</h3><p>Health goal: {goal?.name || 'Unavailable'}</p>
                {missing && <p>One or more remedies are no longer available.</p>}</div>
              <div className="shelf-actions">
                {!missing && catalog && <button type="button" className="button button-primary" onClick={() => openComparison(item)}>Open comparison</button>}
                <button type="button" className="button button-secondary" onClick={() => removeComparison(item.id)}>Remove</button>
              </div>
            </article>;
          })}</div>
        </section>
      </>}
      <dialog
        ref={clearDialogRef}
        className="shelf-confirm"
        aria-labelledby="shelf-confirm-title"
        onClose={() => setConfirmClear(false)}
      >
        <h2 id="shelf-confirm-title">Clear your whole Shelf?</h2>
        <p>This removes all saved remedies and comparisons from this browser.</p>
        <div className="shelf-actions">
          <button type="button" className="button button-primary" onClick={handleClear}>
            Yes, clear all
          </button>
          <button type="button" className="button button-secondary" onClick={() => setConfirmClear(false)}>
            Cancel
          </button>
        </div>
      </dialog>
    </main>
  );
}
