# PashuMittr Hackathon v13

## What changed
- Kept the user-supplied five-row dummy feed table as a separate demo/reference dataset.
- Bundled the supplied NIR workbook under `backend/data/source/` for reproducibility.
- Rebuilt the PLS model from that workbook.
- **Fixed the Node runtime PLS prediction formula** to match scikit-learn `PLSRegression(scale=True)` exactly: center X using `x_mean`, then multiply by exported target-by-feature coefficients, then add `intercept`.
- Added model coefficient-layout metadata and a 25-sample prediction reference file.
- Added runtime shape validation so a corrupted model fails explicitly instead of producing misleading numbers.

## Verification
- The regenerated Node prediction path is checked against scikit-learn reference predictions for all 25 supplied samples.
- 5-fold shuffled validation metrics remain the same as documented in the model card.

## Scientific guardrails
- The five-row dummy dataset is **demo/reference data only** and is not used to train the NIR model.
- Dummy aflatoxin/adulteration values are not claimed as smartphone or NIR detections.
- NIR remains a small-data proof-of-concept screening model trained on 25 supplied samples.
- PashuMittr does not replace laboratory confirmation.

## Offline consistency
- The frontend offline NIR fallback now uses the same exported PLS coefficients and centering transform as the backend instead of echoing stored target labels as if they were predictions.

# v24 additions
- First-use walkthrough with voice narration and replay from Settings.
- Shared ErrorCard UX across camera, voice, auth, AI, history and sensor flows.
- Storage sensor demo now has Bluetooth/Wi-Fi connect, location selection, disconnect and refresh; live readings feed assessment evidence.
