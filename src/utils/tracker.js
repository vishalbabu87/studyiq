const TRACKER_KEY = "studyiq-tracker-items";

function uid(prefix = "trk") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function readTrackerItems() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(TRACKER_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTrackerItems(items) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TRACKER_KEY, JSON.stringify(items));
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
    if (!map.has(key)) {
      map.set(key, item);
      return;
    }
    const prev = map.get(key);
    if (!prev.completed && item.completed) map.set(key, item);
  });
  return [...map.values()];
}

export function addTrackerItem(items, payload) {
  return [
    ...items,
    {
      id: uid("manual"),
      subject: payload.subject,
      chapter: payload.chapter,
      plannedDate: payload.plannedDate || "",
      completed: false,
      completedAt: "",
    },
  ];
}

export function toggleTrackerItem(items, id, completed, completedAt) {
  return items.map((item) => {
    if (item.id !== id) return item;
    return {
      ...item,
      completed,
      completedAt: completed ? completedAt || new Date().toISOString().slice(0, 10) : "",
    };
  });
}

export function updateTrackerCompletionDate(items, id, completedAt) {
  return items.map((item) => {
    if (item.id !== id) return item;
    return {
      ...item,
      completedAt,
      completed: Boolean(completedAt) || item.completed,
    };
  });
}

export function removeTrackerItem(items, id) {
  return items.filter((item) => item.id !== id);
}
