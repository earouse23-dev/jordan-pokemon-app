// Local OCR reads printed identity; it never uploads a photo or verifies a certificate.
const fold = (value) =>
  String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
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
    certificationNumber: grader && certificates.length === 1 ? certificates[0] : "",
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
      card.language === identity.language &&
      identity.numbers.some((number) =>
        number.includes("/")
          ? number === numberKey(card.number)
          : number === numberKey(card.number).split("/")[0],
      ) &&
      (identity.language === "ja"
        ? fold(identity.text)
            .replace(/ /g, "")
            .includes(fold(card.name).replace(/ /g, ""))
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
  const languages = { en: "eng", de: "eng+deu", ja: "eng+jpn" };
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
    const { createWorker } = await import("tesseract.js");
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
          ]
        : [
            [0.07, 0.025, 0.66, 0.09, "7"],
            [0.14, 0.945, 0.19, 0.038, "7"],
            [0.62, 0.935, 0.35, 0.048, "7"],
          ];
    const texts = [];
    try {
      for (const [left, top, width, height, mode] of regions) {
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
        // Printed outlined letters: remove dark background connected to the crop
        // edges, retaining the black glyphs enclosed by their white outlines.
        for (let i = 0; i < pixels.data.length; i += 4)
          pixels.data[i] =
            pixels.data[i + 1] =
            pixels.data[i + 2] =
              pixels.data[i] < 180 ? 0 : 255;
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
          if (index < queue.length - canvas.width) visit(index + canvas.width);
        }
        context.putImageData(pixels, 0, 0);
        await worker.setParameters({ tessedit_pageseg_mode: mode });
        const { data } = await worker.recognize(canvas);
        texts.push(data.text);
      }
      const identity = parseCardText(texts.join("\n"), language);
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
