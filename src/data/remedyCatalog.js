export function validateCatalog(data) {
  for (const key of ['goals', 'remedies', 'studies', 'sources']) {
    if (!Array.isArray(data?.[key])) throw new Error('Missing catalog collection: ' + key);
    const ids = data[key].map((record) => record.id);
    if (ids.some((id) => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length) {
      throw new Error('Invalid or duplicate IDs in ' + key);
    }
  }
  const ids = (key) => new Set(data[key].map((record) => record.id));
  const goals = ids('goals'), studies = ids('studies'), sources = ids('sources');
  for (const goal of data.goals) if (!goal.name) throw new Error('Missing goal name');
  for (const remedy of data.remedies) {
    if (!remedy.name || !Array.isArray(remedy.goalIds) || !Array.isArray(remedy.studyIds)
        || !Array.isArray(remedy.researchSourceIds) || typeof remedy.researchNote !== 'string') {
      throw new Error('Incomplete remedy record');
    }
    if (remedy.goalIds.some((id) => !goals.has(id)) || remedy.studyIds.some((id) => !studies.has(id))
        || remedy.researchSourceIds.some((id) => !sources.has(id))) throw new Error('Broken remedy reference');
  }
  for (const study of data.studies) {
    if (typeof study.human !== 'boolean' || !Array.isArray(study.sourceIds)
        || study.sourceIds.some((id) => !sources.has(id))
        || (study.participantCount !== null && (!Number.isInteger(study.participantCount) || study.participantCount < 0))) {
      throw new Error('Invalid study record');
    }
  }
  return data;
}
