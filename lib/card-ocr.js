import { parseLegacyPsaLabel } from "./psa-label.js";
import { GRADED_SET_CODES } from "./providers/tcgdex.js";

// Local OCR reads printed identity; it never uploads a photo or verifies a certificate.
const fold = (value) =>
  String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
// ponytail: OCR can confuse kana size/voicing marks; exact number and unique version remain required.
const japaneseText = (value) =>
  fold(value)
    .normalize("NFD")
    .replace(/[\u3099\u309a]/g, "")
    .normalize("NFC")
    .replace(/ /g, "")
    .replace(/[ァィゥェォャュョッ]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) + 1),
    );
const numberKey = (value) =>
  String(value || "")
    .toUpperCase()
    .replace(/\s/g, "")
    .split("/")
    .map((part) => part.replace(/^0+(?=\d)/, ""))
    .join("/");
export function parseCardText(text, language = "en") {
  const cleaned = String(text || "").normalize("NFKC");
  let numbers = [
    ...new Set(
      (
        cleaned.match(
          /\b(?:[A-Z]{1,4})?\d{1,4}\s*\/\s*(?:[A-Z]{1,4})?\d{1,4}\b/gi,
        ) || []
      ).map(numberKey),
    ),
  ];
  if (!numbers.length)
    numbers = [
      ...new Set(
        (cleaned.match(/#[A-Z]{0,4}\d{1,4}\b/gi) || []).map((value) =>
          numberKey(value.slice(1)),
        ),
      ),
    ];
  const grader = /\b(?:PSA|PROFESSIONAL SPORTS AUTHENTICATOR)\b/i.test(cleaned)
    ? "PSA"
    : /\b(?:BECKETT|BGS)\b/i.test(cleaned)
      ? "BGS"
      : /\bCGC\b/i.test(cleaned)
        ? "CGC"
        : "";
  const gradeMatch = grader
    ? cleaned.match(
        /\b(?:GEM\s*(?:MINT|MT)|PRISTINE|MINT|GRADE|PSA|BGS|CGC)\s*[:\-]?\s*(10|[1-9](?:\.5)?)\b/i,
      )
    : null;
  const certificates = [...new Set(cleaned.match(/\b\d{7,12}\b/g) || [])];
  return {
    certificationNumber:
      grader && certificates.length === 1 ? certificates[0] : "",
    text: cleaned,
    language,
    numbers,
    query: numbers.length === 1 ? numbers[0] : "",
    cardState: grader ? "graded" : "raw",
    grader,
    grade: gradeMatch?.[1] || "",
  };
}
function printedNameMatches(text, name) {
  const normalized = fold(text);
  const wanted = fold(name);
  if (` ${normalized} `.includes(` ${wanted} `)) return true;
  // OCR can lose one outlined glyph. Require a long whole-name stem and an
  // exact collector number; short names and ambiguous versions never auto-open.
  const stem = wanted.replace(/ (?:ex|gx|v|vmax|vstar)$/, "");
  if (stem.length < 6 || stem.includes(" ")) return false;
  return normalized.split(" ").some((word) => {
    if (Math.abs(word.length - stem.length) > 1) return false;
    let a = 0,
      b = 0,
      edits = 0;
    while (a < word.length && b < stem.length) {
      if (word[a] === stem[b]) {
        a++;
        b++;
        continue;
      }
      if (++edits > 1) return false;
      if (word.length >= stem.length) a++;
      if (stem.length >= word.length) b++;
    }
    return edits + (word.length - a) + (stem.length - b) <= 1;
  });
}
export function matchOcrCards(identity, cards) {
  const matching = cards.filter(
    (card) =>
      Boolean(card.name?.trim()) &&
      card.language === identity.language &&
      identity.numbers.some((number) =>
        number.includes("/")
          ? number === numberKey(card.number)
          : number === numberKey(card.number).split("/")[0],
      ) &&
      (identity.language === "ja"
        ? japaneseText(identity.text).includes(
            japaneseText(card.name).replace(/(?:ex|gx|vmax|vstar|v)$/, ""),
          )
        : printedNameMatches(identity.text, card.name)),
  );
  // A single name/number is not permission to guess between printings or finishes.
  return {
    cards: matching,
    exact:
      matching.length === 1 &&
      (identity.cardState === "raw" || Boolean(identity.grade)),
  };
}
let workerPromise;
let workerLanguage;
export function warmCardOcr(language = "en") {
  const languages = { en: "eng+jpn", de: "eng+deu+jpn", ja: "eng+jpn" };
  const selected = languages[language];
  if (!selected)
    return Promise.reject(
      new Error("Choose English, Japanese or German for scanning."),
    );
  if (workerPromise && workerLanguage === selected) return workerPromise;
  const previous = workerPromise;
  workerLanguage = selected;
  workerPromise = (async () => {
    if (previous)
      await previous.then((worker) => worker.terminate()).catch(() => {});
    // Tesseract is CommonJS: split browser chunks expose its API on default.
    const { createWorker } = (await import("tesseract.js")).default;
    const root = new URL("/assets/ocr/", location.origin).href;
    const worker = await createWorker(selected, 1, {
      workerPath: `${root}worker.min.js`,
      corePath: root,
      langPath: root,
      workerBlobURL: false,
      cachePath: "mica-ocr-v7",
      errorHandler: () => {},
    });
    await worker.setParameters({ tessedit_pageseg_mode: "11" });
    return worker;
  })();
  const pending = workerPromise;
  pending.catch(() => {
    if (workerPromise === pending) workerPromise = null;
  });
  return pending;
}
export async function readCardText(
  source,
  { language = "en", documentKind = "card", timeoutMs = 5000 } = {},
) {
  let timer;
  const pending = warmCardOcr(language);
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      if (workerPromise === pending) workerPromise = null;
      void pending.then((worker) => worker.terminate()).catch(() => {});
      reject(new Error("Reading took too long · try a closer photo."));
    }, timeoutMs);
  });
  try {
    return await Promise.race([read(), deadline]);
  } finally {
    clearTimeout(timer);
  }
  async function read() {
    const worker = await pending;
    const image = new Image();
    image.src = source;
    await image.decode();
    const canvas = document.createElement("canvas");
    // ponytail: fixed print regions; expand only with real-card accuracy evidence.
    const regions =
      documentKind === "slab"
        ? [
            [0, 0, 1, 0.25, "11"],
            [0, 0.25, 1, 0.13, "11"],
            [0, 0.88, 1, 0.11, "11"],
            [0, 0.25, 1, 0.13, "11"],
          ]
        : [
            [0.07, 0.025, 0.66, 0.09, "7"],
            [0.02, 0.88, 0.56, 0.108, "11"],
            [0.14, 0.945, 0.19, 0.038, "7"],
            [0.62, 0.935, 0.35, 0.048, "7"],
            [0.17, 0.03, 0.52, 0.065, "7"],
          ];
    const texts = [];
    try {
      for (let regionIndex = 0; regionIndex < regions.length; regionIndex++) {
        const [left, top, width, height, mode] = regions[regionIndex];
        if (regionIndex === regions.length - 1)
          await worker.reinitialize("jpn", 1);
        canvas.width = top > 0.7 ? 640 : 1200;
        canvas.height =
          Math.ceil(
            (image.height * height * canvas.width) / (image.width * width),
          ) + 24;
        const context = canvas.getContext("2d", { alpha: false });
        context.fillStyle = "white";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.filter = "grayscale(1)";
        context.drawImage(
          image,
          image.width * left,
          image.height * top,
          image.width * width,
          image.height * height,
          0,
          12,
          canvas.width,
          canvas.height - 24,
        );
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        // Canvas filters differ in WebKit; calculate the same luminance on every browser.
        for (let i = 0; i < pixels.data.length; i += 4)
          pixels.data[i] =
            pixels.data[i + 1] =
            pixels.data[i + 2] =
              Math.round(
                pixels.data[i] * 0.299 +
                  pixels.data[i + 1] * 0.587 +
                  pixels.data[i + 2] * 0.114,
              );
        enhanceReadingPixels(pixels.data);
        const histogram = new Uint32Array(256);
        for (let i = 0; i < pixels.data.length; i += 4)
          histogram[pixels.data[i]]++;
        let median = 0,
          sum = 0;
        while (
          median < 255 &&
          (sum += histogram[median]) < (canvas.width * canvas.height) / 2
        )
          median++;
        const lightPaper = median >= 140;
        const threshold = lightPaper ? median * 0.65 : 180;
        // Printed outlined letters: remove dark background connected to the crop
        // edges, retaining the black glyphs enclosed by their white outlines.
        for (let i = 0; i < pixels.data.length; i += 4)
          pixels.data[i] =
            pixels.data[i + 1] =
            pixels.data[i + 2] =
              pixels.data[i] < threshold ? 0 : 255;
        const queue = new Uint32Array(canvas.width * canvas.height);
        let head = 0,
          tail = 0;
        const visit = (index) => {
          if (pixels.data[index * 4] === 0) {
            pixels.data[index * 4] =
              pixels.data[index * 4 + 1] =
              pixels.data[index * 4 + 2] =
                255;
            queue[tail++] = index;
          }
        };
        if (!lightPaper) {
          for (let x = 0; x < canvas.width; x++) {
            visit(12 * canvas.width + x);
            visit((canvas.height - 13) * canvas.width + x);
          }
          for (let y = 12; y < canvas.height - 12; y++) {
            visit(y * canvas.width);
            visit(y * canvas.width + canvas.width - 1);
          }
          while (head < tail) {
            const index = queue[head++];
            if (index % canvas.width) visit(index - 1);
            if (index % canvas.width < canvas.width - 1) visit(index + 1);
            if (index >= canvas.width) visit(index - canvas.width);
            if (index < queue.length - canvas.width)
              visit(index + canvas.width);
          }
        }
        context.putImageData(pixels, 0, 0);
        await worker.setParameters({ tessedit_pageseg_mode: mode });
        const { data } = await worker.recognize(canvas);
        texts.push(data.text);
      }
      const nameText =
        texts[documentKind === "slab" ? 1 : 0] + " " + texts.at(-1);
      const japaneseName =
        /[\p{Script=Katakana}ー]{3,}|\p{Script=Hiragana}{4,}|\p{Script=Han}{2,}/u.test(
          nameText.replace(/\s/g, ""),
        );
      const detectedLanguage = japaneseName
        ? "ja"
        : language === "ja"
          ? "en"
          : language;
      const identity = parseCardText(texts.join("\n"), detectedLanguage);
      if (documentKind === "slab") identity.cardState = "graded";
      return identity;
    } finally {
      canvas.width = canvas.height = 0;
      image.src = "";
      if (workerPromise === pending) workerPromise = null;
      await worker.terminate();
    }
  }
}

