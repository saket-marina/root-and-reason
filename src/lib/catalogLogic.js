// Pure catalog operations: no network calls, storage, or mutations.
const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const unique = (values) => [...new Set(values)];

/** Search display identities and goals; clinical protocol text is not a search suggestion. */
export function searchCatalog(query, goalId, remedies, goals) {
  const filtered = goalId && goalId !== 'all' ? remedies.filter((remedy) => remedy.conditionIds.includes(goalId)) : remedies;
  const terms = unique(normalize(query).split(' ').filter(Boolean));
  if (terms.length === 0) return { results: [...filtered], matchType: 'all' };
  const ranked = filtered.map((remedy) => {
    const goalNames = goals.filter((goal) => remedy.conditionIds.includes(goal.id)).flatMap((goal) => [goal.name, goal.displayName, ...(goal.aliases || [])]);
    const identities = [
      remedy.id, remedy.name, remedy.shortName, ...(remedy.aliases || []),
      ...(remedy.display?.searchTerms || []), ...(remedy.display?.tags || []),
      ...goalNames, ...(remedy.ingredients || []).flatMap((ingredient) => [ingredient.name, ingredient.scientificName, ...(ingredient.aliases || [])]),
    ].filter(Boolean).map(normalize);
    const haystack = identities.join(' ');
    return { remedy, matches: terms.filter((term) => haystack.includes(term)).length, exactIdentity: identities.includes(normalize(query)) };
  });
  const complete = ranked.filter((entry) => entry.matches === terms.length);
  if (complete.length) return { results: complete.map((entry) => entry.remedy), matchType: complete.some(entry => entry.exactIdentity) ? 'exact' : 'partial' };
  const partial = ranked.filter((entry) => entry.matches > 0).sort((a, b) => b.matches - a.matches);
  return { results: partial.map((entry) => entry.remedy), matchType: partial.length ? 'partial' : 'none' };
}

export function commonGoalIds(selectedRemedies) {
  if (!selectedRemedies.length || selectedRemedies.some(remedy => !remedy)) return [];
  return unique(selectedRemedies[0].conditionIds || []).filter((id) => selectedRemedies.every((remedy) => (remedy.conditionIds || []).includes(id)));
}

export function comparisonState(ids, catalog) {
  const selected = unique(ids).map(catalog.getRemedy).filter(Boolean);
  const goalIds = commonGoalIds(selected);
  const valid = selected.length >= 2 && selected.length <= 4 && goalIds.length > 0;
  const message = selected.length < 2 ? 'Add at least two remedies to compare.'
    : selected.length > 4 ? 'Choose no more than four remedies.'
      : !goalIds.length ? 'These remedies have no shared health goal. Change your selection to compare.'
        : 'Choose a shared health goal and explore the research.';
  return { selected, goalIds, valid, message };
}

/**
 * Selected extracted primary-study cohorts only, scoped to one health goal.
 * Analyzed counts describe the whole study, including comparison arms. Review
 * totals remain separate because their studies may overlap with primary records.
 */
export function getResearchMetrics(remedy, goalId) {
  const assessments = (remedy.assessments || []).filter((assessment) => !goalId || assessment.conditionId === goalId);
  const allowedStudyIds = new Set(assessments.flatMap((assessment) => assessment.studyIds || []));
  const studiesById = new Map((remedy.studies || []).filter((study) => allowedStudyIds.has(study.id)).map((study) => [study.id, study]));
  const cohorts = new Map();
  for (const study of studiesById.values()) {
    const key = study.cohortId || study.id;
    if (!cohorts.has(key)) cohorts.set(key, []);
    cohorts.get(key).push(study);
  }
  const records = [...cohorts.values()];
  const cohortCounts = records.map((cohort) => {
    const values = unique(cohort.map((study) => study.counts?.analyzed).filter((count) => Number.isInteger(count) && count >= 0));
    return values.length === 1 ? values[0] : null;
  });
  const knownCounts = cohortCounts.filter((count) => count !== null);
  const knownParticipantSubtotal = knownCounts.reduce((sum, count) => sum + count, 0);
  const participantCoverage = !records.length || !knownCounts.length ? 'unavailable' : knownCounts.length === records.length ? 'complete' : 'partial';
  const reviewMap = new Map();
  for (const assessment of assessments) {
    for (const report of assessment.reportedResearch || []) {
      const key = `${report.sourceId}|${report.scope || ''}`;
      if (!reviewMap.has(key)) reviewMap.set(key, { ...report });
    }
  }
  return {
    studyCount: records.length,
    participantCount: participantCoverage === 'complete' ? knownParticipantSubtotal : null,
    knownParticipantSubtotal,
    participantCoverage,
    studies: records.map((cohort) => cohort.find((study) => Number.isInteger(study.counts?.analyzed)) || cohort[0]),
    reviewTotals: [...reviewMap.values()],
    participantScope: 'whole-study analyzed participants',
    coverage: 'curated_not_exhaustive',
  };
}

export function formatCount(value) {
  return Number.isFinite(value) ? new Intl.NumberFormat('en-US').format(value) : 'Not available';
}
