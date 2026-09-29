const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');


// Load backend/.env without requiring a client-side secrets bundle.
// Node does not automatically load .env files when running `node server.js`.
function loadDotEnv(file=path.join(__dirname,'.env')){
  try{
    if(!fs.existsSync(file)) return;
    const raw=fs.readFileSync(file,'utf8');
    for(const line of raw.split(/\r?\n/)){
      const trimmed=line.trim();
      if(!trimmed || trimmed.startsWith('#')) continue;
      const match=trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if(!match) continue;
      let value=match[2].trim();
      if((value.startsWith('"')&&value.endsWith('"')) || (value.startsWith("'")&&value.endsWith("'"))) value=value.slice(1,-1);
      if(process.env[match[1]]===undefined) process.env[match[1]]=value;
    }
  }catch(err){
    console.warn('Could not load backend/.env:', err.message);
  }
}
loadDotEnv();
const DEBUG_LOGS = String(process.env.DEBUG_LOGS || 'true').toLowerCase() !== 'false';
function logInfo(...args){ console.log(new Date().toISOString(), ...args); }
function logWarn(...args){ console.warn(new Date().toISOString(), ...args); }
function logError(...args){ console.error(new Date().toISOString(), ...args); }
const { URL } = require('url');
const { predictNIR, getDemoSample, model } = require('./nirModel');
const { ruleBasedAssessment } = require('./ruleEngine');

const PORT = Number(process.env.PORT || 8787);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const tests = new Map();
const users = new Map();
const hashes = [];
const syncedClients = new Map();
const alertState = new Map([
  ['ALERT-001',{id:'ALERT-001',severity:'high',title:'Sample #4 requires confirmatory testing',sub:'Possible foreign-material concern • Feed Mash • Farmer F004',status:'open',farmer:'F004',village:'Village D',testId:null}],
  ['ALERT-002',{id:'ALERT-002',severity:'monitor',title:'Village D fibre trend increased',sub:'Multiple screens crossed the demo monitoring threshold',status:'open',farmer:null,village:'Village D',testId:null}],
  ['ALERT-003',{id:'ALERT-003',severity:'info',title:'Batch FX-2026-09-14 verified',sub:'QR traceability and integrity record available',status:'open',farmer:null,village:'Village A',testId:null}]
]);
const villageState = new Map('ABCDEFGHIJKL'.split('').map((letter,i)=>[
  `VILLAGE-${letter}`,
  {id:`VILLAGE-${letter}`,name:`Village ${letter}`,farmers:120+i*17,tests:24+i*4,highRisk:i%4===3?5:1+i%3,monitor:4+i%5,trend:i%3===0?'rising':'stable',batch:i%2===0?'FX-2026-09-14':'FX-2026-09-18'}
]));
const caseState = new Map();
const officerState = new Map();
const expertState = new Map();
const labRequests = new Map();
const otpState = new Map();
const otpCooldownState = new Map();

const environmentSensorState = {
  connected:false,
  connection_type:null,
  location:'Feed storage room',
  source:'Demo IoT sensor',
  device_id:'DEMO-ENV-01',
  temperature_c:null,
  humidity_pct:null,
  updated_at:null
};
function readEnvironmentSensor(refresh=false){
  if(refresh && environmentSensorState.connected){
    const wave=Date.now()/45000;
    environmentSensorState.temperature_c=Number((27.4+Math.sin(wave)*1.6).toFixed(1));
    environmentSensorState.humidity_pct=Number((68+Math.cos(wave)*4.2).toFixed(1));
    environmentSensorState.updated_at=new Date().toISOString();
  }
  return {...environmentSensorState, monitoring_note:environmentSensorState.connected?'Demo sensor values. A real ESP32/BLE/Wi-Fi device can replace this endpoint later.':'Sensor not connected. Connect a demo Bluetooth/Wi-Fi sensor to load readings.'};
}
let counter = 1000;

const json = (status, body, extra={}) => ({ status, body, headers: { 'Content-Type':'application/json; charset=utf-8', 'Access-Control-Allow-Origin':CORS_ORIGIN, 'Access-Control-Allow-Headers':'Content-Type, Authorization', 'Access-Control-Allow-Methods':'GET,POST,PUT,PATCH,OPTIONS', ...extra } });

function send(res, payload) {
  res.writeHead(payload.status, payload.headers);
  res.end(JSON.stringify(payload.body));
}

function ok(data, meta={}) { return { success:true, data, meta, request_id:`REQ-${crypto.randomBytes(4).toString('hex').toUpperCase()}` }; }
function fail(code, message, retryable=false, details) { return { success:false, error:{ code, message, retryable, ...(details?{details}: {}) }, request_id:`REQ-${crypto.randomBytes(4).toString('hex').toUpperCase()}` }; }

async function readJson(req) {
  return await new Promise((resolve,reject)=>{
    let raw='';
    req.on('data', c=>{ raw += c; if (raw.length > 8*1024*1024) { reject(Object.assign(new Error('Body too large'),{code:'PAYLOAD_TOO_LARGE'})); req.destroy(); } });
    req.on('end',()=>{
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(Object.assign(new Error('Invalid JSON'),{code:'INVALID_JSON'})); }
    });
    req.on('error',reject);
  });
}

function requireTest(id) {
  const test=tests.get(id);
  if (!test) throw Object.assign(new Error('Test record was not found'),{code:'TEST_NOT_FOUND'});
  return test;
}

function geminiConfig(){
  const fallbackModels=String(
    process.env.GEMINI_FALLBACK_MODELS ||
    'gemini-3.5-flash-lite,gemini-3.5-flash,gemini-3.6-flash,gemini-3.7-flash,gemini-2.5-flash-lite,gemini-2.5-flash'
  ).split(',').map(s=>s.trim()).filter(Boolean);
  return {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
    assistantModel: process.env.GEMINI_ASSISTANT_MODEL || 'gemini-3.5-flash-lite',
    fallbackModels
  };
}

function sleep(ms){ return new Promise(resolve=>setTimeout(resolve,ms)); }

