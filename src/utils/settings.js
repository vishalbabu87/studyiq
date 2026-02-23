const SETTINGS_KEY = "studyiq-settings";

export const defaultSettings = {
  geminiKey: "",
  geminiDailyLimit: 1400,
  xaiKey: "",
  xaiModel: "grok-4-latest",
  xaiUrl: "https://api.x.ai/v1/chat/completions",
  xaiDailyLimit: 8000,
  groqKey: "",
  groqModel: "llama-3.1-8b-instant",
  groqDailyLimit: 10000,
  cloudflareApiToken: "",
  cloudflareAccountId: "",
  cloudflareModel: "@cf/meta/llama-3.1-8b-instruct",
  cloudflareAiUrl: "",
  cloudflareDailyLimit: 9000,
  providerChain: "gemini,xai,groq,cloudflare,supabase,sarvam,huggingface",
  openaiKey: "",
  sarvamKey: "",
  sarvamDailyLimit: 5000,
  huggingfaceKey: "",
  huggingfaceModel: "google/gemma-2-2b-it",
  huggingfaceDailyLimit: 15000,
  supabaseUrl: "",
  supabaseKey: "",
  supabaseAiFunction: "gemma-chat",
  supabaseDailyLimit: 20000,
  primaryAI: "any",
  autoFallback: true,
  quizType: "mcq",
  strictExtraction: false,
  strictReasonReport: false,
  extractionMode: "hybrid",
  localFirstPipeline: true,
  minLocalEntriesBeforeAiExtract: 8,
  contentProfile: "all_terms",
  minEntryConfidence: 0.42,
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