// Contrast/brightness adjustment is confined to the temporary OCR copy.
export function enhanceReadingPixels(data) {
  const histogram = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) histogram[data[i]]++;
  const count = data.length / 4;
  let sum = 0,
    low = 0,
    high = 255;
  for (let n = 0; n < 256; n++) {
    sum += histogram[n];
    if (sum >= count * 0.02) {
      low = n;
      break;
    }
  }
  sum = 0;
  for (let n = 255; n >= 0; n--) {
    sum += histogram[n];
    if (sum >= count * 0.02) {
      high = n;
      break;
    }
  }
  if (high - low < 20) return; // Do not amplify an unreadable/flat frame.
  const gain = Math.min(2.5, 255 / (high - low));
  for (let i = 0; i < data.length; i += 4)
    data[i] =
      data[i + 1] =
      data[i + 2] =
        Math.max(0, Math.min(255, Math.round((data[i] - low) * gain)));
}

export function packageSearchQuery(text) {
 const lines=String(text||"").normalize("NFKC").split(/\n/).map(line=>line.replace(/[^\p{L}\p{N} .:'&+\-/()#]/gu," ").replace(/\s+/g," ").trim()).map(line=>line.replace(/^pok[eé]mon\s*/i,"")) .filter(line=>line.length>2 && !/^(?:trading card game|scarlet\s*(?:and|&)\s*violet$|play!|ages|warning|contains|www|copyright)/i.test(line));
 const type=lines.findIndex(line=>/\b(?:elite trainer box|booster (?:box|bundle)|collection|tin|trainingsbox)\b|トレーナー|トレーナーズ/i.test(line));
 // ponytail: printed-name search only; ambiguous packaging stays a user-selected catalog result.
 return (type>=0?lines.slice(Math.max(0,type-1),type+1):lines.slice(0,2)).join(" ").slice(0,100);
}
export async function readPackageText(source, language="en") {
 const pending=warmCardOcr(language);let timer;
 try { const result=await Promise.race([pending.then(worker=>worker.recognize(source)),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error("Package text unreadable · search the printed name.")),20000);})]); return packageSearchQuery(result.data.text); }
 finally {clearTimeout(timer);if(workerPromise===pending)workerPromise=null;void pending.then(worker=>worker.terminate()).catch(()=>{});}
}

