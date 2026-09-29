const DB_NAME = 'pashumitr-offline-v2';
const DB_VERSION = 1;
const QUEUE_STORE = 'sync_queue';
const TEST_STORE = 'local_tests';
const META_STORE = 'meta';
const LS_QUEUE = 'pashumitr_offline_queue_v1';
const LS_TESTS = 'pashumitr_local_tests_v1';

function idbAvailable(){
  return typeof indexedDB !== 'undefined';
}

function openDb(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(QUEUE_STORE)) db.createObjectStore(QUEUE_STORE,{keyPath:'client_id'});
      if(!db.objectStoreNames.contains(TEST_STORE)) db.createObjectStore(TEST_STORE,{keyPath:'testId'});
      if(!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE,{keyPath:'key'});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('IndexedDB unavailable'));
  });
}

function tx(store,mode='readonly'){
  return openDb().then(db=>{
    const t=db.transaction(store,mode);
    return {db,t,s:t.objectStore(store)};
  });
}

export async function idbPut(store,value){
  if(!idbAvailable()) throw new Error('NO_IDB');
  const {db,s}=await tx(store,'readwrite');
  return new Promise((resolve,reject)=>{
    const req=s.put(value);
    req.onsuccess=()=>{db.close();resolve(req.result)};
    req.onerror=()=>{db.close();reject(req.error)};
  });
}

export async function idbDelete(store,key){
  if(!idbAvailable()) throw new Error('NO_IDB');
  const {db,s}=await tx(store,'readwrite');
  return new Promise((resolve,reject)=>{
    const req=s.delete(key);
    req.onsuccess=()=>{db.close();resolve(true)};
    req.onerror=()=>{db.close();reject(req.error)};
  });
}

export async function idbGetAll(store){
  if(!idbAvailable()) throw new Error('NO_IDB');
  const {db,s}=await tx(store,'readonly');
  return new Promise((resolve,reject)=>{
    const req=s.getAll();
    req.onsuccess=()=>{db.close();resolve(req.result||[])};
    req.onerror=()=>{db.close();reject(req.error)};
  });
}

export async function idbGet(store,key){
  if(!idbAvailable()) throw new Error('NO_IDB');
  const {db,s}=await tx(store,'readonly');
  return new Promise((resolve,reject)=>{
    const req=s.get(key);
    req.onsuccess=()=>{db.close();resolve(req.result)};
    req.onerror=()=>{db.close();reject(req.error)};
  });
}

export function fallbackQueue(){
  try{return JSON.parse(localStorage.getItem(LS_QUEUE)||'[]')}catch{return[]}
}
export function fallbackTests(){
  try{return JSON.parse(localStorage.getItem(LS_TESTS)||'[]')}catch{return[]}
}

export async function putQueue(item){
  if(idbAvailable()){
    try { await idbPut(QUEUE_STORE,item); return; } catch {}
  }
  const q=fallbackQueue().filter(x=>x.client_id!==item.client_id);
  q.push(item);
  localStorage.setItem(LS_QUEUE,JSON.stringify(q));
}

export async function getQueue(){
  if(idbAvailable()){
    try { return (await idbGetAll(QUEUE_STORE)).sort((a,b)=>(a.created_at||0)-(b.created_at||0)); } catch {}
  }
  return fallbackQueue();
}

export async function deleteQueue(clientId){
  if(idbAvailable()){
    try { await idbDelete(QUEUE_STORE,clientId); return; } catch {}
  }
  const q=fallbackQueue().filter(x=>x.client_id!==clientId);
  localStorage.setItem(LS_QUEUE,JSON.stringify(q));
}

export async function updateQueue(item){ return putQueue(item); }

export async function putTest(test){
  if(idbAvailable()){
    try { await idbPut(TEST_STORE,test); return; } catch {}
  }
  const all=fallbackTests().filter(x=>x.testId!==test.testId);
  all.unshift(test);
  localStorage.setItem(LS_TESTS,JSON.stringify(all.slice(0,100)));
}

export async function getTests(){
  if(idbAvailable()){
    try { return (await idbGetAll(TEST_STORE)).sort((a,b)=>String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||''))); } catch {}
  }
  return fallbackTests();
}

export async function markTestSynced(clientId,serverId){
  const tests=await getTests();
  const hit=tests.find(x=>x.testId===clientId||x.client_id===clientId);
  if(!hit) return;
  hit.online=true;
  hit.synced=true;
  hit.serverTestId=serverId||hit.serverTestId||null;
  hit.updated_at=new Date().toISOString();
  await putTest(hit);
}

export function queueCountFromTests(tests){ return tests.filter(x=>x.online===false || x.synced===false).length; }
