import {getQueue as idbGetQueue, putQueue, deleteQueue, updateQueue, putTest, getTests, markTestSynced} from './offlineStore';

export const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export class ApiError extends Error {
  constructor(message, code='API_ERROR', retryable=false, details=null){
    super(message); this.name='ApiError'; this.code=code; this.retryable=retryable; this.details=details;
  }
}

export async function api(path, options={}){
  const controller = new AbortController();
  const timeout = setTimeout(()=>controller.abort(), options.timeout || 12000);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: options.method || 'GET',
      headers: {'Content-Type':'application/json', ...(options.headers||{})},
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal
    });
    const json = await res.json().catch(()=>({success:false,error:{code:'INVALID_RESPONSE',message:'Server returned an invalid response.'}}));
    if (!res.ok || json.success === false) {
      throw new ApiError(
        json?.error?.message || `Request failed (${res.status})`,
        json?.error?.code || `HTTP_${res.status}`,
        Boolean(json?.error?.retryable),
        json?.error?.details
      );
    }
    return json.data;
  } catch (e) {
    if (e.name === 'AbortError') throw new ApiError('Request timed out. Please retry.', 'REQUEST_TIMEOUT', true);
    if (e instanceof ApiError) throw e;
    throw new ApiError('Internet connection is unavailable. Your test can be saved offline.', 'NETWORK_UNAVAILABLE', true);
  } finally { clearTimeout(timeout); }
}

function makeClientId(item){
  return item.client_id || item.payload?.testId || item.payload?.test_id ||
    `OFF-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function queueOffline(item){
  const client_id=makeClientId(item);
  const existing=(await getQueue()).find(x=>x.client_id===client_id);
  const qitem={
    ...existing,
    ...item,
    client_id,
    created_at: existing?.created_at || new Date().toISOString(),
    attempts: existing?.attempts || 0,
    status: existing?.status || 'pending',
    next_retry_at: existing?.next_retry_at || 0
  };
  await putQueue(qitem);
  window.dispatchEvent(new CustomEvent('pashumitr:queue-updated'));
  return (await getQueue()).length;
}

export async function getQueue(){ return idbGetQueue(); }

export async function saveLocalTest(test){
  await putTest({...test,updated_at:new Date().toISOString()});
  window.dispatchEvent(new CustomEvent('pashumitr:queue-updated'));
}

export async function getLocalTests(){ return getTests(); }

function backoffMs(attempts){
  return Math.min(5 * 60 * 1000, Math.max(1500, Math.pow(2,attempts) * 1000));
}

/**
 * Syncs items one-by-one so a failure in one record does not block successful records.
 * The server uses client_id as an idempotency key.
 */
export async function flushQueue({force=false}={}){
  if(typeof navigator!=='undefined' && !navigator.onLine){
    return {synced:0,remaining:(await getQueue()).length,offline:true};
  }
  const q=await getQueue();
  if(!q.length) return {synced:0,remaining:0};

  let synced=0;
  const errors=[];
  for(const item of q){
    const now=Date.now();
    if(!force && item.next_retry_at && item.next_retry_at>now) continue;
    try{
      const data=await api('/sync',{method:'POST',body:{items:[item]}});
      const row=data?.results?.[0];
      if(row?.synced){
        await deleteQueue(item.client_id);
        await markTestSynced(item.client_id,row.server_id);
        synced++;
      }else{
        throw new ApiError(row?.message||'Sync was not accepted.','SYNC_REJECTED',true);
      }
    }catch(err){
      const attempts=(item.attempts||0)+1;
      const retryable=err?.retryable!==false;
      const failed={
        ...item,
        attempts,
        status:retryable?'pending':'failed',
        last_error:{code:err?.code||'SYNC_ERROR',message:err?.message||'Sync failed'},
        next_retry_at: retryable ? Date.now()+backoffMs(attempts) : Number.MAX_SAFE_INTEGER
      };
      await updateQueue(failed);
      errors.push({client_id:item.client_id,error:failed.last_error,attempts});
      if(err?.code==='NETWORK_UNAVAILABLE' || err?.code==='REQUEST_TIMEOUT') break;
    }
  }
  const remaining=(await getQueue()).length;
  window.dispatchEvent(new CustomEvent('pashumitr:sync-complete',{detail:{synced,remaining,errors}}));
  return {synced,remaining,errors};
}

export async function retryFailedQueue(){
  const q=await getQueue();
  for(const item of q){
    if(item.status==='failed'){
      await updateQueue({...item,status:'pending',next_retry_at:0});
    }
  }
  return flushQueue({force:true});
}
