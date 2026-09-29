const fs = require('fs');
const { predictNIR, getDemoSample } = require('./nirModel');
const ref = JSON.parse(fs.readFileSync('./data/nir_prediction_reference.json', 'utf8'));
const tol = Number(ref.tolerance || 1e-9);
let maxDiff = 0;
for (const expected of ref.predictions) {
  const actual = predictNIR(getDemoSample(expected.sample).spectrum);
  for (const key of ['ivomd','ivdmd','ndf','adf']) {
    const diff = Math.abs(Number(actual[key]) - Number(expected[key]));
    maxDiff = Math.max(maxDiff, diff);
    if (diff > tol) {
      throw new Error(`NIR mismatch sample ${expected.sample} ${key}: ${actual[key]} vs ${expected[key]} (diff ${diff})`);
    }
  }
}
console.log(`NIR validation passed for ${ref.predictions.length} samples. maxDiff=${maxDiff}`);