// One Gemini call for one model. Throws an Error with .status/.model/.details on failure.
async function geminiCallOnce(candidateModel, prompt, apiKey, timeoutMs, outerSignal){
  const controller=new AbortController();
  const onOuterAbort=()=>controller.abort();
  if(outerSignal){ if(outerSignal.aborted) controller.abort(); else outerSignal.addEventListener('abort',onOuterAbort,{once:true}); }
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    // thinkingLevel is only valid for Gemini 3.x; older 2.5 models would return 400.
    const generationConfig={maxOutputTokens:700};
    if(/^gemini-3/.test(candidateModel)) generationConfig.thinkingConfig={thinkingLevel:'low'};
    const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidateModel)}:generateContent`,{
      method:'POST',
      headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},
      body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig}),
      signal:controller.signal
    });
    if(!response.ok){
      const detail=await response.text().catch(()=> '');
      if(DEBUG_LOGS) logWarn('[Gemini] upstream error', {model:candidateModel,status:response.status,detail:detail.slice(0,400)});
      const err=new Error(`Gemini request failed (${response.status})`);
      err.code='GEMINI_API_ERROR'; err.status=response.status; err.model=candidateModel; err.details=detail.slice(0,1200);
      throw err;
    }
    const data=await response.json();
    const text=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('').trim()||'';
    if(!text){
      const err=new Error('Gemini returned no text content.');
      err.code='GEMINI_EMPTY'; err.model=candidateModel; err.status=502;
      throw err;
    }
    return {text,model:candidateModel};
  }catch(err){
    if(err?.name==='AbortError' && !outerSignal?.aborted){
      const t=new Error(`Gemini request timed out after ${timeoutMs} ms`);
      t.code='GEMINI_TIMEOUT'; t.status=504; t.model=candidateModel;
      throw t;
    }
    throw err;
  }finally{
    clearTimeout(timer);
    if(outerSignal) outerSignal.removeEventListener('abort',onOuterAbort);
  }
}

// Hedged cascade: start the first model immediately; if it has not answered within
// HEDGE_MS (or has already failed) start the next model WITHOUT cancelling the first.
// First successful answer wins and cancels the rest. Overall deadline keeps the UI snappy.
async function geminiText(prompt, {preferFast=false}={}){
  const {apiKey,model,assistantModel,fallbackModels}=geminiConfig();
  if(!apiKey) return null;
  const preferred = preferFast ? assistantModel : model;
  const models=[preferred,model,...fallbackModels].filter((m,i,a)=>m && a.indexOf(m)===i).slice(0,2);
  const PER_MODEL_MS=Number(process.env.GEMINI_REQUEST_TIMEOUT_MS || 5000);
  const HEDGE_MS=Number(process.env.GEMINI_HEDGE_MS || 1400);
  const DEADLINE_MS=Number(process.env.GEMINI_TOTAL_TIMEOUT_MS || 7000);
  const master=new AbortController();

  return await new Promise((resolve,reject)=>{
    let next=0, pending=0, done=false, lastErr=null, hedgeTimer=null;
    const finish=(fn,val)=>{ if(done) return; done=true; clearTimeout(hedgeTimer); clearTimeout(deadline); master.abort(); fn(val); };
    const deadline=setTimeout(()=>finish(reject,lastErr||Object.assign(new Error(`Gemini did not answer within ${DEADLINE_MS} ms`),{code:'GEMINI_TIMEOUT',status:504})),DEADLINE_MS);

    const launch=()=>{
      if(done || next>=models.length) return;
      const m=models[next++]; pending++;
      if(DEBUG_LOGS) logInfo('[Gemini] request', {model:m,key_configured:true,timeout_ms:PER_MODEL_MS,hedge_ms:HEDGE_MS});
      geminiCallOnce(m,prompt,apiKey,PER_MODEL_MS,master.signal)
        .then(r=>{ if(DEBUG_LOGS) logInfo('[Gemini] success',{model:r.model}); finish(resolve,r); })
        .catch(err=>{
          if(done) return;
          lastErr=err; pending--;
          // Bad key / permission: switching models cannot help.
          if(err?.status===401 || err?.status===403) return finish(reject,err);
          if(next<models.length){ clearTimeout(hedgeTimer); launch(); }          // failed fast -> next model now
          else if(pending===0) finish(reject,lastErr);
        });
      if(next<models.length){ clearTimeout(hedgeTimer); hedgeTimer=setTimeout(launch,HEDGE_MS); }
    };
    launch();
  });
}

function elevenLabsConfig(){
  const keys=[process.env.ELEVENLABS_API_KEY,process.env.ELEVENLABS_API_KEY_2].map(k=>String(k||'').trim()).filter(Boolean);
  return {
    apiKey: keys[0] || '',
    apiKeys: keys,
    voiceId: process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb',
    voiceIdEn: process.env.ELEVENLABS_VOICE_ID_EN || process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb',
    voiceIdHi: process.env.ELEVENLABS_VOICE_ID_HI || process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb',
    ttsModel: process.env.ELEVENLABS_TTS_MODEL || 'eleven_multilingual_v2',
    sttModel: process.env.ELEVENLABS_STT_MODEL || 'scribe_v2'
  };
}

// English text/lang -> EN voice; Hindi and every other Indian language (or Devanagari text) -> HI voice.
function pickElevenVoice(cfg,text,lang){
  const isEnglish=String(lang||'English')==='English' && !/[\u0900-\u0DFF]/.test(String(text||''));
  return isEnglish ? cfg.voiceIdEn : cfg.voiceIdHi;
}

async function elevenLabsTts(text,lang='English'){
  const cfg=elevenLabsConfig();
  if(!cfg.apiKeys.length) return null;
  const voice=pickElevenVoice(cfg,text,lang);
  const endpoint=`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`;
  let lastErr=null;
  for(const key of cfg.apiKeys){            // second key is used automatically on 401/429/quota errors
    const res=await fetch(endpoint,{
      method:'POST',
      headers:{'Content-Type':'application/json','xi-api-key':key},
      body:JSON.stringify({text:String(text).slice(0,4500),model_id:cfg.ttsModel}),
      signal:AbortSignal.timeout(20000)
    });
    if(res.ok){
      const bytes=Buffer.from(await res.arrayBuffer());
      return {audioContent:bytes.toString('base64'),mimeType:'audio/mpeg',provider:'elevenlabs',voice_id:voice,model_id:cfg.ttsModel};
    }
    const detail=await res.text().catch(()=> '');
    const e=new Error(`ElevenLabs TTS request failed (${res.status})`);e.code='ELEVENLABS_TTS_ERROR';e.status=res.status;e.details=detail.slice(0,900);
    lastErr=e;
    if(![401,402,429].includes(res.status)) break;
  }
  throw lastErr;
}

async function elevenLabsAsr(audioContent,mimeType='audio/webm'){
  const cfg=elevenLabsConfig();
  if(!cfg.apiKeys.length) return null;
  const buffer=Buffer.from(String(audioContent),'base64');
  if(!buffer.length) throw Object.assign(new Error('Audio content is empty.'),{code:'AUDIO_EMPTY'});
  const ext=/wav/.test(mimeType)?'wav':/mp4|m4a/.test(mimeType)?'m4a':'webm';
  let lastErr=null;
  for(const key of cfg.apiKeys){
    const form=new FormData();
    form.append('file',new Blob([buffer],{type:mimeType||'audio/webm'}),`pashumitr-voice.${ext}`);
    form.append('model_id',cfg.sttModel);
    const res=await fetch('https://api.elevenlabs.io/v1/speech-to-text',{method:'POST',headers:{'xi-api-key':key},body:form,signal:AbortSignal.timeout(25000)});
    const data=await res.json().catch(()=>({}));
    if(res.ok) return {text:String(data?.text||'').trim(),languageCode:data?.language_code||null,provider:'elevenlabs',model_id:cfg.sttModel};
    const e=new Error(`ElevenLabs STT request failed (${res.status})`);e.code='ELEVENLABS_STT_ERROR';e.status=res.status;e.details=JSON.stringify(data).slice(0,900);
    lastErr=e;
    if(![401,402,429].includes(res.status)) break;
  }
  throw lastErr;
}

function googleTtsConfig(){
  return {
    apiKey: process.env.GOOGLE_CLOUD_TTS_API_KEY || '',
    accessToken: process.env.GOOGLE_CLOUD_ACCESS_TOKEN || '',
    endpoint: process.env.GOOGLE_CLOUD_TTS_ENDPOINT || 'https://texttospeech.googleapis.com/v1/text:synthesize',
    voiceNames: {
      'en-IN': process.env.GOOGLE_TTS_VOICE_EN || 'en-IN-Standard-A',
      'hi-IN': process.env.GOOGLE_TTS_VOICE_HI || 'hi-IN-Standard-A',
      'mr-IN': process.env.GOOGLE_TTS_VOICE_MR || 'mr-IN-Wavenet-A',
      'gu-IN': process.env.GOOGLE_TTS_VOICE_GU || 'gu-IN-Standard-A',
      'pa-IN': process.env.GOOGLE_TTS_VOICE_PA || '',
      'bn-IN': process.env.GOOGLE_TTS_VOICE_BN || '',
      'te-IN': process.env.GOOGLE_TTS_VOICE_TE || 'te-IN-Standard-A',
      'ta-IN': process.env.GOOGLE_TTS_VOICE_TA || 'ta-IN-Standard-A',
      'kn-IN': process.env.GOOGLE_TTS_VOICE_KN || 'kn-IN-Standard-A',
      'ml-IN': process.env.GOOGLE_TTS_VOICE_ML || 'ml-IN-Standard-A',
      'or-IN': process.env.GOOGLE_TTS_VOICE_OR || '',
      'as-IN': process.env.GOOGLE_TTS_VOICE_AS || ''
    }
  };
}

async function googleTts(text, languageCode){
  const cfg=googleTtsConfig();
  if(!cfg.apiKey && !cfg.accessToken) return null;
  const body={
    input:{text:String(text).slice(0,4500)},
    voice:{languageCode, ssmlGender:'FEMALE', ...(cfg.voiceNames[languageCode]?{name:cfg.voiceNames[languageCode]}:{})},
    audioConfig:{audioEncoding:'MP3'}
  };
  const headers={'Content-Type':'application/json'};
  let url=cfg.endpoint;
  if(cfg.accessToken) headers.Authorization=`Bearer ${cfg.accessToken}`;
  else url += (url.includes('?')?'&':'?')+'key='+encodeURIComponent(cfg.apiKey);
  const res=await fetch(url,{method:'POST',headers,body:JSON.stringify(body)});
  const json=await res.json().catch(()=>({}));
  if(!res.ok || !json.audioContent){
    const err=new Error(`Google TTS request failed (${res.status})`); err.code='GOOGLE_TTS_ERROR'; err.details=JSON.stringify(json).slice(0,600); throw err;
  }
  return {audioContent:json.audioContent, mimeType:'audio/mpeg',languageCode,provider:'google-cloud-tts'};
}


function bhashiniConfig(){
  const service=(prefix, langCode)=>process.env[`BHASHINI_${prefix}_SERVICE_ID_${langCode.toUpperCase()}`]||'';
  return {
    inferenceApiKey: process.env.BHASHINI_INFERENCE_API_KEY || '',
    userId: process.env.BHASHINI_USER_ID || '',
    ulcaApiKey: process.env.BHASHINI_ULCA_API_KEY || '',
    endpoint: process.env.BHASHINI_PIPELINE_URL || 'https://dhruva-api.bhashini.gov.in/services/inference/pipeline',
    ttsService: service('TTS','__DYNAMIC__'),
    asrService: service('ASR','__DYNAMIC__')
  };
}
const bhashiniLangCodes={
  English:'en',Hindi:'hi',Marathi:'mr',Gujarati:'gu',Punjabi:'pa',Bengali:'bn',Telugu:'te',Tamil:'ta',Kannada:'kn',Malayalam:'ml',Odia:'or',Assamese:'as'
};
function bhashiniService(kind, lang){
  const code=(bhashiniLangCodes[lang]||String(lang||'hi').slice(0,2)).toUpperCase();
  return process.env[`BHASHINI_${kind}_SERVICE_ID_${code}`]||'';
}
async function bhashiniInfer({taskType, lang='Hindi', text='', audioContent=''}){
  const cfg=bhashiniConfig();
  if(!cfg.inferenceApiKey) return null;
  const code=bhashiniLangCodes[lang]||'hi';
  const serviceId=bhashiniService(taskType==='tts'?'TTS':'ASR',lang);
  if(!serviceId) return null;
  const body={pipelineTasks:[{taskType,config:{serviceId,language:{sourceLanguage:code},...(taskType==='tts'?{gender:'female'}:{})}}],inputData:taskType==='tts'?{input:[{source:String(text).slice(0,4500)}]}:{audio:[{audioContent}]}};
  const headers={'Content-Type':'application/json','Accept':'*/*','Authorization':cfg.inferenceApiKey};
  const res=await fetch(cfg.endpoint,{method:'POST',headers,body:JSON.stringify(body)});
  const data=await res.json().catch(()=>({}));
  if(!res.ok){const e=new Error(`BHASHINI ${taskType.toUpperCase()} failed (${res.status})`);e.code=`BHASHINI_${taskType.toUpperCase()}_ERROR`;e.details=JSON.stringify(data).slice(0,1000);throw e;}
  return {data,languageCode:code,serviceId};
}
async function bhashiniTts(text, lang){
  const result=await bhashiniInfer({taskType:'tts',lang,text});
  if(!result) return null;
  const audioContent=result.data?.pipelineResponse?.[0]?.audio?.[0]?.audioContent || result.data?.pipelineResponse?.[0]?.output?.[0]?.audioContent;
  if(!audioContent) throw Object.assign(new Error('BHASHINI TTS returned no audio.'),{code:'BHASHINI_TTS_EMPTY'});
  return {audioContent,mimeType:'audio/wav',languageCode:`${result.languageCode}-IN`,provider:'bhashini'};
}
async function bhashiniAsr(audioContent, lang){
  const result=await bhashiniInfer({taskType:'asr',lang,audioContent});
  if(!result) return null;
  const transcript=result.data?.pipelineResponse?.[0]?.output?.[0]?.source || result.data?.pipelineResponse?.[0]?.output?.[0]?.target || '';
  return {text:transcript,languageCode:`${result.languageCode}-IN`,provider:'bhashini',serviceId:result.serviceId};
}

async function assess({visual={}, nir={}, silage={}, storage={}, lang='English'} = {}) {
  const rules=ruleBasedAssessment({visual,nir,silage,storage});
  let farmer_explanation=rules.advisory;
  let gemini_used=false;
  try{
    const prompt=[
      'You are PashuMittr, an Indian dairy feed/silage assistant.',
      'Use ONLY the supplied rule-engine facts below. Do not invent measurements, diagnoses, contamination, toxins, laboratory results, or safety claims.',
      'The rule engine remains authoritative for status and actions.',
      `Write one short farmer-friendly explanation in ${lang} using simple language.`,
      'Mention confirmatory testing when the supplied rules recommend it.',
      `Status: ${rules.screening_status}`,
      `Evidence score: ${rules.evidence_score}`,
      `Rule reasons: ${rules.rule_reasons.join(' | ')||'none'}`,
      `Recommended actions: ${rules.actions.join(' | ')}`,
      `Storage environment: ${JSON.stringify(storage||{})}`,
      `Base advisory: ${rules.advisory}`
    ].join('\n');
    const answer=await geminiText(prompt);
    if(answer){ farmer_explanation=answer.text||answer; gemini_used=true; }
  }catch(_err){
    // Keep deterministic rule advisory if Gemini is unavailable.
  }
  return {...rules, farmer_explanation, gemini:{configured:Boolean(geminiConfig().apiKey),used:gemini_used,model:geminiConfig().model}};
}

function verifyRecord(test) {
  const previous_hash = hashes.length ? hashes[hashes.length-1].current_hash : null;
  const stableAssessment=test.assessment?{...test.assessment,farmer_explanation:undefined,gemini:undefined}:null;
  const canonical = JSON.stringify({ id:test.id, type:test.type, created_at:test.created_at, visual:test.visual, nir:test.nir, silage:test.silage, assessment:stableAssessment, previous_hash });
  const current_hash = crypto.createHash('sha256').update(canonical).digest('hex');
  hashes.push({ test_id:test.id, previous_hash, current_hash });
  test.integrity={ verified:true, algorithm:'SHA-256', previous_hash, current_hash };
  test.qr_payload=`PASHUMITTR|TEST|${test.id}|HASH|${current_hash}`;
  return test.integrity;
}

function demoDashboard() {
  const samples = require('./data/demo_nir_samples.json').samples;
  const good = samples.filter(s=>s.ndf<30).length;
  const monitor = samples.filter(s=>s.ndf>=30 && s.ndf<45).length;
  const risk = samples.filter(s=>s.ndf>=45).length;
  return {
    farmers:5240,
    tests_today:187,
    high_risk_screens:risk,
    villages_monitored:34,
    sample_count:samples.length,
    distribution:{good,monitor,high_risk:risk},
    recent_alerts:[
      {severity:'high',title:'NDF screening cluster',sub:'Multiple samples need human review'},
      {severity:'monitor',title:'Confirmatory test queue',sub:'AI screening is not a lab confirmation'},
      {severity:'info',title:'Batch records verified',sub:'SHA-256 audit records available'}
    ]
  };
}

function authConfig(){
  return {
    provider:(process.env.AUTH_PROVIDER || 'twilio').trim().toLowerCase(),
    demoEnabled:String(process.env.DEMO_AUTH_ENABLED || 'true').trim().toLowerCase() !== 'false',
    demoPhone:String(process.env.DEMO_PHONE || '0000000000').replace(/\D/g,''),
    demoOtp:String(process.env.DEMO_OTP || '123456'),
    ttlMs:Number(process.env.OTP_TTL_SECONDS || 300)*1000,
    cooldownMs:Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 30)*1000,
    twilio:{
      accountSid:process.env.TWILIO_ACCOUNT_SID || '',
      authToken:process.env.TWILIO_AUTH_TOKEN || '',
      serviceSid:process.env.TWILIO_VERIFY_SERVICE_SID || '',
      verifyBaseUrl:(process.env.TWILIO_VERIFY_BASE_URL || 'https://verify.twilio.com/v2').replace(/\/+$/,''),
      channel:(process.env.TWILIO_VERIFY_CHANNEL || 'sms').trim().toLowerCase()
    }
  };
}

function normalizePhone(phone){
  const digits=String(phone||'').replace(/\D/g,'');
  if(!/^\d{10}$/.test(digits)) return null;
  return `+91${digits}`;
}

function authProviderReady(){
  const cfg=authConfig();
  if(cfg.provider==='demo') return true;
  return cfg.provider==='twilio' && Boolean(cfg.twilio.accountSid && cfg.twilio.authToken && cfg.twilio.serviceSid);
}

function isDemoPhone(phone){
  const cfg=authConfig();
  return cfg.demoEnabled && String(phone||'').replace(/\D/g,'')===cfg.demoPhone;
}

function authCooldown(phone){
  const cfg=authConfig();
  const last=otpCooldownState.get(phone)||0;
  const remaining=Math.max(0,cfg.cooldownMs-(Date.now()-last));
  return Math.ceil(remaining/1000);
}

function markAuthCooldown(phone){otpCooldownState.set(phone,Date.now());}

function twilioAuthHeader(cfg){
  return 'Basic '+Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString('base64');
}

async function twilioSendVerification(phoneE164){
  const cfg=authConfig();
  const base=cfg.twilio.verifyBaseUrl;
  const endpoint=`${base}/Services/${encodeURIComponent(cfg.twilio.serviceSid)}/Verifications`;
  const form=new URLSearchParams({To:phoneE164,Channel:cfg.twilio.channel});
  const response=await fetch(endpoint,{method:'POST',headers:{Authorization:twilioAuthHeader(cfg),'Content-Type':'application/x-www-form-urlencoded'},body:form.toString()});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
    const e=new Error(data?.message||`Twilio Verify could not send the OTP (${response.status}).`);
    e.code=response.status===429?'TWILIO_RATE_LIMIT':'TWILIO_SEND_ERROR';
    e.status=response.status;
    e.details=data;
    throw e;
  }
  return {sid:data?.sid||null,status:data?.status||'pending',channel:data?.channel||cfg.twilio.channel};
}

async function twilioCheckVerification(phoneE164,code){
  const cfg=authConfig();
  const base=cfg.twilio.verifyBaseUrl;
  const endpoint=`${base}/Services/${encodeURIComponent(cfg.twilio.serviceSid)}/VerificationCheck`;
  const form=new URLSearchParams({To:phoneE164,Code:String(code||'').trim()});
  const response=await fetch(endpoint,{method:'POST',headers:{Authorization:twilioAuthHeader(cfg),'Content-Type':'application/x-www-form-urlencoded'},body:form.toString()});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
    const e=new Error(data?.message||`Twilio Verify could not check the OTP (${response.status}).`);
    e.code=response.status===404?'OTP_NOT_FOUND':response.status===429?'TWILIO_RATE_LIMIT':'TWILIO_CHECK_ERROR';
    e.status=response.status;
    e.details=data;
    throw e;
  }
  return {approved:data?.status==='approved',status:data?.status||'pending'};
}

function issueDemoOtp(phone,role){
  const cfg=authConfig();
  const existing=otpState.get(phone);
  if(existing && existing.issued_at && Date.now()-existing.issued_at<cfg.cooldownMs){
    const wait=Math.ceil((cfg.cooldownMs-(Date.now()-existing.issued_at))/1000);
    return {ok:false,wait_seconds:wait,expires_at:existing.expires_at,demo_otp:cfg.demoOtp};
  }
  const issued_at=Date.now();
  const record={phone,role:role||'farmer',otp:cfg.demoOtp,issued_at,expires_at:issued_at+cfg.ttlMs,attempts:0,verified:false};
  otpState.set(phone,record);
  return {ok:true,expires_at:record.expires_at,demo_otp:record.otp};
}

function verifyDemoOtp(phone,otp){
  const cfg=authConfig();
  const record=otpState.get(phone);
  if(!record) return {ok:false,code:'OTP_NOT_REQUESTED',message:'Please request an OTP first.'};
  if(Date.now()>record.expires_at){otpState.delete(phone);return {ok:false,code:'OTP_EXPIRED',message:'OTP expired. Please request a new OTP.'};}
  record.attempts+=1;
  if(record.attempts>5) return {ok:false,code:'OTP_ATTEMPTS_EXCEEDED',message:'Too many OTP attempts. Please request a new OTP.'};
  if(String(otp||'')!==String(record.otp)) return {ok:false,code:'OTP_INVALID',message:'The OTP is incorrect. Check the 6 digits and try again.'};
  record.verified=true;
  return {ok:true};
}

async function route(req) {
  const u = new URL(req.url, `http://${req.headers.host}`);
  const p=u.pathname.replace(/\/+$/,'') || '/';
  const method=req.method;
  if (method==='OPTIONS') return json(204,{});
  try {
    if (method==='GET' && p==='/api/v1/health') return json(200, ok({service:'pashumitr-api',status:'healthy',model:{type:model.model_type,training_samples:model.training_samples,target_count:model.targets.length,screening_only:true}}));
    // Command-center read endpoints are intentionally placed early so an older/demo route cannot shadow them.
    if (method==='GET' && (p==='/api/v1/alerts' || p==='/api/v1/alerts/')) {
      return json(200,ok([...alertState.values()].map(a=>({...a}))));
    }
    if (method==='GET' && (p==='/api/v1/villages' || p==='/api/v1/villages/')) {
      return json(200,ok([...villageState.values()]));
    }

    if (method==='GET' && p==='/api/v1/auth/status') {
      const cfg=authConfig();
      return json(200,ok({
        provider:cfg.provider,
        configured:authProviderReady(),
        channel:cfg.provider==='twilio'?cfg.twilio.channel:'demo',
        demo_enabled:cfg.demoEnabled,
        demo_phone:cfg.demoEnabled?cfg.demoPhone:'',
        demo_otp:cfg.demoEnabled?cfg.demoOtp:'',
        message:cfg.provider==='twilio'
          ? (authProviderReady()?'OTP is sent by Twilio Verify SMS.':'Twilio authentication is not configured on this server. You can still use the judge demo number if demo authentication is enabled.')
          : 'Demo authentication is enabled; use the demo phone and OTP shown in the UI.'
      }));
    }

    if (method==='POST' && p==='/api/v1/auth/request-otp') {
      const body=await readJson(req);
      const rawPhone=String(body.phone||'');
      const phone=rawPhone.replace(/\D/g,'');
      if (!/^\d{10}$/.test(phone)) return json(400, fail('INVALID_PHONE','Enter a valid 10-digit Indian mobile number.',false));
      const cfg=authConfig();
      const provider=cfg.provider;
      if(provider!=='twilio' && provider!=='demo') return json(500,fail('AUTH_PROVIDER_INVALID','AUTH_PROVIDER must be twilio or demo.',false));
      const demoPhone=isDemoPhone(phone);
      if(!authProviderReady() && !demoPhone) return json(503,fail('AUTH_NOT_CONFIGURED','Twilio authentication is not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_VERIFY_SERVICE_SID to backend/.env, or use the judge demo number shown below.',true));
      const phoneE164=normalizePhone(phone);
      const wait=authCooldown(phone);
      if(wait>0) return json(429,fail('OTP_COOLDOWN',`Please wait ${wait}s before requesting another OTP.`,true,{wait_seconds:wait}));
      try{
        if(provider==='demo' || demoPhone){
          const issued=issueDemoOtp(phone,body.role||'farmer');
          if(!issued.ok) return json(429,fail('OTP_COOLDOWN',`Please wait ${issued.wait_seconds}s before requesting another OTP.`,true,issued));
          markAuthCooldown(phone);
          return json(200,ok({channel:'demo',provider:'demo',demo:true,message:'Judge demo OTP generated. No SMS is sent for the demo number.',expires_at:issued.expires_at,demo_otp:issued.demo_otp,demo_phone:cfg.demoPhone,cooldown_seconds:Number(process.env.OTP_RESEND_COOLDOWN_SECONDS||30)}));
        }
        const sent=await twilioSendVerification(phoneE164);
        markAuthCooldown(phone);
        return json(200,ok({channel:'sms',provider:'twilio',message:`OTP sent by SMS to ${phoneE164}.`,status:sent.status,cooldown_seconds:Number(process.env.OTP_RESEND_COOLDOWN_SECONDS||30)}));
      }catch(e){
        const retryable=e.code==='TWILIO_RATE_LIMIT' || e.status>=500;
        return json(e.status===429?429:502,fail(e.code||'TWILIO_SEND_ERROR',e.message||'Twilio could not send the OTP.',retryable,{twilio_status:e.status||null}));
      }
    }

    if (method==='POST' && p==='/api/v1/auth/login') {
      const body=await readJson(req);
      const rawPhone=String(body.phone||'');
      const phone=rawPhone.replace(/\D/g,'');
      if (!/^\d{10}$/.test(phone)) return json(400, fail('INVALID_PHONE','Enter a valid 10-digit Indian mobile number.',false));
      const cfg=authConfig();
      const demoPhone=isDemoPhone(phone);
      if(!authProviderReady() && !demoPhone) return json(503,fail('AUTH_NOT_CONFIGURED','Authentication provider is not configured. Add the Twilio credentials in backend/.env and restart the backend, or use the judge demo number shown below.',true));
      try{
        let verified=false;
        let usedDemo=false;
        if(cfg.provider==='demo' || demoPhone){
          const result=verifyDemoOtp(phone,body.otp);
          if(!result.ok) return json(401,fail(result.code,result.message,false));
          verified=true;
          usedDemo=true;
        }else{
          if(!/^\d{6}$/.test(String(body.otp||''))) return json(400,fail('OTP_INVALID','Enter the 6-digit OTP sent to your phone.',false));
          const result=await twilioCheckVerification(normalizePhone(phone),body.otp);
          if(!result.approved) return json(401,fail('OTP_INVALID','That OTP is not valid. Check the SMS and try again.',false,{status:result.status}));
          verified=true;
        }
        if(!verified) return json(401,fail('OTP_INVALID','OTP verification failed.',false));
        const id=`USER-${phone.slice(-4)}`;
        users.set(id,{id,phone:`+91${phone}`,role:body.role||'farmer',auth_provider:usedDemo?'demo':cfg.provider});
        return json(200, ok({token:`demo-${id}`,user:users.get(id),auth_provider:usedDemo?'demo':cfg.provider,demo:usedDemo}));
      }catch(e){
        const retryable=e.code==='TWILIO_RATE_LIMIT' || e.status>=500;
        const status=e.code==='OTP_NOT_FOUND'?401:e.status===429?429:502;
        return json(status,fail(e.code||'TWILIO_CHECK_ERROR',e.message||'Could not verify the OTP.',retryable));
      }
    }

    if (method==='POST' && p==='/api/v1/tests') {
      const body=await readJson(req);
      if (!['feed','silage'].includes(body.test_type || body.type)) return json(400, fail('INVALID_TEST_TYPE','test_type must be feed or silage.',false));
      const id=`TEST-${Date.now()}-${++counter}`;
      const test={id,type:body.test_type||body.type,feed_type:body.feed_type||null,user_id:body.user_id||'DEMO-FARMER',created_at:new Date().toISOString(),status:'created',offline_source:Boolean(body.offline_source),sample_meta:{sample_weight_g:body.sample_weight_g||null,sample_source:body.sample_source||null,batch_code:body.batch_code||null,sample_note:body.sample_note||null,photo_captured:Boolean(body.photo_captured),capture_distance_guidance:body.capture_distance_guidance||'25–40 cm recommended',species:body.species||null,breed:body.breed||null,production_stage:body.production_stage||null,milk_yield_l_per_day:body.milk_yield_l_per_day||null},demo_reference:body.demo_reference||null,storage_environment:body.storage_environment||null};
      tests.set(id,test);
      return json(201,ok({test_id:id,status:'created'}));
    }

    const match = p.match(/^\/api\/v1\/tests\/([^/]+)(?:\/(.+))?$/);
    if (match) {
      const id=decodeURIComponent(match[1]); const action=match[2]||''; const test=requireTest(id);
      if (method==='GET' && action==='') return json(200,ok(test));
      if (method==='POST' && action==='visual') {
        const body=await readJson(req);
        if (!body.visual) return json(400,fail('VISUAL_DATA_MISSING','Visual screening data is required.',false));
        test.visual=body.visual; test.sample_meta={...(test.sample_meta||{}),...(body.sample_meta||{})}; test.status='visual_complete';
        return json(200,ok({test_id:id,visual:test.visual,status:test.status}));
      }
      if (method==='POST' && action==='nir') {
        const body=await readJson(req);
        let spectrum=body.spectrum;
        if (!spectrum && body.sample_id) spectrum=getDemoSample(body.sample_id).spectrum;
        if (!spectrum) return json(400,fail('NIR_SPECTRUM_MISSING','Provide spectrum data or sample_id for demo mode.',false));
        const prediction=predictNIR(spectrum);
        test.nir=prediction; test.nir_sample_id=body.sample_id||null; test.status='nir_complete';
        return json(200,ok({test_id:id,nir:prediction,status:test.status}));
      }
      if (method==='POST' && action==='silage') {
        const body=await readJson(req);
        const ph=Number(body.ph), temp=Number(body.temperature), hum=Number(body.humidity);
        if (![ph,temp,hum].every(Number.isFinite)) return json(400,fail('SILAGE_INPUT_INVALID','pH, temperature and humidity are required numeric values.',false));
        const silage={ph,temperature:temp,humidity:hum,mould_risk:body.mould_risk||'Unknown',photo_captured:Boolean(body.photo_captured)};
        test.storage_environment=body.storage_environment||test.storage_environment||null;
        if(body.visual) test.visual=body.visual;
        test.silage=silage; test.status='silage_complete';
        return json(200,ok({test_id:id,silage}));
      }
      if (method==='POST' && action==='assess') {
        const body=await readJson(req);
        const visual=body.visual||test.visual||{};
        const nir=body.nir||test.nir||{};
        const silage=body.silage||test.silage||{};
        const storage=body.storage||test.storage_environment||{};
        const lang=body.lang||'English';
        const rules=ruleBasedAssessment({visual,nir,silage,storage});
        const geminiConfigured=Boolean(geminiConfig().apiKey);
        test.assessment={
          ...rules,
          farmer_explanation:rules.advisory,
          gemini:{configured:geminiConfigured,used:false,pending:geminiConfigured,model:geminiConfig().model}
        };
        test.status='assessed';

        // Never block the screening result on cloud AI. Gemini only improves the
        // farmer-facing wording after the deterministic result is already ready.
        if(geminiConfigured){
          const prompt=[
            'You are PashuMittr, an Indian dairy feed/silage assistant.',
            'Use ONLY the supplied rule-engine facts below. Do not invent measurements, diagnoses, contamination, toxins, laboratory results, or safety claims.',
            'The rule engine remains authoritative for status and actions.',
            `Write one short farmer-friendly explanation in ${lang} using simple language.`,
            'Mention confirmatory testing when the supplied rules recommend it.',
            `Status: ${rules.screening_status}`,
            `Evidence score: ${rules.evidence_score}`,
            `Rule reasons: ${rules.rule_reasons.join(' | ')||'none'}`,
            `Recommended actions: ${rules.actions.join(' | ')}`,
            `Storage environment: ${JSON.stringify(storage||{})}`,
            `Base advisory: ${rules.advisory}`
          ].join('\n');
          Promise.resolve().then(async()=>{
            try{
              const answer=await geminiText(prompt,{preferFast:false});
              const current=tests.get(id);
              if(current && answer?.text){
                current.ai_explanation=answer.text;
                current.ai_explanation_model=answer.model;
                if(current.assessment) current.assessment.gemini={configured:true,used:true,pending:false,model:answer.model};
              }
            }catch(err){
              const current=tests.get(id);
              if(current?.assessment) current.assessment.gemini={configured:true,used:false,pending:false,model:geminiConfig().model};
              if(DEBUG_LOGS) logWarn('[Assessment] Gemini explanation unavailable', {test_id:id,code:err?.code,status:err?.status,message:err?.message});
            }
          });
        }
        return json(200,ok({test_id:id,assessment:test.assessment}));
      }
      if (method==='POST' && action==='verify') {
        const integrity=verifyRecord(test);
        return json(200,ok({test_id:id,integrity,qr_payload:test.qr_payload}));
      }
      return json(404,fail('ENDPOINT_NOT_FOUND','Test endpoint was not found.',false));
    }

    if (method==='GET' && p==='/api/v1/sensors/environment') {
      return json(200,ok(readEnvironmentSensor(false)));
    }
    if (method==='POST' && p==='/api/v1/sensors/environment/connect') {
      const body=await readJson(req);
      const connectionType=['Bluetooth','Wi-Fi'].includes(body.connection_type)?body.connection_type:null;
      if(!connectionType) return json(400,fail('INVALID_CONNECTION_TYPE','Choose Bluetooth or Wi-Fi.',false));
      environmentSensorState.connected=true;
      environmentSensorState.connection_type=connectionType;
      environmentSensorState.location=String(body.location||'Feed storage room').slice(0,80);
      const wave=Date.now()/45000;
      environmentSensorState.temperature_c=Number((27.4+Math.sin(wave)*1.6).toFixed(1));
      environmentSensorState.humidity_pct=Number((68+Math.cos(wave)*4.2).toFixed(1));
      environmentSensorState.updated_at=new Date().toISOString();
      return json(200,ok(readEnvironmentSensor(false)));
    }
    if (method==='POST' && p==='/api/v1/sensors/environment/disconnect') {
      environmentSensorState.connected=false;
      environmentSensorState.connection_type=null;
      environmentSensorState.temperature_c=null;
      environmentSensorState.humidity_pct=null;
      environmentSensorState.updated_at=null;
      return json(200,ok(readEnvironmentSensor(false)));
    }
    if (method==='POST' && p==='/api/v1/sensors/environment/refresh') {
      if(!environmentSensorState.connected) return json(409,fail('SENSOR_NOT_CONNECTED','Connect the storage sensor before refreshing a reading.',true));
      return json(200,ok(readEnvironmentSensor(true)));
    }

    if (method==='GET' && p==='/api/v1/demo/feed-samples') {
      const dataset=require('./data/demo_feed_dataset.json');
      return json(200,ok(dataset.records,{purpose:dataset.purpose,source:dataset.source}));
    }

    if (method==='GET' && p==='/api/v1/history') {
      const values=[...tests.values()].sort((a,b)=>b.created_at.localeCompare(a.created_at));
      return json(200,ok(values.slice(0,30)));
    }

    if (method==='GET' && p==='/api/v1/alerts') {
      return json(200,ok([...alertState.values()].map(a=>({...a}))));
    }

    const alertMatch=p.match(/^\/api\/v1\/alerts\/([^/]+)(?:\/(.+))?$/);
    if(alertMatch){
      const alertId=decodeURIComponent(alertMatch[1]);
      const action=alertMatch[2]||'';
      const alert=alertState.get(alertId);
      if(!alert) return json(404,fail('ALERT_NOT_FOUND','Alert was not found.',false));
      if(method==='GET' && !action) return json(200,ok(alert));
      if(method==='POST' && action==='investigate'){
        alert.status='investigating';
        return json(200,ok({alert_id:alertId,status:alert.status,case_id:`CASE-${alertId.slice(-3)}`}));
      }
    }

    if(method==='GET' && p==='/api/v1/villages'){
      return json(200,ok([...villageState.values()]));
    }
    const villageMatch=p.match(/^\/api\/v1\/villages\/([^/]+)$/);
    if(villageMatch && method==='GET'){
      const village=villageState.get(decodeURIComponent(villageMatch[1]));
      if(!village) return json(404,fail('VILLAGE_NOT_FOUND','Village was not found.',false));
      return json(200,ok(village));
    }

    if(method==='POST' && p==='/api/v1/officers/assign'){
      const body=await readJson(req);
      if(!body.case_id || !body.officer_id) return json(400,fail('ASSIGNMENT_FIELDS_MISSING','case_id and officer_id are required.',false));
      officerState.set(body.case_id,{...body,status:'assigned',assigned_at:new Date().toISOString()});
      return json(200,ok(officerState.get(body.case_id)));
    }

    if(method==='GET' && p==='/api/v1/cases'){
      const cases=[...alertState.values()].filter(a=>a.severity==='high'||a.severity==='monitor').map((a,i)=>({
        case_id:`CASE-${String(i+1).padStart(3,'0')}`,
        alert_id:a.id,
        title:a.title,
        farmer:a.farmer||`F00${i+1}`,
        village:a.village,
        status:a.status==='open'?'Pending':a.status==='investigating'?'Investigating':'Resolved',
        priority:a.severity
      }));
      return json(200,ok(cases));
    }

    const caseStatusMatch=p.match(/^\/api\/v1\/cases\/([^/]+)\/status$/);
    if(caseStatusMatch && method==='POST'){
      const body=await readJson(req);
      return json(200,ok({case_id:decodeURIComponent(caseStatusMatch[1]),status:body.status||'Resolved',updated_at:new Date().toISOString()}));
    }

    if(method==='GET' && p==='/api/v1/expert/samples'){
      const samples=require('./data/demo_nir_samples.json').samples.slice(0,12).map((s,i)=>({
        id:`LAB-${String(s.sample).padStart(3,'0')}`,
        sample:s.sample,
        farmer:`F00${(i%6)+1}`,
        village:`Village ${String.fromCharCode(65+(i%6))}`,
        status:i===2?'Needs confirmation':i===5?'Reviewed':'Pending',
        ndf:s.ndf,adf:s.adf,ivomd:s.ivomd,ivdmd:s.ivdmd
      }));
      return json(200,ok(samples));
    }

    const expertMatch=p.match(/^\/api\/v1\/expert\/samples\/([^/]+)\/(.+)$/);
    if(expertMatch && method==='POST'){
      const sampleId=decodeURIComponent(expertMatch[1]);
      const action=expertMatch[2];
      expertState.set(sampleId,{sample_id:sampleId,status:action==='confirm'?'Confirmed':'Reviewed',updated_at:new Date().toISOString()});
      return json(200,ok(expertState.get(sampleId)));
    }

    if(method==='POST' && p==='/api/v1/qr/verify'){
      const body=await readJson(req);
      const raw=String(body.payload||body.code||'');
      const m=raw.match(/^PASHUMITTR\|TEST\|([^|]+)\|HASH\|([a-f0-9]+)$/i);
      if(m){
        const test=tests.get(m[1]);
        if(!test) return json(404,fail('QR_RECORD_NOT_FOUND','No matching test record was found.',false));
        const valid=Boolean(test.integrity?.current_hash) && test.integrity.current_hash.toLowerCase()===m[2].toLowerCase();
        return json(200,ok({matched:valid,verified:valid,type:'test',test_id:test.id,record:valid?test:null,message:valid?'Record verified.':'QR record does not match the stored integrity hash.'}));
      }
      const b=raw.match(/^PASHUMITTR\|BATCH\|([^|]+)\|DEMO\|([0-9]+)$/i);
      if(b){
        return json(200,ok({matched:true,verified:true,type:'batch',batch_id:b[1],batch_index:Number(b[2]),message:'Demo batch identity verified.'}));
      }
      return json(400,fail('QR_INVALID','QR code format is not recognised.',false));
    }

    if(method==='GET' && p==='/api/v1/voice/status'){
      const gcfg=googleTtsConfig();
      const ecfg=elevenLabsConfig();
      return json(200,ok({
        browser_tts:true,
        browser_asr:true,
        elevenlabs_tts_configured:Boolean(ecfg.apiKey),
        elevenlabs_stt_configured:Boolean(ecfg.apiKey),
        elevenlabs_provider:'ElevenLabs',
        elevenlabs_tts_model:ecfg.ttsModel,
        elevenlabs_stt_model:ecfg.sttModel,
        elevenlabs_voice_id:ecfg.voiceId,
        elevenlabs_voice_id_en:ecfg.voiceIdEn,
        elevenlabs_voice_id_hi:ecfg.voiceIdHi,
        elevenlabs_keys_configured:ecfg.apiKeys.length,
        google_tts_configured:Boolean(gcfg.apiKey||gcfg.accessToken),
        google_tts_provider:'Google Cloud Text-to-Speech',
        google_tts_language_codes:['en-IN','hi-IN','mr-IN','gu-IN','pa-IN','bn-IN','te-IN','ta-IN','kn-IN','ml-IN','or-IN','as-IN'],
        bhashini_configured:Boolean(process.env.BHASHINI_INFERENCE_API_KEY),
        bhashini_services:['ASR','TTS'],
        bhashini_pipeline_url:process.env.BHASHINI_PIPELINE_URL||'https://dhruva-api.bhashini.gov.in/services/inference/pipeline',
        bhashini_user_configured:Boolean(process.env.BHASHINI_USER_ID),
        gemini_configured:Boolean(geminiConfig().apiKey)
      }));
    }

    if(method==='POST' && p==='/api/v1/voice/tts'){
      const body=await readJson(req);
      const text=String(body.text||'').trim();
      const langMap={'English':'en-IN','Hindi':'hi-IN','Marathi':'mr-IN','Gujarati':'gu-IN','Punjabi':'pa-IN','Bengali':'bn-IN','Telugu':'te-IN','Tamil':'ta-IN','Kannada':'kn-IN','Malayalam':'ml-IN','Odia':'or-IN','Assamese':'as-IN'};
      const languageCode=String(body.locale||langMap[String(body.lang||'English')]||'hi-IN');
      if(!text) return json(400,fail('TTS_TEXT_MISSING','Text is required for speech.',false));
      try{
        const eleven=await elevenLabsTts(text,String(body.lang||'English'));
        if(eleven) return json(200,ok({...eleven,languageCode}));
      }catch(e){ console.warn('ElevenLabs TTS failed, trying fallbacks:',e.code,e.message); }
      try{
        const bh=await bhashiniTts(text,String(body.lang||'Hindi'));
        if(bh) return json(200,ok({...bh,languageCode}));
      }catch(e){ /* fallback */ }
      try{
        const audio=await googleTts(text,languageCode);
        if(!audio) return json(503,fail('TTS_NOT_CONFIGURED','No server-side TTS is configured. Browser speech fallback is available.',true));
        return json(200,ok(audio));
      }catch(e){ return json(502,fail(e.code||'GOOGLE_TTS_ERROR',e.message||'Google TTS failed.',true,{details:e.details})); }
    }

    if(method==='POST' && p==='/api/v1/voice/asr'){
      const body=await readJson(req);
      const audioContent=String(body.audioContent||'').trim();
      const lang=String(body.lang||'Hindi');
      const mimeType=String(body.mimeType||'audio/webm');
      if(!audioContent) return json(400,fail('AUDIO_MISSING','Audio content is required for speech recognition.',false));
      try{
        const result=await elevenLabsAsr(audioContent,mimeType);
        if(result?.text) return json(200,ok(result));
      }catch(e){ console.warn('ElevenLabs STT failed, trying BHASHINI:',e.code,e.message); }
      try{
        const result=await bhashiniAsr(audioContent,lang);
        if(!result) return json(503,fail('ASR_NOT_CONFIGURED','No server-side speech recognition is configured. Browser speech recognition fallback is available.',true));
        return json(200,ok(result));
      }catch(e){ return json(502,fail(e.code||'BHASHINI_ASR_ERROR',e.message||'Speech recognition failed.',true,{details:e.details})); }
    }

    if(method==='POST' && p==='/api/v1/market-advice'){
      const body=await readJson(req);
      const status=body.status||'Monitor';
      const breed=String(body.breed||'').trim();
      const alternatives=status==='High Risk'
        ? ['Use a clean, verified alternate feed batch until the concern is resolved.','Prefer dry, visibly clean fodder/concentrate from a trusted source.','Ask a dairy nutrition expert for a ration adjustment before making large changes.']
        : ['Prefer clean, dry green fodder or hay as appropriate for the current ration.','Use a trusted concentrate/feed batch and follow the existing ration plan.','Ask a dairy nutrition expert before making large ration changes.'];
      return json(200,ok({status,breed,alternatives,lang:body.lang||'English',disclaimer:'General screening guidance only; exact ration quantities should be set by a qualified animal-nutrition professional.'}));
    }

    if (method==='POST' && p==='/api/v1/advisory') {
      const body=await readJson(req);
      const assessment=await assess({...body,storage:body.storage||body.storage_environment||{},lang:body.lang||'English'});
      return json(200,ok(assessment));
    }
    if(method==='GET' && (p==='/api/v1/health' || p==='/api/health')){
      const g=geminiConfig();
      const e=elevenLabsConfig();
      return json(200,ok({
        status:'ok',
        build:'v34-hedged-gemini',
        port:PORT,
        gemini:{configured:Boolean(g.apiKey),model:g.model,assistant_model:g.assistantModel},
        elevenlabs:{configured:Boolean(e.apiKey),tts_model:e.ttsModel,stt_model:e.sttModel},
        auth_provider:process.env.AUTH_PROVIDER||'demo',
        time:new Date().toISOString()
      }));
    }
    if (method==='POST' && p==='/api/v1/assistant/chat') {
      const body=await readJson(req);
      const query=String(body.query||'').trim();
      if(!query) return json(400,fail('QUERY_MISSING','Please enter a question.',false));
      const requestId=`AI-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
      if(DEBUG_LOGS) logInfo('[Assistant] request', {requestId,query:query.slice(0,240),lang:String(body.lang||'English')});
      const context=body.context||{};
      const lang=String(body.lang||'English');
      const testSpecific=/latest|last test|result|report|sample|silage|pH|humidity|temperature|NDF|ADF|IVOMD|IVDMD|मेरा टेस्ट|रिजल्ट|साइलेज|सिलेज|नतीजा/i.test(query);
      const {apiKey,model}=geminiConfig();

      // General questions must be answered by Gemini when cloud AI is configured.
      // Do not silently replace them with a canned PashuMittr response.
      if(!apiKey){
        if(DEBUG_LOGS) logWarn('[Assistant] Gemini key missing', {requestId});
        if(testSpecific){
          const rules=context?.latest?.assessment||{};
          const fallback=rules.farmer_explanation||rules.advisory||((rules.actions||[]).join(' ')||'Gemini is not configured. The current rule-based test context is available in the result card.');
          return json(200,ok({message:fallback,source:'rule-engine',gemini_configured:false}));
        }
        return json(503,fail('GEMINI_NOT_CONFIGURED','PashuMittr AI needs GEMINI_API_KEY in backend/.env for general questions.',true));
      }

      const prompt=[
        'You are PashuMittr AI, a practical assistant for Indian dairy farmers.',
        `Reply in ${lang}. Keep the answer easy to understand, direct and helpful.`,
        'Answer BOTH general farmer questions and test-specific questions. General questions do not require a test record.',
        'For general questions, use your reliable general knowledge about cattle, buffalo, feed, fodder, silage, storage, routine dairy management and farmer practices.',
        'Do not invent measurements or claim that PashuMittr performed a laboratory test when it did not.',
        'When discussing safety-sensitive topics (poisoning, severe illness, medication/dose, pregnancy complications, emergencies), give conservative guidance and recommend a qualified veterinarian.',
        'When the question asks for toxin confirmation, chemical contamination confirmation, or lab certainty, explain that PashuMittr screening cannot substitute for confirmatory laboratory testing.',
        'Use the supplied PashuMittr context when it is relevant, but do not restrict your answer to it.',
        'If the question is general, do not say that the farmer can only ask about their latest test.',
        'Answer in 2–5 short sentences unless a slightly longer answer is needed for safety or clarity.',
        `Question: ${query}`,
        `PashuMittr context (may be empty): ${JSON.stringify(context).slice(0,12000)}`
      ].join('\n');
      try{
        const answer=await geminiText(prompt,{preferFast:true});
        if(!answer){
          if(DEBUG_LOGS) logError('[Assistant] Gemini empty result', {requestId});
          return json(502,fail('GEMINI_EMPTY','Gemini returned an empty answer. Please retry.',true));
        }
        if(DEBUG_LOGS) logInfo('[Assistant] success', {requestId,model:answer.model});
        return json(200,ok({message:answer.text,source:'gemini',gemini_configured:true,model:answer.model}));
      }catch(err){
        if(DEBUG_LOGS) logError('[Assistant] Gemini failure', {requestId,code:err?.code,status:err?.status,model:err?.model,message:err?.message,details:err?.details});
        const status = err?.status===401 || err?.status===403 ? 503 : (err?.status===429 ? 429 : 502);
        const msg = err?.status===401 || err?.status===403
          ? 'Gemini is configured but rejected the API key. Check GEMINI_API_KEY in backend/.env and restart the backend.'
          : err?.status===429
            ? 'Gemini is temporarily rate-limited. Please retry in a moment.'
            : `PashuMittr AI could not get a live Gemini answer: ${err.message||'Gemini request failed.'}`;
        return json(status,fail(err.code||'GEMINI_API_ERROR',msg,true,{details:err.details||null,model:err.model||model,status:err.status||null}));
      }
    }
    if(method==='POST' && p==='/api/v1/qr/proof'){
      const body=await readJson(req);
      return json(200,ok({proof_id:`PROOF-${Date.now()}`,test_id:body.test_id||null,captured_at:new Date().toISOString(),stored:true}));
    }

    if(method==='GET' && p==='/api/v1/lab/requests'){
      return json(200,ok([...labRequests.values()]));
    }
    if(method==='POST' && p==='/api/v1/lab/requests'){
      const body=await readJson(req);
      const id=`LABREQ-${Date.now()}-${++counter}`;
      const rec={id,test_id:body.test_id||null,kind:body.kind||'feed',status:body.status||'Monitor',reason:String(body.reason||'Confirmatory testing requested.'),requester:body.requester||'DEMO-FARMER',created_at:new Date().toISOString(),state:'Requested'};
      labRequests.set(id,rec);
      return json(201,ok(rec));
    }

    if (method==='GET' && p==='/api/v1/cooperative/dashboard') return json(200,ok(demoDashboard()));
    if (method==='POST' && p==='/api/v1/sync') {
      const body=await readJson(req);
      const items=Array.isArray(body.items)?body.items:[];
      const results=[];
      for (const item of items) {
        const clientId=String(item.client_id||'');
        if(!clientId) {
          results.push({client_id:null,synced:false,message:'client_id is required'});
          continue;
        }
        if(syncedClients.has(clientId)){
          results.push({client_id:clientId,synced:true,server_id:syncedClients.get(clientId),duplicate:true});
          continue;
        }
        const serverId=`SYNC-${crypto.createHash('sha1').update(clientId).digest('hex').slice(0,16)}`;
        const payload=item.payload||{};
        tests.set(serverId,{
          id:serverId,
          client_id:clientId,
          type:item.type||payload.type||'feed',
          created_at:payload.created_at||new Date().toISOString(),
          synced_from_client:true,
          offline_source:true,
          ...payload
        });
        syncedClients.set(clientId,serverId);
        results.push({client_id:clientId,synced:true,server_id:serverId});
      }
      const accepted=results.filter(r=>r.synced).length;
      return json(200,ok({synced:accepted,results}));
    }

    return json(404,fail('NOT_FOUND','Route not found.',false));
  } catch (err) {
    const code=err.code||'INTERNAL_ERROR';
    const status=code==='TEST_NOT_FOUND'?404:code==='INVALID_JSON'?400:500;
    return json(status,fail(code,err.message||'Unexpected server error.',code==='INTERNAL_ERROR'));
  }
}

const server=http.createServer((req,res)=>{
  route(req).then(p=>send(res,p));
});
process.on('uncaughtException',(err)=>logError('[Process] uncaughtException', err));
process.on('unhandledRejection',(err)=>logError('[Process] unhandledRejection', err));
server.on('error',(e)=>{ if(e.code==='EADDRINUSE'){ console.error(`\n[FATAL] Port ${PORT} is already in use by an OLD backend process. Close the old backend window (or kill it) and start again. v34 is NOT running.\n`); process.exit(1);} throw e; });
server.listen(PORT,()=>{
  const g=geminiConfig();
  const e=elevenLabsConfig();
  logInfo(`PashuMittr API listening on http://localhost:${PORT}`);
  logInfo('[Config]', {build:'v34-hedged-gemini',gemini_configured:Boolean(g.apiKey),gemini_model:g.model,elevenlabs_configured:Boolean(e.apiKey),auth_provider:process.env.AUTH_PROVIDER||'demo'});
});
