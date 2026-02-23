import {
  callWithFallback,
  dedupeEntries,
  fetchWithTimeout,
  normalizeEntries,
  parseJsonLoose,
} from "./_ai.server.js";
import { enrichEntriesWithTaxonomy, normalizePromptForMatching } from "./_knowledge.server.js";

const ENV_OCR_SPACE_KEY = import.meta.env?.OCR_SPACE_KEY || process.env.OCR_SPACE_KEY || "";
const ENV_TESSERACT_PATH = import.meta.env?.TESSERACT_PATH || process.env.TESSERACT_PATH || "";
const ENV_TESSERACT_LANG = import.meta.env?.TESSERACT_LANG || process.env.TESSERACT_LANG || "eng";
const ENV_TESSERACT_TIMEOUT_MS =
  import.meta.env?.TESSERACT_TIMEOUT_MS || process.env.TESSERACT_TIMEOUT_MS || "60000";

async function getPdfParse() {
  try {
    return (await import("pdf-parse")).default;
  } catch {
    return null;
  }
}

async function getMammoth() {
  try {
    return (await import("mammoth")).default;
  } catch {
    return null;
  }
}

async function getXlsx() {
  try {
    return (await import("xlsx")).default;
  } catch {
    return null;
  }
}

function parsePageRangeInput(raw, maxPages = null) {
  const input = String(raw || "").trim();
  if (!input) return null;
  if (/^(all|all\s+pages|\*)$/i.test(input)) {
    if (Number.isFinite(maxPages) && maxPages > 0) {
      return { start: 1, end: maxPages, label: `1-${maxPages} (all pages)` };
    }
    return { start: 1, end: Number.MAX_SAFE_INTEGER, label: "all pages" };
  }

  const rangeMatch = input.match(/^(\d+)\s*[-:]\s*(\d+)$/);
  const singleMatch = input.match(/^(\d+)$/);
  let start = 1;
  let end = 1;

  if (rangeMatch) {
    start = Number.parseInt(rangeMatch[1], 10);
    end = Number.parseInt(rangeMatch[2], 10);
  } else if (singleMatch) {
    start = Number.parseInt(singleMatch[1], 10);
    end = start;
  } else {
    return null;
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end < start) {
    return null;
  }

  if (Number.isFinite(maxPages) && maxPages > 0) {
    start = Math.min(start, maxPages);
    end = Math.min(end, maxPages);
    if (start > end) return null;
  }

  return { start, end, label: `${start}-${end}` };
}

function parseBoundedInt(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function parseBoundedFloat(value, fallback, min, max) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

async function withTimeout(promise, timeoutMs, label = "operation") {
  const ms = Math.max(1, Number(timeoutMs) || 1);
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const STRICT_BY_DEFAULT_PROVIDERS = new Set(["huggingface", "supabase"]);

function shouldUseStrictPrompt(settings = {}) {
  if (Boolean(settings?.strictExtraction)) return true;
  const primary = String(settings?.primaryAI || "").trim().toLowerCase();
  if (!primary || primary === "any" || primary === "auto") return false;
  return STRICT_BY_DEFAULT_PROVIDERS.has(primary);
}

function splitIntoChunks(text, maxChars = 9000) {
  const content = String(text || "").trim();
  if (!content) return [];
  const blocks = content.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  const chunks = [];
  let current = "";

  for (const block of blocks) {
    const next = current ? `${current}\n\n${block}` : block;
    if (next.length > maxChars) {
      if (current) chunks.push(current);
      if (block.length <= maxChars) {
        current = block;
      } else {
        for (let i = 0; i < block.length; i += maxChars) {
          chunks.push(block.slice(i, i + maxChars));
        }
        current = "";
      }
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function looksLikeGarbageText(text) {
  const value = String(text || "");
  if (!value.trim()) return true;
  const letters = (value.match(/[A-Za-z]/g) || []).length;
  const printable = (value.match(/[A-Za-z0-9\s.,:;'"()\-]/g) || []).length;
  return letters < 120 || printable / Math.max(1, value.length) < 0.35;
}

function normalizeExtractedText(text) {
  return String(text || "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u00A0/g, " ")
    .replace(/\u00E2\u20AC[\u201C\u201D]/g, " - ")
    .replace(/\u00E2\u20AC\u00A2/g, " ")
    .replace(/[\u2012-\u2015]/g, " - ")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isPairFocusedPrompt(prompt) {
  const value = normalizePromptForMatching(prompt);
  if (!value) return false;
  return /(pair|pairs|matching|match the following|opposite|masculine|feminine|male|female|gender|plural|singular|antonym|synonym)/.test(
    value,
  );
}

async function callOcrSpace(buffer, fileName, apiKey, engine = "2") {
  if (!apiKey) return "";
  const form = new FormData();
  form.append("isOverlayRequired", "false");
  form.append("language", "eng");
  form.append("scale", "true");
  form.append("OCREngine", String(engine || "2"));
  form.append("file", new Blob([buffer]), fileName || "upload.pdf");

  const res = await fetchWithTimeout(
    "https://api.ocr.space/parse/image",
    {
      method: "POST",
      headers: { apikey: apiKey },
      body: form,
    },
    45000,
  );
  if (!res.ok) return "";
  const json = await res.json().catch(() => ({}));
  const parsed = Array.isArray(json?.ParsedResults)
    ? json.ParsedResults.map((row) => row?.ParsedText || "").join("\n")
    : "";
  return normalizeExtractedText(parsed);
}

async function callOcrSpaceBestEffort(buffer, fileName, apiKey) {
  let best = "";
  const engines = ["2", "1"];
  for (const engine of engines) {
    try {
      const text = await callOcrSpace(buffer, fileName, apiKey, engine);
      if (text.length > best.length) best = text;
      if (text && !looksLikeGarbageText(text) && text.length > 80) {
        return text;
      }
    } catch {}
  }
  return best;
}

let tesseractProbe = { checked: false, binary: "" };

function isLocalTesseractCandidate(fileName = "") {
  return /\.(png|jpe?g|webp|bmp|gif|tiff?|pdf)$/i.test(String(fileName || ""));
}

async function runCommand(command, args = [], timeoutMs = 15000) {
  const childProcess = await import("node:child_process");
  const spawn = childProcess?.spawn;
  if (typeof spawn !== "function") {
    throw new Error("spawn unavailable");
  }

  return await new Promise((resolve, reject) => {
    let settled = false;
    const child = spawn(command, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        child.kill("SIGKILL");
      } catch {}
      reject(new Error(`Command timed out after ${timeoutMs}ms`));
    }, Math.max(1000, Number(timeoutMs) || 15000));

    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk || "");
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk || "");
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(stderr || stdout || `Exit code ${code}`));
      }
    });
  });
}

async function resolveLocalTesseractBinary(settings = {}) {
  const explicit = String(settings?.tesseractPath || "").trim();
  if (explicit) {
    try {
      await runCommand(explicit, ["--version"], 5000);
      return explicit;
    } catch {
      return "";
    }
  }

  if (tesseractProbe.checked) {
    return tesseractProbe.binary;
  }

  const candidates = [String(ENV_TESSERACT_PATH || "").trim(), "tesseract"].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await runCommand(candidate, ["--version"], 5000);
      tesseractProbe = { checked: true, binary: candidate };
      return candidate;
    } catch {}
  }

  tesseractProbe = { checked: true, binary: "" };
  return "";
}

