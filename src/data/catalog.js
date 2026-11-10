import dataset from '../../data/remedies.json' with { type: 'json' };
import imageManifest from './imageManifest.json' with { type: 'json' };
import researchUpdates from '../../data/app-research-updates.json' with { type: 'json' };

// Read-only application projection. The source dataset, claims, and source locators
// remain intact; this module adds display labels and resolves referenced records.
const byId = (records) => Object.fromEntries(records.map((record) => [record.id, record]));
const unique = (values) => [...new Set(values.filter(Boolean))];
export const sourceById = byId(dataset.sources);
export const studyById = byId(dataset.studies.map(study => {
  const update = researchUpdates.studies[study.id];
  if (!update) return study;
  return { ...study, counts: { ...study.counts, randomized: update.randomized ?? study.counts.randomized, analyzed: update.analyzed },
    countReview: { sourceIds: [update.sourceId], locator: update.locator, fullTextUrl: update.fullTextUrl,
      reviewedAt: update.reviewDate ?? researchUpdates.reviewDate, denominator: update.denominator },
    limitations: [...study.limitations.filter(item => item !== update.replacedLimitation), ...update.analysisLimitations] };
}));
const ingredientById = byId(dataset.ingredients);
const assessmentById = byId(dataset.evidenceAssessments);
const conditionById = byId(dataset.conditions);

const names = {
  'aloe-topical-burns': 'Aloe gel',
  'boswellia-knee-oa': 'Boswellia extract',
  'capsaicin-knee-oa': 'Capsaicin cream',
  'colloidal-oatmeal-cream': 'Colloidal oatmeal',
  'echinacea-cold-prevention': 'Echinacea extract',
  flaxseed: 'Flaxseed',
  'ginger-dysmenorrhea': 'Ginger capsules',
  'green-kiwifruit': 'Green kiwifruit',
  'honey-acute-cough': 'Honey',
  'lavender-oral-anxiety': 'Oral lavender',
  'pelargonium-acute-bronchitis': 'Pelargonium extract',
  'peppermint-caraway': 'Peppermint & caraway',
  'peppermint-oil': 'Peppermint oil',
  prunes: 'Prunes',
  'psyllium-husk': 'Psyllium husk',
  'saline-nasal-irrigation': 'Saline nasal irrigation',
  senna: 'Senna',
  'tea-tree-acne-gel': 'Tea tree oil gel',
  'turmeric-knee-oa': 'Turmeric extract',
  'zinc-oral-lozenges': 'Zinc lozenges',
};

const goalLabels = {
  acne: ['Acne', 'skin'],
  'acute-bronchitis-symptoms': ['Bronchitis symptoms', 'lungs'],
  'acute-cough': ['Cough', 'lungs'],
  'allergic-rhinitis': ['Hay fever', 'flower'],
  'anxiety-symptoms': ['Anxiety symptoms', 'sun'],
  'common-cold-duration': ['Cold duration', 'lungs'],
  'common-cold-prevention': ['Cold prevention', 'leaf'],
  constipation: ['Constipation', 'digestive'],
  'functional-dyspepsia': ['Digestive discomfort', 'digestive'],
  'ibs-symptoms': ['IBS symptoms', 'digestive'],
  'irritant-hand-eczema': ['Hand eczema', 'skin'],
  'knee-osteoarthritis-pain': ['Knee joint pain', 'joint'],
  'partial-thickness-burns': ['Burn-care research', 'skin'],
  'primary-dysmenorrhea': ['Menstrual cramps', 'sun'],
};

const categoryFor = (record) => {
  if (record.conditionIds.some((id) => ['constipation', 'functional-dyspepsia', 'ibs-symptoms'].includes(id))) return 'Digestive';
  if (record.conditionIds.some((id) => ['acne', 'irritant-hand-eczema', 'partial-thickness-burns'].includes(id))) return 'Skin';
  if (record.conditionIds.some((id) => ['knee-osteoarthritis-pain', 'primary-dysmenorrhea', 'anxiety-symptoms'].includes(id))) return 'Pain & wellbeing';
  return 'Respiratory';
};

export const goals = dataset.conditions.map((condition) => {
  const remedyIds = dataset.remedies.filter((remedy) => remedy.conditionIds.includes(condition.id)).map((remedy) => remedy.id);
  return {
    ...condition,
    displayName: goalLabels[condition.id]?.[0] || condition.name,
    iconKey: goalLabels[condition.id]?.[1] || 'leaf',
    remedyIds,
    count: remedyIds.length,
  };
}).sort((a, b) => a.displayName.localeCompare(b.displayName));

const localImage = (record) => {
  const value = imageManifest[record.id];
  const src = typeof value === 'string' ? value : value?.src;
  // Only bundled photographs are accepted. External or arbitrary manifest URLs
  // cannot become image requests from this local catalog projection.
  return src && /^\/images\/[a-z0-9-]+\.(?:jpg|webp)$/i.test(src)
    ? { src, alt: value?.alt || `${names[record.id] || record.name} — ingredient photograph`, credit: value?.credit || null, caption: value?.caption || null }
    : { src: null, alt: `${names[record.id] || record.name} — photograph pending`, credit: null, caption: null };
};

