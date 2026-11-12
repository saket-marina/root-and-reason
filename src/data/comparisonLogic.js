export function getSharedGoals(remedies) {
  if (remedies.length === 0) return [];

  return remedies[0].goalIds.filter((goalId) =>
    remedies.every((remedy) => remedy.goalIds.includes(goalId))
  );
}

export function getRemedyResearch(remedy, studies, goalId) {
  const studyIds = [...new Set(remedy.studyIds)];

  const matchingStudies = studies.filter((study) =>
    studyIds.includes(study.id) &&
    (!study.healthGoalId || study.healthGoalId === goalId)
  );

  const humanStudies = matchingStudies.filter((study) => study.human);
  const knownCounts = humanStudies
    .filter((study) => Number.isInteger(study.participantCount));

  const participantCount = knownCounts.length > 0
    ? knownCounts.reduce((total, study) => total + study.participantCount, 0)
    : null;

  return {
    studies: matchingStudies,
    studyCount: matchingStudies.length,
    participantCount,
    missingParticipants: knownCounts.length < humanStudies.length,
  };
}