async function callLocalTesseract(buffer, fileName, settings = {}) {
  if (settings?.disableLocalTesseract === true) return "";
  if (!isLocalTesseractCandidate(fileName)) return "";

  const binary = await resolveLocalTesseractBinary(settings);
  if (!binary) return "";

  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const path = await import("node:path");

  const lang = String(settings?.tesseractLang || ENV_TESSERACT_LANG || "eng").trim() || "eng";
  const timeoutMs = parseBoundedInt(
    settings?.tesseractTimeoutMs ?? ENV_TESSERACT_TIMEOUT_MS,
    60000,
    5000,
    300000,
  );
  const ext = String(path.extname(fileName || "") || ".bin").toLowerCase();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "studyiq-tess-"));
  const inputPath = path.join(tempDir, `input${ext}`);
  const outputBase = path.join(tempDir, "ocr-output");

  try {
    await fs.writeFile(inputPath, Buffer.from(buffer));
    try {
      await runCommand(binary, [inputPath, outputBase, "-l", lang, "--oem", "1", "--psm", "6"], timeoutMs);
    } catch {
      // Some builds reject OEM/PSM for specific file types; retry with minimal args.
      await runCommand(binary, [inputPath, outputBase, "-l", lang], timeoutMs);
    }
    const outputPath = `${outputBase}.txt`;
    const text = await fs.readFile(outputPath, "utf8").catch(() => "");
    return normalizeExtractedText(text);
  } catch (error) {
    console.warn("Local Tesseract OCR failed:", error?.message || error);
    return "";
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function callOcrWithLocalFallback(buffer, fileName, apiKey, settings = {}) {
  const cloudText = await callOcrSpaceBestEffort(buffer, fileName, apiKey).catch(() => "");
  const normalizedCloud = normalizeExtractedText(cloudText);

  if (normalizedCloud && !looksLikeGarbageText(normalizedCloud) && normalizedCloud.length > 80) {
    return normalizedCloud;
  }

  const localText = await callLocalTesseract(buffer, fileName, settings).catch(() => "");
  if (!localText) {
    return normalizedCloud;
  }
  if (!normalizedCloud) {
    return localText;
  }
  return localText.length >= normalizedCloud.length ? localText : normalizedCloud;
}

function entryKey(entry) {
  return `${String(entry?.term || "").trim()}:::${String(entry?.meaning || "").trim()}`.toLowerCase();
}

function buildPromptTokens(prompt) {
  const stopWords = new Set([
    "extract",
    "only",
    "entries",
    "entry",
    "related",
    "term",
    "terms",
    "meaning",
    "meanings",
    "pairs",
    "pair",
    "from",
    "with",
    "that",
    "this",
    "those",
    "these",
    "about",
    "file",
    "document",
    "text",
    "data",
  ]);
  return normalizePromptForMatching(prompt)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !stopWords.has(token));
}

