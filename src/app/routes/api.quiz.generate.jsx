import { data } from "react-router";
import {
  PROVIDERS,
  callWithFallback,
  dedupeEntries,
  normalizeEntries,
  parseJsonLoose,
} from "./_ai.server.js";
import { buildTaxonomyPromptContext, normalizePromptForMatching } from "./_knowledge.server.js";

function providerLabel(provider) {
  if (provider === PROVIDERS.GEMINI) return "Gemini";
  if (provider === PROVIDERS.XAI) return "xAI/Grok";
  if (provider === PROVIDERS.GROQ) return "Groq";
  if (provider === PROVIDERS.CLOUDFLARE) return "Cloudflare";
  if (provider === PROVIDERS.HUGGINGFACE) return "HuggingFace/Gemma";
  if (provider === PROVIDERS.SARVAM) return "Sarvam";
  if (provider === PROVIDERS.SUPABASE) return "Supabase/Gemma";
  return "Local";
}

function normalizeQuizType(raw) {
  const value = String(raw || "").toLowerCase();
  if (value === "fill_blank" || value === "fillblank" || value === "fill-in-the-blank") {
    return "fill_blank";
  }
  if (value === "match" || value === "matching" || value === "match_the_following") {
    return "match";
  }
  return "mcq";
}

function detectQuizTypeFromMessage(message, fallback = "mcq") {
  const text = String(message || "").toLowerCase();
  if (/fill\s*in|fill[-\s]?blank|blank\s+type/.test(text)) return "fill_blank";
  if (/match|matching|match\s+the\s+following/.test(text)) return "match";
  if (/mcq|multiple\s+choice|options/.test(text)) return "mcq";
  return normalizeQuizType(fallback);
}

function sanitizeCount(raw, fallback = 10) {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(500, n));
}

function extractHeuristicConfig(message, settings = {}) {
  const text = String(message || "");
  const countMatch =
    text.match(/\b(\d+)\s*(question|questions|ques|mcq|q)\b/i) ||
    text.match(/\b(\d+)\b(?:\s+\w+){0,5}\s+(question|questions|ques|mcq|q)\b/i);
  const questionCount = sanitizeCount(
    settings.questionCount ?? settings.count ?? countMatch?.[1],
    10,
  );
  const difficulty = /hard/i.test(text)
    ? "hard"
    : /easy/i.test(text)
      ? "easy"
      : settings.difficulty || "medium";
  const mode = /random/i.test(text)
    ? "random"
    : /mistake|wrong|error/i.test(text)
      ? "mistakes"
      : settings.mode || "sequential";
  const quizType = detectQuizTypeFromMessage(text, settings.quizType || "mcq");
  const rangeStart = Number.parseInt(settings.rangeStart, 10) || 1;
  const rangeEnd = Number.parseInt(settings.rangeEnd, 10) || Math.max(questionCount, rangeStart);

  return {
    questionCount,
    difficulty,
    mode,
    rangeStart,
    rangeEnd,
    quizType,
  };
}

function buildConfigPrompt(message, defaults) {
  return `You are a quiz configuration parser.
Read the request and return ONLY valid JSON.

Request:
${message}

Rules:
- Keep questionCount between 1 and 500.
- Allowed difficulty: easy, medium, hard.
- Allowed mode: sequential, random, mistakes.
- Allowed quizType: mcq, fill_blank, match.

Default JSON:
${JSON.stringify(defaults)}

Return ONLY JSON with this shape:
{"topic":"...","questionCount":10,"difficulty":"medium","mode":"random","quizType":"mcq","rangeStart":1,"rangeEnd":10}`;
}

