export const releaseCollections = ['remedies', 'goals', 'traditions', 'sources', 'studies'];

export function stableCatalogJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableCatalogJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableCatalogJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export const compareCatalogIds = (a, b) => a.id.localeCompare(b.id, 'en');
