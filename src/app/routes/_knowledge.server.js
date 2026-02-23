import taxonomyData from "../../data/ai/taxonomy.json";

const PROMPT_FIXUPS = [
  [/\bpainrs\b/g, "pairs"],
  [/\bpairs\b/g, "pairs"],
  [/\boneword\b/g, "one word"],
  [/\bsubsitution\b/g, "substitution"],
  [/\bsubstituion\b/g, "substitution"],
  [/\bquizz\b/g, "quiz"],
  [/\bbiggen\b/g, "begin"],
  [/\bcatagory\b/g, "category"],
  [/\bcatagories\b/g, "categories"],
];

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function keywordHits(blob, keywords) {
  const text = normalize(blob);
  let hits = 0;
  for (const keyword of keywords || []) {
    const token = normalize(keyword);
    if (!token) continue;
    if (text.includes(token)) hits += 1;
  }
  return hits;
}

export function normalizePromptForMatching(prompt) {
  let value = normalize(prompt);
  for (const [pattern, replacement] of PROMPT_FIXUPS) {
    value = value.replace(pattern, replacement);
  }
  return value;
}

export function classifySubject(input = "") {
  const subjects = taxonomyData?.subjects || {};
  const blob = normalize(input);
  let bestKey = "general";
  let bestScore = 0;

  for (const [key, config] of Object.entries(subjects)) {
    const score = keywordHits(blob, config?.keywords || []);
    if (score > bestScore) {
      bestKey = key;
      bestScore = score;
    }
  }

  return {
    key: bestKey,
    score: bestScore,
    config: subjects[bestKey] || null,
  };
}

function detectFactType(entryText, fallback = "definition") {
  const text = normalize(entryText);
  if (/\b\d{3,4}\b/.test(text) && /\b(battle|war|treaty|revolution|dynasty|empire)\b/.test(text)) {
    return "historical_event";
  }
  if (/\b\d+(\.\d+)?\s*(m|cm|mm|km|kg|g|s|min|hour|n|j|w|v|a|pa|k|mol)\b/.test(text)) {
    return "unit_value";
  }
  if (/[=]/.test(text) || /\b(formula|equation|law|theorem)\b/.test(text)) {
    return "formula";
  }
  if (/\b(type|class|kind|group|category)\b/.test(text)) {
    return "classification";
  }
  return fallback;
}

export function enrichEntriesWithTaxonomy(entries = [], options = {}) {
  const prompt = normalizePromptForMatching(options.prompt || "");
  const list = Array.isArray(entries) ? entries : [];

  return list.map((entry) => {
    const term = String(entry?.term || "").trim();
    const meaning = String(entry?.meaning || "").trim();
    const subject = classifySubject(`${prompt} ${term} ${meaning}`);
    const config = subject.config || {};
    const fallbackFactType = Array.isArray(config.factTypes) && config.factTypes.length ? config.factTypes[0] : "definition";
    const factType = detectFactType(`${term} ${meaning}`, fallbackFactType);
    const quizTypes = Array.isArray(config.quizTypes) && config.quizTypes.length ? config.quizTypes : ["mcq"];

    return {
      ...entry,
      subject: subject.key,
      subjectLabel: config.label || "General",
      factType,
      quizTypes,
    };
  });
}

export function buildTaxonomyPromptContext({ message = "", terms = [], aiPrompt = "" } = {}) {
  const sampleTerms = (Array.isArray(terms) ? terms : [])
    .slice(0, 20)
    .map((item) => `${item.term || ""} ${item.meaning || ""}`)
    .join(" ");
  const combined = `${message} ${aiPrompt} ${sampleTerms}`.trim();
  const subject = classifySubject(combined);

  if (!subject?.config || subject.key === "general" || subject.score <= 0) {
    return "";
  }

  const keywords = (subject.config.keywords || []).slice(0, 8).join(", ");
  const factTypes = (subject.config.factTypes || []).join(", ");
  const quizTypes = (subject.config.quizTypes || []).join(", ");

  return `Taxonomy hints:
- Primary subject: ${subject.config.label}
- Subject keywords: ${keywords}
- Preferred fact types: ${factTypes}
- Recommended quiz types: ${quizTypes}`;
}

export function getTaxonomyData() {
  return taxonomyData;
}
