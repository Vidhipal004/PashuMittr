import {samples} from '../data/nirData';
import model from '../data/nirModel.json';

function downsampleSpectrum(spectrum){
  if(!Array.isArray(spectrum)||!spectrum.length) throw new Error('NIR spectrum is missing.');
  if(spectrum.length===model.model_wavelength_count) return spectrum.map(Number);
  if(spectrum.length===model.original_wavelength_count){
    const out=[];
    for(let i=0;i<spectrum.length;i+=model.downsample_step) out.push(Number(spectrum[i]));
    return out;
  }
  throw new Error(`Expected ${model.original_wavelength_count} or ${model.model_wavelength_count} spectral points.`);
}

// Same exported PLS equation as the Node runtime:
// (X - X_mean) @ coef.T + intercept.
export function predictNIR(sampleId){
  const target=samples.find(s=>s.sample===sampleId)||samples[0];
  const x=downsampleSpectrum(target.spectrum);
  const prediction={};
  model.targets.forEach((name,targetIndex)=>{
    let y=Number(model.intercept[targetIndex]);
    for(let featureIndex=0;featureIndex<model.model_wavelength_count;featureIndex++){
      y+=(x[featureIndex]-Number(model.x_mean[featureIndex]))*Number(model.coef[targetIndex][featureIndex]);
    }
    prediction[name.toLowerCase()]=Number(y);
  });
  return {
    ivomd:prediction.ivomd,
    ivdmd:prediction.ivdmd,
    ndf:prediction.ndf,
    adf:prediction.adf,
    model:{
      type:model.model_type,
      components:model.n_components,
      training_samples:model.training_samples,
      screening_only:true,
      offline_demo:true,
      coefficient_layout:model.coef_orientation
    }
  };
}
