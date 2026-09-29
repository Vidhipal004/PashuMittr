import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Activity,AlertTriangle,ArrowLeft,ArrowRight,BarChart3,Bell,BookOpen,Camera,Check,ChevronDown,Cloud,Database,Download,Eye,FileCheck,FlaskConical,Globe2,Headphones,History,Home,Info,Languages,Leaf,LockKeyhole,LogIn,MapPinned,Menu,Mic,Pause,Play,Plus,ScanLine,Search,Settings,ShieldCheck,SlidersHorizontal,Square,TestTube2,TrendingUp,Upload,UserRound,Users,Volume2,Wifi,WifiOff, X, ZoomIn, ClipboardList, MessageCircle, RefreshCw, Sun, Moon, QrCode, Map, CalendarDays, Scale, ShoppingBag, UserRoundCheck, PhoneCall, CircleUserRound, CheckCircle2, XCircle, Thermometer, Droplets, Radio} from 'lucide-react';
import {QRCodeSVG} from 'qrcode.react';
import {wavelengths,samples,qualityTable} from './data/nirData';
import {demoFeedRecords} from './data/demoFeedData';
import {predictNIR} from './utils/nirModel';
import './styles.css';
import {api, ApiError, queueOffline, saveLocalTest, getLocalTests, getQueue, flushQueue, retryFailedQueue} from './services/api';
import {languageCatalog, localeCode, installLocaleBridge, translateString} from './i18n';
import {prepareOfflineAI, offlineAIStatus, offlineChat} from './services/offlineAI';

const languages=languageCatalog.map(x=>[x.native,x.name]);
const roles=[['farmer','Farmer','👨‍🌾',Home],['cooperative','Cooperative','🏢',Users],['expert','Expert / Lab','🔬',FlaskConical],['officer','Field Officer','🧑‍🌾',MapPinned]];

const BREED_PRESETS=['Gir','Sahiwal','HF Cross','Jersey Cross','Murrah'];
const DEFAULT_ENVIRONMENT_SENSOR={connected:false,location:'Feed storage room',source:'Demo IoT sensor',connection_type:null,device_id:'DEMO-ENV-01',temperature_c:null,humidity_pct:null,updated_at:null,monitoring_note:'Connect a demo Bluetooth/Wi-Fi sensor to load current storage readings.'};
function useEnvironmentSensor(enabled=true){
  const [sensor,setSensor]=useState(DEFAULT_ENVIRONMENT_SENSOR);
  const [sensorLoading,setSensorLoading]=useState(false);
  const [sensorError,setSensorError]=useState('');
  const loadingRef=useRef(false);
  const fetchSensor=useCallback(async(path='/sensors/environment',method='GET',body)=>{
    if(loadingRef.current)return;
    loadingRef.current=true; setSensorLoading(true); setSensorError('');
    try{const data=await api(path,{method,body});setSensor(data||DEFAULT_ENVIRONMENT_SENSOR)}
    catch(e){setSensorError(e?.message||'Storage sensor service is unavailable.');}
    finally{loadingRef.current=false;setSensorLoading(false)}
  },[]);
  const refreshSensor=useCallback(()=>fetchSensor('/sensors/environment/refresh','POST'),[fetchSensor]);
  const connectSensor=useCallback((connection_type,location)=>fetchSensor('/sensors/environment/connect','POST',{connection_type,location}),[fetchSensor]);
  const disconnectSensor=useCallback(()=>fetchSensor('/sensors/environment/disconnect','POST'),[fetchSensor]);
  useEffect(()=>{if(enabled)fetchSensor('/sensors/environment','GET')},[enabled,fetchSensor]);
  useEffect(()=>{
    if(!enabled||!sensor?.connected)return;
    const timer=setInterval(()=>fetchSensor('/sensors/environment/refresh','POST'),10000);
    return()=>clearInterval(timer);
  },[enabled,sensor?.connected,fetchSensor]);
  return {sensor,sensorLoading,sensorError,refreshSensor,connectSensor,disconnectSensor};
}
function BreedField({breed,setBreed}){
  const custom=!BREED_PRESETS.includes(breed);
  return <div className="breed-field"><label>Breed<select value={custom?'__custom__':breed} onChange={e=>{const v=e.target.value;setBreed(v==='__custom__'?(custom?breed:''):v)}}>{BREED_PRESETS.map(x=><option key={x}>{x}</option>)}<option value="__custom__">Other / enter manually</option></select></label>{custom&&<input value={breed} onChange={e=>setBreed(e.target.value.slice(0,60))} placeholder="Type your breed" aria-label="Enter breed manually"/>}</div>}
