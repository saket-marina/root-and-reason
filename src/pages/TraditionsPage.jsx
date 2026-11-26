import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { remedies, sourceById, traditions } from '../data/catalog.js';
import { countriesByRegion } from '../data/regionCountries.js';
import { supplementalCountryShapes } from '../data/supplementalCountryShapes.js';
import { worldCountries } from '../data/worldCountries.js';
import './traditions.css';

const contextLabels = {
  documented_traditional_use: 'Documented traditional use',
  botanical_native_range: 'Botanical range',
  historical_preparation: 'Cultivation history',
  modern_clinical_use: 'Modern clinical use',
  geography_not_established: 'Origin not established',
};

function remedyFor(id) {
  return remedies.find((remedy) => remedy.id === id);
}

function imageFor(tradition) {
  const remedy = remedyFor(tradition.remedyIds[0]);
  return remedy?.image?.src ? { src: remedy.image.src, alt: remedy.imageAlt } : null;
}

function sourcesFor(ids = []) {
  return [...new Set(ids)].map((id) => sourceById[id]).filter((source) => source?.url);
}

function traditionsSearchText(tradition) {
  const associatedRemedies = tradition.remedyIds.map(remedyFor).filter(Boolean);
  return [
    tradition.name,
    tradition.regionLabel,
    tradition.description,
    ...tradition.associations.flatMap((association) => [
      ...association.communities,
      ...association.regions,
      association.claimText,
    ]),
    ...associatedRemedies.map((remedy) => remedy.name),
  ].join(' ').toLocaleLowerCase();
}

function makeRegionRemedyCards(regionNames) {
  const regionKeys = new Set(regionNames.map((region) => region.toLocaleLowerCase()));
  const cardsByRemedy = new Map();
  traditions.forEach((tradition) => tradition.associations.forEach((association) => {
    const remedy = remedyFor(association.remedyId);
    if (!remedy) return;

    association.regions.forEach((region) => {
      if (!regionKeys.has(region.toLocaleLowerCase())) return;
      const existing = cardsByRemedy.get(remedy.id);
      if (existing) {
        existing.associations.push(association);
        existing.regions.set(region.toLocaleLowerCase(), region);
        return;
      }
      cardsByRemedy.set(remedy.id, {
        id: remedy.id,
        associations: [association],
        regions: new Map([[region.toLocaleLowerCase(), region]]),
        remedy,
      });
    });
  }));

  return [...cardsByRemedy.values()].map((card) => ({
    ...card,
    regions: [...card.regions.values()].sort((a, b) => a.localeCompare(b)),
    claimText: [...new Set(card.associations.map((association) => association.claimText).filter(Boolean))].join(' '),
    uncertainty: [...new Set(card.associations.map((association) => association.uncertainty).filter(Boolean))].join(' '),
    communities: [...new Set(card.associations.flatMap((association) => association.communities))],
    sourceIds: [...new Set(card.associations.flatMap((association) => association.sourceIds))],
    contextTypes: [...new Set(card.associations.map((association) => association.type))],
  }));
}

function TraditionCard({ tradition, onSelect }) {
  const image = imageFor(tradition);
  const remedyCount = new Set(tradition.remedyIds).size;
  const contextType = tradition.associations[0]?.type;

  return (
    <button className="rr-tradition-card" type="button" onClick={() => onSelect(tradition.id)}>
      {image ? (
        <img className="rr-tradition-card-image" src={image.src} alt={image.alt} loading="lazy" />
      ) : (
        <span className="rr-tradition-card-image rr-tradition-card-placeholder" aria-hidden="true">✳</span>
      )}
      <span className="rr-tradition-card-copy">
        <span className="rr-tradition-kind">{contextLabels[contextType] || 'Cultural context'}</span>
        <span className="rr-tradition-card-title">{tradition.name}</span>
        <span className="rr-tradition-region">{tradition.regionLabel}</span>
        <span className="rr-tradition-card-count">{remedyCount} linked {remedyCount === 1 ? 'remedy' : 'remedies'}</span>
      </span>
      <span className="rr-tradition-arrow" aria-hidden="true">→</span>
    </button>
  );
}

function CitationLinks({ sourceIds }) {
  const sources = sourcesFor(sourceIds);
  if (!sources.length) return <p className="rr-tradition-no-sources">No source link is listed for this item yet.</p>;

  return (
    <ul className="rr-tradition-sources">
      {sources.map((source) => (
        <li key={source.id}>
          <a href={source.url} target="_blank" rel="noreferrer">{source.title || 'Source'}</a>
        </li>
      ))}
    </ul>
  );
}