function normalizeMcqQuestion(item, idx) {
  const question = String(item?.question || item?.prompt || "").trim();
  const optionsRaw = Array.isArray(item?.options) ? item.options : [];
  let options = optionsRaw
    .map((opt) =>
      typeof opt === "string"
        ? opt.trim()
        : String(opt?.text || opt?.option || opt?.value || opt?.label || "").trim(),
    )
    .map((opt) => opt.replace(/^[A-D][\)\.\-:]\s*/i, "").trim())
    .filter(Boolean);
  let answer = String(item?.answer || item?.correct || "").trim();
  if (!question || !answer) return null;

  // Some providers return packed options like "CBrahmaputraGangaGodavari".
  if (options.length <= 1) {
    const packed = String(options[0] || "").trim();
    if (packed) {
      const parts = packed
        .split(/(?=[A-Z][a-z])/)
        .map((part) => part.trim())
        .filter(Boolean)
        .filter((part, i, arr) => !(part.length === 1 && arr.length > 2));
      if (parts.length >= 2) {
        options = parts;
      }
    }
  }

  options = [...new Set(options.map((opt) => opt.trim()).filter(Boolean))].slice(0, 4);

  // Map label-style answers (A/B/C/D or 1/2/3/4) to real option text.
  const letterMatch = answer.match(/^[A-D]$/i);
  const numberMatch = answer.match(/^[1-4]$/);
  if (letterMatch) {
    const answerIdx = letterMatch[0].toUpperCase().charCodeAt(0) - 65;
    if (options[answerIdx]) answer = options[answerIdx];
  } else if (numberMatch) {
    const answerIdx = Number.parseInt(numberMatch[0], 10) - 1;
    if (options[answerIdx]) answer = options[answerIdx];
  } else {
    answer = answer.replace(/^[A-D][\)\.\-:]\s*/i, "").trim();
  }

  if (!options.some((opt) => opt.toLowerCase() === answer.toLowerCase())) {
    // If provider returned answer separately, keep quiz usable by pinning it into options.
    if (!options.length) {
      options = [answer, "Option 2", "Option 3", "Option 4"];
    } else {
      options[0] = answer;
    }
  }

  if (options.length < 2) {
    options = [answer, "Option 2", "Option 3", "Option 4"];
  }
  return {
    id: item?.id || `mcq-${idx + 1}`,
    type: "mcq",
    question,
    options,
    answer,
    explanation: String(item?.explanation || "").trim(),
  };
}

function normalizeFillBlankQuestion(item, idx) {
  let question = String(item?.question || item?.prompt || item?.sentence || "").trim();
  const answer = String(item?.answer || item?.correct || "").trim();
  if (!question || !answer) return null;
  if (!/_{2,}|\[blank\]/i.test(question)) {
    const escaped = answer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const answerPattern = new RegExp(`\\b${escaped}\\b`, "i");
    if (answerPattern.test(question)) {
      question = question.replace(answerPattern, "_____");
    }
  }
  const acceptable = Array.isArray(item?.acceptable)
    ? item.acceptable.map((x) => String(x || "").trim()).filter(Boolean)
    : [];
  return {
    id: item?.id || `fill-${idx + 1}`,
    type: "fill_blank",
    question,
    answer,
    acceptable,
    explanation: String(item?.explanation || "").trim(),
  };
}

function normalizeMatchQuestion(item, idx) {
  let pairs = Array.isArray(item?.pairs) ? item.pairs : [];
  if (!pairs.length && Array.isArray(item?.items)) {
    pairs = item.items;
  }
  const normalizedPairs = pairs
    .map((pair) => ({
      left: String(pair?.left || pair?.term || "").trim(),
      right: String(pair?.right || pair?.meaning || pair?.match || "").trim(),
    }))
    .filter((pair) => pair.left && pair.right);
  if (!normalizedPairs.length) return null;
  const anchorIndex = idx % normalizedPairs.length;
  const anchor = normalizedPairs[anchorIndex];
  const distractors = shuffle(
    normalizedPairs
      .filter((_, pairIdx) => pairIdx !== anchorIndex)
      .map((pair) => pair.right),
  ).slice(0, 3);
  let options = [...new Set([anchor.right, ...distractors].map((x) => String(x || "").trim()).filter(Boolean))];
  if (options.length < 2) {
    options = [anchor.right, "Option 2", "Option 3", "Option 4"];
  }
  options = shuffle(options).slice(0, 4);
  const answer = options.find((opt) => opt.toLowerCase() === anchor.right.toLowerCase()) || anchor.right;
  const questionBase = String(item?.question || "Match the following").trim();
  return {
    id: item?.id || `match-${idx + 1}`,
    type: "match",
    question: `${questionBase}: ${anchor.left}`,
    pairs: normalizedPairs,
    options,
    answer,
    explanation: String(item?.explanation || "").trim(),
  };
}