function ErrorCard({title='Couldn’t complete that step',message='Please try again.',onRetry,retryLabel='Retry',onDismiss}){
  return <div className="error-card" role="alert"><div className="error-card-icon"><AlertTriangle size={17}/></div><div className="error-card-body"><b>{title}</b><p>{message}</p><div className="error-card-actions">{onRetry&&<button className="secondary" onClick={onRetry}><RefreshCw size={14}/>{retryLabel}</button>}{onDismiss&&<button className="text-button" onClick={onDismiss}>Dismiss</button>}</div></div></div>
}
function EnvironmentSensorCard({sensor,sensorLoading,onRefresh,onConnect,onDisconnect,sensorError,compact=false}){
  const [connectOpen,setConnectOpen]=useState(false),[method,setMethod]=useState('Bluetooth'),[location,setLocation]=useState(sensor?.location||'Feed storage room');
  const temp=Number(sensor?.temperature_c); const hum=Number(sensor?.humidity_pct); const concern=(Number.isFinite(temp)&&temp>35)||(Number.isFinite(hum)&&hum>80); const connected=Boolean(sensor?.connected);
  const submitConnect=async()=>{await onConnect?.(method,location);setConnectOpen(false)};
  return <div className={'environment-sensor-card '+(compact?'compact':'')}>
    <div className="card-head"><div><span className="eyebrow"><Radio size={11}/> STORAGE ENVIRONMENT</span><h3>{sensor?.location||location||'Feed storage room'}</h3></div><div className="sensor-head-actions">{connected&&<span className="sensor-connected-chip"><Check size={12}/> Connected</span>}<button className="icon-btn sensor-refresh" title="Refresh sensor reading" onClick={onRefresh} disabled={sensorLoading||!connected}>{sensorLoading?<RefreshCw size={16} className="spin"/>:<RefreshCw size={16}/>}</button></div></div>
    {!connected ? <div className="sensor-connect-panel"><div className="sensor-connect-copy"><div className="sensor-connect-icon"><Radio size={22}/></div><div><b>Connect storage sensor</b><p>Choose Bluetooth or Wi‑Fi, set the storage location, then load a demo reading.</p></div></div>{connectOpen&&<div className="sensor-connect-form"><label>Connection method<select value={method} onChange={e=>setMethod(e.target.value)}><option>Bluetooth</option><option>Wi-Fi</option></select></label><label>Storage location<select value={location} onChange={e=>setLocation(e.target.value)}><option>Feed storage room</option><option>Silage pit</option><option>Dry fodder shed</option><option>Other storage area</option></select></label><button className="primary full" onClick={submitConnect} disabled={sensorLoading}>{sensorLoading?<><RefreshCw size={16} className="spin"/> Connecting…</>:<><Radio size={16}/> Connect & load readings</>}</button></div>} {!connectOpen&&<button className="primary full" onClick={()=>setConnectOpen(true)}><Radio size={17}/> Connect sensor</button>}</div> : <><div className="sensor-grid"><div><div className="sensor-icon temp"><Thermometer size={20}/></div><span>Temperature</span><b>{Number.isFinite(temp)?temp.toFixed(1):'—'}°C</b></div><div><div className="sensor-icon hum"><Droplets size={20}/></div><span>Humidity</span><b>{Number.isFinite(hum)?hum.toFixed(0):'—'}%</b></div></div><div className={'sensor-status '+(concern?'attention':'stable')}><span>{concern?'⚠':'✓'}</span><b>{concern?'Storage condition needs attention':'Within configured monitoring thresholds'}</b></div><div className="sensor-actions"><button className="secondary" onClick={onRefresh} disabled={sensorLoading}>{sensorLoading?<RefreshCw size={15} className="spin"/>:<RefreshCw size={15}/>} Refresh</button><button className="text-button" onClick={onDisconnect} disabled={sensorLoading}>Disconnect</button></div></>}
    {sensorError&&<ErrorCard title="Sensor update failed" message={sensorError} onRetry={connected?onRefresh:()=>onConnect?.(method,location)}/>}<p className="micro-note">Source: {sensor?.source||'Demo IoT sensor'}{sensor?.connection_type?` · ${sensor.connection_type}`:''} · Updated {sensor?.updated_at?new Date(sensor.updated_at).toLocaleTimeString():'not connected'}</p>
  </div>;
}
const tr={
 English:{welcome:'Welcome to PashuMittr',tag:'Better Feed. Healthier Cattle.',sub:'Test feed and silage, understand quality, and take the right action.',login:'Log In',signup:'Sign Up',role:'I am a…',continue:'Continue',home:'Home',test:'Test',history:'History',more:'More',feedTest:'Feed Test',silageTest:'Silage Test',voice:'Speak to PashuMittr',recent:'Recent result',good:'Good',caution:'Monitor',risk:'High Risk'},
 Hindi:{welcome:'PashuMittr में आपका स्वागत है',tag:'बेहतर चारा। स्वस्थ पशु।',sub:'चारा और साइलेज की जांच करें, गुणवत्ता समझें और सही कदम उठाएं।',login:'लॉग इन',signup:'साइन अप',role:'मैं हूँ…',continue:'आगे बढ़ें',home:'होम',test:'जांच',history:'इतिहास',more:'और',feedTest:'चारा जांच',silageTest:'साइलेज जांच',voice:'PashuMittr से बोलकर पूछें',recent:'हाल का परिणाम',good:'अच्छा',caution:'ध्यान दें',risk:'उच्च जोखिम'}
};
function text(lang,key){return (tr[lang]||tr.English)[key]||tr.English[key]||key}
function Logo({compact=false}){return <div className={'brand '+(compact?'compact':'')}><div className="logo-mark"><svg viewBox="0 0 64 64" aria-hidden="true"><rect x="2" y="2" width="60" height="60" rx="18" fill="#B2D959"/><circle cx="48" cy="15" r="7" fill="#FFF449"/><path d="M7 47c11-7 19-7 29-1 10-6 17-4 21 1v12H7z" fill="#7EC151"/><path d="M11 48c10-2 18-2 28 0M14 52c9-2 18-2 27 0" stroke="#31552A" strokeWidth="2" strokeLinecap="round"/><circle cx="25" cy="26" r="7" fill="#FED24F"/><path d="M17 25c1-6 5-9 10-9 5 0 9 3 10 8-7-2-13-2-20 1Z" fill="#31552A"/><path d="M35 38c-1-9 4-15 12-15 7 0 10 6 9 13-1 5-5 9-10 9-5 0-10-2-11-7Z" fill="#fff"/><path d="M38 29l-5-4 2 8M51 26l6-3-3 8" fill="#fff" stroke="#31552A" strokeWidth="1.5" strokeLinejoin="round"/><circle cx="49" cy="34" r="1.5" fill="#31552A"/><path d="M48 39c-3 2-6 2-9 0" fill="none" stroke="#31552A" strokeWidth="1.5" strokeLinecap="round"/></svg></div>{!compact&&<div><div className="brand-name">Pashu<span>Mittr</span></div><div className="brand-sub">Feed & silage intelligence for Indian dairy</div></div>}</div>}
function LanguageSelector({lang,setLang}){const [open,setOpen]=useState(false),[q,setQ]=useState(''); const filtered=languages.filter(x=>(x[0]+x[1]).toLowerCase().includes(q.toLowerCase())); const current=languageCatalog.find(x=>x.name===lang)||languageCatalog[0]; return <div className="lang-wrap"><button className="language-btn" onClick={()=>setOpen(!open)} aria-label="Select language"><Globe2 size={18}/>{current.native}<small>{current.name}</small><ChevronDown size={16}/></button>{open&&<div className="lang-menu"><div className="searchbox"><Search size={16}/><input autoFocus placeholder="Search language..." value={q} onChange={e=>setQ(e.target.value)}/></div>{filtered.map(([native,en])=><button key={en} className={lang===en?'lang-option selected':'lang-option'} onClick={()=>{setLang(en);setOpen(false)}}><span>{native}</span><small>{en}</small>{lang===en&&<Check size={17}/>}</button>)}</div>}</div>}
function TutorialModal({onClose}){
  const steps=[
    {icon:Languages,title:'Choose your language',body:'Pick a language from the top bar. Settings also lets you increase text size, switch theme, and turn voice assistance on or off.',audio:'Choose your language from the top bar. Settings lets you make text larger and turn voice assistance on or off.'},
    {icon:Radio,title:'Connect your storage sensor',body:'Choose Bluetooth or Wi‑Fi and select the storage location. PashuMittr then loads temperature and humidity and sends those readings into the assessment.',audio:'Connect the storage sensor using Bluetooth or Wi‑Fi, select the storage location, and PashuMittr will use temperature and humidity in the assessment.'},
    {icon:TestTube2,title:'Start a feed or silage test',body:'Feed Test captures sample details and opens visual screening. Silage Test also includes pH, temperature, humidity and mould indicators.',audio:'Start a Feed Test or Silage Test. Silage testing also includes pH, temperature, humidity and mould indicators.'},
    {icon:Camera,title:'Take a clear photo',body:'Use the camera, upload a photo, or choose a supplied demo sample. The visual layer checks image quality and visible patterns only.',audio:'Take a clear sample photo. The visual layer checks image quality and visible patterns only.'},
    {icon:ScanLine,title:'Run the NIR screening',body:'The prototype uses the supplied NIR reference dataset to screen feed traits such as IVOMD, IVDMD, NDF and ADF. Phone camera and NIR are separate evidence layers.',audio:'The NIR step uses the supplied reference spectra to screen feed traits. The phone camera does not measure NIR.'},
    {icon:Scale,title:'Rule engine combines evidence',body:'PashuMittr combines available visual, NIR, silage and storage readings into a screening status and practical next actions.',audio:'The rule engine combines available evidence and produces a screening status with practical next actions.'},
    {icon:FileCheck,title:'Understand the result and next action',body:'Results explain what to monitor and when confirmatory testing is recommended. A screening result is not a laboratory diagnosis.',audio:'The result explains what to monitor and when confirmatory testing is recommended. Screening is not laboratory diagnosis.'},
    {icon:MessageCircle,title:'Ask PashuMittr anything, then review history',body:'PashuMittr AI can answer general farmer questions as well as explain a test. History, QR verification and offline sync keep records usable in the field.',audio:'Ask PashuMittr general farmer questions or questions about your test. History, QR verification and offline sync keep records usable.'}
  ];
  const [step,setStep]=useState(0); const current=steps[step]; const Icon=current.icon;
  const finish=()=>{localStorage.setItem('pashumitr-onboarding-seen','1');onClose?.()};
  const next=()=>step===steps.length-1?finish():setStep(step+1); const back=()=>step>0&&setStep(step-1);
  useEffect(()=>{const onKey=e=>{if(e.key==='Escape')finish();else if(e.key==='ArrowRight')next();else if(e.key==='ArrowLeft')back()};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[step]);
  return <div className="modal-backdrop tutorial-backdrop"><div className="modal tutorial-modal" role="dialog" aria-modal="true" aria-label="How PashuMittr works"><div className="tutorial-top"><div><div className="eyebrow">FIRST-USE GUIDE · {step+1}/{steps.length}</div><h2>How PashuMittr works</h2></div><button className="icon-btn" onClick={finish} aria-label="Close tutorial"><X/></button></div><div className="tutorial-progress"><span style={{width:`${((step+1)/steps.length)*100}%`}}/></div><div className="tutorial-hero"><div className="tutorial-icon"><Icon size={28}/></div><div><h3>{current.title}</h3><p>{current.body}</p></div></div><div className="tutorial-audio"><AudioControls text={current.audio}/><span>सुनें · pause/resume supported</span></div><div className="tutorial-footer"><button className="text-button" onClick={finish}>Skip guide</button><div className="tutorial-nav"><button className="secondary" onClick={back} disabled={step===0}><ArrowLeft size={16}/> Back</button><button className="primary" onClick={next}>{step===steps.length-1?'Finish guide':'Next'} <ArrowRight size={16}/></button></div></div></div></div>
}

function Accessibility({settings,setSettings}){const [open,setOpen]=useState(false);return <><button className="settings-trigger" onClick={()=>setOpen(true)} aria-label="Settings"><Settings size={18}/><span>Settings</span></button>{open&&<div className="modal-backdrop" onClick={()=>setOpen(false)}><div className="modal access" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><div className="eyebrow">ACCESSIBILITY</div><h3>Make PashuMittr easier to use</h3></div><button className="icon-btn" onClick={()=>setOpen(false)}><X/></button></div><div className="setting-row"><span>Text size</span><div className="stepper"><button onClick={()=>setSettings({...settings,font:Math.max(.9,settings.font-.1)})}>A−</button><b>{Math.round(settings.font*100)}%</b><button onClick={()=>setSettings({...settings,font:Math.min(1.7,settings.font+.1)})}>A+</button></div></div><div className="setting-row"><span>High contrast</span><button className={'toggle '+(settings.contrast?'on':'')} onClick={()=>setSettings({...settings,contrast:!settings.contrast})}>{settings.contrast?'ON':'OFF'}</button></div><div className="setting-row"><span>Reduce motion</span><button className={'toggle '+(settings.motion?'on':'')} onClick={()=>setSettings({...settings,motion:!settings.motion})}>{settings.motion?'ON':'OFF'}</button></div><div className="setting-row"><span>Voice assistance</span><button className={'toggle '+(settings.voice?'on':'')} onClick={()=>setSettings({...settings,voice:!settings.voice})}>{settings.voice?'ON':'OFF'}</button></div><p className="muted">Large touch targets, keyboard focus, readable contrast and screen-reader friendly labels are built into the interface.</p><button className="secondary full" onClick={()=>{setOpen(false);window.dispatchEvent(new Event('pashumitr:open-tutorial'))}}><BookOpen size={16}/> How PashuMittr works</button></div></div>}</>}

function OfflineAIStatus(){
  const [info,setInfo]=useState(()=>offlineAIStatus());
  const [message,setMessage]=useState('');
  useEffect(()=>{
    const on=(e)=>setInfo({...offlineAIStatus(),...(e.detail||{})});
    window.addEventListener('pashumitr:offline-ai-status',on);
    return()=>window.removeEventListener('pashumitr:offline-ai-status',on);
  },[]);
  const prepare=async()=>{
    setMessage('');
    try{await prepareOfflineAI();}
    catch(e){setMessage(e?.message||'Offline AI could not be prepared on this device.');}
  };
  return <div className="offline-ai-card">
    <div className="card-head"><div><span className="eyebrow">OFFLINE AI</span><h3>Keep PashuMittr useful without internet</h3></div><WifiOff size={21}/></div>
    <p className="muted">Rule-based screening and stored test data already work offline. Optional local AI can add richer explanations on supported browsers/devices.</p>
    <div className="engine-row"><span className={info.state==='ready'?'engine-on':'engine-off'}>{info.state==='ready'?'Local AI Ready':info.state==='loading'?'Preparing model…':'Local AI not prepared'}</span><span className="muted">Rule engine always available</span></div>
    <button className="secondary" onClick={prepare} disabled={info.state==='loading'}>{info.state==='loading'?<RefreshCw size={16} className="spin"/>:<Download size={16}/>} {info.state==='ready'?'Offline AI Ready':'Prepare Offline AI'}</button>
    {message&&<ErrorCard title="Offline AI could not be prepared" message={message}/>}
    <small className="micro-note">First preparation downloads a large local model. This is optional for the hackathon; the app keeps a rule-based fallback.</small>
  </div>;
}

function SettingsPanel({settings,setSettings,onClose}){
  const [show,setShow]=useState(true);
  if(!show) return null;
  return <div className="modal-backdrop" onClick={onClose}>
    <div className="modal settings-panel" onClick={e=>e.stopPropagation()}>
      <div className="modal-head">
        <div><div className="eyebrow">SETTINGS</div><h3>PashuMittr controls</h3></div>
        <button className="icon-btn" aria-label="Close settings" onClick={onClose}><X/></button>
      </div>
      <div className="setting-row"><span>Theme</span>
        <div className="theme-pills">
          <button className={settings.theme!=='dark'?'selected':''} onClick={()=>setSettings({...settings,theme:'light'})}><Sun size={15}/> Light</button>
          <button className={settings.theme==='dark'?'selected':''} onClick={()=>setSettings({...settings,theme:'dark'})}><Moon size={15}/> Dark</button>
        </div>
      </div>
      <div className="setting-row"><span>Voice assistance</span><button className={'toggle '+(settings.voice?'on':'')} onClick={()=>setSettings({...settings,voice:!settings.voice})}>{settings.voice?'ON':'OFF'}</button></div>
      <div className="setting-row"><span>High contrast</span><button className={'toggle '+(settings.contrast?'on':'')} onClick={()=>setSettings({...settings,contrast:!settings.contrast})}>{settings.contrast?'ON':'OFF'}</button></div>
      <p className="muted">Voice can use the browser fallback today. Google Cloud TTS can be enabled from the server configuration. BHASHINI is not required.</p><button className="secondary full" onClick={()=>{onClose();window.dispatchEvent(new Event('pashumitr:open-tutorial'))}}><BookOpen size={16}/> How PashuMittr works</button><OfflineAIStatus/>
      <button className="secondary full" onClick={onClose}>Done</button>
    </div>
  </div>
}

function Header({lang,setLang,onHome,onAccess,settings}){return <header className="topbar"><button className="logo-button" onClick={onHome}><Logo/></button><div className="top-actions"><LanguageSelector lang={lang} setLang={setLang}/><Accessibility settings={settings} setSettings={onAccess}/></div></header>}
function Auth({lang,setLang,onEnter,settings,setSettings}){
  const DEMO_PHONE='0000000000',DEMO_OTP='123456';
  const [mode,setMode]=useState('landing'),[role,setRole]=useState(null),[phone,setPhone]=useState(DEMO_PHONE),[otp,setOtp]=useState(''),[otpSent,setOtpSent]=useState(false),[signup,setSignup]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[resendIn,setResendIn]=useState(0),[demoMode,setDemoMode]=useState(false);
  useEffect(()=>{ if(!resendIn)return; const t=setInterval(()=>setResendIn(v=>Math.max(0,v-1)),1000); return()=>clearInterval(t)},[resendIn]);
  const reset=()=>{setOtp('');setOtpSent(false);setError('');setBusy(false);setResendIn(0);setDemoMode(false);setPhone(DEMO_PHONE)};
  const requestOtp=async()=>{
    setError('');setBusy(true);
    try{ const result=await api('/auth/request-otp',{method:'POST',body:{phone,role,mode:signup?'signup':'login'}}); setOtpSent(true);setResendIn(Number(result?.cooldown_seconds||30)); setDemoMode(Boolean(result?.demo)); if(result?.demo_otp) setOtp(String(result.demo_otp)); }
    catch(e){setError(e.message||'Could not send OTP.');}
    finally{setBusy(false)}
  };
  const verify=async()=>{
    setError('');setBusy(true);
    try{const result=await onEnter(role,phone,otp,signup); if(result?.error)setError(result.error);}
    catch(e){setError(e.message||'OTP verification failed.');}
    finally{setBusy(false)}
  };
  if(mode==='auth')return <div className="auth-page"><Header lang={lang} setLang={setLang} onHome={()=>setMode('landing')} onAccess={setSettings} settings={settings}/><div className="auth-center"><div className="auth-card"><button className="back" onClick={()=>{reset();setMode('landing')}}><ArrowLeft size={17}/> Back</button><Logo compact/><h1>{signup?'Create your account':'Welcome back'}</h1><p className="muted">{signup?'Choose your role and verify your mobile number.':'Choose your role to continue.'}</p><div className="role-grid">{roles.map(([id,name,emoji])=><button key={id} className={role===id?'role selected':'role'} onClick={()=>{setRole(id);reset()}}><span>{emoji}</span><strong>{name}</strong>{role===id&&<Check size={17}/>}</button>)}</div>{role&&<><div className="auth-provider-note"><ShieldCheck size={15}/> OTP authentication via Twilio Verify SMS</div><label className="field-label">Mobile number <span className="demo-label">(Judge demo: {DEMO_PHONE})</span></label><div className="input"><span>+91</span><input value={phone} onChange={e=>{setPhone(e.target.value.replace(/\D/g,'').slice(0,10));setError('');setDemoMode(false)}} placeholder="Enter mobile number (demo: 0000000000)" inputMode="numeric"/></div><div className="demo-hint"><b>Judge demo:</b> enter <code>{DEMO_PHONE}</code> and use OTP <code>{DEMO_OTP}</code>. This path does not send an SMS or require a judge's personal number.</div><button className="primary full" onClick={requestOtp} disabled={phone.length<10||busy||resendIn>0}>{busy?'Sending…':resendIn>0?`Resend OTP in ${resendIn}s`:'Send OTP'} <ArrowRight size={18}/></button>{otpSent&&<div className="otp-box"><label className="field-label">Enter OTP</label><div className="input"><input inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="Enter 6-digit OTP"/></div><button className="primary full" disabled={otp.length<4||busy} onClick={verify}>{busy?'Verifying…':signup?'Verify & create account':'Verify & continue'} <Check size={18}/></button><small className="muted">{demoMode?'Demo authentication: no SMS is sent for the judge demo number.':`We sent a verification code to +91 ${phone}.`}</small>{demoMode&&<div className="demo-success"><Check size={15}/><span>Judge demo OTP generated. No SMS is sent for the demo number.</span></div>}{error&&<ErrorCard title="Authentication failed" message={error}/>}</div>}</>}</div></div></div>;
  return <div className="landing"><Header lang={lang} setLang={setLang} onHome={()=>{}} onAccess={setSettings} settings={settings}/><main className="hero"><section className="hero-copy"><div className="pill"><span className="dot"/> AI + NIR + Farmer-first testing</div><h1>{text(lang,'tag')}</h1><p>{text(lang,'sub')}</p><div className="hero-actions"><button className="primary" onClick={()=>{reset();setSignup(false);setMode('auth')}}><LogIn size={19}/>{text(lang,'login')}</button><button className="secondary" onClick={()=>{reset();setSignup(true);setMode('auth')}}><Plus size={19}/>{text(lang,'signup')}</button></div><div className="trust-row"><span><Languages size={17}/> Multilingual</span><span><Volume2 size={17}/> Voice assisted</span><span><WifiOff size={17}/> Offline ready</span><span><ShieldCheck size={17}/> Verified records</span></div></section><section className="hero-art"><div className="sun"/><div className="hill hill1"/><div className="hill hill2"/><div className="farmer-art"><div className="farmer-head"/><div className="farmer-body"/><div className="farmer-scarf"/></div><div className="cow-art"><div className="cow-body"/><div className="cow-head"/><div className="cow-ear e1"/><div className="cow-ear e2"/><div className="cow-horn h1"/><div className="cow-horn h2"/><div className="cow-eye"/></div><div className="floating-note n1"><Check size={16}/> Feed quality</div><div className="floating-note n2"><Activity size={16}/> NIR analysis</div><div className="floating-note n3"><Volume2 size={16}/> Voice advisory</div></section></main><footer className="landing-footer"><span>© 2026 PashuMittr</span><span>Secure records • Farmer-first design • Demo environment</span></footer></div>
}
function OfflineIndicator(){const [online,setOnline]=useState(navigator.onLine);const [queued,setQueued]=useState(0);const [syncing,setSyncing]=useState(false);const refresh=async()=>{const q=await getQueue();setQueued(q.length)};useEffect(()=>{refresh();const on=async()=>{setOnline(true);setSyncing(true);await flushQueue();await refresh();setSyncing(false)},off=()=>{setOnline(false);setSyncing(false)};const queuedEvt=()=>refresh();const syncEvt=()=>{refresh();setSyncing(false)};window.addEventListener('online',on);window.addEventListener('offline',off);window.addEventListener('pashumitr:queue-updated',queuedEvt);window.addEventListener('pashumitr:sync-complete',syncEvt);const timer=setInterval(()=>{if(navigator.onLine&&queued>0)flushQueue().finally(refresh)},30000);return()=>{window.removeEventListener('online',on);window.removeEventListener('offline',off);window.removeEventListener('pashumitr:queue-updated',queuedEvt);window.removeEventListener('pashumitr:sync-complete',syncEvt);clearInterval(timer)}},[queued]);return <div className={'offline-pill '+(online?'online':'offline')} title={online?'Online':'Offline'}>{online?(syncing?<RefreshCw size={15} className="spin"/>:<Wifi size={15}/>):<WifiOff size={15}/>}<span>{online?(syncing?'Syncing…':'Synced'):'Offline'}</span>{queued>0&&<b>{queued}</b>}</div>}


function QRScanner({onClose,onVerified}){
  const videoRef=useRef(null),streamRef=useRef(null),rafRef=useRef(null);
  const [mode,setMode]=useState('camera'),[running,setRunning]=useState(false),[code,setCode]=useState(''),[status,setStatus]=useState(''),[match,setMatch]=useState(null),[proof,setProof]=useState(false);
  const start=async()=>{
    try{
      if(!navigator.mediaDevices?.getUserMedia) throw new Error('Camera is not available in this browser.');
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
      streamRef.current=stream; videoRef.current.srcObject=stream; await videoRef.current.play(); setRunning(true);
      const Detector=window.BarcodeDetector;
      if(Detector){
        const detector=new Detector({formats:['qr_code']});
        const scan=async()=>{
          if(!videoRef.current||videoRef.current.readyState<2){rafRef.current=requestAnimationFrame(scan);return}
          try{
            const codes=await detector.detect(videoRef.current);
            if(codes?.[0]?.rawValue){setCode(codes[0].rawValue);verify(codes[0].rawValue);return}
          }catch(_){}
          rafRef.current=requestAnimationFrame(scan);
        };
        rafRef.current=requestAnimationFrame(scan);
      }else{
        setStatus('This browser does not expose native QR scanning. Use manual code entry below.');
      }
    }catch(e){setMode('manual');setStatus(e.message||'Camera access failed.')}
  };
  useEffect(()=>{if(mode==='camera')start();return()=>{cancelAnimationFrame(rafRef.current);streamRef.current?.getTracks().forEach(t=>t.stop())}},[mode]);
  const verify=async(raw)=>{
    if(!raw||match?.verified) return;
    setStatus('Checking QR record…');
    try{const result=await api('/qr/verify',{method:'POST',body:{payload:raw}});setMatch(result);setStatus(result.verified?'QR matched and integrity verified.':'QR found but integrity did not match.');}
    catch(e){setMatch({verified:false,matched:false,message:e.message});setStatus(e.message)}
  };
  const captureProof=async()=>{
    setProof(true);
    setStatus('Proof camera is ready. Capture a photo of the matched batch/label.');
  };
  return <div className="modal-backdrop" onClick={onClose}>
    <div className="qr-modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-head">
        <div><div className="eyebrow">QR VERIFICATION</div><h3>Scan feed batch / test</h3></div>
        <button className="icon-btn" onClick={onClose}><X/></button>
      </div>
      <div className="qr-mode-tabs"><button className={mode==='camera'?'selected':''} onClick={()=>setMode('camera')}><Camera size={16}/> Camera</button><button className={mode==='manual'?'selected':''} onClick={()=>setMode('manual')}><QrCode size={16}/> Enter code</button></div>
      {!proof&&mode==='camera'&&<div className="qr-camera-box"><video ref={videoRef} playsInline muted/><div className="qr-target"><span/></div>{!running&&<button className="primary" onClick={start}><Camera size={17}/> Start camera</button>}</div>}
      {!proof&&mode==='manual'&&<div className="qr-manual"><label>Paste/enter QR payload<input value={code} onChange={e=>setCode(e.target.value)} placeholder="PASHUMITTR|TEST|...|HASH|..."/></label><button className="primary" onClick={()=>verify(code)} disabled={!code.trim()}>Verify QR</button></div>}
      {status&&<div className={'qr-status '+(match?.verified?'good':match?'risk':'info')}><Info size={17}/><span>{status}</span></div>}
      {match?.verified&&<div className="match-card"><div className="match-icon"><CheckCircle2 size={26}/></div><div><b>Record matched</b><p>Test {match.test_id} is linked to a stored SHA-256 integrity record.</p></div></div>}
      {match?.verified&&!proof&&<div className="qr-actions"><button className="secondary" onClick={captureProof}><Camera size={17}/> Take proof photo</button><button className="primary" onClick={()=>{onVerified?.(match);onClose()}}><ArrowRight size={17}/> Continue</button></div>}
      {proof&&<ProofCamera testId={match?.test_id} onDone={()=>{onVerified?.(match);onClose()}}/>}
    </div>
  </div>
}

function ProofCamera({testId,onDone}){
  const videoRef=useRef(null),canvasRef=useRef(null),streamRef=useRef(null);const [ready,setReady]=useState(false),[captured,setCaptured]=useState(null);
  useEffect(()=>{(async()=>{try{const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});streamRef.current=stream;videoRef.current.srcObject=stream;await videoRef.current.play();setReady(true)}catch(_){}})();return()=>streamRef.current?.getTracks().forEach(t=>t.stop())},[]);
  const capture=async()=>{const v=videoRef.current,c=canvasRef.current;if(!v||!c)return;c.width=v.videoWidth||640;c.height=v.videoHeight||480;c.getContext('2d').drawImage(v,0,0,c.width,c.height);setCaptured(c.toDataURL('image/jpeg',.85))};
  const save=async()=>{try{await api('/qr/proof',{method:'POST',body:{test_id:testId,captured:true}})}catch(_){} onDone?.()};
  return <div className="proof-camera"><div className="card-head"><div><span className="eyebrow">MATCHED RECORD</span><h4>Take proof photo</h4></div><Camera size={20}/></div>{captured?<img src={captured} alt="Verification proof"/>:<video ref={videoRef} playsInline muted/>}<canvas ref={canvasRef} className="hidden-canvas"/><div className="proof-actions">{!captured?<button className="primary" disabled={!ready} onClick={capture}><Camera size={17}/> Capture</button>:<><button className="secondary" onClick={()=>setCaptured(null)}>Retake</button><button className="primary" onClick={save}><Check size={17}/> Save & continue</button></>}</div></div>
}

function MarketAlternatives({status,lang,profile={}}){
 const [items,setItems]=useState([]); const [loading,setLoading]=useState(false);
 const load=async()=>{setLoading(true);try{const data=await api('/market-advice',{method:'POST',body:{status,breed:profile.breed,species:profile.species,lactation_stage:profile.production_stage,lang}});setItems((data.alternatives||[]).map(x=>translateString(x,lang)))}catch(_){setItems((status==='High Risk'?['Use a clean verified alternate feed batch.','Prefer dry, visibly clean fodder from a trusted source.','Ask a nutrition expert before changing the ration.']:['Use clean dry fodder/hay as appropriate.','Use a trusted feed batch and existing ration plan.','Ask a nutrition expert for exact ration quantities.']).map(x=>translateString(x,lang)))}finally{setLoading(false)}};
 useEffect(()=>{load()},[status,profile.breed,profile.species,profile.production_stage]);
 const msg=items.join(' ');
 return <div className="market-card"><div className="card-head"><div><span className="eyebrow">WHAT CAN I FEED INSTEAD?</span><h3>Practical market options</h3></div><ShoppingBag size={21}/></div><p className="muted">General options only — exact ration quantities should come from a qualified animal-nutrition professional.</p>{profile?.breed&&<div className="profile-context"><UserRound size={15}/> For {profile.species||'cattle'} · {profile.breed} · {profile.production_stage||'stage not set'}</div>}{loading?<div className="micro-note"><RefreshCw className="spin" size={15}/> Finding options…</div>:<div className="market-list">{items.map((x,i)=><div key={i}><Check size={15}/><span>{x}</span></div>)}</div>}<AudioControls text={msg} lang={lang}/></div>
}

