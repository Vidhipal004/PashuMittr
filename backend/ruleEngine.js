function numberOrNull(value){
  const n=Number(value);
  return Number.isFinite(n)?n:null;
}

function ruleBasedAssessment({visual={}, nir={}, silage={}, storage={}}={}){
  const visualRisk=visual.visualRisk || visual.risk || 'Low visual concern';
  const quality=String(visual.quality||'').toLowerCase();
  const imageGood=!quality.startsWith('retake');
  const ndf=numberOrNull(nir.ndf);
  const ph=numberOrNull(silage.ph);
  const temp=numberOrNull(silage.temperature);
  const humidity=numberOrNull(silage.humidity);
  const storageTemp=numberOrNull(storage.temperature_c ?? storage.temperature);
  const storageHumidity=numberOrNull(storage.humidity_pct ?? storage.humidity);

  const reasons=[];
  const actions=[];
  let status='Good';
  let score=90;

  if(!imageGood){ status='Monitor'; score-=15; reasons.push('Photo quality is insufficient for a strong visual screen.'); actions.push('Retake the sample photo in good light with the sample fully visible.'); }
  if(visualRisk==='High Risk'){ status='High Risk'; score-=28; reasons.push('The visual screening layer flagged a strong concern.'); actions.push('Keep the batch separate and arrange confirmatory testing before final feeding decisions.'); }
  else if(visualRisk==='Monitor'){ status='Monitor'; score-=11; reasons.push('The visual screening layer found indicators that need attention.'); actions.push('Improve handling/storage and repeat the screen or confirm the sample.'); }
  if(ndf!=null && ndf>=45){ status=status==='High Risk'?'High Risk':'Monitor'; score-=8; reasons.push('The NDF prediction is on the higher side in the supplied screening model.'); actions.push('Review ration balance with an animal-nutrition expert if this sample is representative.'); }
  if(ndf!=null && visualRisk==='Monitor' && ndf<30){ score-=5; reasons.push('Visual and NIR screening signals do not fully agree.'); actions.push('Treat this as a preliminary screen and consider confirmatory testing.'); }

  if(ph!=null && (ph<4.3 || ph>5.0)){ status=status==='High Risk'?'High Risk':'Monitor'; score-=12; reasons.push('Silage pH is outside the configured screening guidance range.'); actions.push(ph>5.0 ? 'Use confirmatory testing when pH is above 5.0, especially before feeding decisions.' : 'Review fermentation/storage conditions and retest the silage.'); }
  if(ph!=null && ph>5.0){ reasons.push('pH above 5.0 triggers confirmatory-testing guidance in this prototype.'); }
  if(String(silage.mould_risk||'').toLowerCase()==='high'){ status=status==='High Risk'?'High Risk':'Monitor'; score-=10; reasons.push('High visible mould concern was reported for the silage sample.'); actions.push('Separate the affected material and arrange confirmatory testing before feeding decisions.'); }
  if(visualRisk==='Monitor' && silage.mould_risk){ const mr=String(silage.mould_risk).toLowerCase(); if(mr==='medium'||mr==='high'){ reasons.push('Visual and reported mould indicators warrant additional checking.'); actions.push('Repeat the screen after corrective action or send a sample for confirmatory testing.'); } }
  if(temp!=null && temp>35){ status=status==='High Risk'?'High Risk':'Monitor'; score-=7; reasons.push('Silage temperature is above the configured monitoring threshold.'); actions.push('Check heating/spoilage risk and storage conditions.'); }
  if(humidity!=null && humidity>80){ status=status==='High Risk'?'High Risk':'Monitor'; score-=7; reasons.push('Storage humidity is above the configured monitoring threshold.'); actions.push('Reduce moisture exposure and improve storage ventilation/covering.'); }
  if(storageTemp!=null && storageTemp>35){ status=status==='High Risk'?'High Risk':'Monitor'; score-=7; reasons.push('Feed storage temperature is above the configured monitoring threshold.'); actions.push('Check the storage area for heating and improve ventilation/cooling where practical.'); }
  if(storageHumidity!=null && storageHumidity>80){ status=status==='High Risk'?'High Risk':'Monitor'; score-=7; reasons.push('Feed storage humidity is above the configured monitoring threshold.'); actions.push('Reduce moisture exposure and improve storage ventilation/covering.'); }

  if(storageTemp!=null || storageHumidity!=null){ reasons.push(`Storage environment reading recorded at ${storageTemp!=null?storageTemp+'°C':'—'} and ${storageHumidity!=null?storageHumidity+'% RH':'—'}.`); }
  score=Math.max(50,Math.min(96,score));
  if(!actions.length) actions.push('Keep feed clean and dry and continue routine monitoring.');
  const advisory = status==='Good'
    ? 'Screening indicators look stable. Keep the feed dry, clean and stored correctly.'
    : status==='High Risk'
      ? 'The screening shows a strong concern. Keep this batch separate and use confirmatory testing before final feeding decisions.'
      : 'Some indicators need attention. Improve storage/handling and consider confirmatory testing before final decisions.';
  const direct_decision = status==='Good'
    ? 'Screening shows no major concern; routine use may continue with normal storage practices.'
    : status==='High Risk'
      ? 'Do not use this batch for feeding until confirmatory testing is completed.'
      : 'Do not treat this screen as final safe; retest or send a sample for confirmatory testing before feeding decisions.';
  const decision_code = status==='Good' ? 'SCREENING_OK' : status==='High Risk' ? 'LAB_CONFIRMATION_REQUIRED' : 'RETEST_OR_LAB_CHECK';

  return {
    screening_status:status,
    evidence_score:Math.round(score),
    advisory,
    actions:[...new Set(actions)].slice(0,5),
    rule_reasons:[...new Set(reasons)].slice(0,6),
    confirmatory_testing_recommended: status!=='Good' || reasons.some(x=>x.includes('do not fully agree')),
    direct_decision,
    decision_code,
    evidence_conflict: reasons.some(x=>x.includes('do not fully agree')),
    storage_environment:{temperature_c:storageTemp,humidity_pct:storageHumidity,attention:(storageTemp!=null&&storageTemp>35)||(storageHumidity!=null&&storageHumidity>80)},
    engine:'rule-based-v1',
    disclaimer:'AI-assisted screening is not laboratory confirmation. Exact safety claims require validated device/lab workflows.'
  };
}

module.exports={ruleBasedAssessment};
