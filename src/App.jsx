import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';

const CatalogPreview = import.meta.env.DEV && import.meta.env.MODE === 'firestore'
  ? lazy(() => import('./CatalogPreview.jsx'))
  : null;

const DISCLAIMER_KEY = 'rr-disclaimer-accepted';
const SAVED_REMEDIES_KEY = 'savedRemedies';
const SAVED_COMPARISONS_KEY = 'savedComparisons';

function SproutMark({ className = '' }) {
  return (
    <svg className={`sprout-mark ${className}`} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <circle className="sprout-ring" cx="32" cy="32" r="26" />
      <path d="M23 47h18M32 47V31c0-7 5-12 14-13 0 8-4 13-12 14M31 38c-6 0-10-3-11-9 6-1 10 2 12 7" />
    </svg>
  );
}

function BookmarkMark() {
  return (
    <svg className="bookmark-mark" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7.5 4.75h9a1.75 1.75 0 0 1 1.75 1.75v13L12 15.4l-6.25 4.1v-13A1.75 1.75 0 0 1 7.5 4.75Z" />
    </svg>
  );
}

// A device-local count keeps the shelf useful without requiring an account.
function readSavedCount() {
  try {
    return [SAVED_REMEDIES_KEY, SAVED_COMPARISONS_KEY].reduce((sum, key) => {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      return sum + (Array.isArray(value) ? value.length : value && typeof value === 'object' ? Object.keys(value).length : 0);
    }, 0);
  } catch {
    return 0;
  }
}

function Navigation() {
  const [savedCount, setSavedCount] = useState(readSavedCount);

  useEffect(() => {
    // Keep the shared badge current when shelf data changes in this or another tab.
    const updateCount = () => setSavedCount(readSavedCount());
    window.addEventListener('storage', updateCount);
    window.addEventListener('remedy-shelf-change', updateCount);
    return () => {
      window.removeEventListener('storage', updateCount);
      window.removeEventListener('remedy-shelf-change', updateCount);
    };
  }, []);

  const links = [
    ['Remedies', '/remedies'],
    ['Compare', '/compare'],
    ['Traditions', '/traditions'],
  ];

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="wordmark" to="/" aria-label="Root & Remedy home">
          <SproutMark className="sprout-mark-framed" />
          <span>Root <span className="ampersand">&</span> Remedy</span>
        </Link>
        <nav className="main-nav" aria-label="Main navigation">
          {links.map(([label, path]) => (
            <NavLink key={path} to={path} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              {label}
            </NavLink>
          ))}
          <NavLink to="/shelf" className={({ isActive }) => isActive ? 'nav-link shelf-link active' : 'nav-link shelf-link'}>
            <BookmarkMark /> Remedy Shelf
            {savedCount > 0 && <span className="count-badge" aria-label={`${savedCount} saved items`}>{savedCount}</span>}
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <SproutMark className="footer-mark" />
      <span>For learning only. Not medical advice.</span>
    </footer>
  );
}

function DisclaimerNotice() {
  // Remember consent on this browser so returning visitors are not interrupted again.
  const [accepted, setAccepted] = useState(() => {
    try { return localStorage.getItem(DISCLAIMER_KEY) === 'true'; }
    catch { return false; }
  });
  const [checked, setChecked] = useState(false);

  function acceptDisclaimer() {
    if (!checked) return;
    try {
      localStorage.setItem(DISCLAIMER_KEY, 'true');
      setAccepted(true);
    } catch {
      // Consent must not appear permanent when the browser could not store it.
      setAccepted(false);
    }
  }

  if (accepted) return null;

  return (
    <aside className="disclaimer-popover" aria-label="Important learning-only notice">
      <div className="notice-heading">
        <SproutMark className="notice-icon" />
        <h2>A note before you explore</h2>
      </div>
      <p>
        Root &amp; Remedy shares traditional and research-based information for learning only. It is not medical advice, and it does not tell you what to use. What you do with this information is your own decision. A pharmacist or doctor can answer questions about your health or medicines.
      </p>
      <div className="notice-actions">
        <label className="agree-control">
          <input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} />
          <span>I understand this is for learning only.</span>
        </label>
        <button className="button button-primary accept-button" type="button" disabled={!checked} onClick={acceptDisclaimer}>
          Accept
        </button>
      </div>
    </aside>
  );
}

