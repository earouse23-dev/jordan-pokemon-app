# Local browser OCR assets

Tesseract.js 7.0.0 and its pinned lockfile core are copied from installed packages during the build, including Apache 2.0 licenses. All runtime assets are served by Mica; no CDN runtime or photo upload. Language weights are public upstream 4.0.0_best_int distributions, not customer data. Cached browser storage contains language weights only.

- eng: https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz — SHA-256 45b4cb346724ac1774f1c36f42f182b887bcdb28ebe63e6fff90ac41f3fcff91
- deu: https://cdn.jsdelivr.net/npm/@tesseract.js-data/deu/4.0.0_best_int/deu.traineddata.gz — SHA-256 306c4280d0cbed46fbff727486bd43b92730181bae80f56941a091f363bdf28b
- jpn: https://cdn.jsdelivr.net/npm/@tesseract.js-data/jpn/4.0.0_best_int/jpn.traineddata.gz — SHA-256 2b63ebfbf1484de4a08ce53b29ef98a1c17658a93cbd38acb665d7d316d0be88