function evaluateEntryAgainstPrompt(entry, aiPrompt) {
  const prompt = normalizePromptForMatching(aiPrompt);
  if (!prompt) {
    return { matched: true, reason: "No prompt filter provided." };
  }

  const blob = `${entry.term} ${entry.meaning}`.toLowerCase();

  if (/one[-\s]?word\s+substitution/.test(prompt)) {
    const term = String(entry.term || "").trim();
    const words = term.split(/\s+/).filter(Boolean);
    const meaningWords = entry.meaning.split(/\s+/).filter(Boolean).length;
    const headingLike =
      /one[-\s]?word\s+substitut/i.test(term) ||
      /^(chapter|unit|lesson|exercise|worksheet|vocabulary|english)\b/i.test(term);
    const oneWordLike = words.length === 1 || (words.length === 2 && /[-\/]/.test(term));
    const matched = !headingLike && oneWordLike && meaningWords >= 2 && meaningWords <= 40;
    return {
      matched,
      reason: matched
        ? "Matched one-word substitution term length rule."
        : "Dropped: one-word substitution expects a single-word term; heading/noise removed.",
    };
  }

  if (/idiom|idioms|phrase|phrases|proverb|proverbs|expression|expressions/.test(prompt)) {
    const termWords = entry.term.split(/\s+/).filter(Boolean).length;
    const meaningWords = entry.meaning.split(/\s+/).filter(Boolean).length;
    const termNoise = /^(chapter|exercise|page|question|answer|unit|lesson)\b/i.test(entry.term.trim());
    const hasSignal = /\b(idiom|phrase|proverb|expression)\b/.test(blob);
    const matched =
      !termNoise &&
      (hasSignal || (termWords >= 2 && termWords <= 9 && meaningWords >= 2 && meaningWords <= 30));
    return {
      matched,
      reason: matched ? "Matched idiom/phrase heuristic." : "Dropped: idiom/phrase pattern not detected.",
    };
  }

  if (/phrasal\s*verb|phrasal\s*verbs/.test(prompt)) {
    const termWords = entry.term.split(/\s+/).filter(Boolean);
    const meaningWords = entry.meaning.split(/\s+/).filter(Boolean);
    const hasParticle =
      /\b(in|out|up|down|off|on|away|over|through|back|along|around|across)\b/.test(
        entry.term.toLowerCase(),
      );
    const matched =
      termWords.length >= 2 &&
      termWords.length <= 5 &&
      meaningWords.length >= 2 &&
      meaningWords.length <= 30 &&
      hasParticle;
    return {
      matched,
      reason: matched
        ? "Matched phrasal-verb heuristic."
        : "Dropped: phrasal-verb pattern not detected.",
    };
  }

  if (/noun\s*gender|masculine|feminine|gender\s*pairs?/.test(prompt)) {
    const keywordMatch = /masculine|feminine|male|female|gender/.test(blob);
    const shortPair =
      entry.term.split(/\s+/).filter(Boolean).length <= 2 &&
      entry.meaning.split(/\s+/).filter(Boolean).length <= 3;
    const matched = keywordMatch || shortPair;
    return {
      matched,
      reason: matched
        ? "Matched noun-gender heuristic."
        : "Dropped: noun-gender keywords not found.",
    };
  }

  if (/history|historical|history\s+related|events?\s+only/.test(prompt)) {
    const matched =
      /\b\d{3,4}\b/.test(blob) ||
      /battle|war|treaty|revolution|empire|dynasty|king|queen|civilization|medieval|ancient|independence|history/.test(
        blob,
      );
    return {
      matched,
      reason: matched ? "Matched history keyword/date heuristic." : "Dropped: no history signal detected.",
    };
  }

  const tokens = buildPromptTokens(prompt);
  if (!tokens.length) {
    return { matched: true, reason: "Prompt had no strict keywords after cleanup." };
  }

  const matchedTokens = tokens.filter((token) => blob.includes(token));
  return {
    matched: matchedTokens.length > 0,
    reason:
      matchedTokens.length > 0
        ? `Matched prompt token(s): ${matchedTokens.slice(0, 3).join(", ")}`
        : `Dropped: none of prompt tokens matched (${tokens.slice(0, 5).join(", ")})`,
  };
}

function applyPromptFilterWithReport(entries, aiPrompt) {
  const list = Array.isArray(entries) ? entries : [];
  const reportItems = [];
  const keptEntries = [];
  list.forEach((entry) => {
    const evaluation = evaluateEntryAgainstPrompt(entry, aiPrompt);
    reportItems.push({
      term: entry.term,
      meaning: entry.meaning,
      kept: evaluation.matched,
      reason: evaluation.reason,
    });
    if (evaluation.matched) {
      keptEntries.push(entry);
    }
  });
  return {
    entries: keptEntries,
    reportItems,
  };
}

function buildFilterReport(inputEntries, outputEntries, reportItems, source, prompt) {
  const input = Array.isArray(inputEntries) ? inputEntries : [];
  const output = Array.isArray(outputEntries) ? outputEntries : [];
  const outputKeys = new Set(output.map((item) => entryKey(item)));
  const reasonMap = new Map(
    Array.isArray(reportItems)
      ? reportItems.map((item) => [entryKey(item), item.reason])
      : [],
  );

  const items = input.map((item) => {
    const key = entryKey(item);
    const kept = outputKeys.has(key);
    return {
      term: item.term,
      meaning: item.meaning,
      kept,
      reason: reasonMap.get(key) || (kept ? "Kept by filter pipeline." : "Dropped by filter pipeline."),
    };
  });

  return {
    prompt: String(prompt || ""),
    source,
    totalInput: input.length,
    keptCount: output.length,
    droppedCount: Math.max(0, input.length - output.length),
    items: items.slice(0, 200),
  };
}

function normalizeContentProfile(settings = {}) {
  const raw = String(settings?.contentProfile || "").trim().toLowerCase();
  if (raw === "nouns_only" || raw === "chapter_unit" || raw === "all_terms") return raw;
  return "all_terms";
}

function isLikelyNounTerm(term = "", meaning = "") {
  const value = String(term || "").trim();
  const words = value.split(/\s+/).filter(Boolean);
  if (!value || words.length === 0 || words.length > 5) return false;
  if (/^to\s+/i.test(value)) return false;
  if (/\b(is|are|was|were|am|be|being|been)\b/i.test(value)) return false;
  if (/[.!?]/.test(value)) return false;

  const lower = value.toLowerCase();
  const verbish = [
    "run",
    "walk",
    "eat",
    "drink",
    "study",
    "read",
    "write",
    "learn",
    "play",
    "watch",
    "speak",
    "talk",
    "go",
    "come",
    "make",
    "do",
    "take",
    "give",
    "use",
  ];
  if (words.length === 1 && verbish.includes(lower)) return false;

  const meaningText = String(meaning || "").toLowerCase();
  const nounSignals = /\b(a|an|the)\s+[a-z]/.test(meaningText) || /\b(noun|object|person|place|thing|concept)\b/.test(meaningText);
  if (nounSignals) return true;

  // Accept compact term labels by default; quality gate still runs after this.
  return true;
}