function Shell({children,active,onNavigate,lang,setLang,settings,setSettings,role}){
 const nav=role==='cooperative'?[['overview','Overview',BarChart3],['farmers','Farmers',Users],['alerts','Alerts',Bell],['riskmap','Risk Map',MapPinned],['trace','Traceability',ShieldCheck]]
  :role==='expert'?[['samples','Samples',TestTube2],['verification','Verification',FileCheck],['reports','Reports',Download]]
  :role==='officer'?[['cases','Cases',ClipboardList],['visits','Visits',MapPinned],['alerts','Alerts',Bell]]
  :[['home','Home',Home],['test','Test',TestTube2],['history','History',History],['more','More',Settings]];
 const [settingsOpen,setSettingsOpen]=useState(false),[aiOpen,setAiOpen]=useState(false),[scanOpen,setScanOpen]=useState(false);
 useEffect(()=>{const open=()=>setScanOpen(true);window.addEventListener('pashumitr:open-qr',open);return()=>window.removeEventListener('pashumitr:open-qr',open)},[]);
 const exit=()=>{if(window.confirm('Exit PashuMittr demo and return to role selection?'))window.dispatchEvent(new Event('pashumitr:exit'))};
 return <div className="app-shell">
   <aside className="sidebar"><Logo/><div className="role-chip">{role==='farmer'?'👨‍🌾 Farmer':role==='cooperative'?'🏢 Cooperative':role==='expert'?'🔬 Expert / Lab':'🧑‍🌾 Field Officer'}</div><nav>{nav.map(([id,label,Icon])=><button className={active===id?'nav-item active':'nav-item'} key={id} onClick={()=>onNavigate(id)}><Icon size={20}/><span>{label}</span></button>)}</nav><div className="sidebar-bottom"><button className="nav-item ai-nav" onClick={()=>setAiOpen(true)}><MessageCircle size={20}/><span>PashuMittr AI</span></button><button className="nav-item" onClick={()=>setScanOpen(true)}><QrCode size={20}/><span>Scan QR</span></button><button className="nav-item" onClick={()=>setSettingsOpen(true)}><Settings size={20}/><span>Settings</span></button><button className="nav-item danger-nav" onClick={exit}><ArrowLeft size={20}/><span>Exit / Role selection</span></button></div></aside>
   <div className="mobile-top"><Logo compact/><div className="mobile-top-right"><OfflineIndicator/><div className="top-actions"><LanguageSelector lang={lang} setLang={setLang}/><button className="icon-btn" aria-label="PashuMittr AI" onClick={()=>setAiOpen(true)}><MessageCircle size={19}/></button><button className="icon-btn" aria-label="Scan QR" onClick={()=>setScanOpen(true)}><QrCode size={19}/></button><Accessibility settings={settings} setSettings={setSettings}/></div></div></div>
   <main className="content"><div className="shell-actions"><button className="shell-ai" onClick={()=>setAiOpen(true)}><MessageCircle size={17}/><span>PashuMittr AI</span><small>Ask / listen / act</small></button><button className="shell-scan" onClick={()=>setScanOpen(true)}><QrCode size={17}/><span>Scan / Verify</span></button><button className="icon-btn" aria-label="Theme settings" onClick={()=>setSettingsOpen(true)}>{settings.theme==='dark'?<Moon size={18}/>:<Sun size={18}/>}</button><button className="icon-btn" aria-label="Exit" onClick={exit}><ArrowLeft size={18}/></button></div>{children}</main>
   <div className="mobile-nav">{nav.slice(0,4).map(([id,label,Icon])=><button className={active===id?'active':''} key={id} onClick={()=>onNavigate(id)}><Icon size={20}/><small>{label}</small></button>)}</div>
   {settingsOpen&&<SettingsPanel settings={settings} setSettings={setSettings} onClose={()=>setSettingsOpen(false)}/>}
   {aiOpen&&<VoiceAssistant lang={lang} context={{role}} onClose={()=>setAiOpen(false)}/>}
   {scanOpen&&<QRScanner onClose={()=>setScanOpen(false)}/>}
 </div>
}
function ClipboardIcon(p){return <FileCheck {...p}/>}
function StatusBadge({status}){const good=status==='Good'||!status;return <span className={'badge '+(good?'good':'warn')}>{good?'Good':'Monitor'}</span>}
function StatCard({icon:Icon,label,value,trend,status}){return <div className="stat-card"><div className="stat-top"><div className="icon-tile"><Icon size={19}/></div><span className={'status-dot '+(status||'good')}></span></div><div className="stat-value">{value}</div><div className="stat-label">{label}</div>{trend&&<div className="trend"><TrendingUp size={14}/> {trend}</div>}</div>}
function NIRChart({sample}){const vals=sample.spectrum; const max=Math.max(...vals),min=Math.min(...vals); const points=vals.map((v,i)=>`${(i/(vals.length-1))*100},${100-((v-min)/(max-min||1))*82-9}`).join(' ');return <div className="chart-wrap"><div className="chart-head"><div><span className="eyebrow">NIR SPECTRAL SIGNATURE</span><h3>Sample #{sample.sample}</h3></div><span className="mini-badge">{wavelengths[0].toFixed(0)}–{wavelengths[wavelengths.length-1].toFixed(0)} nm</span></div><svg className="nir-chart" viewBox="0 0 100 100" preserveAspectRatio="none"><defs><linearGradient id="nirfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7EC151" stopOpacity=".28"/><stop offset="1" stopColor="#7EC151" stopOpacity="0"/></linearGradient></defs><polyline points={points} fill="none" stroke="#31552A" strokeWidth="1.15" vectorEffect="non-scaling-stroke"/><polyline points={`0,100 ${points} 100,100`} fill="url(#nirfill)" stroke="none"/></svg><div className="axis"><span>{wavelengths[0].toFixed(0)} nm</span><span>Wavelength</span><span>{wavelengths[wavelengths.length-1].toFixed(0)} nm</span></div></div>}
function CameraCV({onReady,onBack,kind='feed',demoImages=[]}){
 const videoRef=useRef(null), canvasRef=useRef(null), fileRef=useRef(null), streamRef=useRef(null);
 const [mode,setMode]=useState('choose'), [preview,setPreview]=useState(null), [cameraState,setCameraState]=useState('idle'), [busy,setBusy]=useState(false), [finding,setFinding]=useState(null), [error,setError]=useState('');
 const title=kind==='silage'?'Silage photo for visual screening':'Feed photo for visual screening';
 const continueLabel=kind==='silage'?'Use photo & continue':'Continue to NIR analysis';
 useEffect(()=>()=>{streamRef.current?.getTracks?.().forEach(t=>t.stop())},[]);
 useEffect(()=>{if(mode==='camera'&&streamRef.current&&videoRef.current){videoRef.current.srcObject=streamRef.current;videoRef.current.play().catch(()=>{});}},[mode,cameraState]);
 const startCamera=async()=>{setError('');setMode('camera');setCameraState('starting');try{if(!window.isSecureContext && location.hostname!=='localhost') throw new Error('Camera needs HTTPS (or localhost).');if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera API is unavailable in this browser.');let stream;try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});}catch(primary){stream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});}streamRef.current=stream;setCameraState('ready');}catch(e){setCameraState('blocked');setMode('choose');const name=e?.name||'CameraError';const detail=e?.message||'Camera access failed.';setError(`${name}: ${detail} If permission is already allowed, use Retry camera or Upload photo.`);}};
 const stopCamera=()=>{streamRef.current?.getTracks?.().forEach(t=>t.stop());streamRef.current=null;setCameraState('idle')};
 const analyzeImage=(src)=>{setBusy(true);setError('');const img=new Image();img.onload=()=>{const c=canvasRef.current;c.width=320;c.height=240;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,320,240);const d=ctx.getImageData(0,0,320,240).data;let sum=0,green=0,brown=0,gray=0,variance=0,n=0;for(let i=0;i<d.length;i+=16){const r=d[i],g=d[i+1],b=d[i+2],br=(r+g+b)/3,mx=Math.max(r,g,b),mn=Math.min(r,g,b);sum+=br;variance+=br*br;n++;if(g>r*1.03&&g>b*1.05)green++;if(r>g*1.08&&g>b*1.1)brown++;if(mx-mn<22&&br>55&&br<220)gray++;}const mean=sum/n,sd=Math.sqrt(Math.max(0,variance/n-mean*mean)),brightness=Math.round(mean),texture=Math.round(Math.min(100,sd*2));const quality=brightness<55?'Retake — image is too dark':brightness>235?'Retake — image is overexposed':'Image quality looks usable';const textureConcern=texture>48,colourConcern=brown/n>0.18,mouldLike=(kind==='silage'&&gray/n>0.14&&texture>32);const visualRisk=(textureConcern||colourConcern||mouldLike)?'Monitor':'Low visual concern';setFinding({quality,brightness,texture,visualRisk,greenPct:Math.round(green/n*100),brownPct:Math.round(brown/n*100),grayPct:Math.round(gray/n*100),visibleConcern:mouldLike?'Possible mould-like visual pattern':'No obvious mould-like pattern in this screen',foreignMaterial:colourConcern?'Possible visible material variation':'No obvious foreign-material pattern'});setBusy(false);};img.onerror=()=>{setBusy(false);setError('This image could not be processed. Please choose another photo.')};img.src=src};
 const handleFile=e=>{const f=e.target.files?.[0];if(!f)return;const url=URL.createObjectURL(f);setPreview(url);setMode('preview');analyzeImage(url)};
 const useDemo=src=>{setPreview(src);setMode('preview');analyzeImage(src)};
 const capture=()=>{const v=videoRef.current,c=canvasRef.current;if(!v||!v.videoWidth){setError('Camera is still starting. Please wait a moment and capture again.');return}c.width=v.videoWidth||1280;c.height=v.videoHeight||720;c.getContext('2d').drawImage(v,0,0,c.width,c.height);const url=c.toDataURL('image/jpeg',.88);stopCamera();setPreview(url);setMode('preview');analyzeImage(url)};
 const continueFlow=()=>{if(preview&&finding)onReady({image:preview,cv:{...finding,photo_kind:kind}})};
 return <div className="capture-card cv-card"><canvas ref={canvasRef} className="hidden-canvas"/><div className="capture-header"><div><span className="eyebrow">STEP 1 · VISUAL SCREENING</span><h3>{title}</h3><p className="muted">Photo is checked for usability and visible patterns. This is visual screening, not laboratory confirmation.</p></div><ScanLine size={25}/></div>
   {mode==='choose'&&<><div className="capture-options"><button className="primary" onClick={startCamera}><Camera size={20}/> Open camera</button><button className="secondary" onClick={()=>{setMode('upload');fileRef.current?.click()}}><Upload size={20}/> Upload photo</button>{cameraState==='blocked'&&<button className="text-button" onClick={startCamera}>Retry camera</button>}<input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFile} hidden/><div className="capture-tips"><span>✓ Good light</span><span>✓ Sample fills the frame</span><span>✓ Avoid blur</span></div>{error&&<ErrorCard message={error}/>}</div>{demoImages.length>0&&<div className="demo-samples"><div className="eyebrow">DEMO SAMPLE PHOTOS</div><div className="demo-sample-grid">{demoImages.map(d=><button key={d.src} className="demo-sample" onClick={()=>useDemo(d.src)}><img src={d.src} alt=""/><span>{d.label}</span><small>Use this sample</small></button>)}</div></div>}</>}
   {mode==='upload'&&<div className="upload-drop"><input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFile}/><Upload size={30}/><b>Choose a {kind==='silage'?'silage':'feed'} photo</b><span>JPG, PNG or camera capture</span>{error&&<ErrorCard message={error}/>}<button className="secondary" onClick={()=>{setError('');setMode('choose')}}>Back</button></div>}
   {mode==='camera'&&<div className="live-camera"><video ref={videoRef} playsInline muted/><div className="camera-guide"><span>{cameraState==='starting'?'Starting camera…':'Keep the sample inside the frame'}</span></div><div className="camera-controls"><button className="secondary" onClick={()=>{stopCamera();setMode('choose')}}>Cancel</button><button className="capture-shutter" disabled={cameraState!=='ready'} onClick={capture} aria-label="Capture photo"><Camera size={25}/></button><button className="secondary" onClick={()=>fileRef.current?.click()}>Upload</button><input ref={fileRef} type="file" accept="image/*" onChange={handleFile} hidden/></div></div>}
   {mode==='preview'&&preview&&<div className="preview-area"><div className="preview-image-wrap"><img src={preview} alt="Captured sample"/><span className="preview-badge"><Check size={15}/> Photo captured</span></div>{busy?<div className="cv-processing"><div className="mini-spinner"><Activity size={20}/></div><b>Running visual screening…</b><span>Checking brightness, texture and visible material patterns</span></div>:finding&&<div className="cv-findings"><div className="finding-row"><span>Image quality</span><b className={finding.quality.startsWith('Retake')?'bad':'good'}>{finding.quality}</b></div><div className="finding-row"><span>Visual screening</span><b className={finding.visualRisk==='Monitor'?'warn':'good'}>{finding.visualRisk}</b></div><div className="finding-grid"><div><small>Brightness</small><b>{finding.brightness}/255</b></div><div><small>Texture signal</small><b>{finding.texture}</b></div><div><small>Green pixels</small><b>{finding.greenPct}%</b></div><div><small>Brown pixels</small><b>{finding.brownPct}%</b></div></div><div className="finding-extra"><span><b>Visible pattern</b>{finding.visibleConcern}</span><span><b>Foreign material</b>{finding.foreignMaterial}</span></div><p className="micro-note">This is a visual indicator only. It does not confirm toxins or lab contamination.</p></div>}{error&&<ErrorCard message={error}/>}<div className="preview-actions"><button className="secondary" onClick={()=>{setPreview(null);setFinding(null);setMode('choose');setError('')}}>Retake</button><button className="primary" disabled={busy||!finding||finding.quality.startsWith('Retake')} onClick={continueFlow}>{continueLabel} <ArrowRight size={18}/></button></div></div>}</div>;
}
function SilageTest({lang,setLang,settings,setSettings,onBack,onDone,onNavigate}){
 const {sensor:storageEnvironment,sensorLoading,sensorError,refreshSensor,connectSensor,disconnectSensor}=useEnvironmentSensor(true);
 const [ph,setPh]=useState('4.2'),[temperature,setTemperature]=useState('27.4'),[humidity,setHumidity]=useState('68'),[mould,setMould]=useState('Low'),[sampleWeight,setSampleWeight]=useState('500'),[photo,setPhoto]=useState(null),[error,setError]=useState('');
 useEffect(()=>{if(storageEnvironment?.connected){setTemperature(String(storageEnvironment.temperature_c??'27.4'));setHumidity(String(storageEnvironment.humidity_pct??'68'))}},[storageEnvironment?.connected,storageEnvironment?.temperature_c,storageEnvironment?.humidity_pct]);
 const localStatus=visual=>{const phn=Number(ph),temp=Number(temperature),humn=Number(humidity);return (phn<3.5||phn>5.2||temp>35||humn>80||mould==='High'||visual?.visualRisk==='Monitor')?'Monitor':'Good'};
 const submit=async()=>{setError('');if(!photo?.image){setError('Silage photo is required for the visual screening step. Use camera, upload, or one of the supplied demo samples.');return;}const localSilage={ph:Number(ph),temperature:Number(temperature),humidity:Number(humidity),mould_risk:mould,photo_captured:true,sample_weight_g:Number(sampleWeight)||null,captured_at:new Date().toISOString(),capture_distance_guidance:'25–40 cm recommended'};try{const t=await api('/tests',{method:'POST',body:{test_type:'silage',user_id:'DEMO-FARMER',sample_source:'On-farm',sample_note:'Silage photo + storage readings',storage_environment:storageEnvironment}});if(photo?.cv)await api(`/tests/${t.test_id}/visual`,{method:'POST',body:{visual:photo.cv,image_captured:true}});const data=await api(`/tests/${t.test_id}/silage`,{method:'POST',body:{...localSilage,visual:photo?.cv||{},storage_environment:storageEnvironment}});const assessment=await api(`/tests/${t.test_id}/assess`,{method:'POST',body:{visual:photo?.cv||{},silage:data.silage,storage:storageEnvironment,lang}});const integrity=await api(`/tests/${t.test_id}/verify`,{method:'POST',body:{}});await onDone({testId:t.test_id,silage:data.silage,visual:photo?.cv||null,image:photo?.image||null,assessment:assessment.assessment,integrity:integrity.integrity,qr_payload:integrity.qr_payload,online:true})}catch(e){const localId=`OFF-${Date.now()}-${Math.random().toString(16).slice(2)}`;const status=localStatus(photo?.cv);const localAssessment={screening_status:status,evidence_score:status==='Good'?88:70,advisory:status==='Good'?'Current silage screening shows no major concern in the submitted readings/photo. Continue monitoring.':'Do not treat this silage screen as fully safe. Review storage and send for confirmatory testing if the concern persists.',actions:status==='Good'?['Keep the silo covered and limit air exposure.','Continue pH, temperature and humidity monitoring.']:['Check visible mould/heating/moisture concerns.','Retest after corrective action.','Send a sample for confirmatory testing before feeding if the concern is strong.'],confirmatory_testing_recommended:status!=='Good',disclaimer:'AI-assisted visual/storage screening is not laboratory confirmation.'};await saveLocalTest({testId:localId,type:'silage',silage:localSilage,storage_environment:storageEnvironment,visual:photo?.cv||null,image:photo?.image||null,online:false,synced:false,assessment:localAssessment,updated_at:new Date().toISOString(),qr_payload:`PASHUMITTR|TEST|${localId}`});await queueOffline({client_id:localId,type:'silage_test',payload:{testId:localId,type:'silage',created_at:new Date().toISOString(),silage:localSilage,visual:photo?.cv||{},assessment:localAssessment,image:null}});setError(e.message||'Internet unavailable. Saved offline.');await onDone({testId:localId,silage:localSilage,visual:photo?.cv||null,image:photo?.image||null,assessment:localAssessment,online:false,qr_payload:`PASHUMITTR|TEST|${localId}`})}};
 const status=localStatus(photo?.cv);const silageMessage=status==='Good'?'Current silage screening looks stable based on the readings and visible sample screen.':'Some silage indicators need attention. Do not rely on this screen alone for a final safety decision.';const silageActions=status==='Good'?['Continue monitoring pH, temperature and humidity.','Keep the silo covered and limit air exposure after opening.']:['Review visible mould/heating/moisture concerns.','Retest after corrective action.','Send for confirmatory testing before feeding if the concern remains.'];
 return <Shell role="farmer" active="test" onNavigate={onNavigate||((id)=>id==='home'&&onBack())} lang={lang} setLang={setLang} settings={settings} setSettings={setSettings}><PageTitle eyebrow="SILAGE TEST" title="Check your silage" sub="Photo + visual screening + pH + temperature + humidity." action={<button className="secondary" onClick={onBack}><ArrowLeft size={18}/> Back</button>}/><div className="silage-photo-first"><CameraCV kind="silage" demoImages={[{label:'Visible mould sample',src:'/demo-samples/silage-mold.jpg'},{label:'Green forage sample',src:'/demo-samples/green-forage.jpg'}]} onReady={setPhoto}/></div><EnvironmentSensorCard sensor={storageEnvironment} sensorLoading={sensorLoading} sensorError={sensorError} onRefresh={refreshSensor} onConnect={connectSensor} onDisconnect={disconnectSensor}/><div className="sensor-apply-row"><span><b>Use this sensor reading in the test</b><small>Copies temperature and humidity into the assessment fields.</small></span><button className="secondary" disabled={!storageEnvironment?.connected} onClick={()=>{if(storageEnvironment?.connected){setTemperature(String(storageEnvironment.temperature_c));setHumidity(String(storageEnvironment.humidity_pct))}}}>Use live reading</button></div><div className="silage-grid"><div className="panel"><div className="metric-input-grid"><label>Sample weight (g)<input value={sampleWeight} onChange={e=>setSampleWeight(e.target.value)} inputMode="numeric"/></label><label>pH<input value={ph} onChange={e=>setPh(e.target.value)} inputMode="decimal"/></label><label>Temperature (°C)<input value={temperature} onChange={e=>setTemperature(e.target.value)} inputMode="decimal"/></label><label>Humidity (%)<input value={humidity} onChange={e=>setHumidity(e.target.value)} inputMode="decimal"/></label><label>Mould indicators<select value={mould} onChange={e=>setMould(e.target.value)}><option>Low</option><option>Medium</option><option>High</option></select></label></div><div className={'silage-status '+status.toLowerCase()}><div className="status-icon">{status==='Good'?<Check/>:<AlertTriangle/>}</div><div><b>{status}</b><p>{status==='Good'?'Current silage conditions look stable.':'Storage conditions need attention and a retest.'}</p></div></div><RuleAdvisory title="Silage advisory" message={silageMessage} actions={silageActions} lang={lang} status={status}/>{photo?.cv&&<div className="panel-inset"><b>Visual screening captured</b><span>{photo.cv.visualRisk} · {photo.cv.visibleConcern}</span></div>}{error&&<ErrorCard title="Saved offline" message={error}/>}<button className="primary full" onClick={submit} disabled={!photo?.image}><Leaf size={18}/> {photo?.image?'Save silage test':'Add silage photo first'}</button></div><div className="panel"><div className="card-head"><div><span className="eyebrow">STORAGE MONITORING</span><h3>What will be tracked</h3></div><Wifi size={21}/></div><div className="storage-list"><div><span>pH</span><b>{ph}</b></div><div><span>Temperature</span><b>{Number(temperature).toFixed(1)}°C</b></div><div><span>Humidity</span><b>{Number(humidity).toFixed(0)}%</b></div><div><span>Mould risk</span><b>{mould}</b></div><div><span>Photo evidence</span><b>{photo?.image?'Captured':'Required for visual screen'}</b></div></div><p className="micro-note">Screening guidance in this prototype uses pH as one signal: below 4.3 generally looks stable, 4.4–5.0 warrants monitoring, and above 5.0 triggers confirmatory-testing guidance. The photo does not detect toxins.</p></div></div></Shell>
}