function remedyDetailPath(remedy) {
  return `/remedies/${encodeURIComponent(remedy.id)}`;
}

function TraditionDetails({ tradition, onBack, onOpenMap }) {
  const image = imageFor(tradition);
  const mapRegionNames = [...new Set(tradition.associations.flatMap((association) => association.regions))];

  return (
    <section className="rr-tradition-detail" aria-labelledby="rr-tradition-title">
      <button className="rr-back-link" type="button" onClick={onBack}>← All traditions</button>
      <div className="rr-tradition-detail-heading">
        {image && <img src={image.src} alt={image.alt} />}
        <div>
          <p className="eyebrow">{tradition.regionLabel}</p>
          <h2 id="rr-tradition-title">{tradition.name}</h2>
          <p>{tradition.description}</p>
          {mapRegionNames.length ? (
            <button className="button button-primary" type="button" onClick={() => onOpenMap(mapRegionNames)}>View on the origin map</button>
          ) : (
            <p className="rr-tradition-uncertainty">This source does not name a place that can be shown on the map.</p>
          )}
        </div>
      </div>

      <h3>Remedies and stories</h3>
      <div className="rr-tradition-story-list">
        {tradition.associations.map((association, index) => {
          const remedy = remedyFor(association.remedyId);
          if (!remedy) return null;
          const communities = association.communities.join(', ');

          return (
            <article className="rr-tradition-story" key={`${association.remedyId}-${index}`}>
              <div className="rr-tradition-story-heading">
                <div>
                  <p className="rr-tradition-kind">{contextLabels[association.type] || 'Cultural context'}</p>
                  <h4>{remedy.name}</h4>
                </div>
                <Link className="button button-secondary rr-remedy-detail-button" to={remedyDetailPath(remedy)}>View remedy →</Link>
              </div>
              {communities && <p className="rr-tradition-communities">{communities}</p>}
              <p>{association.claimText || 'No story is available for this source record.'}</p>
              {association.uncertainty && <p className="rr-tradition-uncertainty">{association.uncertainty}</p>}
              <div className="rr-tradition-source-block">
                <span>Sources</span>
                <CitationLinks sourceIds={association.sourceIds} />
              </div>
            </article>
          );
        })}
      </div>
      <div className="rr-tradition-source-block rr-tradition-source-summary" id="tradition-sources">
        <h3>Sources used</h3>
        <CitationLinks sourceIds={tradition.sourceIds} />
      </div>
    </section>
  );
}