// Source text stays available beside editorial wording in the catalog projection.
const displayCopy = {
  'The ACR/Arthritis Foundation guideline conditionally recommends topical capsaicin for knee osteoarthritis, citing small effects and wide confidence intervals.': 'An ACR/Arthritis Foundation guideline discusses topical capsaicin for knee osteoarthritis, noting small effects and wide confidence intervals.',
  'The ACR recommendation is knee-specific; it recommends against hand use because of limited evidence and eye-contamination risk.': 'The guideline is knee-specific and advises against hand use because of limited evidence and eye-contamination risk.',
  'Children in an echinacea trial developed rashes; a child’s clinician should be consulted before use.': 'Children in an echinacea trial developed rashes; the source emphasizes discussing use with a child’s clinician.',
  'Pregnancy use should be discussed with a clinician, and breastfeeding safety is poorly known.': 'The source flags pregnancy use for discussion with a clinician; information about breastfeeding is limited.',
  'The extracted trial studied flaxseed flour with meals; its findings should not be assigned to flaxseed oil.': 'The extracted trial studied flaxseed flour with meals; its findings do not establish the same effects for flaxseed oil.',
  'Pregnancy use of ginger supplements should be discussed with a clinician; breastfeeding safety is poorly characterized.': 'The source flags ginger supplements during pregnancy for discussion with a clinician; information about breastfeeding is limited.',
  'Kiwi allergy can occur alongside latex allergy; the NHS referral guidance recommends allergy assessment for affected patients.': 'Kiwi allergy can occur alongside latex allergy; NHS referral guidance discusses allergy assessment for affected patients.',
  'NICE found no information on cough duration; symptom relief should not be described as curing the infection.': 'NICE found no information on cough duration; symptom relief alone does not establish resolution of the infection.',
  'Some capsule brands contain arachis oil and should be avoided by people with relevant peanut or soya allergy.': 'Some capsule brands contain arachis oil, an important allergy concern for people with relevant peanut or soya allergy.',
};

export const remedies = dataset.remedies.map((record) => {
  const extraClaims = Object.entries(researchUpdates.studies).filter(([id]) => studyById[id]?.interventions.some(item => item.remedyId === record.id)).map(([,update]) => ({
    id: update.claimId, text: update.claimText, category: record.claims.find(claim => claim.id === update.claimId)?.category ?? 'limitation',
    verificationStatus: 'source_checked', verifiedAt: update.reviewDate ?? researchUpdates.reviewDate,
    citations: [{ sourceId: update.sourceId, locator: update.locator, support: 'supports' }],
  }));
  const claims = [...record.claims.filter(claim => !extraClaims.some(update => update.id === claim.id)), ...extraClaims];
  record = { ...record, claims: claims.map(claim =>
    Object.hasOwn(displayCopy, claim.text) ? { ...claim, displayText: displayCopy[claim.text] } : claim) };
  const claimsById = byId(record.claims);
  const assessments = record.evidenceAssessmentIds.map((id) => assessmentById[id]).filter(Boolean);
  const summaryClaims = record.summaryClaimIds.map((id) => claimsById[id]).filter(Boolean);
  const studies = unique(assessments.flatMap((assessment) => assessment.studyIds)).map((id) => studyById[id]).filter(Boolean);
  const ingredients = record.ingredientIds.map((id) => ingredientById[id]).filter(Boolean);
  const image = localImage(record);
  return {
    ...record,
    preparationTime: { status: 'not_recorded', minutes: null,
      explanation: 'No source-verified preparation time is recorded for this formulation. Research duration is a different measure.' },
    shortName: names[record.id] || record.name,
    category: categoryFor(record),
    summary: summaryClaims[0]?.text || '',
    summaryClaims,
    ingredients,
    assessments,
    studies,
    regions: unique(record.culturalContexts.flatMap((context) => context.regions)),
    sourceIds: unique([
      ...record.claims.flatMap((claim) => claim.citations.map((citation) => citation.sourceId)),
      ...ingredients.flatMap((ingredient) => ingredient.identitySourceIds),
      ...studies.flatMap((study) => study.sourceIds),
      ...assessments.flatMap((assessment) => assessment.reviewSourceIds),
    ]),
    image: image.src,
    imageAlt: image.alt,
    imageCredit: image.credit,
    imageCaption: image.caption,
    goalNames: record.conditionIds.map((id) => goalLabels[id]?.[0] || conditionById[id]?.name).filter(Boolean),
    traditionIds: [],
  };
});