function SilageResult({result,lang,setLang,settings,setSettings,onBack,onNavigate}){
 const status=result?.assessment?.screening_status||'Monitor';
 const text=[result?.assessment?.advisory,...(result?.assessment?.actions||[])].filter(Boolean).join(' ');
 return <Shell role="farmer" active="test" onNavigate={onNavigate||((id)=>id==='home'&&onBack())} lang={lang} setLang={setLang} settings={settings} setSettings={setSettings}>
   <PageTitle eyebrow="SILAGE RESULT" title="Silage storage screening" sub="Manual/sensor readings plus rule-based storage advisory." action={<button className="secondary" onClick={onBack}><ArrowLeft size={18}/> Home</button>}/>
   <div className="result-meta-strip"><span><Leaf size={15}/> pH {result.silage.ph}</span><span><Activity size={15}/> Temperature {result.silage.temperature}°C</span><span><Wifi size={15}/> Humidity {result.silage.humidity}%</span><span><Scale size={15}/> Weight {result.silage.sample_weight_g||'—'} g</span><span><CalendarDays size={15}/> {result.silage.captured_at?new Date(result.silage.captured_at).toLocaleString():'—'}</span><span><ShieldCheck size={15}/> {result.online?'Synced':'Saved offline'}</span><span><Camera size={15}/> Photo captured</span><span><Thermometer size={15}/> Storage {Number(result?.storage_environment?.temperature_c ?? 0).toFixed(1)}°C · {Number(result?.storage_environment?.humidity_pct ?? 0).toFixed(0)}% RH</span><span className="capture-guidance-pill">25–40 cm capture guide</span></div>
   <DirectDecisionCard status={status} assessment={result?.assessment||{}} kind="silage" testId={result?.testId}/>{result?.image&&<div className="result-photo-row"><div className="result-photo"><img src={result.image} alt="Submitted silage sample"/><div><b>Submitted silage photo</b><span>Visual screening evidence</span></div></div></div>}<div className="silage-result-grid"><div className="panel"><div className="silage-status"><div className={'status-icon '+(status==='Good'?'good':'warn')}>{status==='Good'?<Check/>:<AlertTriangle/>}</div><div><span className="eyebrow">SCREENING STATUS</span><h2>{status}</h2><p>{result.assessment.advisory}</p></div></div><RuleAdvisory title="Storage advisory" message={result.assessment.advisory} actions={result.assessment.actions||[]} lang={lang} status={status}/><div className="result-actions"><AudioControls text={text} lang={lang}/><button className="secondary" onClick={()=>window.dispatchEvent(new Event('pashumitr:open-qr'))}><QrCode size={16}/> Verify related record</button></div></div><div className="panel"><div className="card-head"><div><span className="eyebrow">STORAGE TREND</span><h3>What to monitor next</h3></div><TrendingUp size={21}/></div><div className="trend-placeholder"><div style={{height:`${Math.min(92,Math.max(16,result.silage.temperature*2))}%`}}></div><span>Temperature</span><b>{result.silage.temperature}°C</b></div><div className="trend-placeholder humidity"><div style={{height:`${Math.min(92,Math.max(16,result.silage.humidity))}%`}}></div><span>Humidity</span><b>{result.silage.humidity}%</b></div><p className="micro-note">Persistent monitoring can later be fed by connected IoT temperature/humidity/pH sensors.</p></div></div>
 </Shell>
}

