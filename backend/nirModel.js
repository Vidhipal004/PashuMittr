const model = require('./data/nir_model.json');
const demo = require('./data/demo_nir_samples.json');

function downsampleSpectrum(spectrum) {
  if (!Array.isArray(spectrum) || spectrum.length === 0) {
    throw Object.assign(new Error('NIR spectrum is missing'), { code: 'NIR_SPECTRUM_MISSING', retryable: false });
  }
  if (spectrum.length === model.model_wavelength_count) return spectrum.map(Number);
  if (spectrum.length === model.original_wavelength_count) {
    const out = [];
    for (let i = 0; i < spectrum.length; i += model.downsample_step) out.push(Number(spectrum[i]));
    return out;
  }
  throw Object.assign(
    new Error(`Expected ${model.original_wavelength_count} or ${model.model_wavelength_count} spectral points`),
    { code: 'NIR_SPECTRUM_LENGTH_INVALID', retryable: false }
  );
}

function predictNIR(spectrum) {
  const x = downsampleSpectrum(spectrum);
  if (!Array.isArray(model.coef) || model.coef.length !== model.targets.length) {
    throw Object.assign(new Error('NIR model coefficient shape is invalid'), {
      code: 'NIR_MODEL_INVALID',
      retryable: false
    });
  }
  if (model.coef.some(row => !Array.isArray(row) || row.length !== model.model_wavelength_count)) {
    throw Object.assign(new Error('NIR model feature count is invalid'), {
      code: 'NIR_MODEL_INVALID',
      retryable: false
    });
  }

  // sklearn PLSRegression(scale=True) exports coefficients in targets × features
  // orientation and internally centers X before multiplying by coef_.T.
  // The exported coefficients already include the required scale adjustment,
  // so runtime prediction is: (X - x_mean) @ coef.T + intercept.
  const predictions = model.targets.map((target, targetIndex) => {
    let y = Number(model.intercept[targetIndex]);
    for (let featureIndex = 0; featureIndex < model.model_wavelength_count; featureIndex++) {
      y += (x[featureIndex] - Number(model.x_mean[featureIndex])) * Number(model.coef[targetIndex][featureIndex]);
    }
    return { key: target, value: Number(y) };
  });

  const result = {};
  for (const p of predictions) result[p.key.toLowerCase()] = p.value;
  return {
    ivomd: result.ivomd,
    ivdmd: result.ivdmd,
    ndf: result.ndf,
    adf: result.adf,
    model: {
      type: model.model_type,
      components: model.n_components,
      training_samples: model.training_samples,
      wavelengths_used: model.model_wavelength_count,
      screening_only: true,
      coefficient_layout: 'targets_x_features'
    }
  };
}

function getDemoSample(id = 1) {
  return demo.samples.find(s => s.sample === Number(id)) || demo.samples[0];
}

module.exports = { predictNIR, getDemoSample, model };