// Groups are navigation lenses into cited contexts, never exclusive countries of
// origin. Each association retains the complete source claim and its uncertainty.
const groups = [
  { id: 'ayurvedic-connections', name: 'Ayurvedic connections', type: 'documented_traditional_use', regionLabel: 'Multiple documented contexts', matches: (_, context) => context.communities.some((name) => /ayurved/i.test(name)) },
  { id: 'mediterranean-west-asian-histories', name: 'Mediterranean & West Asian histories', type: 'documented_traditional_use', regionLabel: 'Mediterranean · Middle East · Egypt', matches: (remedy, context) => ['aloe-topical-burns', 'flaxseed', 'peppermint-oil', 'honey-acute-cough'].includes(remedy.id) && context.associationType === 'documented_traditional_use' },
  { id: 'chinese-traditions', name: 'Chinese traditional contexts', type: 'documented_traditional_use', regionLabel: 'China · connected histories', matches: (_, context) => context.communities.some((name) => /chinese/i.test(name)) && context.associationType === 'documented_traditional_use' },
  { id: 'islamic-traditions', name: 'Islamic traditional contexts', type: 'documented_traditional_use', regionLabel: 'No exclusive geographic attribution', matches: (_, context) => context.communities.some((name) => /islamic/i.test(name)) },
  { id: 'north-american-indigenous-histories', name: 'North American Indigenous histories', type: 'documented_traditional_use', regionLabel: 'North America', matches: (remedy, context) => remedy.id === 'echinacea-cold-prevention' && context.associationType === 'documented_traditional_use' },
  { id: 'mexican-chili-knowledge', name: 'Mexican chili knowledge', type: 'documented_traditional_use', regionLabel: 'Mexico', matches: (remedy, context) => remedy.id === 'capsaicin-knee-oa' && context.associationType === 'documented_traditional_use' },
  { id: 'southern-african-plant-traditions', name: 'Southern African plant traditions', type: 'documented_traditional_use', regionLabel: 'South Africa', matches: (remedy, context) => remedy.id === 'pelargonium-acute-bronchitis' && context.associationType === 'documented_traditional_use' },
  { id: 'aboriginal-australian-leaf-use', name: 'Aboriginal Australian leaf use', type: 'documented_traditional_use', regionLabel: 'Australia', matches: (remedy, context) => remedy.id === 'tea-tree-acne-gel' && context.associationType === 'documented_traditional_use' },
  { id: 'european-ingredient-history', name: 'European ingredient history', type: 'documented_traditional_use', regionLabel: 'Europe', matches: (remedy, context) => remedy.id === 'peppermint-caraway' && context.associationType === 'documented_traditional_use' },
  { id: 'botanical-native-ranges', name: 'Botanical native ranges', type: 'botanical_native_range', regionLabel: 'Multiple regions', matches: (_, context) => context.associationType === 'botanical_native_range' },
  { id: 'cultivation-histories', name: 'Cultivation histories', type: 'historical_preparation', regionLabel: 'China · New Zealand', matches: (remedy, context) => remedy.id === 'green-kiwifruit' && context.associationType === 'historical_preparation' },
  { id: 'histories-being-traced', name: 'Histories still being traced', type: 'geography_not_established', regionLabel: 'Geographic attribution pending', matches: (_, context) => context.regions.length === 0 && context.communities.length === 0 && context.associationType !== 'modern_clinical_use' },
  { id: 'modern-clinical-formulations', name: 'Modern clinical formulations', type: 'modern_clinical_use', regionLabel: 'No birthplace assigned', matches: (_, context) => context.associationType === 'modern_clinical_use' },
];

export const traditions = groups.map(({ matches, ...group }) => {
  const associations = remedies.flatMap((remedy) => remedy.culturalContexts.filter((context) => matches(remedy, context)).map((context) => {
    const claims = context.narrativeClaimIds.map((id) => remedy.claims.find((claim) => claim.id === id)).filter(Boolean);
    return {
      regionLabel: context.regions.join(' · ') || 'No geographic attribution in this source',
      regions: [...context.regions],
      type: context.associationType,
      remedyId: remedy.id,
      claimText: claims.map((claim) => claim.displayText || claim.text).join(' '),
      claimIds: claims.map((claim) => claim.id),
      sourceIds: unique(claims.flatMap((claim) => claim.citations.map((citation) => citation.sourceId))),
      communities: [...context.communities],
      coordinates: context.mapAnchor || null,
      uncertainty: context.uncertainty,
    };
  }));
  return {
    ...group,
    slug: group.id,
    description: associations[0]?.claimText || 'Explore the cited contexts in this collection.',
    remedyIds: unique(associations.map((association) => association.remedyId)),
    sourceIds: unique(associations.flatMap((association) => association.sourceIds)),
    associations,
    coordinates: null,
  };
}).filter((tradition) => tradition.remedyIds.length > 0);

for (const remedy of remedies) {
  remedy.traditionIds = traditions.filter((tradition) => tradition.remedyIds.includes(remedy.id)).map((tradition) => tradition.id);
}

export const getRemedy = (idOrSlug) => remedies.find((remedy) => remedy.id === idOrSlug || remedy.slug === idOrSlug);
export const getGoal = (id) => goals.find((goal) => goal.id === id);