const speechLocales={English:'en-IN',Hindi:'hi-IN',Marathi:'mr-IN',Gujarati:'gu-IN',Punjabi:'pa-IN',Bengali:'bn-IN',Telugu:'te-IN',Tamil:'ta-IN',Kannada:'kn-IN',Malayalam:'ml-IN',Odia:'or-IN',Assamese:'as-IN'};
let speechSession=null;
let activeGoogleAudio=null;
let activeGoogleUrl=null;
function stopAllSpeech(){
  if(typeof window!=='undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  if(activeGoogleAudio){try{activeGoogleAudio.pause();activeGoogleAudio.currentTime=0}catch(_){} activeGoogleAudio=null;}
  if(activeGoogleUrl){try{URL.revokeObjectURL(activeGoogleUrl)}catch(_){} activeGoogleUrl=null;}
  if(speechSession?.onStop) speechSession.onStop();
  speechSession=null;
}
function base64ToBlob(base64,mime='audio/mpeg'){
  const binary=atob(base64); const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
  return new Blob([bytes],{type:mime});
}

function AudioControls({text:content,lang='English',compact=false}){
  const [state,setState]=useState('idle'),[error,setError]=useState(''); const tokenRef=useRef(0),[voices,setVoices]=useState([]);
  useEffect(()=>{
    if(typeof window==='undefined'||!('speechSynthesis' in window)) return;
    const load=()=>setVoices(window.speechSynthesis.getVoices()||[]);
    load(); window.speechSynthesis.addEventListener?.('voiceschanged',load);
    return()=>window.speechSynthesis.removeEventListener?.('voiceschanged',load)
  },[]);
  useEffect(()=>()=>{if(speechSession?.token===tokenRef.current) stopAllSpeech()},[]);
  const browserSpeak=()=>{
    if(typeof window==='undefined'||!('speechSynthesis' in window)){setState('idle');setError('Voice playback is not available in this browser.');return}
    const clean=String(content||'').trim(); if(!clean){setState('idle');setError('Nothing is available to read.');return}
    const token=Date.now()+Math.random();tokenRef.current=token;
    const utterance=new SpeechSynthesisUtterance(clean); const target=speechLocales[lang]||'en-IN';
    const best=voices.find(v=>v.lang?.toLowerCase().startsWith(target.split('-')[0].toLowerCase()))||voices.find(v=>v.lang?.toLowerCase().startsWith('en'));
    if(best) utterance.voice=best; utterance.lang=target; utterance.rate=.92; utterance.pitch=1;
    utterance.onend=()=>{if(tokenRef.current===token){setState('idle');speechSession=null}};
    utterance.onerror=()=>{if(tokenRef.current===token){setState('idle');speechSession=null;setError('Voice playback failed. Try again or use the text answer.')}};
    speechSession={token,onStop:()=>setState('idle')}; window.speechSynthesis.speak(utterance); setState('speaking');
  };
  const speak=async()=>{
    setError('');
    const clean=String(content||'').trim(); if(!clean){setError('Nothing is available to read.');return}
    stopAllSpeech(); setState('loading');
    try{
      const data=await api('/voice/tts',{method:'POST',body:{text:clean,lang,locale:speechLocales[lang]||'en-IN'}});
      if(data?.audioContent){
        const blob=base64ToBlob(data.audioContent,data.mimeType||'audio/mpeg');
        const url=URL.createObjectURL(blob); activeGoogleUrl=url;
        const audio=new Audio(url); activeGoogleAudio=audio;
        const token=Date.now()+Math.random();tokenRef.current=token;
        audio.onended=()=>{if(tokenRef.current===token){setState('idle');speechSession=null;if(activeGoogleUrl){URL.revokeObjectURL(activeGoogleUrl);activeGoogleUrl=null;}activeGoogleAudio=null;}};
        audio.onerror=()=>{if(tokenRef.current===token){activeGoogleAudio=null;setState('idle');speechSession=null;setError('Google voice playback failed.');}};
        speechSession={token,onStop:()=>setState('idle')};
        await audio.play(); setState('speaking'); return;
      }
    }catch(_){/* fallback below */}
    browserSpeak();
  };
  const pause=()=>{
    if(activeGoogleAudio&& !activeGoogleAudio.paused){activeGoogleAudio.pause();setState('paused');return}
    if(window.speechSynthesis?.speaking){window.speechSynthesis.pause();setState('paused')}
  };
  const resume=()=>{
    if(activeGoogleAudio){activeGoogleAudio.play().then(()=>setState('speaking')).catch(()=>setError('Could not resume audio.'));return}
    window.speechSynthesis?.resume();setState('speaking')
  };
  const stop=()=>{stopAllSpeech();setState('idle')};
  const cls=compact?'audio-controls compact':'audio-controls';
  return <div className={cls}>
    {state==='loading'?<button className="audio-btn" disabled title="Preparing voice"><RefreshCw size={15} className="spin"/>{!compact&&'Preparing…'}</button>:
     state==='speaking'?<><button className="audio-btn" onClick={pause} title="Pause reading"><Pause size={15}/>{!compact&&'Pause'}</button><button className="audio-btn ghost" onClick={stop} title="Stop reading"><Square size={14}/>{!compact&&'Stop'}</button></>:
     state==='paused'?<><button className="audio-btn" onClick={resume} title="Resume reading"><Play size={15}/>{!compact&&'Resume'}</button><button className="audio-btn ghost" onClick={stop} title="Stop reading"><Square size={14}/>{!compact&&'Stop'}</button></>:
     <button className={compact?'audio-btn compact-single':'audio-btn'} onClick={speak} title="Listen again"><Volume2 size={15}/>सुनें</button>}
    {error&&!compact&&<span className="audio-error">{error}</span>}
  </div>
}
function RuleAdvisory({title='Farmer advisory',message,actions=[],lang='English',status}){
  const textForSpeech=[message,...actions].filter(Boolean).join(' ');
  return <div className="advisory-box"><div className="advisory-title"><Volume2 size={18}/><b>{title}</b>{status&&<span className={'advisory-status '+(status==='High Risk'?'risk':status==='Monitor'?'warn':'good')}>{status}</span>}</div><p>{message}</p>{actions.length>0&&<div className="advisory-actions-list"><b>अब क्या करें?</b>{actions.map((a,i)=><div key={i}><Check size={14}/><span>{a}</span></div>)}</div>}<div className="advisory-audio"><AudioControls text={textForSpeech} lang={lang}/><span>सुनें • रोकें • फिर से सुनें</span></div></div>}

function VoiceAssistant({onClose,lang='English',context={}}){
  const [listening,setListening]=useState(false),[paused,setPaused]=useState(false),[query,setQuery]=useState(''),[sending,setSending]=useState(false),[voiceError,setVoiceError]=useState('');
  const recognitionRef=useRef(null);
  const voiceIntentRef=useRef('idle');
  const finalTranscriptRef=useRef('');
  const interimTranscriptRef=useRef('');
  const retryRef=useRef(0);
  const [messages,setMessages]=useState([{id:'welcome',from:'bot',text:'Namaste! PashuMittr AI mein aap kya samajhna chahte hain?'}]);
  const [voiceStatus,setVoiceStatus]=useState({bhashini_configured:false,browser_tts:true,browser_asr:true,gemini_configured:false});
  const [offlineInfo,setOfflineInfo]=useState(()=>offlineAIStatus());
  useEffect(()=>{const on=(e)=>setOfflineInfo({...offlineAIStatus(),...(e.detail||{})});window.addEventListener('pashumitr:offline-ai-status',on);return()=>window.removeEventListener('pashumitr:offline-ai-status',on)},[]);
  useEffect(()=>{api('/voice/status').then(setVoiceStatus).catch(()=>{})},[]);
  const send=async(q)=>{
    const text=(q??query).trim();if(!text||sending)return;
    setMessages(m=>[...m,{id:`u-${Date.now()}`,from:'user',text}]);setQuery('');finalTranscriptRef.current='';interimTranscriptRef.current='';setSending(true);setVoiceError('');
    try{
      const data=await api('/assistant/chat',{method:'POST',body:{query:text,lang,context},timeout:7500});
      setMessages(m=>[...m,{id:`b-${Date.now()}`,from:'bot',text:data.message,source:data.source||'gemini'}]);
    }catch(e){
      if(offlineAIStatus().ready){
        try{
          const localAnswer=await offlineChat({query:text,lang,context});
          setMessages(m=>[...m,{id:`b-${Date.now()}`,from:'bot',text:localAnswer,source:'offline-ai'}]);
        }catch(err){
          setMessages(m=>[...m,{id:`b-${Date.now()}`,from:'bot',text:`Live PashuMittr AI could not answer this question. ${e?.message||err?.message||'Please retry.'}`,source:'assistant-error'}]);
        }
      }else{
        setMessages(m=>[...m,{id:`b-${Date.now()}`,from:'bot',text:`Live PashuMittr AI could not answer this question. ${e?.message||'Please check Gemini configuration and retry.'}`,source:'assistant-error'}]);
      }
    }finally{setSending(false)}
  };
  const syncTranscript=()=>{
    const combined=[finalTranscriptRef.current,interimTranscriptRef.current].filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
    setQuery(combined);
  };
  const stopBrowserSpeech=({clear=false}={})=>{
    voiceIntentRef.current='idle';
    try{recognitionRef.current?.abort?.()}catch(_){ }
    recognitionRef.current=null;
    interimTranscriptRef.current='';
    if(clear){finalTranscriptRef.current='';setQuery('');}else{if(query.trim())finalTranscriptRef.current=query.trim();syncTranscript();}
    setListening(false);setPaused(false);
  };
  const buildBrowserRecognition=()=>{
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR)throw new Error('Voice input is not available in this browser. Try Chrome or Edge on localhost/HTTPS.');
    const r=new SR();r.lang=speechLocales[lang]||'hi-IN';r.interimResults=true;r.continuous=true;r.maxAlternatives=1;recognitionRef.current=r;
    r.onstart=()=>{setVoiceError('');setListening(true);setPaused(false)};
    r.onresult=e=>{let interim='';const finals=[];for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results?.[i]?.[0]?.transcript?.trim()||'';if(!t)continue;if(e.results[i].isFinal)finals.push(t);else interim+=`${t} `;}if(finals.length)finalTranscriptRef.current=[finalTranscriptRef.current,...finals].filter(Boolean).join(' ').replace(/\s+/g,' ').trim();interimTranscriptRef.current=interim.trim();syncTranscript();retryRef.current=0};
    r.onerror=e=>{const code=e?.error||'unknown error';recognitionRef.current=null;setListening(false);if(voiceIntentRef.current==='paused')return;voiceIntentRef.current='idle';if((code==='aborted'||code==='no-speech')&&retryRef.current===0){retryRef.current=1;setVoiceError('Voice capture stopped briefly. Retrying…');window.setTimeout(()=>startBrowserSpeech({resume:true}),350);return}if(code==='not-allowed'||code==='service-not-allowed')setVoiceError('Microphone permission/service was blocked. Allow microphone access for localhost and try again.');else if(code==='audio-capture')setVoiceError('Microphone is unavailable. Close other apps using the mic and try again.');else if(code==='network')setVoiceError('Browser speech service is unavailable. Check internet or use the text box.');else if(code==='no-speech')setVoiceError('No speech was detected. Speak after the mic indicator turns on.');else setVoiceError(`Voice input could not start (${code}). Try again.`)};
    r.onend=()=>{recognitionRef.current=null;if(voiceIntentRef.current==='listening'){setListening(false);window.setTimeout(()=>{if(voiceIntentRef.current!=='listening')return;try{buildBrowserRecognition().start()}catch(_){voiceIntentRef.current='idle';setListening(false);setVoiceError('Voice capture ended. Press Resume to continue.')}},120)}else if(voiceIntentRef.current==='paused')setListening(false);else setListening(false)};
    return r;
  };
  const startBrowserSpeech=async({resume=false,restart=false}={})=>{
    if(!('webkitSpeechRecognition' in window||'SpeechRecognition' in window)){setVoiceError('Voice input is not available in this browser. Try Chrome or Edge on localhost/HTTPS.');return}
    if(!window.isSecureContext&&!['localhost','127.0.0.1'].includes(window.location.hostname)){setVoiceError('Voice input needs localhost or HTTPS. Open PashuMittr using http://localhost:5173.');return}
    if(restart){try{recognitionRef.current?.abort?.()}catch(_){ }recognitionRef.current=null;finalTranscriptRef.current='';interimTranscriptRef.current='';setQuery('')}else if(resume){finalTranscriptRef.current=(query||finalTranscriptRef.current||'').trim();interimTranscriptRef.current=''}
    try{if(navigator.mediaDevices?.getUserMedia){const stream=await navigator.mediaDevices.getUserMedia({audio:true});stream.getTracks().forEach(t=>t.stop())}}catch(e){const name=e?.name||'';if(name==='NotAllowedError'||name==='PermissionDeniedError')setVoiceError('Microphone permission was blocked. In Chrome: site settings → Microphone → Allow, then reload.');else if(name==='NotFoundError')setVoiceError('No microphone was found. Connect a microphone and try again.');else setVoiceError('Could not access the microphone. Check Windows microphone permissions and browser settings.');setListening(false);setPaused(false);voiceIntentRef.current='idle';return}
    try{voiceIntentRef.current='listening';retryRef.current=0;setVoiceError('');const r=buildBrowserRecognition();r.start()}catch(e){recognitionRef.current=null;voiceIntentRef.current='idle';setListening(false);setPaused(false);setVoiceError(e?.message||'Could not start microphone. Please try again.')}
  };
  const pauseVoice=()=>{if(!recognitionRef.current)return;voiceIntentRef.current='paused';if(query.trim())finalTranscriptRef.current=query.trim();interimTranscriptRef.current='';syncTranscript();try{recognitionRef.current.stop?.()}catch(_){try{recognitionRef.current.abort?.()}catch(__){}}recognitionRef.current=null;setListening(false);setPaused(true);setVoiceError('Paused. Press Resume to continue or Restart to clear the question.')};
  const resumeVoice=()=>startBrowserSpeech({resume:true});
  const restartVoice=()=>startBrowserSpeech({restart:true});
  useEffect(()=>()=>stopBrowserSpeech({clear:false}),[]);

  const startBhashiniRecorder=async()=>{
    setVoiceError('');const stream=await navigator.mediaDevices.getUserMedia({audio:true});const ctx=new (window.AudioContext||window.webkitAudioContext)({sampleRate:16000});const source=ctx.createMediaStreamSource(stream);const processor=ctx.createScriptProcessor(4096,1,1);const chunks=[];let active=true;const input=ctx.createGain();input.gain.value=0;source.connect(processor);processor.connect(input);input.connect(ctx.destination);processor.onaudioprocess=e=>{if(active)chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)))};setListening(true);setPaused(false);
    const stopCapture=async()=>{if(!active)return;active=false;setListening(false);processor.disconnect();source.disconnect();input.disconnect();stream.getTracks().forEach(t=>t.stop());const sampleRate=ctx.sampleRate||16000;const length=chunks.reduce((n,c)=>n+c.length,0);const pcm=new Int16Array(length);let off=0;for(const c of chunks){for(let i=0;i<c.length;i++){const x=Math.max(-1,Math.min(1,c[i]));pcm[off++]=x<0?x*0x8000:x*0x7fff}}const buffer=new ArrayBuffer(44+pcm.length*2);const view=new DataView(buffer);const write=(o,str)=>{for(let i=0;i<str.length;i++)view.setUint8(o+i,str.charCodeAt(i))};write(0,'RIFF');view.setUint32(4,36+pcm.length*2,true);write(8,'WAVE');write(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);write(36,'data');view.setUint32(40,pcm.length*2,true);for(let i=0;i<pcm.length;i++)view.setInt16(44+i*2,pcm[i],true);const bytes=new Uint8Array(buffer);let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));const audioContent=btoa(binary);await ctx.close().catch(()=>{});try{const data=await api('/voice/asr',{method:'POST',body:{audioContent,lang}});if(data?.text){setQuery(data.text);finalTranscriptRef.current=data.text;setVoiceError('Voice captured. Review the question, then press → to send.')}else throw new Error('BHASHINI returned no transcript.')}catch(e){setVoiceError(e.message||'Regional voice service failed. Falling back to browser speech input.');startBrowserSpeech({restart:true})}};
    window.setTimeout(stopCapture,6500);window.__pashumitrStopVoice=stopCapture;
  };
  const startVoice=()=>{setVoiceError('');if(voiceStatus.bhashini_configured){startBhashiniRecorder().catch(e=>{setListening(false);setVoiceError(e.message||'Microphone could not start.')});return}if(listening)pauseVoice();else startBrowserSpeech({resume:paused})};
  return <div className="modal-backdrop"><div className="voice-modal">
    <div className="modal-head"><div><span className="eyebrow">PASHUMITTR AI · VOICE ASSISTANT</span><h3>Speak by voice</h3><div className="voice-engine-badges"><span className={voiceStatus.bhashini_configured?'engine-on':'engine-off'}>{voiceStatus.bhashini_configured?'BHASHINI ON':'BHASHINI pending'}</span><span className={voiceStatus.google_tts_configured?'engine-on':'engine-off'}>{voiceStatus.google_tts_configured?'Google TTS ON':'Google TTS fallback'}</span><span className="engine-on">Browser TTS {voiceStatus.browser_tts?'ready':'unavailable'}</span><span className={voiceStatus.gemini_configured?'engine-on':'engine-off'}>Gemini {voiceStatus.gemini_configured?'ON':'fallback'}</span><span className={offlineInfo.ready?'engine-on':'engine-off'}>{offlineInfo.ready?'Offline AI ON':'Offline AI on demand'}</span></div></div><button className="icon-btn" onClick={()=>{try{window.__pashumitrStopVoice?.()}catch(_){}stopAllSpeech();stopBrowserSpeech({clear:false});onClose()}}><X/></button></div>
    <div className="voice-messages">{messages.map(msg=><div key={msg.id} className={'chat-row '+msg.from}><div className={'chat-bubble '+msg.from}>{msg.text}{msg.from==='bot'&&msg.source&&<small className="chat-source">{msg.source==='offline-ai'?'Offline AI':msg.source==='gemini'?'Gemini':msg.source==='assistant-error'?'AI unavailable':'PashuMittr Rules'}</small>}</div>{msg.from==='bot'&&<AudioControls text={msg.text} lang={lang} compact/>}</div>)}{sending&&<div className="chat-row bot"><div className="chat-bubble bot"><RefreshCw size={15} className="spin"/> जवाब तैयार हो रहा है…</div></div>}</div>
    <div className="suggestions"><button onClick={()=>send('क्या गाय और भैंस को चॉकलेट खिला सकते हैं?')}>चारा पूछें</button><button onClick={()=>send('मेरी सिलेज कैसी है?')}>साइलेज सलाह</button><button onClick={()=>send('इस रिजल्ट का मतलब क्या है?')}>रिजल्ट समझाएं</button><button onClick={()=>send('मेरा आखिरी टेस्ट क्या कहता है?')}>मेरा टेस्ट</button></div>
    <div className="voice-input"><input value={query} onChange={e=>{setQuery(e.target.value);finalTranscriptRef.current=e.target.value}} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Ask anything about cattle, buffalo, feed, silage, care or your test…" aria-label="Question for PashuMittr AI"/><button className={'primary '+(listening?'speaking':'')} onClick={startVoice} disabled={sending}><Mic size={18}/>{listening?'Listening…':'Speak'}</button><button className="secondary" onClick={()=>send()} disabled={sending||!query.trim()}><ArrowRight size={18}/></button></div>
    <div className="voice-controls"><button className={'voice-control-btn '+(listening?'active':'')} onClick={()=>listening?pauseVoice():resumeVoice()} disabled={sending}>{listening?<><Pause size={16}/> Pause</>:<><Play size={16}/> {paused?'Resume':'Start voice'}</>}</button><button className="voice-control-btn" onClick={restartVoice} disabled={sending}><RefreshCw size={16}/> Restart</button><button className="voice-control-btn ghost" onClick={()=>stopBrowserSpeech({clear:false})} disabled={sending||(!listening&&!paused)}><Square size={14}/> Stop</button><span className="voice-live-state">{listening?'Listening — your words appear in the box…':paused?'Paused — your words are saved in the box':'Speak, review, then Send'}</span></div>
    {voiceError&&<ErrorCard title="Voice input needs attention" message={voiceError} onRetry={startVoice}/>}
  </div></div>
}