// Only accept the complete modern PSA header. Other layouts use the existing image recognizer.
export function parseModernSlabLabel(text) {
  const lines = String(text).toUpperCase().replace(/’/g, "'").trim().split(/\r?\n/).map(line => line.trim());
  const header = /^(?:19|20)\d{2} POK[EÉ]MON ([A-Z0-9]+) EN\s+#(\d{1,3})$/.exec(lines[0]);
  const setId = header && GRADED_SET_CODES.get(header[1].toLowerCase());
  const title = /^([A-Z0-9][A-Z0-9 '.&:-]*?)[ ~]+(GEM MT|MINT)$/.exec(lines[1] || "");
  const grade = /\s(10|9)$/.exec(lines[2] || "");
  const cert = /(?:^|\D)(\d{8,10})$/.exec(lines[3] || "");
  if (lines.length !== 4 || !setId || !title || !cert || !grade ||
      (title[2] === "GEM MT" ? grade[1] !== "10" : grade[1] !== "9") ||
      /\b(?:OC|MC|ST|PD|OF|MK|QUALIFIED|AUTO|AUTOGRAPH)\b/.test(lines.join(" "))) return null;
  return { providerId: setId + "-" + header[2].padStart(3, "0"), name: title[1].trim(),
    number: header[2], grade: grade[1], certificationNumber: cert[1] };
}

// Locate the two red horizontal borders before starting an OCR worker.
export function slabLabelCrop(canvas) {
  const sample = document.createElement("canvas");
  sample.width = 240;
  sample.height = Math.round(240 * canvas.height / canvas.width);
  if (sample.height < 200 || sample.height > 620) return null;
  const ctx = sample.getContext("2d", {willReadFrequently: true});
  ctx.drawImage(canvas, 0, 0, sample.width, sample.height);
  const height = Math.floor(sample.height * 0.45);
  const pixels = ctx.getImageData(0, 0, sample.width, height).data;
  const bands = [];
  for (let y = 0; y < height; y++) {
    let left = 240, right = 0, count = 0;
    for (let x = 0; x < 240; x++) {
      const i = (y * 240 + x) * 4, r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      if (r > 105 && r > g * 1.55 && r > b * 1.4) { left = Math.min(left, x); right = x; count++; }
    }
    if (count < 85 || count < (right - left) * 0.67) continue;
    const last = bands.at(-1);
    if (last && last.end === y - 1) last.end = y;
    else bands.push({start:y, end:y, left, right});
  }
  for (let n = 1; n < bands.length; n++) {
    const top = bands[n-1], bottom = bands[n];
    const x = Math.max(top.left, bottom.left), width = Math.min(top.right, bottom.right) - x;
    const h = bottom.start - top.end;
    if (width < 100 || h < width * 0.17 || h > width * 0.32) continue;
    const crop = document.createElement("canvas"), scale = canvas.width / 240;
    crop.width = 1050; crop.height = Math.round(1050 * h / width);
    crop.getContext("2d").drawImage(canvas,(x+4)*scale,(top.end+1)*scale,(width-8)*scale,(h-1)*scale,0,0,crop.width,crop.height);
    return crop;
  }
  return null;
}

export async function readModernSlabLabel(crop) {
  const root = new URL("/assets/ocr/", location.origin).href;
  const {createWorker} = (await import("tesseract.js")).default;
  const pending = createWorker("eng", 1, {workerPath: root+"worker.min.js", corePath: root,
    langPath: root, workerBlobURL:false, cachePath:"mica-ocr-v7", errorHandler:()=>{}});
  let timer;
  try {
    return await Promise.race([pending.then(async worker => {
      await worker.setParameters({tessedit_pageseg_mode:"6"});
      const {data} = await worker.recognize(crop);
      let label = parseModernSlabLabel(data.text);
      if (!label) {
        let text = data.text.trim();
        // Small legacy labels place the set directly above the barcode. Read
        // just that line if whole-label segmentation merged the two.
        const lines = text.split(/\n+/);
        if (!parseLegacyPsaLabel(text) && lines.length === 4 && /^2008 POK[EÉ]MON JAPANESE\s+#/i.test(lines[0]) &&
            /-HOLO\s+(GEM MT|MINT)$/i.test(lines[1]) && /-1ST ED\.?\s+(10|9)$/i.test(lines[2])) {
          const readLine = async (x, y, width, height) => {
            const row = document.createElement("canvas");
            row.width = Math.round(crop.width * width);
            const h = Math.round(crop.height * height);
            row.height = h + 24;
            const ctx = row.getContext("2d");
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, row.width, row.height);
            ctx.drawImage(crop, Math.round(crop.width*x), Math.round(crop.height*y), row.width, h, 0, 12, row.width, h);
            return (await worker.recognize(row)).data.text.trim();
          };
          await worker.setParameters({tessedit_pageseg_mode:"7"});
          const setLine = await readLine(0, .49, .72, .26);
          const certLine = await readLine(.63, .74, .36, .23);
          if (!/^\d{8,10}$/.test(certLine) || lines[3].trim().split(/\s+/).at(-1) !== certLine) return null;
          lines[2] = setLine + " " + lines[2].trim().split(/\s+/).at(-1);
          lines[3] = certLine;
          text = lines.join("\n");
        }
        const legacy = parseLegacyPsaLabel(text);
        if (legacy) label = { ...legacy, legacyText: text };
      }
      if (label && globalThis.BarcodeDetector) {
        const codes = await new BarcodeDetector({formats:["code_128"]}).detect(crop).catch(() => []);
        if (codes.some(code => /^\d{8,10}$/.test(code.rawValue) && code.rawValue !== label.certificationNumber)) return null;
      }
      return label;
    }), new Promise(resolve => { timer = setTimeout(() => resolve(null), 2400); })]);
  } finally {
    clearTimeout(timer);
    void pending.then(worker => worker.terminate()).catch(() => {});
  }
}
