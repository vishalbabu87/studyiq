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

function pickDistractors(allEntries, correct, targetCount = 3) {
  const pool = allEntries.filter((entry) => entry.id !== correct.id);
  return shuffle(pool).slice(0, targetCount);
}

function buildQuestion(entry, allEntries, direction = "term_to_meaning") {
  const distractors = pickDistractors(allEntries, entry, 3);

  const optionSource =
    direction === "term_to_meaning"
      ? [
          { text: entry.meaning, isCorrect: true },
          ...distractors.map((d) => ({ text: d.meaning, isCorrect: false })),
        ]
      : [
          { text: entry.term, isCorrect: true },
          ...distractors.map((d) => ({ text: d.term, isCorrect: false })),
        ];

  return {
    id: entry.id,
    prompt: direction === "term_to_meaning" ? entry.term : entry.meaning,
    direction,
    options: shuffle(optionSource),
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