function Farmer({active,onNavigate,lang,setLang,settings,setSettings}){
 const [stage,setStage]=useState('home'),[silageResult,setSilageResult]=useState(null),[sampleId,setSampleId]=useState(1),[sampleWeight,setSampleWeight]=useState('1000'),[sampleSource,setSampleSource]=useState('On-farm'),[batchCode,setBatchCode]=useState(''),[sampleNote,setSampleNote]=useState(''),[animalSpecies,setAnimalSpecies]=useState('Cattle'),[breed,setBreed]=useState('Gir'),[productionStage,setProductionStage]=useState('Lactating'),[milkYield,setMilkYield]=useState('10'),[profileSaved,setProfileSaved]=useState(false);
 const [listening,setListening]=useState(false),[analysis,setAnalysis]=useState(false),[cvResult,setCvResult]=useState(null),[serverResult,setServerResult]=useState(null),[error,setError]=useState(''),[offlineSaved,setOfflineSaved]=useState(false),[historyItems,setHistoryItems]=useState([]),[latest,setLatest]=useState(null);
 const {sensor:storageEnvironment,sensorLoading,sensorError,refreshSensor,connectSensor,disconnectSensor}=useEnvironmentSensor(true);
 useEffect(()=>{try{const p=JSON.parse(localStorage.getItem('pashumitr-animal-profile')||'null');if(p){setAnimalSpecies(p.species||'Cattle');setBreed(p.breed||'Gir');setProductionStage(p.production_stage||'Lactating');setMilkYield(String(p.milk_yield_l_per_day??'10'))}}catch(_){}} ,[]);
 useEffect(()=>{localStorage.setItem('pashumitr-animal-profile',JSON.stringify({species:animalSpecies,breed,production_stage:productionStage,milk_yield_l_per_day:Number(milkYield)||null}))},[animalSpecies,breed,productionStage,milkYield]);
 const sample=samples.find(s=>s.sample===sampleId)||samples[0];
 const [demoFeedId,setDemoFeedId]=useState('F001');
 const demoFeed=demoFeedRecords.find(r=>r.sample_id===demoFeedId)||demoFeedRecords[0];

 const loadHistory=async()=>{try{const local=await getLocalTests();let remote=[];try{remote=await api('/history')}catch(_){remote=[]}const byId=new Map();[...remote,...local].forEach(x=>{if(x?.testId||x?.id){const id=x.testId||x.id;if(!byId.has(id))byId.set(id,x)}});const rows=[...byId.values()].map(x=>({...x,meta:x.meta||x.sample_meta||{}})).sort((a,b)=>String(b.created_at||b.updated_at||'').localeCompare(String(a.created_at||a.updated_at||'')));setHistoryItems(rows);if(rows[0])setLatest(rows[0])}catch(_){setHistoryItems([])}};
 useEffect(()=>{if(stage==='history'||stage==='home')loadHistory()},[stage]);
 useEffect(()=>{const on=()=>refreshSensor();window.addEventListener('pashumitr:refresh-environment',on);return()=>window.removeEventListener('pashumitr:refresh-environment',on)},[refreshSensor]);

 const startTest=()=>{setStage('test');setAnalysis(false);setCvResult(null);setServerResult(null);setError('');setOfflineSaved(false);};
 const farmerNavigate=(id)=>{if(id==='home')setStage('home');else if(id==='test')startTest();else if(id==='history')setStage('history');else if(id==='more')setStage('more');};

 const run=async()=>{
   setError('');setAnalysis(true);
   const meta={feed_type:'demo-feed',sample_weight_g:Number(sampleWeight)||null,sample_source:sampleSource,batch_code:batchCode.trim()||null,sample_note:sampleNote.trim()||null,captured_at:new Date().toISOString(),photo_captured:Boolean(cvResult?.image),capture_distance_guidance:'25–40 cm recommended',species:animalSpecies,breed,production_stage:productionStage,milk_yield_l_per_day:Number(milkYield)||null};
   try{
     const t=await api('/tests',{method:'POST',body:{test_type:'feed',feed_type:meta.feed_type,user_id:'DEMO-FARMER',sample_weight_g:meta.sample_weight_g,sample_source:meta.sample_source,batch_code:meta.batch_code,sample_note:meta.sample_note,species:meta.species,breed:meta.breed,production_stage:meta.production_stage,milk_yield_l_per_day:meta.milk_yield_l_per_day,demo_reference:demoFeed,storage_environment:storageEnvironment}});
     const visual=await api(`/tests/${t.test_id}/visual`,{method:'POST',body:{visual:cvResult?.cv||{quality:'Dataset-only demo',visualRisk:'Low visual concern'},image_captured:Boolean(cvResult?.image),sample_meta:meta}});
     const nir=await api(`/tests/${t.test_id}/nir`,{method:'POST',body:{sample_id:sample.sample}});
     const assessment=await api(`/tests/${t.test_id}/assess`,{method:'POST',body:{visual:visual.visual,nir:nir.nir,storage:storageEnvironment,lang}});
     const integrity=await api(`/tests/${t.test_id}/verify`,{method:'POST',body:{}});
     const result={testId:t.test_id,type:'feed',visual:visual.visual,nir:nir.nir,assessment:assessment.assessment,integrity:integrity.integrity,qr_payload:integrity.qr_payload,online:true,synced:true,sample:sample.sample,demo_reference:demoFeed,image:cvResult?.image||null,meta,storage_environment:storageEnvironment};
     setServerResult(result);setAnalysis(false);setStage('result');await saveLocalTest(result);await loadHistory();
     const pollAi=async(attempt=0)=>{
       if(attempt>=6)return;
       try{
         const fresh=await api(`/tests/${t.test_id}`,{timeout:5000});
         if(fresh?.ai_explanation){
           const updated={...result,assessment:{...result.assessment,farmer_explanation:fresh.ai_explanation,gemini:{...(result.assessment?.gemini||{}),used:true,pending:false}}};
           setServerResult(prev=>prev&&prev.testId===t.test_id?updated:prev);
           await saveLocalTest(updated);
           return;
         }
       }catch(_){}
       window.setTimeout(()=>pollAi(attempt+1),1100);
     };
     window.setTimeout(()=>pollAi(),1100);
   }catch(e){
     const storageConcern=Number(storageEnvironment?.temperature_c)>35||Number(storageEnvironment?.humidity_pct)>80;
     const status=(cvResult?.cv?.visualRisk==='High Risk')?'High Risk':((cvResult?.cv?.visualRisk==='Monitor'||storageConcern)?'Monitor':'Good');
     const local={testId:`OFF-${Date.now()}-${Math.random().toString(16).slice(2)}`,type:'feed',visual:cvResult?.cv||{quality:'Dataset-only demo',visualRisk:'Low visual concern'},nir:{...predictNIR(sample.sample)},assessment:{screening_status:status,evidence_score:74,advisory:'Internet nahi hai. Test offline save ho gaya hai. Feed ko dry aur clean rakhein aur baad mein sync karein.',actions:['Keep the sample dry and clean.','Reconnect and sync the test when internet returns.','Use confirmatory testing before high-stakes decisions.'],confirmatory_testing_recommended:true,disclaimer:'Offline demo screening only.'},online:false,synced:false,sample:sample.sample,demo_reference:demoFeed,image:cvResult?.image||null,meta,storage_environment:storageEnvironment};
     await saveLocalTest(local);await queueOffline({client_id:local.testId,type:'feed_test',payload:{...local,image:null}});setServerResult(local);setOfflineSaved(true);setAnalysis(false);setStage('result');setError(e.message||'Network unavailable. Test saved offline.');await loadHistory();
   }
 };

 const openHistory=(it)=>{
   const s=samples.find(x=>x.sample===it.sample)||sample;
   setSampleId(s.sample);setServerResult(it);setOfflineSaved(it.online===false);setStage('result')
 };

 if(stage==='test')return <Shell role="farmer" active="test" onNavigate={farmerNavigate} lang={lang} setLang={setLang} settings={settings} setSettings={setSettings}>
   <PageTitle eyebrow="FEED TEST" title="Check your feed quality" sub="Photo + NIR screening + rule-based advisory." action={<button className="secondary" onClick={()=>setStage('home')}><ArrowLeft size={18}/> Back</button>}/>
   <div className="sample-meta-grid"><div><label>Feed / sample source<select value={sampleSource} onChange={e=>setSampleSource(e.target.value)}><option>On-farm</option><option>Purchased market feed</option><option>Cooperative batch</option><option>Unknown</option></select></label></div><div><label>Sample weight (g)<input value={sampleWeight} onChange={e=>setSampleWeight(e.target.value)} inputMode="numeric" placeholder="e.g. 1000"/></label></div><div><label>Batch / packet code<input value={batchCode} onChange={e=>setBatchCode(e.target.value)} placeholder="Optional"/></label></div><div><label>Sample note<input value={sampleNote} onChange={e=>setSampleNote(e.target.value)} placeholder="e.g. maize mash"/></label></div><div><label>Animal species<select value={animalSpecies} onChange={e=>setAnimalSpecies(e.target.value)}><option>Cattle</option><option>Buffalo</option></select></label></div><BreedField breed={breed} setBreed={setBreed}/><div><label>Production stage<select value={productionStage} onChange={e=>setProductionStage(e.target.value)}><option>Lactating</option><option>Dry</option><option>Heifer</option><option>Calf</option></select></label></div><div><label>Milk yield (L/day)<input value={milkYield} onChange={e=>setMilkYield(e.target.value)} inputMode="decimal" placeholder="e.g. 10"/></label></div></div>
   <div className="panel demo-reference-panel"><div className="card-head"><div><span className="eyebrow">DEMO REFERENCE DATASET</span><h3>Use a supplied sample scenario</h3></div><Database size={22}/></div><div className="demo-reference-grid"><label>Reference row<select value={demoFeedId} onChange={e=>setDemoFeedId(e.target.value)}>{demoFeedRecords.map(r=><option key={r.sample_id} value={r.sample_id}>{r.sample_id} · {r.feed_type} · {r.quality_status}</option>)}</select></label><div className="demo-reference-values"><span><b>Moisture</b>{demoFeed.moisture_pct == null ? '—' : `${demoFeed.moisture_pct}%`}</span><span><b>Protein</b>{demoFeed.protein_pct == null ? '—' : `${demoFeed.protein_pct}%`}</span><span><b>Fiber</b>{demoFeed.fiber_pct == null ? '—' : `${demoFeed.fiber_pct}%`}</span><span><b>pH</b>{demoFeed.ph == null ? '—' : demoFeed.ph}</span><span><b>Aflatoxin</b>{demoFeed.aflatoxin_ppb == null ? '—' : `${demoFeed.aflatoxin_ppb} ppb`}</span><span><b>Adulteration</b>{demoFeed.adulteration_detected}</span></div></div><p className="micro-note">Demo/reference values only. These fields are not used to train or claim that the phone camera detects aflatoxin. NIR uses the separate supplied spectral dataset.</p></div>
   <EnvironmentSensorCard sensor={storageEnvironment} sensorLoading={sensorLoading} sensorError={sensorError} onRefresh={refreshSensor} onConnect={connectSensor} onDisconnect={disconnectSensor}/><div className="sensor-data-note"><Info size={15}/><span><b>Storage environment is part of the assessment.</b> {storageEnvironment?.connected?`Temperature ${storageEnvironment.temperature_c}°C and humidity ${storageEnvironment.humidity_pct}% are connected via ${storageEnvironment.connection_type||'sensor'}.`:'Connect the storage sensor to add live temperature and humidity evidence.'}</span></div>
   <CameraCV kind="feed" demoImages={[{label:'Green forage sample',src:'/demo-samples/green-forage.jpg'},{label:'Visible mould-like silage sample',src:'/demo-samples/silage-mold.jpg'}]} onReady={({image,cv})=>{setCvResult({image,cv});setStage('nir')}} onBack={()=>setStage('home')}/>
   <div className="camera-help global-capture-help"><Camera size={15}/><span>Capture tip: keep the sample about <b>25–40 cm</b> from the camera, fill most of the frame, and avoid strong backlight. This is a guidance range, not a measured distance.</span></div>
   <div className="test-layout">
     <div className="info-card"><div className="card-head"><div><span className="eyebrow">WHAT WE USE</span><h3>All supplied evidence, clearly separated</h3></div><FlaskConical size={24}/></div>
       <div className="step"><span>1</span><div><b>Camera visual screening</b><p>Checks image usability and visible colour/texture indicators. It does not measure NIR or toxins.</p></div></div>
       <div className="step"><span>2</span><div><b>Supplied NIR reference dataset</b><p>Uses the available feed spectra to screen IVOMD, IVDMD, NDF and ADF.</p></div></div>
       <div className="step"><span>3</span><div><b>Rule-based assessment</b><p>Combines available evidence into a status and concrete next actions.</p></div></div>
       <div className="step"><span>4</span><div><b>Gemini explanation</b><p>When configured, Gemini rewrites only the rule-engine result in simple farmer language.</p></div></div>
       <div className="note"><Info size={17}/><span>Phone camera and NIR are separate evidence layers. No claim is made that the phone camera measures NIR or confirms aflatoxin/mycotoxin.</span></div>
     </div>
     <div className="capture-card compact-demo"><span className="eyebrow">SUPPLIED NIR DATA</span><h3>Choose any sample from the dataset</h3><p className="muted">All <b>{samples.length}</b> supplied reference samples are available here — not just a small subset.</p>
       <select value={sampleId} onChange={e=>setSampleId(+e.target.value)}>{samples.map(s=><option key={s.sample} value={s.sample}>NIR sample #{s.sample} · NDF {Number(s.ndf).toFixed(1)}%</option>)}</select>
       <div className="sample-info"><span><b>IVOMD</b>{Number(sample.ivomd).toFixed(1)}%</span><span><b>IVDMD</b>{Number(sample.ivdmd).toFixed(1)}%</span><span><b>ADF</b>{Number(sample.adf).toFixed(1)}%</span></div>
       <button className="secondary full" disabled={!cvResult?.image} onClick={()=>{if(!cvResult?.image)return;setStage('nir')}}>{cvResult?.image?'Use selected NIR sample':'First capture or upload a photo above'}</button>
     </div>
   </div>
 </Shell>;

 if(stage==='nir')return <Shell role="farmer" active="test" onNavigate={farmerNavigate} lang={lang} setLang={setLang} settings={settings} setSettings={setSettings}>
   <PageTitle eyebrow="STEP 2 · NIR + EVIDENCE" title="Analyse your sample" sub="Photo received → NIR reference model → rule engine → advisory." action={<button className="secondary" onClick={()=>setStage('test')}><ArrowLeft size={18}/> Back</button>}/>
   <div className="nir-run"><div className="spectrum-mini"><div className="scan-line-anim"/><Activity size={38}/></div><h2>NIR spectral analysis</h2><p>Using supplied reference sample #{sample.sample} to predict IVOMD, IVDMD, NDF and ADF.</p><div className="progress"><span/></div><div className="analysis-steps"><span className="done">✓ Photo captured</span><span className="done">✓ Visual screening complete</span><span className="live">● NIR + combined evidence</span><span>○ Farmer advisory</span></div><button className="primary" onClick={run} disabled={analysis}>{analysis?<><RefreshCw className="spin"/> Analysing…</>:<>Run complete analysis <ArrowRight size={18}/></>}</button>{error&&<ErrorCard title="Could not complete the online analysis" message={error} onRetry={run}/>}</div>
 </Shell>;

 if(stage==='result')return <Result sample={sample} result={serverResult} offlineSaved={offlineSaved} listening={listening} setListening={setListening} onBack={()=>setStage('test')} onNavigate={farmerNavigate} lang={lang} setLang={setLang} settings={settings} setSettings={setSettings} profile={{species:animalSpecies,breed,production_stage:productionStage,milk_yield:milkYield}} storageEnvironment={storageEnvironment}/>;

 if(stage==='silage')return <SilageTest lang={lang} setLang={setLang} settings={settings} setSettings={setSettings} onBack={()=>setStage('home')} onNavigate={farmerNavigate} onDone={async(rec)=>{const saved={...rec,type:'silage',synced:rec.online,updated_at:new Date().toISOString()};await saveLocalTest(saved);await loadHistory();setSilageResult(saved);setStage('silage-result')}}/>;
 if(stage==='silage-result')return <SilageResult result={silageResult} lang={lang} setLang={setLang} settings={settings} setSettings={setSettings} onBack={()=>setStage('home')} onNavigate={farmerNavigate}/>;

 if(stage==='more')return <Shell role="farmer" active="more" onNavigate={farmerNavigate} lang={lang} setLang={setLang} settings={settings} setSettings={setSettings}><PageTitle eyebrow="MORE" title="Profile & settings" sub="Keep your animal profile, language and accessibility controls close at hand." action={<button className="secondary" onClick={()=>setStage('home')}><Home size={17}/> Home</button>}/><div className="two-col"><div className="panel"><div className="card-head"><div><span className="eyebrow">ANIMAL PROFILE</span><h3>Personalize the advisory</h3></div><UserRound size={22}/></div><div className="metric-input-grid"><label>Species<select value={animalSpecies} onChange={e=>setAnimalSpecies(e.target.value)}><option>Cattle</option><option>Buffalo</option></select></label><BreedField breed={breed} setBreed={setBreed}/><label>Production stage<select value={productionStage} onChange={e=>setProductionStage(e.target.value)}><option>Lactating</option><option>Dry</option><option>Heifer</option><option>Calf</option></select></label><label>Milk yield (L/day)<input value={milkYield} onChange={e=>setMilkYield(e.target.value)} inputMode="decimal"/></label></div><button className="primary full" onClick={()=>{localStorage.setItem('pashumitr-animal-profile',JSON.stringify({species:animalSpecies,breed,production_stage:productionStage,milk_yield_l_per_day:Number(milkYield)||null}));setProfileSaved(true)}}><Check size={17}/> {profileSaved?'Profile saved':'Save profile'}</button></div><div className="panel"><div className="card-head"><div><span className="eyebrow">QUICK CONTROLS</span><h3>Accessibility & theme</h3></div><Settings size={22}/></div><div className="action-grid"><button className="secondary" onClick={()=>setSettings({...settings,theme:settings.theme==='dark'?'light':'dark'})}>{settings.theme==='dark'?<Sun size={16}/>:<Moon size={16}/>} Switch {settings.theme==='dark'?'to light':'to dark'}</button><button className="secondary" onClick={()=>setSettings({...settings,font:Math.min(1.7,settings.font+.1)})}>A+ Text size</button><button className="secondary" onClick={()=>setSettings({...settings,contrast:!settings.contrast})}>High contrast {settings.contrast?'ON':'OFF'}</button><button className="secondary" onClick={()=>window.dispatchEvent(new Event('pashumitr:open-qr'))}><QrCode size={16}/> Scan / Verify</button><button className="secondary" onClick={()=>setListening(true)}><MessageCircle size={16}/> PashuMittr AI</button><button className="danger" onClick={()=>window.dispatchEvent(new Event('pashumitr:exit'))}><ArrowLeft size={16}/> Exit / role selection</button></div><p className="micro-note">If a result is Monitor or High Risk, the app gives a direct next action and can add a confirmatory-lab request.</p></div></div>{listening&&<VoiceAssistant onClose={()=>setListening(false)} context={{latest,breed,animalSpecies,productionStage,milkYield,storage_environment:storageEnvironment}} lang={lang}/>}</Shell>;

 if(stage==='history')return <Shell role="farmer" active="history" onNavigate={farmerNavigate} lang={lang} setLang={setLang} settings={settings} setSettings={setSettings}>
   <PageTitle eyebrow="HISTORY" title="Your recent tests" sub="Tap a record to reopen the result or review the advisory." action={<button className="secondary" onClick={async()=>{try{await retryFailedQueue();await loadHistory()}catch(e){setError(e.message)}}}><RefreshCw size={18}/> Sync now</button>}/>
   <div className="panel">{historyItems.length?<div className="history-list">{historyItems.map((it,i)=><button className="history-item clickable" key={it.testId||i} onClick={()=>openHistory(it)}><div className="history-icon">{it.type==='silage'?<Leaf/>:<History/>}</div><div className="history-main"><b>{it.testId}</b><span>{it.type==='silage'?`pH ${it.silage?.ph} · ${it.online===false?'Offline':'Synced'}`:`NDF ${Number(it.nir?.ndf||0).toFixed(1)} · ${it.meta?.sample_source||'Feed sample'}`}</span></div><span className={'badge '+(it.assessment?.screening_status==='High Risk'?'risk':it.assessment?.screening_status==='Monitor'?'warn':'good')}>{it.assessment?.screening_status||'Saved'}</span><ArrowRight size={18}/></button>)}</div>:<div className="empty-state"><History size={32}/><h3>Abhi koi test nahi hai.</h3><p>Start a feed or silage test to build your history.</p></div>}</div>{error&&<ErrorCard title="History sync needs attention" message={error} onRetry={loadHistory}/>}
 </Shell>;

 const latestText=latest?.assessment?.screening_status?`${latest.assessment.screening_status} — ${latest.assessment.farmer_explanation||latest.assessment.advisory||''}`:'No test yet. Start a feed or silage test.';
 return <Shell role="farmer" active="home" onNavigate={farmerNavigate} lang={lang} setLang={setLang} settings={settings} setSettings={setSettings}>
   <div className="welcome-row"><div><span className="eyebrow">FARMER HOME</span><h1>Namaste, Ramesh 👋</h1><p className="muted">Test → Understand → Hear → Act.</p></div><button className="voice-panel" onClick={()=>setListening(true)}><Mic size={22}/><span>PashuMittr AI — बोलकर पूछें</span></button></div>
   <div className="hero-action-grid"><button className="big-action green" onClick={startTest}><div className="action-icon"><TestTube2 size={30}/></div><div><b>Feed Test</b><span>Photo + supplied NIR screening</span></div><ArrowRight/></button><button className="big-action yellow" onClick={()=>setStage('silage')}><div className="action-icon"><Leaf size={30}/></div><div><b>Silage Test</b><span>pH + temperature + humidity + advisory</span></div><ArrowRight/></button></div>
   <EnvironmentSensorCard sensor={storageEnvironment} sensorLoading={sensorLoading} sensorError={sensorError} onRefresh={refreshSensor} onConnect={connectSensor} onDisconnect={disconnectSensor}/><div className="sensor-data-note"><Info size={15}/><span><b>Storage environment</b> is monitored as part of feed/silage screening. {storageEnvironment?.connected?'Live demo readings are included in the assessment.':'Connect the demo sensor before using live storage readings.'}</span></div>
   <div className="section-head"><h2>Recent result</h2><button className="text-btn" onClick={()=>setStage('history')}>View history</button></div>
   <div className="result-preview"><div className="result-left"><div className="status-icon"><Check size={22}/></div><div><span className="eyebrow">LATEST</span><h3>{latest?.testId||'No saved test yet'}</h3><p>{latestText}</p></div></div><button className="secondary" onClick={()=>latest?openHistory(latest):startTest()}>{latest?'Open':'Start test'}</button></div>
   <div className="voice-card"><div><span className="eyebrow">PASHUMITTR AI</span><h3>Ask, listen, pause, resume, act</h3><p>“इस रिजल्ट का मतलब क्या है?”</p></div><button className="primary" onClick={()=>setListening(true)}><MessageCircle size={18}/> Ask PashuMittr AI</button></div>
   {listening&&<VoiceAssistant onClose={()=>setListening(false)} context={{latest,breed,animalSpecies,productionStage,milkYield,storage_environment:storageEnvironment}} lang={lang}/>}
 </Shell>
}
function DirectDecisionCard({status='Monitor',assessment={},kind='feed',testId=null}){
 const [requested,setRequested]=useState(false),[requesting,setRequesting]=useState(false);const high=status==='High Risk',good=status==='Good';
 const title=high?'अभी उपयोग न करें':good?'स्क्रीनिंग में कोई बड़ी चिंता नहीं दिखी':'अभी इसे final safe न मानें';
 const sub=high?'इस batch को अलग रखें और confirmatory lab test के बाद ही final feeding decision लें.':good?'उपलब्ध screening signals में कोई बड़ी चिंता नहीं दिखी. यह laboratory certificate नहीं है; unusual concern या high-stakes decision में confirmatory testing करें.':'Retest करें या confirmatory lab testing कराएं, खासकर feeding decision लेने से पहले.';
 const label=high?'LAB CONFIRMATION REQUIRED':good?'SCREENING OK — NOT A LAB CERTIFICATE':'RETEST / LAB CHECK RECOMMENDED';
 const requestLab=async()=>{if(requesting||requested)return;setRequesting(true);try{await api('/lab/requests',{method:'POST',body:{test_id:testId||null,kind,status,reason:assessment?.rule_reasons||assessment?.advisory||'Confirmatory testing requested from screening result'}})}catch(_){ }finally{setRequested(true);setRequesting(false)}};
 return <div className={'decision-card '+(high?'risk':good?'good':'warn')}><div className="decision-icon">{high?<AlertTriangle size={25}/>:good?<CheckCircle2 size={25}/>:<FlaskConical size={25}/>}</div><div className="decision-copy"><span className="eyebrow">DIRECT ANSWER · {kind==='silage'?'SILAGE':'FEED'}</span><h2>{title}</h2><p>{sub}</p><div className="decision-action"><b>{label}</b>{!good&&!requested?<button className="secondary" onClick={requestLab} disabled={requesting}>{requesting?<RefreshCw size={16} className="spin"/>:<FlaskConical size={16}/>} {requesting?'Sending…':'Send to lab / confirm'}</button>:requested?<span className="lab-requested"><Check size={15}/> Lab/confirmatory request added</span>:<span className="lab-note">Use this as a screening decision, not a lab certificate.</span>}</div></div></div>
}
function CombinedEvidence({sample,cv,result,lang='English',storageEnvironment}){const assessment=result?.assessment||{};const status=assessment.screening_status||((cv?.visualRisk==='Monitor')?'Monitor':'Good');const score=assessment.evidence_score||74;const advisory=assessment.farmer_explanation||assessment.advisory||'Screening available. Use confirmatory testing for final decisions when needed.';return <div className="assessment-card"><div className="assessment-top"><div><span className="eyebrow">COMBINED SCREENING</span><h2>{status==='Good'?'Screening looks good':status==='High Risk'?'High-risk screen':'Monitor recommended'}</h2><p className="muted">Evidence combines visual screening, the supplied NIR reference model and storage environment readings.</p></div><div className={'assessment-status '+(status==='Good'?'good':status==='High Risk'?'risk':'warn')}><span>{status==='Good'?'✓':status==='High Risk'?'⚠':'!'}</span><b>{score}%</b><small>evidence score</small></div></div><div className="evidence-grid"><div className="evidence-card"><div className="evidence-icon"><Camera size={19}/></div><div><b>Visual screening</b><span>{cv?.visualRisk||'Not run'}</span></div><Check size={18}/></div><div className="evidence-card"><div className="evidence-icon"><FlaskConical size={19}/></div><div><b>NIR screening</b><span>{result?.nir?.model?.screening_only?'Reference model completed':'Not available'}</span></div><Check size={18}/></div><div className="evidence-card"><div className="evidence-icon"><Thermometer size={19}/></div><div><b>Storage environment</b><span>{Number(storageEnvironment?.temperature_c).toFixed(1)}°C · {Number(storageEnvironment?.humidity_pct).toFixed(0)}% RH</span></div><Check size={18}/></div></div><RuleAdvisory message={advisory} actions={assessment.actions||[]} lang={lang} status={status}/>{assessment.gemini?.configured&&<p className="engine-note"><ShieldCheck size={14}/> Rule engine controls status/actions. Gemini is used only to simplify the explanation when configured.</p>}<div className="scientific-note"><Info size={16}/><span>{assessment.disclaimer||'AI-assisted screening is not laboratory confirmation. Exact safety claims require validated device/lab workflows.'}</span></div></div>}

function Result({sample,result,offlineSaved,listening,setListening,onBack,onNavigate,lang,setLang,settings,setSettings,profile={},storageEnvironment}){
  const pred=result?.nir||sample;
  const status=result?.assessment?.screening_status||'Monitor';
  const advisoryText=result?.assessment?.farmer_explanation||result?.assessment?.advisory||'';
  const envForSpeech=result?.storage_environment||storageEnvironment||{}; const resultSpeech=`PashuMittr screening result. Status ${status}. Storage environment is ${Number(envForSpeech.temperature_c||0).toFixed(1)} degrees Celsius and ${Number(envForSpeech.humidity_pct||0).toFixed(0)} percent humidity. IVOMD ${Number(pred.ivomd||0).toFixed(1)} percent. IVDMD ${Number(pred.ivdmd||0).toFixed(1)} percent. NDF ${Number(pred.ndf||0).toFixed(1)} percent dry matter. ADF ${Number(pred.adf||0).toFixed(1)} percent dry matter. ${advisoryText}`;
  const context={latest:{assessment:result?.assessment||{},nir:result?.nir||{},visual:result?.visual||{},testId:result?.testId,meta:result?.meta||{},storage_environment:result?.storage_environment||storageEnvironment}, breed:profile?.breed, animalSpecies:profile?.species, productionStage:profile?.production_stage, milkYield:profile?.milk_yield};
  return <Shell role="farmer" active="test" onNavigate={onNavigate||((id)=>id==='home'&&onBack())} lang={lang} setLang={setLang} settings={settings} setSettings={setSettings}>
   <PageTitle eyebrow="RESULT · SCREENING" title="Your feed screening result" sub="Simple evidence view with clear limits on what the prototype can claim." action={<button className="secondary" onClick={onBack}><ArrowLeft size={18}/> Test again</button>}/>
   {offlineSaved&&<div className="offline-banner"><WifiOff size={18}/><div><b>Saved offline</b><span>Internet aane par sync hoga. QR verification will be available after sync.</span></div></div>}
   <div className="result-meta-strip"><span><Scale size={15}/> Weight: {result?.meta?.sample_weight_g||'—'} g</span><span><CalendarDays size={15}/> Captured: {result?.meta?.captured_at?new Date(result.meta.captured_at).toLocaleString():'—'}</span><span><CircleUserRound size={15}/> Source: {result?.meta?.sample_source||'—'}</span><span><ShieldCheck size={15}/> {result?.qr_payload?'QR generated':'QR ready'}</span><span><Camera size={15}/> {result?.meta?.photo_captured?'Photo captured':'No photo'}</span><span><UserRound size={15}/> Breed: {result?.meta?.breed||profile?.breed||'—'}</span>{result?.demo_reference&&<span><Database size={15}/> Demo ref: {result.demo_reference.sample_id}</span>}<span className="capture-guidance-pill">25–40 cm capture guide</span></div>
   <div className="result-photo-row">{result?.image&&<div className="result-photo"><img src={result.image} alt="Submitted feed sample"/><div><b>Submitted sample photo</b><span>Captured for visual screening evidence</span></div></div>}</div><div className="result-layout">
    <div className="result-main">
      <DirectDecisionCard status={status} assessment={result?.assessment||{}} kind="feed" testId={result?.testId}/><CombinedEvidence sample={sample} cv={result?.visual} result={result} lang={lang} storageEnvironment={result?.storage_environment||storageEnvironment}/>{result?.demo_reference&&<details className="panel technical-reference"><summary>Demo/reference record · {result.demo_reference.sample_id}</summary><div className="demo-reference-values"><span><b>Feed type</b>{result.demo_reference.feed_type}</span><span><b>Moisture</b>{result.demo_reference.moisture_pct == null ? '—' : `${result.demo_reference.moisture_pct}%`}</span><span><b>Protein</b>{result.demo_reference.protein_pct == null ? '—' : `${result.demo_reference.protein_pct}%`}</span><span><b>Fiber</b>{result.demo_reference.fiber_pct == null ? '—' : `${result.demo_reference.fiber_pct}%`}</span><span><b>Aflatoxin</b>{result.demo_reference.aflatoxin_ppb == null ? '—' : `${result.demo_reference.aflatoxin_ppb} ppb`}</span><span><b>Adulteration</b>{result.demo_reference.adulteration_detected}</span><span><b>Quality row</b>{result.demo_reference.quality_status}</span></div><p className="micro-note">This is a supplied demo/reference row, not an output of the camera or NIR model.</p></details>}
      {result?.nir&&<><NIRChart sample={{...sample,spectrum:sample.spectrum}}/><ResultMetrics values={result.nir}/></>}
      <MarketAlternatives status={status} lang={lang} profile={profile}/>
      <div className="result-actions"><AudioControls text={resultSpeech} lang={lang}/><button className="secondary" onClick={()=>setListening(true)}><MessageCircle size={18}/> Ask PashuMittr AI</button></div>
    </div>
    <div className="result-side">
      <TrustCard sample={sample} integrity={result?.integrity} result={result}/>
      <EnvironmentSensorCard sensor={result?.storage_environment||storageEnvironment} sensorLoading={false} onRefresh={()=>window.dispatchEvent(new Event('pashumitr:refresh-environment'))}/>
    </div>
   </div>
   {listening&&<VoiceAssistant lang={lang} context={context} onClose={()=>setListening(false)}/>}
  </Shell>
}

function ResultMetrics({values}){const metrics=[['IVOMD','In vitro organic matter digestibility',values.ivomd,'%'],['IVDMD','In vitro dry matter digestibility',values.ivdmd,'%'],['NDF','Neutral detergent fiber',values.ndf,'% DM'],['ADF','Acid detergent fiber',values.adf,'% DM']];return <div className="metric-grid">{metrics.map(([k,label,val,unit])=><div className="metric-card" key={k}><div className="metric-label">{k}<Info size={14}/></div><div className="metric-value">{Number(val).toFixed(2)} <small>{unit}</small></div><div className="metric-bar"><span style={{width:`${Math.min(100,Math.max(8,Number(val)*1.3))}%`}}/></div><div className="metric-desc">{label}</div></div>)}</div>}
function TrustCard({sample,integrity,result}){
 const [hash,setHash]=useState(integrity?.current_hash||'pending');
 const payload=result?.qr_payload||`PASHUMITTR|TEST|${result?.testId||'OFFLINE'}|HASH|${hash}`;
 useEffect(()=>{if(integrity?.current_hash){setHash(integrity.current_hash);return}if(result?.online!==false){crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({sample:sample.sample,testId:result?.testId}))).then(b=>setHash(Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('')))}},[sample,integrity,result]);
 const verified=Boolean(integrity?.verified);
 return <div className="trust-card"><div className="card-head"><div><span className="eyebrow">TRACEABILITY</span><h3>{verified?'Record verified':'QR ready'}</h3></div><QrCode size={25}/></div>
   <div className="qr-wrap"><QRCodeSVG value={payload} size={148} bgColor="#ffffff" fgColor="#31552A"/></div>
   <div className="hash-row"><LockKeyhole size={15}/><span>SHA-256</span><code>{String(hash).slice(0,18)}{String(hash).length>18?'…':''}</code></div>
   <div className="trust-actions"><button className="secondary" onClick={()=>alert('Open Scan / Verify from the top bar to verify this QR with camera or code entry.')}><QrCode size={15}/> Scan / Verify</button></div>
   <details className="technical-verification"><summary>Technical verification</summary><p>Previous hash: <code>{integrity?.previous_hash||'—'}</code></p><p>Current hash: <code>{hash}</code></p><p>Payload: <code className="wrap-code">{payload}</code></p></details>
   <p>{verified?'✓ Record verified.':'QR generated locally for this test; full integrity verification is available after online sync.'}</p>
 </div>}