function applyContentProfile(entries, settings = {}) {
  const profile = normalizeContentProfile(settings);
  const subject = String(settings?.profileSubject || "").trim();
  const unit = String(settings?.profileUnit || "").trim();
  const chapter = String(settings?.profileChapter || "").trim();
  const input = dedupeEntries(entries || []);
  let output = input;

  if (profile === "nouns_only") {
    output = input.filter((entry) => isLikelyNounTerm(entry?.term, entry?.meaning));
  }

  output = output.map((entry) => ({
    ...entry,
    subject: entry?.subject || subject || "",
    unit: entry?.unit || unit || "",
    chapter: entry?.chapter || chapter || "",
  }));

  return {
    entries: output,
    profile,
    context: { subject, unit, chapter },
    report: {
      totalInput: input.length,
      keptCount: output.length,
      droppedCount: Math.max(0, input.length - output.length),
    },
  };
}

function analyzeEntryQuality(entry, settings = {}) {
  const term = String(entry?.term || "").replace(/\s+/g, " ").trim();
  const meaning = String(entry?.meaning || "").replace(/\s+/g, " ").trim();
  const example = String(entry?.example || "").replace(/\s+/g, " ").trim();
  const prompt = normalizePromptForMatching(settings?.aiPrompt || "");

  if (!term || !meaning) {
    return { accepted: false, confidence: 0.05, reason: "Missing term or meaning." };
  }

  const termWords = term.split(/\s+/).filter(Boolean);
  const meaningWords = meaning.split(/\s+/).filter(Boolean);
  const termLetters = (term.match(/[A-Za-z]/g) || []).length;
  const meaningLetters = (meaning.match(/[A-Za-z]/g) || []).length;
  const termSymbolRatio = ((term.match(/[^A-Za-z0-9\s'()\-\/]/g) || []).length) / Math.max(1, term.length);
  const meaningSymbolRatio = ((meaning.match(/[^A-Za-z0-9\s.,;:'"()\-\/]/g) || []).length) / Math.max(1, meaning.length);

  let confidence = 0.6;
  const reasons = [];
  const reject = (reason, score = 0.05) => ({ accepted: false, confidence: score, reason });

  if (/^(page|chapter|unit|lesson|exercise|worksheet|index|appendix|question|answer)\b/i.test(term)) {
    return reject("Looks like section/header text, not a term.");
  }
  if (/^(page|chapter|unit|lesson|exercise|worksheet|index|appendix)\b/i.test(meaning)) {
    return reject("Meaning looks like section/header text.");
  }
  if (/^\d+([.\-]\d+)?$/.test(term)) {
    return reject("Term is numeric only.");
  }
  if (term.length < 2 || term.length > 120) {
    return reject("Term length is outside valid range.");
  }
  if (meaning.length < 2 || meaning.length > 450) {
    return reject("Meaning length is outside valid range.");
  }
  if (termWords.length > 14) {
    confidence -= 0.25;
    reasons.push("Term is unusually long.");
  }
  if (meaningWords.length > 70) {
    confidence -= 0.2;
    reasons.push("Meaning is unusually long.");
  }
  if (termLetters < 2 || meaningLetters < 2) {
    confidence -= 0.3;
    reasons.push("Very low alphabetic signal.");
  }
  if (termSymbolRatio > 0.25 || meaningSymbolRatio > 0.35) {
    confidence -= 0.25;
    reasons.push("Heavy symbol noise.");
  }
  if (/^[^A-Za-z0-9]+$/.test(term) || /^[^A-Za-z0-9]+$/.test(meaning)) {
    return reject("Contains only symbols.");
  }
  if (/\b(lorem ipsum|table of contents|copyright|all rights reserved)\b/i.test(`${term} ${meaning}`)) {
    return reject("Boilerplate text detected.");
  }
  if (example) confidence += 0.05;

  const promptTokens = prompt
    ? buildPromptTokens(prompt).filter((token) => token.length >= 3)
    : [];
  if (promptTokens.length) {
    const blob = `${term} ${meaning} ${example}`.toLowerCase();
    const matches = promptTokens.filter((token) => blob.includes(token));
    if (matches.length > 0) {
      confidence += 0.1;
      reasons.push(`Prompt-aligned tokens: ${matches.slice(0, 3).join(", ")}.`);
    } else {
      confidence -= 0.1;
      reasons.push("Weak prompt alignment.");
    }
  }

  const normalizedConfidence = parseBoundedFloat(confidence, 0.6, 0, 0.99);
  const minEntryConfidence = parseBoundedFloat(settings?.minEntryConfidence, 0.42, 0.2, 0.95);
  if (normalizedConfidence < minEntryConfidence) {
    return {
      accepted: false,
      confidence: normalizedConfidence,
      reason: reasons[0] || "Low confidence after quality checks.",
    };
  }

  return {
    accepted: true,
    confidence: normalizedConfidence,
    reason: reasons[0] || "Accepted by quality gate.",
  };
}

function applyEntryQualityGate(entries, settings = {}) {
  const accepted = [];
  const review = [];
  const sampleRejected = [];
  const input = dedupeEntries(entries || []);

  for (const item of input) {
    const term = String(item?.term || "").replace(/\s+/g, " ").trim();
    const meaning = String(item?.meaning || "").replace(/\s+/g, " ").trim();
    const example = String(item?.example || "").replace(/\s+/g, " ").trim();
    const quality = analyzeEntryQuality({ ...item, term, meaning, example }, settings);
    const shaped = {
      ...item,
      term,
      meaning,
      example,
      confidence: Number.isFinite(item?.confidence)
        ? parseBoundedFloat(item.confidence, quality.confidence, 0, 0.99)
        : quality.confidence,
    };

    if (quality.accepted) {
      accepted.push(shaped);
      continue;
    }

    const rejected = {
      ...shaped,
      reviewReason: quality.reason,
    };
    review.push(rejected);
    if (sampleRejected.length < 8) {
      sampleRejected.push({
        term: rejected.term,
        reason: rejected.reviewReason,
      });
    }
  }

  return {
    accepted: dedupeEntries(accepted),
    review,
    report: {
      totalInput: input.length,
      acceptedCount: accepted.length,
      rejectedCount: review.length,
      sampleRejected,
    },
  };
}

async function extractDocxEmbeddedImageText(buffer, fileName, settings, mammoth) {
  if (!mammoth?.images?.inline) return "";
  const ocrKey = settings?.ocrApiKey || ENV_OCR_SPACE_KEY || "helloworld";
  const maxImages = parseBoundedInt(settings?.docxOcrMaxImages, 240, 10, 400);
  const batchSize = parseBoundedInt(settings?.docxOcrBatchSize, 6, 1, 12);
  const pending = [];
  const collected = [];
  let imageCount = 0;

  await mammoth.convertToHtml(
    { buffer: Buffer.from(buffer) },
    {
      convertImage: mammoth.images.inline(async (image) => {
        imageCount += 1;
        if (imageCount > maxImages) return { src: "" };
        try {
          const base64 = await image.read("base64");
          if (!base64) return { src: "" };
          const imageBuffer = Buffer.from(base64, "base64");
          const ext = String(image.contentType || "image/png").split("/")[1] || "png";
          pending.push({
            imageBuffer,
            imageName: `${fileName || "docx"}-img-${imageCount}.${ext}`,
          });
        } catch {}
        return { src: "" };
      }),
    },
  );

  // Process OCR in bounded batches so large DOCX files do not stall on one huge serial run.
  for (let index = 0; index < pending.length; index += batchSize) {
    const batch = pending.slice(index, index + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (item) => {
        try {
          return await callOcrWithLocalFallback(item.imageBuffer, item.imageName, ocrKey, settings);
        } catch {
          return "";
        }
      }),
    );
    for (const ocrText of batchResults) {
      if (ocrText && ocrText.trim().length > 20) {
        collected.push(ocrText.trim());
      }
    }
  }

  return collected.join("\n\n").trim();
}

function extractPairsHeuristic(text) {
  const output = [];
  const source = normalizeExtractedText(text);
  if (!source.trim()) return output;
  try {
    const parsed = JSON.parse(source);
    if (Array.isArray(parsed)) {
      return normalizeEntries(parsed);
    }
  } catch {}
  const lines = source.split(/\r?\n/);
  let pendingTerm = "";
  const isNoise = (line) =>
    /^(page|chapter|note|index|appendix|figure|table)\b/i.test(line) ||
    /^\d+\s*$/.test(line) ||
    line.length < 2 ||
    line.length > 280;
  const normalizeSide = (value) =>
    String(value || "")
      .replace(/^[\s\"']+|[\s\"']+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const splitByDelim = (value) => {
    const delimiters = [" => ", " -> ", " = ", " : ", ": ", " - ", "\t"];
    for (const delim of delimiters) {
      const idx = value.indexOf(delim);
      if (idx > 0) {
        const left = normalizeSide(value.slice(0, idx));
        const right = normalizeSide(value.slice(idx + delim.length));
        if (left.length > 1 && right.length > 1) {
          return { term: left, meaning: right };
        }
      }
    }
    const compactHyphen = value.match(
      /^([A-Za-z][A-Za-z0-9'()\/ ]{0,40}?)\s*[\-]\s*([A-Za-z][A-Za-z0-9'()\/ ]{0,40})$/,
    );
    if (compactHyphen) {
      const left = normalizeSide(compactHyphen[1]);
      const right = normalizeSide(compactHyphen[2]);
      if (
        left &&
        right &&
        left.split(/\s+/).filter(Boolean).length <= 4 &&
        right.split(/\s+/).filter(Boolean).length <= 4
      ) {
        return { term: left, meaning: right };
      }
    }
    return null;
  };
  const splitCompoundPairs = (value) =>
    String(value || "")
      .split(/[;,|]/)
      .map((part) => normalizeSide(part).replace(/^(pairs?|examples?|list|terms?)\s*:\s*/i, ""))
      .filter(Boolean)
      .map((part) => splitByDelim(part))
      .filter(Boolean);
  for (const raw of lines) {
    const line = String(raw || "").trim();
    if (!line || isNoise(line)) continue;
    const exampleLine = line.match(/^(example|eg|e\.g\.)\s*[:\-]\s*(.+)$/i);
    if (exampleLine) {
      if (output.length > 0) {
        const last = output[output.length - 1];
        if (last && !last.example) {
          last.example = normalizeSide(exampleLine[2]);
        }
      }
      continue;
    }
    const meaningLine = line.match(/^(meaning|definition|def)\s*:\s*(.+)$/i);
    if (meaningLine && pendingTerm) {
      output.push({ term: pendingTerm, meaning: meaningLine[2].trim() });
      pendingTerm = "";
      continue;
    }
    if (pendingTerm) {
      const looksLikeShortTerm =
        /^[A-Za-z0-9'()\-\/\s]{1,72}$/.test(line) && line.split(/\s+/).filter(Boolean).length <= 6;
      if (!looksLikeShortTerm) {
        output.push({
          term: pendingTerm,
          meaning: normalizeSide(line.replace(/^(meaning|definition|def)\s*[:\-]\s*/i, "")),
        });
        pendingTerm = "";
        continue;
      }
    }
    const numbered = line.match(/^\d+\s*[\.\)-]\s*(.+)$/);
    if (numbered) {
      const body = numbered[1].trim();
      const compound = splitCompoundPairs(body);
      if (compound.length) {
        output.push(...compound);
        pendingTerm = "";
      } else {
        pendingTerm = normalizeSide(body);
      }
      continue;
    }
    const bullet = line.match(/^[\-\u2022\*]\s*(.+)$/);
    if (bullet) {
      const compound = splitCompoundPairs(bullet[1].trim());
      if (compound.length) {
        output.push(...compound);
        pendingTerm = "";
        continue;
      }
    }
    const tabParts = line
      .split(/\t+/)
      .map((part) => normalizeSide(part))
      .filter(Boolean);
    if (tabParts.length >= 2) {
      output.push({ term: tabParts[0], meaning: tabParts.slice(1).join(" ") });
      pendingTerm = "";
      continue;
    }
    const doubleSpaceParts = line
      .split(/\s{2,}/)
      .map((part) => normalizeSide(part))
      .filter(Boolean);
    if (doubleSpaceParts.length >= 2) {
      output.push({ term: doubleSpaceParts[0], meaning: doubleSpaceParts.slice(1).join(" ") });
      pendingTerm = "";
      continue;
    }
    const inline = splitCompoundPairs(line);
    if (inline.length) {
      output.push(...inline);
      pendingTerm = "";
      continue;
    }
    const colon = line.match(/^(.+?)\s*:\s*(.+)$/);
    if (
      colon &&
      colon[1].length > 1 &&
      colon[2].length > 2 &&
      !/^(meaning|definition|def|example)$/i.test(colon[1].trim())
    ) {
      output.push({ term: colon[1].trim(), meaning: colon[2].trim() });
      pendingTerm = "";
      continue;
    }
  }
  return dedupeEntries(output);
}

async function filterEntriesByPrompt(entries, settings = {}) {
  const cleanEntries = dedupeEntries(entries);
  const rawPrompt = String(settings?.aiPrompt || "").trim();
  const prompt = normalizePromptForMatching(rawPrompt);
  const strict = shouldUseStrictPrompt(settings);
  const oneWordPrompt = /one[-\s]?word\s+substitution/.test(prompt);
  const reportEnabled = Boolean(settings?.strictReasonReport);

  if (!prompt || !cleanEntries.length) {
    return {
      entries: cleanEntries,
      provider: "none",
      providerErrors: [],
      normalizedPrompt: prompt,
      report: reportEnabled
        ? buildFilterReport(cleanEntries, cleanEntries, [], "none", prompt)
        : null,
    };
  }

  const filterPrompt = `Filter this JSON list strictly by user instruction.

USER INSTRUCTION:
${prompt}

INPUT JSON:
${JSON.stringify(cleanEntries)}

Return ONLY JSON array with shape:
[{"term":"...","meaning":"...","example":"optional"}]
Return [] if no entry matches.`;

  const heuristic = applyPromptFilterWithReport(cleanEntries, prompt);
  const ai = await callWithFallback({ prompt: filterPrompt, settings });
  let source = "heuristic";
  let finalEntries = heuristic.entries;
  let reportItems = heuristic.reportItems;

  if (ai.text) {
    const parsed = parseJsonLoose(ai.text, []);
    const normalized = dedupeEntries(parsed);
    if (normalized.length || strict) {
      source = "ai";
      if (strict) {
        const strictAi = applyPromptFilterWithReport(normalized, prompt);
        const strictRaw = applyPromptFilterWithReport(cleanEntries, prompt);
        // Keep strict behavior, but avoid losing valid local pairs when AI over-filters.
        finalEntries = dedupeEntries([...(strictAi.entries || []), ...(strictRaw.entries || [])]);
        const mergedReport = new Map();
        [...(strictRaw.reportItems || []), ...(strictAi.reportItems || [])].forEach((item) => {
          const key = `${String(item?.term || "").trim()}:::${String(item?.meaning || "").trim()}`.toLowerCase();
          if (!key) return;
          const prev = mergedReport.get(key);
          if (!prev || item.kept) {
            mergedReport.set(key, item);
          }
        });
        reportItems = [...mergedReport.values()];
      } else {
        finalEntries = normalized;
        // Non-strict mode should not discard valid local matches when AI over-filters.
        const merged = dedupeEntries([...(heuristic.entries || []), ...finalEntries]);
        if (oneWordPrompt) {
          const oneWordResult = applyPromptFilterWithReport(merged, prompt);
          finalEntries = oneWordResult.entries;
          reportItems = oneWordResult.reportItems;
        } else {
          finalEntries = merged;
          reportItems = cleanEntries.map((entry) => {
            const kept = normalized.some((item) => entryKey(item) === entryKey(entry));
            return {
              term: entry.term,
              meaning: entry.meaning,
              kept,
              reason: kept ? "Kept by AI prompt filter." : "Dropped by AI prompt filter.",
            };
          });
        }
      }
    }
  }

  return {
    entries: finalEntries,
    provider: ai.provider || "local",
    providerErrors: Array.isArray(ai.errors) ? ai.errors : [],
    normalizedPrompt: prompt,
    report: reportEnabled
      ? buildFilterReport(cleanEntries, finalEntries, reportItems, source, prompt)
      : null,
  };
}

async function extractWithAI(text, settings = {}) {
  const chunks = splitIntoChunks(text, 9000);
  const maxChunks = parseBoundedInt(settings?.maxAiChunks, 80, 10, 120);
  const selectedChunks = (chunks.length ? chunks : [String(text || "").slice(0, 12000)]).slice(0, maxChunks);
  const promptInstruction = normalizePromptForMatching(String(settings?.aiPrompt || "").trim());
  const strictInstruction = shouldUseStrictPrompt(settings) ? promptInstruction : "";
  const strictBlock = strictInstruction
    ? `\nUSER FILTER (STRICT):\n${strictInstruction}\nOnly return pairs matching this filter.\n`
    : "";
  const focusBlock =
    !strictInstruction && promptInstruction
      ? `\nUSER FOCUS:\n${promptInstruction}\nPrefer entries related to this request; keep highly relevant pairs.\n`
      : "";
  const collected = [];
  const providersUsed = new Set();
  const providerErrors = [];

  for (let index = 0; index < selectedChunks.length; index += 1) {
    const chunk = selectedChunks[index];
    const prompt = `Extract term-meaning pairs from this document chunk.

CHUNK ${index + 1}/${selectedChunks.length}:
${chunk}

Rules:
- Ignore headers, footers, page numbers, and decorative text.
- If a usage sentence exists, place it in optional "example" (do not merge into meaning).
- Return only JSON array with objects: {"term":"...","meaning":"...","example":"optional"}.
- Return [] when no valid pair exists.
${strictBlock}${focusBlock}`;

    const ai = await callWithFallback({ prompt, settings });
    if (ai.provider) providersUsed.add(ai.provider);
    if (Array.isArray(ai.errors) && ai.errors.length) {
      providerErrors.push(...ai.errors);
    }
    if (!ai.text) continue;
    const parsed = parseJsonLoose(ai.text, []);
    if (Array.isArray(parsed) && parsed.length) {
      collected.push(...parsed);
    }
  }

  return {
    entries: dedupeEntries(collected),
    providersUsed: [...providersUsed],
    providerErrors: [...new Set(providerErrors)].slice(0, 20),
  };
}

async function parseFileToText(file, settings = {}) {
  const fileName = String(file?.name || "").toLowerCase();
  const buffer = await file.arrayBuffer();
  let text = "";
  let pageRangeApplied = null;
  const pageRangeRaw = String(settings.pageRange || "").trim();
  const ocrKey = settings?.ocrApiKey || ENV_OCR_SPACE_KEY || "helloworld";
  const pairFocusedPrompt = isPairFocusedPrompt(settings?.aiPrompt);
  const minPairsBeforeOcr = parseBoundedInt(settings?.minPairsBeforeOcr, 3, 1, 20);
  const pdfParseTimeoutMs = parseBoundedInt(settings?.pdfParseTimeoutMs, 45000, 10000, 180000);
  const imageFile = /\.(png|jpe?g|webp|bmp|gif|tiff?)$/i.test(fileName);
  const shouldTryOcrForPairs = (candidateText) => {
    if (!pairFocusedPrompt) return false;
    const pairCount = extractPairsHeuristic(candidateText).length;
    return pairCount < minPairsBeforeOcr;
  };
  if (fileName.endsWith(".pdf")) {
    const pdfParse = await getPdfParse();
    if (pdfParse) {
      try {
        const pageTexts = [];
        let pageCounter = 0;
        const parsed = await withTimeout(
          pdfParse(Buffer.from(buffer), {
            pagerender: async (pageData) => {
              pageCounter += 1;
              const textContent = await pageData.getTextContent({
                normalizeWhitespace: true,
                disableCombineTextItems: false,
              });
              const pageText = textContent.items
                .map((item) => String(item?.str || "").trim())
                .filter(Boolean)
                .join(" ");
              pageTexts.push(pageText);
              return pageText;
            },
          }),
          pdfParseTimeoutMs,
          "PDF parse",
        );
        const maxPages = parsed?.numpages || pageTexts.length || pageCounter || null;
        const wanted = parsePageRangeInput(pageRangeRaw, maxPages);
        if (wanted && pageTexts.length) {
          text = pageTexts.slice(wanted.start - 1, wanted.end).join("\n\n");
          pageRangeApplied = wanted.label;
        } else {
          text = pageTexts.length ? pageTexts.join("\n\n") : parsed?.text || "";
        }
        text = normalizeExtractedText(text);
      } catch (error) {
        console.warn("PDF parse failed, fallback decode will be used:", error?.message || error);
      }
    }
  } else if (fileName.endsWith(".docx") || fileName.endsWith(".doc")) {
    const mammoth = await getMammoth();
    if (mammoth) {
      try {
        const parsed = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
        text = normalizeExtractedText(parsed?.value || "");
      } catch (error) {
        console.warn("DOC/DOCX parse failed, fallback decode will be used:", error?.message || error);
      }
      const needsOcr =
        !text || looksLikeGarbageText(text) || text.trim().length < 120 || shouldTryOcrForPairs(text);
      if (needsOcr) {
        try {
          let ocrText = "";
          if (fileName.endsWith(".docx")) {
            ocrText = await extractDocxEmbeddedImageText(buffer, file.name || "upload.docx", settings, mammoth);
          } else {
            ocrText = await callOcrWithLocalFallback(buffer, file.name || "upload.doc", ocrKey, settings);
          }
          ocrText = normalizeExtractedText(ocrText);
          if (ocrText && (ocrText.length > text.length || shouldTryOcrForPairs(text))) {
            text = ocrText;
          }
        } catch (error) {
          console.warn("DOC/DOCX OCR fallback failed:", error?.message || error);
        }
      }
    }
  } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    const xlsx = await getXlsx();
    if (xlsx) {
      try {
        const workbook = xlsx.read(buffer, { type: "array" });
        const sheets = workbook.SheetNames.map((sheetName) =>
          xlsx.utils.sheet_to_csv(workbook.Sheets[sheetName]),
        );
        text = normalizeExtractedText(sheets.join("\n\n"));
      } catch (error) {
        console.warn("Excel parse failed, fallback decode will be used:", error?.message || error);
      }
    }
  } else if (imageFile) {
    text = await callOcrWithLocalFallback(buffer, file.name || "upload-image", ocrKey, settings).catch(
      () => "",
    );
  } else {
    text = new TextDecoder().decode(buffer);
  }
  if (!text) {
    text = new TextDecoder("utf-8", { fatal: false })
      .decode(buffer)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ");
  }
  text = normalizeExtractedText(text);
  const needsPdfOcr =
    fileName.endsWith(".pdf") &&
    (looksLikeGarbageText(text) || text.trim().length < 120 || shouldTryOcrForPairs(text));
  if (needsPdfOcr) {
    const ocrText = await callOcrWithLocalFallback(buffer, file.name || "upload.pdf", ocrKey, settings).catch(
      () => "",
    );
    if (ocrText && (ocrText.length > text.length || shouldTryOcrForPairs(text))) {
      text = ocrText;
    }
  }
  return { text: normalizeExtractedText(text), pageRangeApplied };
}

async function runExtractionPipeline(rawText, settings = {}) {
  const fullText = String(rawText || "");
  const maxPipelineChars = parseBoundedInt(settings?.maxPipelineChars, 180000, 20000, 2000000);
  const text = fullText.length > maxPipelineChars ? fullText.slice(0, maxPipelineChars) : fullText;
  const truncatedForPipeline = text.length < fullText.length;
  const parsedEntries = dedupeEntries(extractPairsHeuristic(text));
  let aiExtraction = { entries: [], providersUsed: [], providerErrors: [] };
  const requestedMode = String(settings?.extractionMode || "").toLowerCase().trim();
  const localFirst =
    requestedMode === "local_first"
      ? true
      : requestedMode === "ai_only" || requestedMode === "hybrid"
        ? false
        : settings?.localFirstPipeline !== false;
  const extractionMode =
    requestedMode === "ai_only" || requestedMode === "local_first" || requestedMode === "hybrid"
      ? requestedMode
      : localFirst
        ? "local_first"
        : "hybrid";
  const minLocalEntriesBeforeAiExtract = parseBoundedInt(
    settings?.minLocalEntriesBeforeAiExtract,
    8,
    1,
    200,
  );
  const maxCharsForAutoAiLocalFirst = parseBoundedInt(
    settings?.maxCharsForAutoAiLocalFirst,
    100000,
    20000,
    2000000,
  );
  const skipAiOnLargeLocalFirst = settings?.skipAiOnLargeLocalFirst !== false;
  const forceAiExtraction = Boolean(settings?.forceAiExtraction);
  const hasPrompt = Boolean(String(settings?.aiPrompt || "").trim());

  const shouldRunAiExtraction = (() => {
    if (forceAiExtraction) return true;
    if (extractionMode === "ai_only" || extractionMode === "hybrid") return true;
    if (extractionMode === "local_first" && !hasPrompt) return false;
    if (extractionMode === "local_first" && skipAiOnLargeLocalFirst && text.length > maxCharsForAutoAiLocalFirst) {
      return false;
    }
    return parsedEntries.length < minLocalEntriesBeforeAiExtract;
  })();

  if (shouldRunAiExtraction && (text.length > 200 || parsedEntries.length < minLocalEntriesBeforeAiExtract)) {
    aiExtraction = await extractWithAI(text, settings);
  }

  const aiEntries = dedupeEntries(aiExtraction.entries || []);
  const combined =
    extractionMode === "ai_only"
      ? aiEntries
      : extractionMode === "hybrid"
        ? dedupeEntries([...parsedEntries, ...aiEntries])
        : dedupeEntries([...parsedEntries, ...aiEntries]);
  const filteredResult = await filterEntriesByPrompt(combined, settings);
  const filtered = enrichEntriesWithTaxonomy(filteredResult.entries || [], {
    prompt: filteredResult.normalizedPrompt || settings?.aiPrompt || "",
  });
  const profiled = applyContentProfile(filtered, settings);
  const qualityGate = applyEntryQualityGate(profiled.entries, settings);
  const finalEntries = qualityGate.accepted;
  const strict = Boolean(settings.strictExtraction && String(settings.aiPrompt || "").trim());
  if (strict && finalEntries.length === 0) {
    return {
      ok: false,
      strictNoMatch: true,
      error: "Strict extraction mode: no entries matched your prompt, so nothing was saved.",
      entries: [],
      count: 0,
      usedAI: aiEntries.length > 0,
      extractionMode,
      textLength: fullText.length,
      processedTextLength: text.length,
      truncatedForPipeline,
      providersUsed: [...new Set([...(aiExtraction.providersUsed || []), filteredResult.provider].filter(Boolean))],
      providerErrors: [...new Set([...(aiExtraction.providerErrors || []), ...(filteredResult.providerErrors || [])])].slice(0, 20),
      filterReport: filteredResult.report || null,
      contentProfile: profiled.profile,
      profileContext: profiled.context,
      profileReport: profiled.report,
      qualityReport: qualityGate.report,
      reviewCount: qualityGate.review.length,
      reviewEntries: qualityGate.review.slice(0, 200),
    };
  }

  return {
    ok: true,
    entries: finalEntries,
    count: finalEntries.length,
    usedAI: aiEntries.length > 0,
    extractionMode,
    pipelineMode:
      extractionMode === "ai_only"
        ? "ai-only-filter"
        : extractionMode === "hybrid"
          ? "hybrid-filter"
          : "local-first-filter",
    textLength: fullText.length,
    processedTextLength: text.length,
    truncatedForPipeline,
    providersUsed: [...new Set([...(aiExtraction.providersUsed || []), filteredResult.provider].filter(Boolean))],
    providerErrors: [...new Set([...(aiExtraction.providerErrors || []), ...(filteredResult.providerErrors || [])])].slice(0, 20),
    filterReport: filteredResult.report || null,
    contentProfile: profiled.profile,
    profileContext: profiled.context,
    profileReport: profiled.report,
    qualityReport: qualityGate.report,
    reviewCount: qualityGate.review.length,
    reviewEntries: qualityGate.review.slice(0, 200),
  };
}

export async function action({ request }) {
  try {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await request.json();
      const text = body.text || body.message || "";
      const settings = body.settings || {};
      return runExtractionPipeline(text, settings);
    }

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!file) return { ok: false, error: "No file provided", entries: [], count: 0 };

      let settings = {};
      try {
        settings = JSON.parse(formData.get("settings") || "{}");
      } catch {
        settings = {};
      }
      if (!settings.pageRange) {
        settings.pageRange = String(formData.get("pageRange") || "").trim();
      }
      if (!settings.aiPrompt) {
        settings.aiPrompt = String(formData.get("aiPrompt") || "").trim();
      }
      const parseRequestTimeoutMs = parseBoundedInt(settings?.parseRequestTimeoutMs, 65000, 10000, 300000);
      const { text, pageRangeApplied } = await withTimeout(
        parseFileToText(file, settings),
        parseRequestTimeoutMs,
        "File parse",
      );
      const result = await withTimeout(
        runExtractionPipeline(text, settings),
        parseRequestTimeoutMs,
        "Extraction pipeline",
      );
      return { ...result, pageRangeApplied };
    }

    const textBody = await request.text();
    return runExtractionPipeline(textBody, {});
  } catch (error) {
    return {
      ok: false,
      error: "Failed to parse file",
      details: String(error?.message || error),
      entries: [],
      count: 0,
    };
  }
}


