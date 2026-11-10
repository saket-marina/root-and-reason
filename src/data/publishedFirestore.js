import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, getDoc, getDocs, doc, collection, query, where } from 'firebase/firestore';
import { compareCatalogIds, releaseCollections, stableCatalogJson } from '../lib/catalogRelease.js';

// This adapter is never selected by the local launcher. It requires an explicit
// published mode and real, public Web SDK configuration; no Admin credentials.
export async function loadPublishedFirestoreCatalog() {
  if(import.meta.env.VITE_DATA_MODE!=='published')throw new Error('Published catalog mode was not explicitly selected.');
  const projectId=import.meta.env.VITE_FIREBASE_PROJECT_ID;
  if(!projectId||projectId.startsWith('demo-')||!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId))throw new Error('A real Firebase project configuration is required for the published catalog.');
  const apiKey=import.meta.env.VITE_FIREBASE_API_KEY,appId=import.meta.env.VITE_FIREBASE_APP_ID;
  if(!apiKey||!appId)throw new Error('Public Firebase Web SDK configuration is incomplete.');
  const app=getApps().find(app=>app.name==='root-remedy-published')||initializeApp({projectId,apiKey,appId},'root-remedy-published');
  if(app.options.projectId!==projectId)throw new Error('Published Firebase project mismatch.');
  return readPublishedCatalog(getFirestore(app));
}

export async function readPublishedCatalog(database) {
  const pointer=await getDoc(doc(database,'appCatalogPointers','current'));
  const releaseId=pointer.data()?.releaseId;
  if(!pointer.exists()||pointer.data().publicationStatus!=='published'||!/^candidate-[a-f0-9]{12}$/.test(releaseId||''))throw new Error('No approved published catalog release is available.');
  const snapshot=await getDoc(doc(database,'appCatalogReleases',releaseId));
  const release=snapshot.data();
  if(!snapshot.exists()||release.releaseId!==releaseId||release.publicationStatus!=='published'||release.editorialReviewStatus!=='approved'||release.localPreview!==false||release.formatVersion!=='1.0.0'||!/^[a-f0-9]{64}$/.test(release.contentSha256||''))throw new Error('Published release metadata did not pass validation.');
  const entries=await Promise.all(releaseCollections.map(async name=>{
    const expected=release.counts?.[name];
    if(!Number.isInteger(expected)||expected<0||expected>5000)throw new Error(`Invalid catalog count: ${name}.`);
    const records=await getDocs(query(collection(database,'appCatalogReleases',releaseId,name),where('publicationStatus','==','published'),where('localPreview','==',false),where('releaseId','==',releaseId)));
    if(records.size!==expected)throw new Error(`Published catalog is incomplete: ${name}.`);
    return [name,records.docs.map(item=>{const {publicationStatus,localPreview,releaseId:documentRelease,...record}=item.data();if(record.id!==item.id)throw new Error('Published record identity mismatch.');return record;}).sort(compareCatalogIds)];
  }));
  const payload=Object.fromEntries(entries);
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(stableCatalogJson(payload)));
  const hash=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
  if(hash!==release.contentSha256||releaseId!==`candidate-${hash.slice(0,12)}`)throw new Error('Published catalog integrity verification failed.');
  if(payload.remedies.length!==20||payload.remedies.some(remedy=>remedy.safety?.safetyScore!==null))throw new Error('Published catalog violates the 20-remedy/null-score contract.');
  const {remedies,goals,traditions}=payload;
  goals.sort((a,b)=>a.displayName.localeCompare(b.displayName));
  return {remedies,goals,traditions,sourceById:Object.fromEntries(payload.sources.map(source=>[source.id,source])),studyById:Object.fromEntries(payload.studies.map(study=>[study.id,study])),release,
    getRemedy:id=>remedies.find(remedy=>remedy.id===id||remedy.slug===id),getGoal:id=>goals.find(goal=>goal.id===id)};
}