function HomePage() {
  return (
    <main className="page-main home-page">
      <section className="hero" aria-labelledby="home-title">
        <div className="hero-copy">
          <img className="home-logo" src="/root-remedy-logo.png" alt="Root & Remedy sprout logo" />
          <p className="eyebrow">Rooted in tradition. Guided by research.</p>
          <h1 id="home-title">A little wisdom,<br /><em>well sourced.</em></h1>
          <p className="hero-summary">
            Explore traditional remedies, learn what research has found, and find thoughtful questions to bring to a health professional.
          </p>
          <Link className="button button-primary start-button" to="/remedies">Start here <span aria-hidden="true">→</span></Link>
          <p className="hero-note">A calm place to learn about remedies and the evidence behind them.</p>
        </div>
      </section>
      <section className="mission-strip" aria-label="Our mission">
        <SproutMark className="mission-spark" />
        <p>Root &amp; Remedy helps you explore traditional home remedies, see what the research says, and compare your options, so you can choose with confidence.</p>
      </section>
    </main>
  );
}

const pageInfo = {
  Remedies: { intro: 'Browse remedies by health goal and explore the information and research behind each one.' },
  Compare: { intro: 'Choose remedies to compare their shared health goals, study counts, participant counts, and cited research notes.' },
  Traditions: { intro: 'Explore the cultural traditions and regions connected with remedies.' },
  'Remedy Shelf': { intro: 'Your saved remedies and comparisons will appear here on this device.' },
};

function PlaceholderPage({ title, children }) {
  return (
    <main className="page-main subpage">
      <p className="eyebrow">Root &amp; Remedy</p>
      <h1>{title}</h1>
      <p className="subpage-intro">{pageInfo[title].intro}</p>
      {children ?? <div className="coming-soon-card">
        <SproutMark className="coming-soon-mark" />
        <p>This section is being prepared. You can return to Home or explore another page.</p>
        <Link className="text-link" to="/">Go to Home <span aria-hidden="true">→</span></Link>
      </div>}
    </main>
  );
}

function ErrorPage() {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');

  function handleSearch(event) {
    event.preventDefault();
    setSubmittedQuery(query.trim());
  }

  return (
    <main className="page-main subpage error-page">
      <p className="eyebrow">Page not found</p>
      <h1>Sorry, we don’t have that remedy yet.</h1>
      <p className="subpage-intro">Try a different search, browse all remedies, or head back Home.</p>
      <form className="error-search" onSubmit={handleSearch} role="search">
        <label htmlFor="error-search-input">Search remedies</label>
        <div className="search-row">
          <input id="error-search-input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try a remedy or health goal" />
          <button className="button button-primary" type="submit">Search</button>
        </div>
        {submittedQuery && <p className="search-feedback">No remedy found for “{submittedQuery}”.</p>}
      </form>
      <div className="error-actions">
        <Link className="button button-primary" to="/remedies">Browse all remedies</Link>
        <Link className="button button-secondary" to="/">Go home</Link>
      </div>
    </main>
  );
}

function App() {
  const location = useLocation();

  useEffect(() => {
    // Prevent a new page from inheriting the previous route's scroll position.
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // One shared shell keeps navigation and the learning-only notice consistent across routes.
  return (
    <div className="app-shell">
      <Navigation />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/remedies" element={
          <PlaceholderPage title="Remedies">
            {CatalogPreview && (
              <Suspense fallback={<p role="status">Loading sample remedies…</p>}>
                <CatalogPreview />
              </Suspense>
            )}
          </PlaceholderPage>
        } />
        <Route path="/compare" element={<PlaceholderPage title="Compare" />} />
        <Route path="/traditions" element={<PlaceholderPage title="Traditions" />} />
        <Route path="/shelf" element={<PlaceholderPage title="Remedy Shelf" />} />
        {/* Stale or mistyped links should still offer a way back into the site. */}
        <Route path="*" element={<ErrorPage />} />
      </Routes>
      <Footer />
      <DisclaimerNotice />
    </div>
  );
}

export default App;
