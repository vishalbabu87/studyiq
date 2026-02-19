function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function clampRange(start, end, max) {
  const safeStart = Math.max(1, start);
  const safeEnd = Math.max(safeStart, Math.min(end, max));
  return { safeStart, safeEnd };
}

// Clean option text by removing bracket labels, leading numbering, quotes, and excess punctuation/spaces
function cleanOptionText(s) {
  let str = String(s ?? "");
  // Remove common leading markers like "1.", "(a)", "[1]", "-" etc.
  str = str.replace(/^\s*(?:[\(\[]?[A-Za-z]?\d+[\)\]]|[\(\[]?[A-Za-z][\)\]]|[\-–—•])\s*[\-–—.:)]*\s*/u, "");
  // Trim surrounding quotes and collapse whitespace
  str = str.replace(/^['"“”]|['"“”]$/g, "").replace(/\s+/g, " ").trim();
  return str;
}

function isMeaningfulText(s) {
  if (!s) return false;
  const t = String(s).trim();
  if (t.length < 2) return false;
  // Only digits or only punctuation is not meaningful
  if (/^[\d\W]+$/u.test(t)) return false;
  return true;
}

function pickDistractors(allEntries, correct, targetCount = 3, direction = "term_to_meaning") {
  const correctRaw = direction === "term_to_meaning" ? correct.meaning : correct.term;
  const correctClean = cleanOptionText(correctRaw).toLowerCase();

  const candidates = [];
  for (const e of allEntries) {
    if (e.id === correct.id) continue;
    const raw = direction === "term_to_meaning" ? e.meaning : e.term;
    const cleaned = cleanOptionText(raw);
    if (!isMeaningfulText(cleaned)) continue;
    if (cleaned.toLowerCase() === correctClean) continue;
    candidates.push({ entry: e, text: cleaned });
  }

  // Uniq by cleaned text
  const seen = new Set();
  const uniq = [];
  for (const c of candidates) {
    const key = c.text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(c);
  }

  const shuffled = shuffle(uniq);
  return shuffled.slice(0, targetCount).map((c) => c.entry);
}

function buildQuestion(entry, allEntries, direction = "term_to_meaning") {
  const distractors = pickDistractors(allEntries, entry, 3, direction);

  const correctRaw = direction === "term_to_meaning" ? entry.meaning : entry.term;
  const correctText = cleanOptionText(correctRaw);

  const optionSource = [
    { text: correctText, isCorrect: true },
    ...distractors.map((d) => {
      const raw = direction === "term_to_meaning" ? d.meaning : d.term;
      return { text: cleanOptionText(raw), isCorrect: false };
    }),
  ].filter((opt) => isMeaningfulText(opt.text));

  // Deduplicate options by text (case-insensitive)
  const seen = new Set();
  const unique = [];
  for (const o of optionSource) {
    const key = o.text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(o);
  }

  // Clean the prompt as well, but fall back to original if it becomes empty
  const promptRaw = direction === "term_to_meaning" ? entry.term : entry.meaning;
  const cleanedPrompt = cleanOptionText(promptRaw) || promptRaw;

  return {
    id: entry.id,
    prompt: cleanedPrompt,
    direction,
    options: shuffle(unique),
    entry,
  };
}

function questionDirectionByDifficulty(difficulty, index) {
  if (difficulty === "easy") return "term_to_meaning";
  if (difficulty === "medium") return index % 3 === 0 ? "meaning_to_term" : "term_to_meaning";
  return index % 2 === 0 ? "meaning_to_term" : "term_to_meaning";
}

export function parseRange(rangeText, fallbackStart = 1, fallbackEnd = 10) {
  const cleaned = (rangeText || "").trim();
  if (!cleaned) return { start: fallbackStart, end: fallbackEnd };
  const match = cleaned.match(/^(\d+)\s*[-:]\s*(\d+)$/);
  if (!match) return { start: fallbackStart, end: fallbackEnd };
  const start = Number.parseInt(match[1], 10);
  const end = Number.parseInt(match[2], 10);
  if (Number.isNaN(start) || Number.isNaN(end) || start <= 0 || end < start) {
    return { start: fallbackStart, end: fallbackEnd };
  }
  return { start, end };
}

export function makeQuizSession({ entries, mode, difficulty, questionCount, rangeStart, rangeEnd }) {
  const { safeStart, safeEnd } = clampRange(rangeStart, rangeEnd, entries.length);
  let selection = entries.slice(safeStart - 1, safeEnd);

  if (mode === "mistakes") {
    selection = selection.filter((entry) => (entry.wrongCount || 0) > 0);
  }

  if (mode === "random") {
    selection = shuffle(selection);
  }

  selection = selection.slice(0, questionCount);

  const questions = selection.map((entry, index) =>
    buildQuestion(entry, entries.slice(safeStart - 1, safeEnd), questionDirectionByDifficulty(difficulty, index)),
  );

  return {
    questions,
    usedRange: { start: safeStart, end: safeEnd },
    sourceCount: selection.length,
  };
}

export function nextSequentialRange(currentEnd, questionCount, total) {
  const nextStart = currentEnd + 1;
  if (nextStart > total) return null;
  const nextEnd = Math.min(total, nextStart + questionCount - 1);
  return { start: nextStart, end: nextEnd };
}
