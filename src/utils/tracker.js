const TRACKER_KEY = "studyiq-tracker-items";
const TRACKER_SUBJECTS_KEY = "studyiq-tracker-subjects";
const DEFAULT_SUBJECTS = ["Quant", "Reasoning", "English", "Science"];

function uid(prefix = "trk") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function readTrackerItems() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(TRACKER_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item, index) => normalizeItem(item, index));
  } catch {
    return [];
  }
}

export function saveTrackerItems(items) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TRACKER_KEY, JSON.stringify(items));
}

export function readTrackerSubjects() {
  if (typeof window === "undefined") return [...DEFAULT_SUBJECTS];
  try {
    const parsed = JSON.parse(localStorage.getItem(TRACKER_SUBJECTS_KEY) || "[]");
    if (!Array.isArray(parsed) || parsed.length === 0) return [...DEFAULT_SUBJECTS];
    const valid = parsed
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    return valid.length ? [...new Set(valid)] : [...DEFAULT_SUBJECTS];
  } catch {
    return [...DEFAULT_SUBJECTS];
  }
}

export function saveTrackerSubjects(subjects) {
  if (typeof window === "undefined") return;
  const valid = [...new Set(subjects.map((value) => String(value || "").trim()).filter(Boolean))];
  localStorage.setItem(TRACKER_SUBJECTS_KEY, JSON.stringify(valid));
}

function extractField(block, key) {
  const match = block.match(new RegExp(`${key}\\s*:\\s*"([^"]*)"`, "i"));
  return match?.[1]?.trim() || "";
}

function parseScheduleObjects(html) {
  const block = html.match(/const\s+schedule\s*=\s*\[([\s\S]*?)\];/i)?.[1];
  if (!block) return [];
  return block.match(/\{[\s\S]*?\}/g) || [];
}

function cleanChapter(text) {
  return String(text || "")
    .replace(/\s*✅/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseWarRoomHtmlToItems(html) {
  const rows = parseScheduleObjects(html);
  const parsed = [];
  const order = {
    Quant: 0,
    Reasoning: 0,
    English: 0,
  };

  rows.forEach((row) => {
    const plannedDate = extractField(row, "d");
    const done = /done\s*:\s*true/i.test(row);

    const quant = cleanChapter(extractField(row, "q"));
    const reasoning = cleanChapter(extractField(row, "r"));
    const english = cleanChapter(extractField(row, "g"));

    if (quant) {
      parsed.push({
        id: uid("quant"),
        subject: "Quant",
        chapter: quant,
        plannedDate,
        order: order.Quant++,
        completed: done,
        completedAt: done ? new Date().toISOString().slice(0, 10) : "",
      });
    }
    if (reasoning) {
      parsed.push({
        id: uid("reason"),
        subject: "Reasoning",
        chapter: reasoning,
        plannedDate,
        order: order.Reasoning++,
        completed: done,
        completedAt: done ? new Date().toISOString().slice(0, 10) : "",
      });
    }
    if (english) {
      parsed.push({
        id: uid("english"),
        subject: "English",
        chapter: english,
        plannedDate,
        order: order.English++,
        completed: done,
        completedAt: done ? new Date().toISOString().slice(0, 10) : "",
      });
    }
  });

  return parsed;
}

export function mergeTrackerItems(existing, imported) {
  const map = new Map();
  [...existing, ...imported].forEach((item) => {
    const key = `${item.subject}|${item.chapter}|${item.plannedDate || ""}`.toLowerCase();
    const normalized = normalizeItem(item);
    if (!map.has(key)) {
      map.set(key, normalized);
      return;
    }
    const prev = map.get(key);
    if (!prev.completed && normalized.completed) map.set(key, normalized);
  });
  return [...map.values()].sort(compareTrackerItems);
}

export function addTrackerItem(items, payload) {
  const normalized = items.map((item, index) => normalizeItem(item, index));
  const nextOrder =
    normalized
      .filter((item) => item.subject === payload.subject)
      .reduce((max, item) => Math.max(max, Number(item.order) || 0), -1) + 1;

  return [
    ...normalized,
    {
      id: uid("manual"),
      subject: payload.subject,
      chapter: payload.chapter,
      plannedDate: payload.plannedDate || "",
      order: nextOrder,
      completed: false,
      completedAt: "",
    },
  ].sort(compareTrackerItems);
}

export function toggleTrackerItem(items, id, completed, completedAt) {
  return items.map((item, index) => {
    const normalized = normalizeItem(item, index);
    if (item.id !== id) return item;
    return {
      ...normalized,
      completed,
      completedAt: completed ? completedAt || new Date().toISOString().slice(0, 10) : "",
    };
  }).sort(compareTrackerItems);
}

export function updateTrackerCompletionDate(items, id, completedAt) {
  return items.map((item, index) => {
    const normalized = normalizeItem(item, index);
    if (item.id !== id) return item;
    return {
      ...normalized,
      completedAt,
      completed: Boolean(completedAt) || normalized.completed,
    };
  }).sort(compareTrackerItems);
}

export function removeTrackerItem(items, id) {
  return items.filter((item) => item.id !== id);
}

function normalizeItem(item, index = 0) {
  return {
    id: item.id || uid("trk"),
    subject: String(item.subject || "Other").trim() || "Other",
    chapter: String(item.chapter || "").trim(),
    plannedDate: String(item.plannedDate || "").trim(),
    order: Number.isFinite(Number(item.order)) ? Number(item.order) : index,
    completed: Boolean(item.completed),
    completedAt: String(item.completedAt || "").trim(),
  };
}

function compareTrackerItems(a, b) {
  if (a.subject !== b.subject) return a.subject.localeCompare(b.subject);
  const orderDiff = (Number(a.order) || 0) - (Number(b.order) || 0);
  if (orderDiff !== 0) return orderDiff;
  return a.chapter.localeCompare(b.chapter);
}