function OriginMap({ onBack, initialRegionNames = [] }) {
  const sourceRegions = useMemo(() => {
    const uniqueRegions = new Map();
    traditions.forEach((tradition) => tradition.associations.forEach((association) => {
      association.regions.forEach((region) => {
        const key = region.toLocaleLowerCase();
        if (!uniqueRegions.has(key)) uniqueRegions.set(key, region);
      });
    }));
    return [...uniqueRegions.values()].sort((a, b) => a.localeCompare(b));
  }, []);
  const regionsByCountry = useMemo(() => Object.fromEntries(worldCountries.map((country) => [
    country.name,
    sourceRegions.filter((region) => countriesByRegion[region.toLocaleLowerCase()]?.includes(country.name)),
  ]).filter(([, regions]) => regions.length)), [sourceRegions]);
  const mapCountries = useMemo(() => [...worldCountries, ...supplementalCountryShapes]
    .filter((country) => regionsByCountry[country.name]), [regionsByCountry]);
  const [selectedRegionNames, setSelectedRegionNames] = useState(initialRegionNames);
  const [selectedCountryName, setSelectedCountryName] = useState('');
  const [hoveredCountryName, setHoveredCountryName] = useState('');
  const [mapFailed, setMapFailed] = useState(false);
  const highlightedCountries = hoveredCountryName ? new Set([hoveredCountryName]) : new Set();
  const selectedCountrySet = useMemo(() => selectedCountryName
    ? new Set([selectedCountryName])
    : new Set(selectedRegionNames.flatMap((region) => countriesByRegion[region.toLocaleLowerCase()] || [])),
  [selectedCountryName, selectedRegionNames]);
  const resultCards = useMemo(() => makeRegionRemedyCards(selectedRegionNames), [selectedRegionNames]);

  function selectCountry(countryName) {
    setSelectedCountryName(countryName);
    setSelectedRegionNames(regionsByCountry[countryName] || []);
  }

  function selectRegion(regionName) {
    setSelectedCountryName('');
    setSelectedRegionNames([regionName]);
  }

  return (
    <section className="rr-origin-map-view" aria-labelledby="rr-origin-map-title">
      <button className="rr-back-link" type="button" onClick={onBack}>← Back to Traditions</button>
      <p className="eyebrow">Root &amp; Remedy</p>
      <h2 id="rr-origin-map-title">Remedy origins</h2>
      <p className="rr-map-intro">Move over a highlighted area to preview its source regions. Select it to see the related remedy cards, stories, and sources below. The map uses current country shapes to represent broad and historical regions.</p>

      {mapFailed ? (
        <div className="rr-map-unavailable" role="status">
          <h3>Map unavailable</h3>
          <p>The map could not load. You can still read the traditions, remedy stories, and sources on this page.</p>
          <button className="button button-secondary" type="button" onClick={onBack}>Back to Traditions</button>
        </div>
      ) : (
        <>
          <div className="rr-map-scroll" role="region" aria-label="Interactive remedy origin map. Scroll horizontally on small screens." tabIndex="0">
            <div className="rr-world-map">
              <img src="/images/world-map.svg" alt="" onError={() => setMapFailed(true)} />
              <svg className="rr-map-regions" viewBox="0 0 1000 500" role="group" aria-label="Select a country-shaped source region" aria-describedby="rr-map-instructions" onPointerLeave={() => setHoveredCountryName('')}>
                {mapCountries.map((country) => {
                  const regionNames = regionsByCountry[country.name];
                  const isSelected = selectedCountrySet.has(country.name);
                  const isHighlighted = highlightedCountries.has(country.name);
                  return (
                    <path
                      key={country.name}
                      d={country.d}
                      className={`rr-map-region${isHighlighted ? ' highlighted' : ''}${isSelected ? ' selected' : ''}`}
                      fillRule="evenodd"
                      role="button"
                      tabIndex="0"
                      aria-label={`Show remedies for ${country.name}. Source regions: ${regionNames.join(', ')}`}
                      aria-describedby="rr-map-instructions"
                      aria-pressed={isSelected}
                      onPointerEnter={() => setHoveredCountryName(country.name)}
                      onPointerLeave={() => setHoveredCountryName('')}
                      onFocus={() => setHoveredCountryName(country.name)}
                      onBlur={() => setHoveredCountryName('')}
                      onClick={() => selectCountry(country.name)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          selectCountry(country.name);
                        }
                      }}
                    />
                  );
                })}
              </svg>
            </div>
          </div>
          <p className="rr-map-instructions" id="rr-map-instructions">Use Tab to move through the country-shaped regions and Enter or Space to select one. You can also open the region list and choose a source region by name.</p>

          <details className="rr-map-region-picker">
            <summary>Choose a source region by name</summary>
            <div className="rr-map-region-options">
              {sourceRegions.map((region) => (
                <button
                  className={selectedRegionNames.length === 1 && selectedRegionNames[0] === region ? 'rr-map-region-option active' : 'rr-map-region-option'}
                  key={region}
                  type="button"
                  aria-pressed={selectedRegionNames.length === 1 && selectedRegionNames[0] === region}
                  onClick={() => selectRegion(region)}
                >
                  {region}
                </button>
              ))}
            </div>
          </details>

          {selectedRegionNames.length ? (
            <section className="rr-region-results" aria-labelledby="rr-region-results-title">
              <h3 id="rr-region-results-title">{selectedCountryName ? `Remedies connected to ${selectedCountryName}` : `Remedies connected to ${selectedRegionNames[0]}`}</h3>
              <p className="rr-region-result-context">Source regions: {selectedRegionNames.join(' · ')}</p>
              <p className="rr-region-result-count" role="status">{resultCards.length} remedy {resultCards.length === 1 ? 'card' : 'cards'} found for {selectedCountryName || selectedRegionNames[0]}. Results are below the map.</p>
              {resultCards.length ? (
                <div className="rr-region-remedy-list">
                  {resultCards.map((card) => (
                    <article className="rr-region-remedy-card" key={card.id}>
                      <div className="rr-tradition-story-heading">
                        <div>
                          <p className="rr-tradition-kind">{card.regions.join(' · ')} · {card.contextTypes.map((type) => contextLabels[type] || 'Cultural context').join(' · ')}</p>
                          <h4>{card.remedy.name}</h4>
                        </div>
                        <Link className="button button-secondary rr-remedy-detail-button" to={remedyDetailPath(card.remedy)}>View remedy →</Link>
                      </div>
                      {card.communities.length > 0 && <p className="rr-tradition-communities">{card.communities.join(', ')}</p>}
                      <p>{card.claimText || 'No story is available for this source record.'}</p>
                      {card.uncertainty && <p className="rr-tradition-uncertainty">{card.uncertainty}</p>}
                      <div className="rr-tradition-source-block">
                        <span>Sources</span>
                        <CitationLinks sourceIds={card.sourceIds} />
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p>No remedy cards are available for this region yet.</p>
              )}
            </section>
          ) : (
            <p className="rr-map-hint">Select a highlighted region to see its remedy cards.</p>
          )}
        </>
      )}
    </section>
  );
}

export default function TraditionsPage() {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [view, setView] = useState('list');
  const [mapReturnView, setMapReturnView] = useState('list');
  const [mapInitialRegionNames, setMapInitialRegionNames] = useState([]);
  const cultureTraditions = useMemo(() => traditions.filter((tradition) =>
    tradition.type === 'documented_traditional_use'), []);
  const filteredTraditions = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    if (!search) return cultureTraditions;
    return cultureTraditions.filter((tradition) => traditionsSearchText(tradition).includes(search));
  }, [cultureTraditions, query]);
  const selectedTradition = traditions.find((tradition) => tradition.id === selectedId);
  const heroRemedy = remedies.find((remedy) => remedy.image);

  function openMap(regionNames = []) {
    setMapReturnView(view);
    setMapInitialRegionNames(regionNames);
    setView('map');
  }

  function openTradition(id) {
    setSelectedId(id);
    setView('detail');
  }

  function backToList() {
    setView('list');
  }

  function backFromMap() {
    setView(mapReturnView === 'detail' && selectedTradition ? 'detail' : 'list');
  }

  return (
    <main className="page-main subpage rr-traditions-page">
      <p className="eyebrow">Root &amp; Remedy</p>
      <h1>Traditions</h1>
      <p className="subpage-intro">Explore the cultural traditions and regions connected with remedies.</p>

      {view === 'detail' && selectedTradition ? (
        <TraditionDetails tradition={selectedTradition} onBack={backToList} onOpenMap={openMap} />
      ) : view === 'map' ? (
        <OriginMap onBack={backFromMap} initialRegionNames={mapInitialRegionNames} />
      ) : (
        <>
          <section className="rr-traditions-intro" aria-label="About the traditions page">
            {heroRemedy?.image && (
              <figure>
                <img src={heroRemedy.image.src} alt={heroRemedy.imageAlt} />
                <figcaption>{heroRemedy.imageCaption || heroRemedy.shortName}</figcaption>
              </figure>
            )}
            <div>
              <h2>Culture and tradition</h2>
              <p>Remedies have different histories and uses across communities. The cards below follow what each source says, including when it does not name a specific community or place.</p>
              <p className="rr-tradition-uncertainty">A documented use or plant range does not mean a remedy is proven to work or comes from only one place.</p>
            </div>
          </section>

          <form className="rr-traditions-search" role="search" onSubmit={(event) => event.preventDefault()}>
            <label htmlFor="rr-traditions-search">Search traditions</label>
            <div className="search-row">
              <input
                id="rr-traditions-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Try a culture, region, or remedy"
              />
              {query && <button className="button button-secondary" type="button" onClick={() => setQuery('')}>Clear</button>}
            </div>
          </form>

          <div className="rr-traditions-heading">
            <h2>{query ? 'Search results' : 'Explore traditions and origins'}</h2>
            <button className="rr-map-open" type="button" onClick={() => openMap()}>Open origin map →</button>
          </div>

          {filteredTraditions.length ? (
            <div className="rr-tradition-grid" id="rr-traditions-grid" aria-live="polite">
              {filteredTraditions.map((tradition) => (
                <TraditionCard key={tradition.id} tradition={tradition} onSelect={openTradition} />
              ))}
            </div>
          ) : (
            <div className="rr-traditions-empty" role="status">
              <p>No traditions match “{query}”.</p>
              <button className="button button-secondary" type="button" onClick={() => setQuery('')}>Clear search</button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
