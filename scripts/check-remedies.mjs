import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function checkRemedies(data) {
  const collections = ['remedies', 'healthGoals', 'studies', 'origins', 'sources'];
  const ids = {};
  for (const name of collections) {
    assert.ok(Array.isArray(data[name]), `Missing collection: ${name}`);
    ids[name] = new Set(data[name].map(record => record.id));
    assert.equal(ids[name].size, data[name].length, `Duplicate IDs in ${name}`);
    assert.ok(data[name].every(record => typeof record.id === 'string' && /^[a-z0-9-]+$/.test(record.id)),
      `Invalid ID in ${name}`);
  }
  assert.ok(data.remedies.length >= 20, 'The release needs at least 20 remedies.');

  function references(collection, values, label) {
    assert.ok(Array.isArray(values), `Missing ${label}`);
    assert.equal(new Set(values).size, values.length, `Duplicate references in ${label}`);
    for (const id of values) assert.ok(ids[collection].has(id), `Unknown ${collection}/${id} in ${label}`);
  }
  const allClaims = new Set();
  for (const remedy of data.remedies) {
    assert.ok(remedy.name && remedy.summary, `Missing description: ${remedy.id}`);
    assert.ok(remedy.ingredients?.length && remedy.healthGoalIds?.length, `Missing ingredients or goals: ${remedy.id}`);
    assert.equal(remedy.safetyScore, null, `Safety score must stay null: ${remedy.id}`);
    assert.ok(remedy.preparationMinutes === null ||
      (Number.isInteger(remedy.preparationMinutes) && remedy.preparationMinutes >= 0));
    assert.ok(remedy.preparationNote && remedy.preparation?.length, `Missing preparation context: ${remedy.id}`);
    assert.ok(remedy.originIds?.length && remedy.researchSourceIds?.length, `Missing origin or research: ${remedy.id}`);
    references('healthGoals', remedy.healthGoalIds, remedy.id);
    references('studies', remedy.studyIds, remedy.id);
    references('origins', remedy.originIds, remedy.id);
    references('sources', remedy.sourceIds, remedy.id);
    references('sources', remedy.ingredientSourceIds, remedy.id);
    references('sources', remedy.researchSourceIds, remedy.id);
    const claimIds = new Set();
    for (const claim of remedy.claims) {
      assert.ok(!allClaims.has(claim.id), `Duplicate claim: ${claim.id}`);
      claimIds.add(claim.id);
      allClaims.add(claim.id);
      assert.ok(claim.text && claim.citations?.length, `Uncited claim: ${claim.id}`);
      for (const citation of claim.citations) {
        references('sources', [citation.sourceId], claim.id);
        assert.ok(citation.locator, `Missing source locator: ${claim.id}`);
      }
    }
    const displayedClaims = [
      ...remedy.summaryClaimIds, ...remedy.cautionClaimIds,
      ...remedy.preparation.flatMap(item => item.claimIds),
      ...data.origins.filter(origin => remedy.originIds.includes(origin.id))
        .flatMap(origin => origin.associations.flatMap(item => item.claimIds)),
    ];
    assert.ok(displayedClaims.every(id => claimIds.has(id)), `Missing claim: ${remedy.id}`);
    const image = remedy.image;
    assert.ok(/^\/images\/[a-z0-9-]+\.jpg$/.test(image?.src) && image.alt && image.caption, `Missing photo: ${remedy.id}`);
    assert.ok(image.credit?.artist && image.credit.license && image.credit.sourceUrl && image.credit.licenseUrl,
      `Missing photo credit: ${remedy.id}`);
  }
  for (const study of data.studies) {
    references('healthGoals', [study.healthGoalId], study.id);
    references('sources', study.sourceIds, study.id);
    assert.ok(study.summaryClaimIds.every(id => allClaims.has(id)), `Missing outcome claim: ${study.id}`);
    assert.ok(study.participantsAnalyzed === null ||
      (Number.isInteger(study.participantsAnalyzed) && study.participantsAnalyzed >= 0), `Invalid count: ${study.id}`);
    assert.ok(study.participantScope && study.participantSourceUrl && study.cohortId);
    for (const remedy of data.remedies.filter(item => item.studyIds.includes(study.id))) {
      assert.ok(remedy.healthGoalIds.includes(study.healthGoalId), `Study goal mismatch: ${remedy.id}`);
    }
  }
  for (const origin of data.origins) {
    references('sources', origin.sourceIds, origin.id);
    assert.ok(origin.summary && origin.sourceIds.length, `Missing origin source: ${origin.id}`);
    assert.ok(origin.continents.every(name => ['Africa', 'Asia', 'Europe', 'North America'].includes(name)));
    assert.ok(origin.continents.length || origin.mapNote, `Unexplained map omission: ${origin.id}`);
  }
  for (const source of data.sources) {
    assert.ok(source.title && /^https:\/\//.test(source.url), `Invalid source: ${source.id}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const data = JSON.parse(await readFile(new URL('../data/remedy-samples.json', import.meta.url), 'utf8'));
  checkRemedies(data);
  await Promise.all(data.remedies.map(remedy => access(new URL('../public' + remedy.image.src, import.meta.url))));
  console.log(`Checked ${data.remedies.length} remedies, ${data.studies.length} studies, and ${data.sources.length} sources.`);
  const missingTimes = data.remedies.filter(remedy => remedy.preparationMinutes === null).length;
  const missingCounts = data.studies.filter(study => study.participantsAnalyzed === null).length;
  console.log(`${missingTimes} preparation times and ${missingCounts} study analysis counts remain unknown.`);
}