function normalizeQuestions(payload, quizType) {
  const arrayPayload = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.questions)
      ? payload.questions
      : [];

  if (!arrayPayload.length) return [];

  const normalized = arrayPayload
    .map((item, idx) => {
      const itemType = normalizeQuizType(item?.type || quizType);
      if (itemType === "fill_blank") return normalizeFillBlankQuestion(item, idx);
      if (itemType === "match") return normalizeMatchQuestion(item, idx);
      return normalizeMcqQuestion(item, idx);
    })
    .filter(Boolean);

  return normalized;
}

function dedupeQuestions(questions = []) {
  const seen = new Set();
  return (Array.isArray(questions) ? questions : []).filter((item) => {
    const key = `${String(item?.type || "")}:::${String(item?.question || "").toLowerCase().trim()}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function ensureQuestionCount(baseQuestions = [], fallbackQuestions = [], target = 10) {
  const wanted = Math.max(1, Math.min(500, Number.parseInt(target, 10) || 10));
  const merged = dedupeQuestions([...(baseQuestions || []), ...(fallbackQuestions || [])]);
  return merged.slice(0, wanted);
}

function shuffle(values) {
  const arr = [...values];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function extractMeaningForQuiz(entry) {
  const explicitMeaning = String(entry?.meaning || "").trim();
  const explicitExample = String(entry?.example || "").trim();
  let meaning = explicitMeaning;
  if (meaning) {
    const marker = meaning.search(/\b(example|eg|e\.g\.)\s*[:\-]/i);
    if (marker >= 0) {
      meaning = meaning.slice(0, marker).trim();
    }
    meaning = meaning.replace(/\s+/g, " ").trim();
  }
  if (!meaning && explicitExample) return explicitExample;
  return meaning || explicitMeaning;
}

function localMcqQuestions(terms, count) {
  const pool = shuffle(terms).slice(0, count);
  return pool.map((entry, idx) => {
    const answer = extractMeaningForQuiz(entry);
    const distractors = shuffle(
      terms
        .filter((candidate) => candidate.term !== entry.term || candidate.meaning !== entry.meaning)
        .slice(0, 20),
    )
      .slice(0, 3)
      .map((candidate) => extractMeaningForQuiz(candidate))
      .filter(Boolean);
    const options = shuffle([...distractors, answer]).slice(0, 4);
    return {
      id: `local-mcq-${idx + 1}`,
      type: "mcq",
      question: `What does "${entry.term}" mean?`,
      options,
      answer,
      explanation: `${entry.term} = ${entry.meaning}`,
    };
  });
}

function localFillBlankQuestions(terms, count) {
  return shuffle(terms)
    .slice(0, count)
    .map((entry, idx) => ({
      id: `local-fill-${idx + 1}`,
      type: "fill_blank",
      question: `Fill in the blank: "${entry.term}" means ______.`,
      answer: extractMeaningForQuiz(entry),
      acceptable: [],
      explanation: `${entry.term} = ${entry.meaning}`,
    }));
}

function localMatchQuestions(terms, count) {
  const wanted = Math.max(1, Math.min(500, Number.parseInt(count, 10) || 10));
  const source = shuffle(terms).slice(0, Math.max(12, wanted * 2));
  if (source.length < 2) return [];

  const blockCount = Math.max(1, Math.min(8, Math.ceil(wanted / 5)));
  const perBlock = Math.max(4, Math.min(6, Math.ceil(wanted / blockCount)));
  const blocks = [];

  for (let i = 0; i < blockCount; i += 1) {
    const start = (i * perBlock) % source.length;
    const block = [];
    for (let j = 0; j < perBlock; j += 1) {
      block.push(source[(start + j) % source.length]);
    }
    const pairs = block
      .map((entry) => ({ left: String(entry.term || "").trim(), right: String(extractMeaningForQuiz(entry) || "").trim() }))
      .filter((pair) => pair.left && pair.right);
    if (pairs.length < 2) continue;

    const anchor = pairs[0];
    let options = shuffle([...new Set(pairs.map((pair) => pair.right))]).slice(0, 4);
    if (!options.some((opt) => opt.toLowerCase() === anchor.right.toLowerCase())) {
      options = shuffle([anchor.right, ...options]).slice(0, 4);
    }
    if (options.length < 2) {
      options = [anchor.right, "Option 2", "Option 3", "Option 4"];
    }

    blocks.push({
      id: `local-match-${i + 1}`,
      type: "match",
      question: `Match the following (Block ${i + 1})`,
      pairs,
      options,
      answer: anchor.right,
      explanation: "",
    });
  }

  return blocks.length ? blocks : [];
}

function buildLocalQuestions(terms, count, quizType) {
  if (!terms.length) return [];
  if (quizType === "fill_blank") return localFillBlankQuestions(terms, count);
  if (quizType === "match") return localMatchQuestions(terms, count);
  return localMcqQuestions(terms, count);
}

function getTopicSeedEntries(message = "") {
  const text = String(message || "").toLowerCase();
  const treeSeeds = [
    { term: "Process by which green plants make food", meaning: "Photosynthesis" },
    { term: "Green pigment in leaves", meaning: "Chlorophyll" },
    { term: "Tiny pores on leaf surface", meaning: "Stomata" },
    { term: "Part that absorbs water from soil", meaning: "Roots" },
    { term: "Tissue that carries water upward", meaning: "Xylem" },
    { term: "Tissue that transports food", meaning: "Phloem" },
    { term: "Gas released during photosynthesis", meaning: "Oxygen" },
    { term: "Gas taken in for photosynthesis", meaning: "Carbon dioxide" },
    { term: "Main source of energy for plants", meaning: "Sunlight" },
    { term: "Loss of water vapor from leaves", meaning: "Transpiration" },
  ];
  const historySeeds = [
    { term: "Battle of Plassey year", meaning: "1757" },
    { term: "First Battle of Panipat year", meaning: "1526" },
    { term: "Indian Constitution adopted on", meaning: "26 November 1949" },
    { term: "Quit India Movement year", meaning: "1942" },
    { term: "Founder of Maurya Empire", meaning: "Chandragupta Maurya" },
    { term: "Akbar belonged to", meaning: "Mughal dynasty" },
    { term: "Jallianwala Bagh massacre year", meaning: "1919" },
    { term: "Leader of Non-Cooperation Movement", meaning: "Mahatma Gandhi" },
    { term: "Capital of Harappan civilization (major site)", meaning: "Harappa" },
    { term: "Vasco da Gama reached India in", meaning: "1498" },
    { term: "Dandi March year", meaning: "1930" },
    { term: "Regulating Act year", meaning: "1773" },
  ];
  const scienceSeeds = [
    { term: "Chemical symbol of Sodium", meaning: "Na" },
    { term: "SI unit of Force", meaning: "Newton" },
    { term: "Speed of light is approximately", meaning: "3 x 10^8 m/s" },
    { term: "Process by which plants make food", meaning: "Photosynthesis" },
    { term: "Human blood pH is approximately", meaning: "7.4" },
    { term: "Gas essential for respiration", meaning: "Oxygen" },
  ];
  const gkSeeds = [
    { term: "Capital of India", meaning: "New Delhi" },
    { term: "National animal of India", meaning: "Bengal tiger" },
    { term: "Largest ocean", meaning: "Pacific Ocean" },
    { term: "Currency of Japan", meaning: "Yen" },
    { term: "Author of the Constitution draft committee", meaning: "B. R. Ambedkar" },
    { term: "Highest mountain peak", meaning: "Mount Everest" },
  ];

  if (/(history|indian history|ancient|medieval|modern india|freedom struggle)/.test(text)) {
    return historySeeds;
  }
  if (/(tree|trees|plant|plants|botany|forest|leaf|leaves|root|roots|stem|stems)/.test(text)) {
    return treeSeeds;
  }
  if (/(science|physics|chemistry|biology)/.test(text)) {
    return scienceSeeds;
  }
  return gkSeeds;
}

function buildQuizGenerationPrompt({
  message,
  terms,
  questionCount,
  difficulty,
  quizType,
  aiPrompt,
}) {
  const topic = String(message || "general knowledge").trim() || "general knowledge";
  const normalizedFocus = normalizePromptForMatching(aiPrompt || "");
  const focusBlock = normalizedFocus
    ? `\nUSER FOCUS (STRICT):\n${normalizedFocus}\nOnly include content that matches this focus.\n`
    : "";
  const taxonomyBlock = buildTaxonomyPromptContext({
    message: topic,
    terms,
    aiPrompt: normalizedFocus,
  });
  const taxonomyHint = taxonomyBlock ? `\n${taxonomyBlock}\n` : "";

  if (quizType === "fill_blank") {
    const sourceBlock = terms.length
      ? `Use this term-meaning list:\n${terms
          .slice(0, 120)
          .map((item) => `- ${item.term}: ${item.meaning}`)
          .join("\n")}\n`
      : `Topic: ${topic}\n`;
    return `Create exactly ${questionCount} ${difficulty} fill-in-the-blank quiz questions.
${sourceBlock}
Rules:
- Every question must contain exactly one blank using "____".
- Provide exact answer string for each blank.
- Keep questions short and clear.
${focusBlock}${taxonomyHint}
Return ONLY JSON array:
[{"type":"fill_blank","question":"... ____ ...","answer":"...","acceptable":["..."],"explanation":"..."}]`;
  }

  if (quizType === "match") {
    const sourceBlock = terms.length
      ? `Build from this list:\n${terms
          .slice(0, 160)
          .map((item) => `- ${item.term}: ${item.meaning}`)
          .join("\n")}\n`
      : `Topic: ${topic}\n`;
    return `Create ${Math.max(1, Math.min(8, Math.ceil(questionCount / 5)))} match-the-following blocks.
${sourceBlock}
Rules:
- Each block must contain 4 to 6 pairs.
- Avoid duplicate terms.
${focusBlock}${taxonomyHint}
Return ONLY JSON array:
[{"type":"match","question":"Match the following","pairs":[{"left":"...","right":"..."}],"explanation":"..."}]`;
  }

  const sourceBlock = terms.length
    ? `Use these term-meaning pairs:\n${terms
        .slice(0, 120)
        .map((item) => `"${item.term}" = "${item.meaning}"`)
        .join("\n")}\n`
    : `Topic: ${topic}\n`;
  return `Create exactly ${questionCount} ${difficulty} multiple-choice questions.
${sourceBlock}
Rules:
- 4 options per question.
- Exactly one correct answer.
- "answer" must exactly match one option string.
${focusBlock}${taxonomyHint}
Return ONLY JSON array:
[{"type":"mcq","question":"...","options":["A","B","C","D"],"answer":"A","explanation":"..."}]`;
}

async function getQuizData(message, settings = {}) {
  const defaults = extractHeuristicConfig(message, settings);
  if (String(settings.primaryAI || "").toLowerCase() === "local") {
    return {
      provider: providerLabel(PROVIDERS.LOCAL),
      providerErrors: [],
      reply: `Configured ${defaults.questionCount} ${defaults.difficulty} ${defaults.quizType} questions (${defaults.mode}).`,
      quizConfig: defaults,
    };
  }

  const prompt = buildConfigPrompt(message, defaults);
  const ai = await callWithFallback({ prompt, settings });
  if (ai.text) {
    const parsed = parseJsonLoose(ai.text, {});
    const merged = {
      ...defaults,
      ...parsed,
      questionCount: sanitizeCount(parsed?.questionCount ?? parsed?.count, defaults.questionCount),
      difficulty: ["easy", "medium", "hard"].includes(parsed?.difficulty)
        ? parsed.difficulty
        : defaults.difficulty,
      mode: ["sequential", "random", "mistakes"].includes(parsed?.mode)
        ? parsed.mode
        : defaults.mode,
      quizType: normalizeQuizType(parsed?.quizType || defaults.quizType),
    };
    return {
      provider: providerLabel(ai.provider),
      providerErrors: Array.isArray(ai.errors) ? ai.errors : [],
      reply: `Configured ${merged.questionCount} ${merged.difficulty} ${merged.quizType} questions (${merged.mode}).`,
      quizConfig: merged,
    };
  }

  return {
    provider: providerLabel(PROVIDERS.LOCAL),
    providerErrors: Array.isArray(ai.errors) ? ai.errors : [],
    reply: `Configured ${defaults.questionCount} ${defaults.difficulty} ${defaults.quizType} questions (${defaults.mode}) using local parser.`,
    quizConfig: defaults,
  };
}

async function generateQuizQuestions(message, settings = {}) {
  const base = extractHeuristicConfig(message, settings);
  const questionCount = sanitizeCount(settings.questionCount ?? base.questionCount, base.questionCount);
  const difficulty = ["easy", "medium", "hard"].includes(settings.difficulty)
    ? settings.difficulty
    : base.difficulty;
  const quizType = detectQuizTypeFromMessage(message, settings.quizType || base.quizType);
  const userTerms = dedupeEntries(normalizeEntries(settings.terms || []));
  const promptTerms = userTerms.length ? userTerms : [];
  const fallbackTerms = userTerms.length ? userTerms : getTopicSeedEntries(message);
  const aiPrompt = String(settings.aiPrompt || "").trim();

  if (String(settings.primaryAI || "").toLowerCase() === "local") {
    const localQuestions = buildLocalQuestions(fallbackTerms, questionCount, quizType);
    if (!localQuestions.length) {
      throw new Error("Local mode needs uploaded terms for quiz generation.");
    }
    return {
      provider: providerLabel(PROVIDERS.LOCAL),
      providerErrors: [],
      type: "quiz-questions",
      reply: `Generated ${localQuestions.length} ${quizType} questions using local engine.`,
      questions: localQuestions,
      quizType,
    };
  }

  const prompt = buildQuizGenerationPrompt({
    message,
    terms: promptTerms,
    questionCount,
    difficulty,
    quizType,
    aiPrompt,
  });
  const ai = await callWithFallback({ prompt, settings });
  if (ai.text) {
    const parsed = parseJsonLoose(ai.text, []);
    const aiQuestions = normalizeQuestions(parsed, quizType);
    if (aiQuestions.length) {
      const fallbackQuestions = buildLocalQuestions(fallbackTerms, questionCount, quizType);
      const questions = ensureQuestionCount(aiQuestions, fallbackQuestions, questionCount);
      return {
        provider: providerLabel(ai.provider),
        providerErrors: Array.isArray(ai.errors) ? ai.errors : [],
        type: "quiz-questions",
        reply: `Generated ${questions.length} ${quizType} questions via ${providerLabel(ai.provider)}.`,
        questions,
        quizType,
      };
    }
  }

  const localQuestions = buildLocalQuestions(fallbackTerms, questionCount, quizType);
  if (localQuestions.length) {
    const fromTopicFallback = !userTerms.length;
    return {
      provider: providerLabel(PROVIDERS.LOCAL),
      providerErrors: Array.isArray(ai.errors) ? ai.errors : [],
      type: "quiz-questions",
      reply: fromTopicFallback
        ? `AI was unavailable, so local topic fallback generated ${localQuestions.length} ${quizType} questions.`
        : `AI response was invalid, so local fallback generated ${localQuestions.length} ${quizType} questions.`,
      questions: localQuestions,
      quizType,
      fallbackUsed: true,
    };
  }

  throw new Error("All quiz providers failed. Add provider keys in Settings or upload local terms.");
}

async function extractTermsFromText(rawText, settings = {}) {
  const text = String(rawText || "").slice(0, 12000);
  if (!text.trim()) return [];
  const userFilter = normalizePromptForMatching(String(settings.aiPrompt || "").trim());
  const strict = Boolean(settings.strictExtraction);
  const filterBlock = userFilter
    ? `\nUSER FILTER (STRICT):\n${userFilter}\nOnly return entries that match this filter.\n`
    : "";

  const prompt = `Extract term-meaning pairs from the text below.
Return ONLY JSON array:
[{"term":"...","meaning":"..."}]
If nothing matches, return [].
${filterBlock}
TEXT:
${text}`;

  const ai = await callWithFallback({ prompt, settings });
  const parsed = parseJsonLoose(ai.text, []);
  const entries = dedupeEntries(parsed);
  if (strict && userFilter && entries.length === 0) {
    return [];
  }
  return entries;
}

export async function action({ request }) {
  let message = "";
  let settings = {};
  let mode = "";

  try {
    const body = await request.json();
    message = body?.message || "";
    settings = body?.settings || {};
    mode = body?.mode || "";
  } catch {
    return { type: "error", reply: "Invalid request format." };
  }

  if (mode === "generate-quiz") {
    try {
      return await generateQuizQuestions(message, settings);
    } catch (error) {
      return { type: "error", reply: `Quiz generation failed: ${error.message}` };
    }
  }

  if (mode === "extract-terms") {
    try {
      const entries = await extractTermsFromText(message, settings);
      return { type: "extracted-terms", entries };
    } catch {
      return { type: "extracted-terms", entries: [] };
    }
  }

  try {
    const result = await getQuizData(message, settings);
    return {
      ...result,
      fallbackUsed: result.provider === providerLabel(PROVIDERS.LOCAL),
    };
  } catch (error) {
    return data(
      { type: "error", reply: "Failed to configure quiz.", details: error.message },
      { status: 500 },
    );
  }
}
