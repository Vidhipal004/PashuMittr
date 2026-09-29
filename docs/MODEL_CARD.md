# NIR Model Card — PashuMittr Demo

## Data source

The supplied workbook contains animal-feed NIR spectra with 25 usable samples and labels for:

- IVOMD
- IVDMD
- NDF
- ADF

The spectrum spans approximately 1000–2500 nm with 1557 wavelength points.

## Model

- Algorithm: PLSRegression
- Components: 2
- Runtime features: 312 wavelength points sampled every fifth input point
- Runtime equation: `(X - X_mean) @ coef.T + intercept`
- Exported coefficient layout: `targets × features`
- Runtime: Node.js using exported coefficients; no Python is required at serving time

## Small-data validation note

A 5-fold shuffled cross-validation experiment on the supplied dataset (random state 42) produced approximate MAE values of:

- IVOMD: 2.66
- IVDMD: 2.15
- NDF: 4.12
- ADF: 0.85

Approximate R² values were:

- IVOMD: 0.26
- IVDMD: 0.31
- NDF: -0.28
- ADF: -0.15

These metrics are not sufficient to represent a deployment-ready calibration. The prototype therefore labels outputs as **screening/model evidence** and not certified laboratory measurements.

## What it does not claim

- It does not validate aflatoxin/mycotoxin contamination.
- It does not validate adulteration from smartphone images.
- It does not turn a phone camera into an NIR sensor.
- It does not establish clinical/lab feeding safety.
- It does not use the separate five-row demo feed dataset for NIR training.
