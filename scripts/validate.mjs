import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { resolve } from 'node:path';
import { ROOT, GROUPS, MAX_DOCUMENT_BYTES, readJson, writeJson, parseArgs, isMain, fail, estimateFirestoreBytes } from './lib.mjs';

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
const schema = await readJson(resolve(ROOT, 'schemas/dataset.schema.json'));
const validateSchema = ajv.compile(schema);

export function verifiedParticipants(studies) {
  // Counts are comparable only when the analyzed denominator is known for each
  // primary cohort. Repeated reports of a cohort cannot add participants twice.
  const cohorts = new Map();
  for (const study of studies) {
    const n = study.counts.analyzed;
    if (n === null) return null;
    if (cohorts.has(study.cohortId) && cohorts.get(study.cohortId) !== n) return null;
    cohorts.set(study.cohortId, n);
  }
  return studies.length ? [...cohorts.values()].reduce((a, b) => a + b, 0) : null;
}

export function validateDataset(data) {
  const errors = [], warnings = [];
  if (!validateSchema(data)) {
    return { valid: false, errors: validateSchema.errors.map(e => `${e.instancePath || '/'} ${e.message}${e.params.additionalProperty ? ` (${e.params.additionalProperty})` : ''}`), warnings };
  }
  const by = Object.fromEntries(GROUPS.map(group => [group, new Map()]));
  for (const group of GROUPS) {
    for (const row of data[group]) {
      if (by[group].has(row.id)) errors.push(`Duplicate ${group} ID: ${row.id}`);
      by[group].set(row.id, row);
      if (estimateFirestoreBytes(row, `${group}/${row.id}`) > MAX_DOCUMENT_BYTES) errors.push(`${group}/${row.id} exceeds the conservative document size budget`);
    }
  }
  const claims = new Map(), preparations = new Map(), safetyIds = new Set(), slugs = new Set();
  const ref = (group, id, where) => {
    if (!by[group].has(id)) errors.push(`${where}: unresolved ${group} reference ${id}`);
  };
  const sourceRefs = (ids, where) => ids.forEach(id => ref('sources', id, where));
  for (const r of data.remedies) {
    if (slugs.has(r.slug)) errors.push(`Duplicate remedy slug ${r.slug}`);
    slugs.add(r.slug);
    r.ingredientIds.forEach(id => ref('ingredients', id, r.id));
    r.conditionIds.forEach(id => ref('conditions', id, r.id));
    r.evidenceAssessmentIds.forEach(id => ref('evidenceAssessments', id, r.id));
    for (const claim of r.claims) {
      if (claims.has(claim.id)) errors.push(`Duplicate claim ID ${claim.id}`);
      claims.set(claim.id, { ...claim, remedyId: r.id });
      sourceRefs(claim.citations.map(c => c.sourceId), claim.id);
      if (claim.verifiedAt > data.metadata.researchDate) errors.push(`${claim.id}: verification after dataset researchDate`);
    }
    for (const p of r.preparations) {
      if (preparations.has(p.id)) errors.push(`Duplicate preparation ID ${p.id}`);
      preparations.set(p.id, { ...p, remedyId: r.id });
      p.ingredientIds.forEach(id => {
        ref('ingredients', id, p.id);
        if (!r.ingredientIds.includes(id)) errors.push(`${p.id}: ingredient ${id} absent from parent remedy`);
      });
      const g = p.guidedUse;
      if (g.status === 'available' && !g.steps.length) errors.push(`${p.id}: available guided use needs sourced steps`);
      if (g.status === 'not_provided' && (g.steps.length || g.reason === null || g.totalTimeMinutes !== null)) errors.push(`${p.id}: omitted guided use needs a reason, no steps, and null totalTimeMinutes`);
      if (g.status === 'available' && g.reason !== null) errors.push(`${p.id}: available guided use should have null omission reason`);
      g.steps.forEach((step, index) => {
        if (step.order !== index + 1) errors.push(`${p.id}: steps must be consecutive and ordered from 1`);
      });
    }
    for (const item of r.safety.items) {
      if (safetyIds.has(item.id)) errors.push(`Duplicate safety item ID ${item.id}`);
      safetyIds.add(item.id);
    }
    for (const c of r.culturalContexts) {
      if (c.associationType !== 'unknown' && !c.narrativeClaimIds.length) errors.push(`${r.id}: documented cultural association needs narrative citations`);
      if (['uncertain','not_established'].includes(c.originStatus) && c.uncertainty === null) errors.push(`${r.id}: uncertain origin requires explanation`);
      if (c.associationType === 'unknown' && (c.countryCodes.length || c.regions.length || c.mapAnchor)) errors.push(`${r.id}: unknown origin cannot assert geographic precision`);
      if (c.mapAnchor) ref('sources', c.mapAnchor.sourceId, `${r.id} mapAnchor`);
    }
  }
  const claimRefs = (value, where, expectedRemedyId) => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if ((key === 'claimIds' || key.endsWith('ClaimIds')) && Array.isArray(child)) {
        child.forEach(id => {
          const claim = claims.get(id);
          if (!claim) errors.push(`${where}.${key}: unresolved claim ${id}`);
          else if (expectedRemedyId && claim.remedyId !== expectedRemedyId) errors.push(`${where}.${key}: claim ${id} belongs to another remedy`);
        });
      } else if (child && typeof child === 'object') claimRefs(child, `${where}.${key}`, expectedRemedyId);
    }
  };
  for (const r of data.remedies) claimRefs(r, r.id, r.id);
  for (const ingredient of data.ingredients) sourceRefs(ingredient.identitySourceIds, ingredient.id);
  for (const study of data.studies) {
    sourceRefs(study.sourceIds, study.id);
    if (!study.sourceIds.some(id => ['randomized_trial','clinical_study'].includes(by.sources.get(id)?.sourceType))) errors.push(`${study.id}: primary study needs a primary publication source`);
    study.interventions.forEach(i => {
      ref('remedies', i.remedyId, study.id);
      if (preparations.get(i.preparationId)?.remedyId !== i.remedyId) errors.push(`${study.id}: intervention preparation belongs to no matching remedy`);
    });
    claimRefs(study, study.id);
    for (const outcome of study.outcomes) {
      if (!outcome.claimIds.some(id => claims.get(id)?.citations.some(c => study.sourceIds.includes(c.sourceId)))) errors.push(`${study.id}: outcome claim must cite the primary study source`);
    }
    if (study.counts.enrolled !== null && [study.counts.randomized,study.counts.analyzed].some(n => n !== null && n > study.counts.enrolled)) errors.push(`${study.id}: participant counts exceed enrollment`);
    if (study.counts.randomized !== null && study.counts.analyzed !== null && study.counts.analyzed > study.counts.randomized) warnings.push(`${study.id}: analyzed exceeds randomized; verify the extraction denominator`);
    for (const id of study.sourceIds) {
      const source = by.sources.get(id);
      if (source && ['randomized_trial','clinical_study'].includes(source.sourceType) && source.accessLevel === 'summary') errors.push(`${study.id}: primary extraction requires access to the publication abstract or full text`);
      if (source && ['randomized_trial','clinical_study'].includes(source.sourceType) && study.extractionAccess === 'full_text' && source.accessLevel !== 'full_text') errors.push(`${study.id}: full-text extraction exceeds recorded source access`);
    }
  }
  for (const e of data.evidenceAssessments) {
    ref('remedies', e.remedyId, e.id); ref('conditions', e.conditionId, e.id);
    const r = by.remedies.get(e.remedyId);
    if (preparations.get(e.preparationId)?.remedyId !== e.remedyId) errors.push(`${e.id}: preparation does not belong to remedy`);
    if (r && (!r.evidenceAssessmentIds.includes(e.id) || !r.conditionIds.includes(e.conditionId))) errors.push(`${e.id}: assessment must be linked from its remedy and condition list`);
    sourceRefs(e.reviewSourceIds, e.id);
    e.studyIds.forEach(id => ref('studies', id, e.id));
    e.reportedResearch.forEach(report => {
      ref('sources', report.sourceId, e.id);
      if (!report.claimIds.some(id => claims.get(id)?.citations.some(c => c.sourceId === report.sourceId))) errors.push(`${e.id}: reported research counts need a claim citing their exact source`);
    });
    if (!e.studyIds.length && !e.reviewSourceIds.length) errors.push(`${e.id}: requires primary studies or reviewed research sources`);
    if (e.certainty.sourceId) ref('sources', e.certainty.sourceId, e.id);
    if (e.certainty.method === 'not_assessed' && (e.certainty.level !== 'not_formally_assessed' || e.certainty.sourceId !== null)) errors.push(`${e.id}: unassessed certainty cannot imply a formal grade`);
    if (e.certainty.method !== 'not_assessed' && !e.certainty.sourceId) errors.push(`${e.id}: attributed certainty needs a source`);
    if (e.certainty.sourceId && !e.certainty.explanationClaimIds.some(id => claims.get(id)?.citations.some(c => c.sourceId === e.certainty.sourceId))) errors.push(`${e.id}: certainty explanation must cite the attributed source`);
    claimRefs(e, e.id, e.remedyId);
    if (e.comparison.verifiedStudyCount !== new Set(e.studyIds).size) errors.push(`${e.id}: verifiedStudyCount must equal distinct extracted primary study IDs`);
    const studies = e.studyIds.map(id => by.studies.get(id)).filter(Boolean);
    for (const study of studies) {
      if (!study.interventions.some(i => i.remedyId === e.remedyId && i.preparationId === e.preparationId)) errors.push(`${e.id}: linked study has no matching remedy/preparation intervention`);
    }
    if (e.comparison.participantCountStatus === 'not_aggregated' && e.comparison.verifiedParticipantCount !== null) errors.push(`${e.id}: unaggregated participant count must be null`);
    if (e.comparison.participantCountStatus === 'verified') {
      const total = verifiedParticipants(studies);
      if (total === null || e.comparison.verifiedParticipantCount !== total) errors.push(`${e.id}: verified participant count must use known, deduplicated analyzed cohorts`);
    }
    if (['indirect','unknown'].includes(e.formulationMatch) && e.comparison.eligible) errors.push(`${e.id}: indirect/unknown formulation cannot enter direct comparison`);
  }
  const sourceKeys = new Map(), urls = new Map();
  for (const source of data.sources) {
    const expected = {day:10,month:7,year:4,unknown:0}[source.datePrecision];
    if ((source.publishedDate?.length ?? 0) !== expected) errors.push(`${source.id}: publishedDate must match datePrecision`);
    if (source.retractionCheck.status === 'not_checked' && source.retractionCheck.checkedAt !== null) errors.push(`${source.id}: unperformed retraction check must not have a date`);
    if (source.retractionCheck.status !== 'not_checked' && source.retractionCheck.checkedAt === null) errors.push(`${source.id}: performed retraction check needs date`);
    for (const [field, value] of [['doi',source.doi],['pmid',source.pmid]]) if (value) {
      const key = `${field}:${value.toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//,'')}`;
      if (sourceKeys.has(key)) errors.push(`Duplicate source ${field} on ${sourceKeys.get(key)} and ${source.id}`);
      sourceKeys.set(key, source.id);
    }
    const normalized = new URL(source.url); normalized.hash = '';
    const url = normalized.toString().replace(/\/$/,'');
    if (urls.has(url)) warnings.push(`Same URL used by sources ${urls.get(url)} and ${source.id}; consolidate or explain distinct cited versions`);
    urls.set(url, source.id);
  }
  data.screeningLog.forEach((row, i) => sourceRefs(row.sourceIds, `screeningLog[${i}]`));
  if (data.screeningLog.filter(row => row.status === 'included').length !== 20) errors.push('Screening log must have exactly 20 included candidates');
  return { valid: errors.length === 0, errors, warnings, counts: Object.fromEntries(GROUPS.map(g => [g, data[g].length])), claims: claims.size };
}

export function assertValid(data) {
  const report = validateDataset(data);
  if (!report.valid) throw new Error(`Dataset validation failed:\n${report.errors.map(e => '- ' + e).join('\n')}`);
  return report;
}

if (isMain(import.meta.url)) {
  try {
    const { options, positional } = parseArgs(process.argv.slice(2), ['input','report']);
    if (positional.length) throw new Error('Use --input FILE, not positional arguments');
    const report = validateDataset(await readJson(resolve(ROOT, options.input || 'data/remedies.json')));
    await writeJson(resolve(ROOT, options.report || 'reports/validation.json'), report);
    console.log(JSON.stringify(report, null, 2));
    if (!report.valid) process.exitCode = 1;
  } catch (error) { fail(error); }
}
