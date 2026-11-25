import catalog from '../../data/remedy-samples.json' with { type: 'json' };

const unique = (values) => [...new Set(values.filter(Boolean))];
const claimsById = (claims = []) => Object.fromEntries(claims.map((claim) => [claim.id, claim]));

export const remedies = catalog.remedies.map((remedy) => ({
  ...remedy,
  slug: remedy.id,
  imageAlt: remedy.image?.alt || '',
  imageCaption: remedy.image?.caption || '',
}));

export const sourceById = Object.fromEntries(catalog.sources.map((source) => [source.id, source]));

const remediesByOriginId = new Map();
remedies.forEach((remedy) => remedy.originIds.forEach((originId) => {
  const associated = remediesByOriginId.get(originId) || [];
  associated.push(remedy);
  remediesByOriginId.set(originId, associated);
}));

export const traditions = catalog.origins.flatMap((origin) => {
  const associatedRemedies = remediesByOriginId.get(origin.id) || [];

  return associatedRemedies.flatMap((remedy) => {
    const claims = claimsById(remedy.claims);
    return (origin.associations || []).map((association, index) => {
      const regions = unique(association.regions || []);
      const story = unique((association.claimIds || []).map((claimId) => claims[claimId]?.text)).join(' ');
      const sourceIds = unique([
        ...origin.sourceIds,
        ...(association.claimIds || []).flatMap((claimId) =>
          (claims[claimId]?.citations || []).map((citation) => citation.sourceId)),
      ]);
      const associationRecord = {
        remedyId: remedy.id,
        type: association.type,
        regions,
        communities: [],
        claimText: story,
        uncertainty: association.uncertainty || '',
        sourceIds,
      };

      return {
        id: `${origin.id}:${remedy.id}:${index}`,
        type: association.type,
        name: regions.length
          ? `${remedy.name} · ${regions.join(' · ')}`
          : `${remedy.name} traditional use`,
        regionLabel: regions.length ? regions.join(' · ') : 'No exclusive geographic attribution',
        description: story || origin.summary || '',
        remedyIds: [remedy.id],
        associations: [associationRecord],
        sourceIds,
      };
    });
  });
});
