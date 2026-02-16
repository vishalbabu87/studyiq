const SETTINGS_KEY = "studyiq-settings";

export const defaultSettings = {
  geminiKey: "",
  openaiKey: "",
  primaryAI: "gemini",
  autoFallback: true,
};

export function readSettings() {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return { ...defaultSettings, ...parsed };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(next) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
}