function PageTitle({eyebrow,title,sub,action}){return <div className="page-title"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p className="muted">{sub}</p></div>{action}</div>}

const COOP_FALLBACK_DASHBOARD={
  farmers:5240,
  tests_today:187,
  high_risk_screens:12,
  villages_monitored:34,
  distribution:{good:18,monitor:9,high_risk:4}
};
const COOP_FALLBACK_ALERTS=[
  {id:'ALERT-001',severity:'high',title:'Sample #4 requires confirmatory testing',sub:'Possible foreign-material concern • Feed Mash • Farmer F004',status:'open',farmer:'F004',village:'Village D'},
  {id:'ALERT-002',severity:'monitor',title:'Village D fibre trend increased',sub:'Multiple screens crossed the demo monitoring threshold',status:'open',farmer:null,village:'Village D'},
  {id:'ALERT-003',severity:'info',title:'Batch FX-2026-09-14 verified',sub:'QR traceability and integrity record available',status:'open',farmer:null,village:'Village A'}
];
const COOP_FALLBACK_VILLAGES='ABCDEFGHIJKL'.split('').map((letter,i)=>({
  id:`VILLAGE-${letter}`,
  name:`Village ${letter}`,
  farmers:120+i*17,
  tests:24+i*4,
  highRisk:i%4===3?5:1+i%3,
  monitor:4+i%5,
  trend:i%3===0?'rising':'stable',
  batch:i%2===0?'FX-2026-09-14':'FX-2026-09-18'
}));
function Donut({distribution=COOP_FALLBACK_DASHBOARD.distribution}){
  const good=Number(distribution?.good||0), monitor=Number(distribution?.monitor||0), high=Number(distribution?.high_risk||distribution?.risk||0);
  const total=Math.max(1,good+monitor+high);
  const g=good/total*100, m=monitor/total*100;
  return <div className="donut-wrap">
    <div className="donut-chart" style={{background:`conic-gradient(#7EC151 0 ${g}%, #FED24F ${g}% ${g+m}%, #D64545 ${g+m}% 100%)`}}>
      <div className="donut-hole"><b>{total}</b><span>screens</span></div>
    </div>
    <div className="donut-legend">
      <span><i style={{background:'#7EC151'}}/> Good <b>{good}</b></span>
      <span><i style={{background:'#FED24F'}}/> Monitor <b>{monitor}</b></span>
      <span><i style={{background:'#D64545'}}/> High Risk <b>{high}</b></span>
    </div>
  </div>;
}
function Cooperative({active,onNavigate,lang,setLang,settings,setSettings}){
 const [view,setView]=useState(active||'overview'),[dashboard,setDashboard]=useState(null),[alerts,setAlerts]=useState([]),[villages,setVillages]=useState([]),[selectedAlert,setSelectedAlert]=useState(null),[selectedVillage,setSelectedVillage]=useState(null),[verifiedBatch,setVerifiedBatch]=useState(null),[loading,setLoading]=useState(true),[toast,setToast]=useState('');
 useEffect(()=>{(async()=>{
   setLoading(true);
   const results=await Promise.allSettled([api('/cooperative/dashboard'),api('/alerts'),api('/villages')]);
   const [d,a,v]=results;
   setDashboard(d.status==='fulfilled'?d.value:COOP_FALLBACK_DASHBOARD);
   setAlerts(a.status==='fulfilled'?a.value:COOP_FALLBACK_ALERTS);
   setVillages(v.status==='fulfilled'?v.value:COOP_FALLBACK_VILLAGES);
   const failed=results.filter(x=>x.status==='rejected');
   if(failed.length) setToast('Demo data loaded for any unavailable command-center service.');
   setLoading(false);
 })()},[view]);
 const investigate=async(a)=>{
   try{
     const r=await api(`/alerts/${a.id}/investigate`,{method:'POST',body:{}});
     setAlerts(xs=>xs.map(x=>x.id===a.id?{...x,status:'investigating'}:x));
     setSelectedAlert({...a,status:'investigating',case_id:r.case_id});
     setToast('Case opened for investigation.');
   }catch(e){
     const caseId=`CASE-${String(a.id||'ALERT').slice(-3)}`;
     setAlerts(xs=>xs.map(x=>x.id===a.id?{...x,status:'investigating'}:x));
     setSelectedAlert({...a,status:'investigating',case_id:caseId});
     setToast('Investigation opened in demo/offline mode.');
   }
 };
 const assign=async()=>{
   const caseId=selectedAlert?.case_id||`CASE-${String(selectedAlert?.id||'001').slice(-3)}`;
   try{
     await api('/officers/assign',{method:'POST',body:{case_id:caseId,officer_id:'OFF-01',alert_id:selectedAlert?.id}});
     setToast('Field officer assigned.');
   }catch(e){
     setToast('Field officer assignment recorded in demo/offline mode.');
   }
 };
 const exportReport=()=>{const rows=[['Village','Farmers','Tests','High Risk','Monitor','Trend'],...villages.map(v=>[v.name,v.farmers,v.tests,v.highRisk,v.monitor,v.trend])];const blob=new Blob([rows.map(r=>r.join(',')).join('\\n')],{type:'text/csv'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='pashumitr-cooperative-report.csv';a.click();URL.revokeObjectURL(url)};
 return <Shell role="cooperative" active={view} onNavigate={id=>setView(id)} lang={lang} setLang={setLang} settings={settings} setSettings={setSettings}>
   {toast&&<div className="toast"><Info size={16}/>{toast}<button onClick={()=>setToast('')}><X size={15}/></button></div>}
   {view==='overview'&&<><PageTitle eyebrow="COOPERATIVE COMMAND CENTER" title="Feed intelligence at a glance" sub="Live-connected demo data and action queues." action={<button className="secondary" onClick={exportReport}><Download size={18}/> Export report</button>}/>{loading?<div className="panel loading-panel"><RefreshCw className="spin"/> Loading command center…</div>:<><div className="stats-grid"><StatCard icon={Users} label="Farmers" value={dashboard?.farmers||'—'}/><StatCard icon={TestTube2} label="Tests today" value={dashboard?.tests_today||'—'}/><StatCard icon={AlertTriangle} label="High-risk screens" value={dashboard?.high_risk_screens||'—'} status="risk"/><StatCard icon={MapPinned} label="Villages monitored" value={dashboard?.villages_monitored||'—'}/></div><div className="dashboard-grid"><div className="panel wide"><div className="card-head"><div><span className="eyebrow">QUALITY DISTRIBUTION</span><h3>Screening mix</h3></div></div><Donut/></div><div className="panel"><div className="card-head"><div><span className="eyebrow">ALERTS</span><h3>Needs attention</h3></div><Bell size={21}/></div>{alerts.slice(0,3).map(a=><button className="alert-click-row" key={a.id} onClick={()=>setSelectedAlert(a)}><span className={'alert-symbol '+a.severity}>{a.severity==='high'?<AlertTriangle/>:<Info/>}</span><div><b>{a.title}</b><p>{a.sub}</p></div><ArrowRight size={17}/></button>)}</div><div className="panel wide"><div className="card-head"><div><span className="eyebrow">VILLAGE RISK</span><h3>Where should we look first?</h3></div><button className="text-btn" onClick={()=>setView('riskmap')}>Open map</button></div><div className="village-mini-grid">{villages.slice(0,8).map(v=><button key={v.id} onClick={()=>{setSelectedVillage(v);setView('riskmap')}}><MapPinned size={17}/><b>{v.name}</b><span>{v.highRisk} high-risk</span></button>)}</div></div></div></>}</>}

   {view==='farmers'&&<><PageTitle eyebrow="FARMERS" title="Farmer testing activity" sub="Click a farmer to inspect their latest status."/><div className="panel"><div className="history-list">{['F001','F002','F003','F004','F005','F006','F007','F008'].map((id,i)=><button className="history-item clickable" key={id} onClick={()=>setSelectedAlert({id:`FARMER-${id}`,title:`${id} • Village ${String.fromCharCode(65+i)}`,sub:'Open farmer detail and recent test history.',status:'review',farmer:id,village:`Village ${String.fromCharCode(65+i)}`})}><div className="history-icon"><Users/></div><div className="history-main"><b>{id} • Village {String.fromCharCode(65+i)}</b><span>Latest screen • {i===3?'Needs confirmation':'Screening complete'} • tap to inspect</span></div><span className={'badge '+(i===3?'warn':'good')}>{i===3?'Monitor':'Good'}</span><ArrowRight size={18}/></button>)}</div></div></>}

   {view==='alerts'&&<><PageTitle eyebrow="ALERTS" title="Action queue" sub="Every alert has an investigation path."/><div className="alert-list">{alerts.map(a=><button className="alert-detail-row" key={a.id} onClick={()=>setSelectedAlert(a)}><span className={'alert-symbol '+a.severity}>{a.severity==='high'?<AlertTriangle/>:a.severity==='monitor'?<Info/>:<ShieldCheck/>}</span><div><b>{a.title}</b><p>{a.sub}</p><small>Status: {a.status}</small></div><ArrowRight size={18}/></button>)}</div></>}

   {view==='riskmap'&&<><PageTitle eyebrow="RISK MAP" title="Village risk heatmap" sub="Select a village to open risk details and investigation actions."/><div className="map-card real-demo-map">{villages.map((v,i)=><button key={v.id} className={'map-pin risk-'+(v.highRisk>4?'high':v.highRisk>2?'monitor':'low')} style={{left:`${10+(i%6)*15}%`,top:`${18+Math.floor(i/6)*38}%`}} onClick={()=>setSelectedVillage(v)}><MapPinned size={17}/><span>{v.name}</span><small>{v.highRisk} risk</small></button>)}<div className="map-compass">N</div></div><div className="map-legend"><span><i className="lg good"/>Low</span><span><i className="lg warn"/>Monitor</span><span><i className="lg risk"/>High</span></div>{selectedVillage&&<div className="detail-panel"><div className="card-head"><div><span className="eyebrow">VILLAGE DETAIL</span><h3>{selectedVillage.name}</h3></div><button className="icon-btn" onClick={()=>setSelectedVillage(null)}><X/></button></div><div className="detail-stats"><span><b>{selectedVillage.farmers}</b>Farmers</span><span><b>{selectedVillage.tests}</b>Tests</span><span><b>{selectedVillage.highRisk}</b>High risk</span><span><b>{selectedVillage.monitor}</b>Monitor</span></div><p>Trend: <b>{selectedVillage.trend}</b> · Common batch: <b>{selectedVillage.batch}</b></p><button className="primary" onClick={()=>{
  const candidate=alerts.find(a=>a.village===selectedVillage.name) || {
    id:`VILLAGE-${selectedVillage.name.replace(/\s+/g,'-').toUpperCase()}`,
    severity:selectedVillage.highRisk>4?'high':'monitor',
    title:`${selectedVillage.name} investigation`,
    sub:`Review ${selectedVillage.highRisk} high-risk and ${selectedVillage.monitor} monitor screens.`,
    status:'open',
    farmer:null,
    village:selectedVillage.name
  };
  setSelectedAlert(candidate);
  setToast(`Investigation opened for ${selectedVillage.name}.`);
}}>Investigate village</button></div>}</>}

   {view==='trace'&&<><PageTitle eyebrow="TRACEABILITY" title="Verified feed batches" sub="Generate, scan and verify the actual PashuMittr QR payload."/><div className="trace-grid">{['FX-2026-09-14','FX-2026-09-16','FX-2026-09-18'].map((id,i)=><div className="trust-card" key={id}><div className="card-head"><div><span className="eyebrow">BATCH</span><h3>{id}</h3></div><QrCode/></div><div className="qr-wrap"><QRCodeSVG value={`PASHUMITTR|BATCH|${id}|DEMO|${i+1}`} size={140}/></div><span className="badge good"><Check size={13}/> Identity available</span><div className="trust-actions"><button className="secondary" onClick={()=>setView('trace')}>Refresh</button><button className="primary" onClick={async()=>{
  try{
    const result=await api('/qr/verify',{method:'POST',body:{payload:`PASHUMITTR|BATCH|${id}|DEMO|${i+1}`}});
    if(result.verified)setVerifiedBatch({id,result});setToast(result.verified?`✓ ${id} verified.`:`${id} could not be verified.`);
  }catch(e){
    setToast(`Verification service unavailable. ${id} is shown as demo identity.`);
  }
}}>Verify</button></div></div>)}</div>{verifiedBatch&&<div className="verification-success-strip"><div><b>✓ Batch verified</b><span>{verifiedBatch.id} identity matched successfully.</span></div><button className="primary" onClick={()=>{setVerifiedBatch(null);setView('overview')}}><ArrowRight size={16}/> Continue</button></div>}</>}

   {selectedAlert&&<div className="modal-backdrop" onClick={()=>setSelectedAlert(null)}><div className="modal alert-detail-modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><div className="eyebrow">CASE / ALERT</div><h3>{selectedAlert.title}</h3></div><button className="icon-btn" onClick={()=>setSelectedAlert(null)}><X/></button></div><p>{selectedAlert.sub}</p><div className="detail-stats"><span><b>{selectedAlert.farmer||'—'}</b> Farmer</span><span><b>{selectedAlert.village||'—'}</b> Village</span><span><b>{selectedAlert.status||'open'}</b> Status</span></div><div className="action-grid">{String(selectedAlert.id||'').startsWith('ALERT-')?<><button className="primary" onClick={()=>investigate(selectedAlert)}><Search size={17}/> Investigate</button><button className="secondary" onClick={assign}><UserRoundCheck size={17}/> Assign field officer</button><button className="secondary" onClick={()=>setToast('Confirmatory-testing request added to the case.') }><FlaskConical size={17}/> Request confirmatory test</button></>:<><button className="primary" onClick={()=>setToast(`Opening ${selectedAlert.farmer} test history.`)}><History size={17}/> View test history</button><button className="secondary" onClick={assign}><UserRoundCheck size={17}/> Assign field officer</button></>}<button className="secondary" onClick={()=>setSelectedAlert(null)}><ArrowLeft size={17}/> Back</button></div></div></div>}
 </Shell>
}

function SimpleRole({role,lang,setLang,settings,setSettings}){
 const expert=role==='expert'; const [view,setView]=useState(expert?'samples':'cases'),[samplesState,setSamplesState]=useState([]),[cases,setCases]=useState([]),[labRequests,setLabRequests]=useState([]),[selected,setSelected]=useState(null),[toast,setToast]=useState('');
 useEffect(()=>{(async()=>{try{if(expert){const [samplesRes,labRes]=await Promise.allSettled([api('/expert/samples'),api('/lab/requests')]);if(samplesRes.status==='fulfilled')setSamplesState(samplesRes.value);if(labRes.status==='fulfilled')setLabRequests(labRes.value)}else setCases(await api('/cases'))}catch(e){setToast(e.message)}})()},[expert]);
 const act=async(action)=>{
   if(!selected)return;
   try{
     if(expert){await api(`/expert/samples/${selected.id}/${action}`,{method:'POST',body:{}});setSamplesState(xs=>xs.map(x=>x.id===selected.id?{...x,status:action==='confirm'?'Confirmed':action==='reject'?'Rejected':'Reviewed'}:x));setToast(`Sample ${action}ed.`)}
     else{if(action==='assign')await api('/officers/assign',{method:'POST',body:{case_id:selected.case_id,officer_id:'OFF-01'}});else await api(`/cases/${selected.case_id}/status`,{method:'POST',body:{status:action==='resolve'?'Resolved':'Investigating'}});setCases(xs=>xs.map(x=>x.case_id===selected.case_id?{...x,status:action==='resolve'?'Resolved':action==='assign'?'Assigned':'Investigating'}:x));setToast('Case updated.')}
   }catch(e){setToast(e.message)}
 };
 const exportJson=()=>{const data=expert?samplesState:cases;const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`pashumitr-${expert?'lab':'officer'}-report.json`;a.click();URL.revokeObjectURL(url)};
 return <Shell role={role} active={view} onNavigate={setView} lang={lang} setLang={setLang} settings={settings} setSettings={setSettings}>
   {toast&&<div className="toast"><Info size={16}/>{toast}<button onClick={()=>setToast('')}><X size={15}/></button></div>}
   {expert&&view==='samples'&&<><PageTitle eyebrow="EXPERT / LAB" title="Confirmatory testing queue" sub="Review the screening evidence, then record the lab decision." action={<button className="secondary" onClick={exportJson}><Download size={17}/> Export queue</button>}/>{labRequests.length>0&&<div className="panel lab-request-panel"><div className="card-head"><div><span className="eyebrow">INCOMING REQUESTS</span><h3>Farmer confirmatory requests</h3></div><FlaskConical size={21}/></div>{labRequests.map(r=><div className="lab-request-row" key={r.id}><div><b>{r.id}</b><span>{r.test_id||'Offline test'} · {r.kind} · {r.status}</span></div><span className="badge warn">{r.state}</span></div>)}</div>}<div className="panel"><div className="queue-list">{samplesState.map(s=><button className="queue-row clickable" key={s.id} onClick={()=>setSelected(s)}><div className="history-icon"><FlaskConical/></div><div><b>{s.id} • Sample #{s.sample}</b><p>{s.farmer} • {s.village} • NDF {Number(s.ndf).toFixed(1)}% • ADF {Number(s.adf).toFixed(1)}%</p></div><span className={'badge '+(s.status==='Confirmed'?'good':s.status==='Needs confirmation'?'warn':'info')}>{s.status}</span><ArrowRight size={17}/></button>)}</div></div></>}
   {expert&&view==='verification'&&<><PageTitle eyebrow="VERIFICATION" title="Technical integrity checks" sub="Paste a PashuMittr QR payload or use Scan QR in the toolbar."/><div className="panel verification-workbench"><QrCode size={40}/><h3>QR verification workbench</h3><p>For farmer use, keep the UI simple. For experts, show the integrity evidence.</p><button className="primary" onClick={()=>window.dispatchEvent(new Event('pashumitr:open-qr'))}>Open Scan / Verify</button><div className="note"><LockKeyhole size={16}/><span>SHA-256 + hash-chain details are displayed after a matched test-level record.</span></div></div></>}
   {expert&&view==='reports'&&<><PageTitle eyebrow="REPORTS" title="Lab review report" sub="Export the current expert queue for the hackathon demo." action={<button className="primary" onClick={exportJson}><Download size={17}/> Download report</button>}/><div className="panel"><p>{samplesState.length} samples in the current demo queue.</p><div className="detail-stats"><span><b>{samplesState.filter(x=>x.status==='Confirmed').length}</b>Confirmed</span><span><b>{samplesState.filter(x=>x.status==='Needs confirmation').length}</b>Needs confirmation</span><span><b>{samplesState.filter(x=>x.status==='Pending').length}</b>Pending</span></div></div></>}
   {!expert&&view==='cases'&&<><PageTitle eyebrow="FIELD OFFICER" title="Assigned cases" sub="Investigate alerts, schedule visits and close cases."/><div className="panel">{cases.map(c=><button className="queue-row clickable" key={c.case_id} onClick={()=>setSelected(c)}><div className="history-icon"><ClipboardList/></div><div><b>{c.case_id} • {c.title}</b><p>{c.farmer} • {c.village}</p></div><span className={'badge '+(c.priority==='high'?'risk':'warn')}>{c.status}</span><ArrowRight size={17}/></button>)}</div></>}
   {!expert&&view==='visits'&&<><PageTitle eyebrow="VISITS" title="Field visit plan" sub="Convert an alert into an on-ground action."/><div className="panel"><div className="visit-card"><CalendarDays size={22}/><div><b>Next field visit</b><p>Village D • Confirm batch/sample • 10:30 AM</p></div><button className="primary" onClick={()=>setToast('Visit marked as scheduled.')}>Mark scheduled</button></div><div className="visit-card"><PhoneCall size={22}/><div><b>Farmer contact</b><p>Call the assigned farmer before collection.</p></div><button className="secondary" onClick={()=>setToast('Call action opened in demo mode.')}>Call</button></div></div></>}
   {!expert&&view==='alerts'&&<><PageTitle eyebrow="OFFICER ALERTS" title="Open alert cases" sub="Tap an alert to investigate or resolve."/><div className="alert-list">{cases.map(c=><button className="alert-detail-row" key={c.case_id} onClick={()=>setSelected(c)}><span className="alert-symbol risk"><AlertTriangle/></span><div><b>{c.title}</b><p>{c.farmer} • {c.village}</p></div><ArrowRight size={18}/></button>)}</div></>}
   {selected&&<div className="modal-backdrop" onClick={()=>setSelected(null)}><div className="modal role-detail" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><div className="eyebrow">{expert?'LAB SAMPLE':'FIELD CASE'}</div><h3>{expert?selected.id:selected.case_id}</h3></div><button className="icon-btn" onClick={()=>setSelected(null)}><X/></button></div>{expert?<><p>{selected.farmer} • {selected.village}</p><div className="detail-stats"><span><b>{Number(selected.ivomd).toFixed(1)}%</b>IVOMD</span><span><b>{Number(selected.ivdmd).toFixed(1)}%</b>IVDMD</span><span><b>{Number(selected.ndf).toFixed(1)}%</b>NDF</span><span><b>{Number(selected.adf).toFixed(1)}%</b>ADF</span></div><div className="action-grid"><button className="primary" onClick={()=>act('review')}>Review evidence</button><button className="primary" onClick={()=>act('confirm')}><CheckCircle2 size={17}/> Confirm</button><button className="danger" onClick={()=>act('reject')}><XCircle size={17}/> Reject</button><button className="secondary" onClick={()=>setSelected(null)}>Back</button></div></>:<><p>{selected.title}</p><div className="detail-stats"><span><b>{selected.farmer}</b>Farmer</span><span><b>{selected.village}</b>Village</span><span><b>{selected.status}</b>Status</span></div><div className="action-grid"><button className="primary" onClick={()=>act('assign')}><UserRoundCheck size={17}/> Assign myself</button><button className="secondary" onClick={()=>act('investigate')}>Investigating</button><button className="primary" onClick={()=>act('resolve')}><CheckCircle2 size={17}/> Mark resolved</button><button className="secondary" onClick={()=>setSelected(null)}>Back</button></div></>}</div></div>}
 </Shell>
}

class AppErrorBoundary extends React.Component{
 constructor(props){super(props);this.state={hasError:false,message:''};}
 static getDerivedStateFromError(error){return {hasError:true,message:error?.message||'Unexpected screen error.'};}
 render(){
   if(this.state.hasError) return <div className="auth-page"><div className="auth-center"><div className="auth-card"><Logo compact/><div className="eyebrow">RECOVERABLE ERROR</div><h2>Something went wrong</h2><p className="muted">{this.state.message}</p><button className="primary" onClick={()=>window.location.reload()}>Reload PashuMittr</button></div></div></div>;
   return this.props.children;
 }
}

function App(){
 const [lang,setLang]=useState(localStorage.getItem('pashumitr-lang')||'English');
 useEffect(()=>{const stop=installLocaleBridge(lang); document.documentElement.lang=localeCode(lang); localStorage.setItem('pashumitr-lang',lang); return stop},[lang]);
 const [screen,setScreen]=useState('auth');
 const [role,setRole]=useState(null);
 const [settings,setSettings]=useState({font:1,contrast:false,motion:false,voice:true,theme:localStorage.getItem('pashumitr-theme')||'light'});
 const [tutorialOpen,setTutorialOpen]=useState(()=>localStorage.getItem('pashumitr-onboarding-seen')!=='1');
 useEffect(()=>localStorage.setItem('pashumitr-lang',lang),[lang]);
 useEffect(()=>{
   document.documentElement.style.fontSize=(16*settings.font)+'px';
   document.body.classList.toggle('high-contrast',settings.contrast);
   document.body.classList.toggle('reduce-motion',settings.motion);
   document.body.classList.toggle('dark-theme',settings.theme==='dark');
   localStorage.setItem('pashumitr-theme',settings.theme);
 },[settings]);
 useEffect(()=>{
   flushQueue().catch(()=>{});
   const on=()=>flushQueue().catch(()=>{});
   window.addEventListener('online',on);
   return()=>window.removeEventListener('online',on)
 },[]);
 useEffect(()=>{
   if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(()=>{})}
 },[]);
 useEffect(()=>{
   const open=()=>setTutorialOpen(true);
   window.addEventListener('pashumitr:open-tutorial',open);
   return()=>window.removeEventListener('pashumitr:open-tutorial',open);
 },[]);
 useEffect(()=>{
   const exit=()=>{setRole(null);setScreen('auth')};
   window.addEventListener('pashumitr:exit',exit);
   return()=>window.removeEventListener('pashumitr:exit',exit)
 },[]);
 const enter=async(r,phone,otp,isSignup)=>{
   try{
     const result=await api('/auth/login',{method:'POST',body:{phone,role:r,otp,mode:isSignup?'signup':'login'}});
     localStorage.setItem('pashumitr-auth-token',result.token);
     localStorage.setItem('pashumitr-user',JSON.stringify(result.user));
     setRole(r);setScreen(r);
     return {ok:true};
   }catch(e){ return {error:e.message||'OTP verification failed.'}; }
 };
 let view=null;
 if(screen==='auth')view=<Auth lang={lang} setLang={setLang} onEnter={enter} settings={settings} setSettings={setSettings}/>;
 else if(screen==='farmer')view=<Farmer active="home" onNavigate={()=>{}} lang={lang} setLang={setLang} settings={settings} setSettings={setSettings}/>;
 else if(screen==='cooperative')view=<Cooperative active="overview" onNavigate={()=>{}} lang={lang} setLang={setLang} settings={settings} setSettings={setSettings}/>;
 else view=<SimpleRole role={role} lang={lang} setLang={setLang} settings={settings} setSettings={setSettings}/>;
 return <>{view}{tutorialOpen&&<TutorialModal onClose={()=>setTutorialOpen(false)}/>}</>
}
createRoot(document.getElementById('root')).render(<AppErrorBoundary><App/></AppErrorBoundary>);