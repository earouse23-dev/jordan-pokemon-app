# Mica grading engine V3

V3 is a gated evidence pipeline. It does not treat a catalog or marketplace
image as a pristine grade-10 specimen, and it does not treat a raw RGB/hex
difference as card damage.

## Runtime pipeline

1. Isolate the dominant card-shaped connected component and crop it to the
   63:88 card plane. Disconnected background marks, including table scratches,
   are excluded. Both primary sides must pass the boundary gate.
2. Read printed identity from the user's card and resolve one exact catalog
   printing. Name alone is insufficient; number, set, language, artwork, and
   variant/finish evidence participate in the match.
3. Select the best allowed design reference. TCGplayer media is preferred when
   present in the catalog, followed by other allow-listed catalog providers.
4. Send the card-only user views and exact reference through independent
   comparison reviews. The reference must be registered to the user's card
   plane before comparison.
5. Normalize exposure/white balance and exclude glare, shadows, compression,
   intentional foil/texture, and normal print variance. Raw corresponding
   pixel inequality is never itself a defect.
6. Keep a difference only when it is localized on the user's primary image,
   visibly consistent with physical damage, and independently corroborated.
   Reflective-surface findings also require the same coordinates in a second
   lighting view.
7. Classify accepted findings into centering, corners, edges, surface (the card
   face), and structural integrity. Calculate the five subgrades first; the
   weakest area limits the weighted overall visible-condition score.
8. Apply the held-out PSA calibration only after all evidence gates. If a gate
   fails, preserve the partial report and abstain from attaching a final V3
   grade.

Every report stores `gradingWorkflow` and `referenceComparison` inside the
existing `evidence_profile` JSON document. This keeps the current owner-scoped
RLS and report RPC intact without introducing a new exposed table.

## Training data contract

Training examples should be grouped by physical card ID so photos of one copy
never cross train/validation/test partitions. Each retained example needs:

- exact catalog printing and finish, plus the reference provider and rights;
- the original capture, human-reviewed card mask, four corners, and rectified
  card plane;
- capture device, resolution tier, lighting angle, glare mask, and whether the
  photo is front/back/alternate-light;
- per-defect polygon or mask, category, severity, side, and persistence across
  light;
- five expert subgrades, adjudicated overall visible-condition score, and the
  eventual professional return label when available;
- explicit negative labels for table scratches, lint, shadows, glare, foil,
  texture, print artwork, compression, scanner hue, and normal manufacturing
  variance.

The app now has an administrator-only V3 dataset factory in **PSA accuracy
program → V3 dataset**. A manifest can only be frozen after each example has:

- four retained, card-isolated captures with immutable hashes and private
  storage references;
- an exact printing and completed, registered reference comparison;
- two matching blind human annotations or an adjudication;
- a verified PSA outcome captured after the original photos;
- an immutable physical-card partition and no consent-deletion tombstone.

The frozen manifest snapshots human labels, capture metadata, V3 pipeline
evidence, PSA targets, cohorts, and hashes. Export is service-role only and
fails closed if consent deletion later quarantines any source card.

Hard-negative examples are essential. For each clean card, synthesize camera
rotation, perspective, exposure, white-balance, JPEG compression, shadows, and
table scratches outside the card mask. These augmentations may train crop and
artifact invariance, but they must not be used as synthetic positive damage.

Research consent currently retains the prepared card-only crop, not the
original room or table photograph. Geometry exports therefore emit a
deterministic `mica-geometry-composite-v1` plan that places the retained crop
onto procedural backgrounds with an analytic mask and corners. Scratches,
lint, dust, shadows, and highlights are restricted outside that mask and are
always negative examples. This supports privacy-preserving boundary training,
but it does not replace a separately consented, card-disjoint real-background
validation set.

## Model plan

- Segmentation: train a compact mask/corner model from human card masks. Score
  boundary IoU and corner error separately from defect accuracy.
- Identity: contrastive image/text retrieval over exact printings, then a
  variant verifier. Measure top-1 exact-printing accuracy and calibration.
- Registration: supervised corner/homography estimation with reprojection
  error. Comparison is disabled above the accepted error.
- Difference encoder: use paired user/reference crops with illumination and
  glare masks. Predict anomaly heatmaps, not raw RGB thresholds.
- Defect classifier: train on adjudicated masks and hard negatives. Optimize
  per-category precision first because false defects directly lower grades.
- Grade heads: predict ordered subgrade distributions. Fit the overall score
  from subgrades and severity evidence, then calibrate professional outcomes
  only on held-out real returns.

Model-specific exports deliberately remove targets that would leak answers
into training inputs. Geometry and quality exports exclude their measured
metadata from the image inputs; defect heads never receive PSA outcomes; PSA
fusion receives model evidence and cohort features, with the return label only
as its target.

## Private training operations

After the database migration is deployed and an administrator freezes a
manifest, export it inside the private training environment:

```sh
npm run export:grading-v3 -- <manifest-uuid> --output private-v3.json
npm run export:grading-v3 -- <manifest-uuid> --role corners --output private-corners-v3.json
```

The exporter creates owner-only files (`0600`) and exits with status 2 until
dataset size, partition, hard-negative, identity, capture, label, and lineage
checks pass. Never commit these exports.

Evaluate candidate predictions against a card-disjoint shadow set:

```sh
npm run evaluate:grading-v3 -- private-shadow-cases.json --output private-shadow-report.json
```

The evaluator will not report a candidate as promotion-eligible until the
coverage, MAE, within-half, within-one, false-positive-defect, minimum-case,
physical-card uniqueness, and worst-cohort gates pass. Any finish, language,
device, or era cohort with at least ten shadow cases must independently clear
its accuracy and false-defect floor; aggregate gains cannot hide a harmed
cohort.
Promotion still requires registering the trained artifact and completing the
existing shadow/champion review process; the script does not activate a model.

## Release gates

V3 should remain a visible-condition estimate until a card-disjoint held-out
set passes all of these gates:

- card-mask IoU and four-corner error by device and background cohort;
- exact-printing top-1 accuracy, including finish/variant cohorts;
- false-positive defect rate on clean cards and artifact hard negatives;
- defect localization precision/recall by category and severity;
- subgrade MAE and within-one agreement against blinded expert adjudication;
- overall grade MAE, within-one rate, calibration error, and worst-cohort
  results by era, finish, language, and device tier;
- repeatability under alternate lighting and repeated captures of one card;
- no leakage of one physical card across dataset partitions.

Do not market the catalog comparison as literal grade-10 pixel matching. A
responsible claim is: “registered, lighting-normalized design-reference
comparison with cross-view defect verification.”
