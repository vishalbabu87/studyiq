// Flexible AI Provider System
// Easy to add new AI providers without code changes

import { data } from "react-router";

// Read env vars: Vite SSR uses import.meta.env, Node fallback uses process.env
const ENV_GEMINI = import.meta.env?.GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
const ENV_SARVAM = import.meta.env?.SARVAM_API_KEY || process.env.SARVAM_API_KEY || "";
const ENV_GEMINI_MODEL = import.meta.env?.GEMINI_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

// ─── Provider Cooldown Cache ─────────────────────────────────────────────────
const _cooldowns = new Map(); // Map<provider, failTimestamp>
const COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes

function isCooling(prov) {
  const t = _cooldowns.get(prov);
  return t && (Date.now() - t) < COOLDOWN_MS;
}
function setCooling(prov, errMsg) {
  if (errMsg?.includes("429") || errMsg?.includes("quota") || errMsg?.includes("exceeded")) {
    const remaining = Math.ceil(COOLDOWN_MS / 1000);
    console.log(`⏳ ${prov} is rate-limited → cooling down for ${remaining}s`);
    _cooldowns.set(prov, Date.now());
  }
}
function clearCooling(prov) { _cooldowns.delete(prov); }

// ─── Fetch with Timeout ───────────────────────────────────────────────────────
async function fetchWithTimeout(url, options, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Sarvam.ai API call ───────────────────────────────────────────────────────
async function callSarvam(apiKey, prompt) {
  const res = await fetchWithTimeout(
    "https://api.sarvam.ai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": apiKey,
      },
      body: JSON.stringify({
        model: "sarvam-m",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 4096,
      }),
    },
    15000 // 15s for Sarvam (slower model)
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Sarvam API error ${res.status}: ${err?.error?.message || res.statusText}`);
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content?.trim() || "";
}

// ─── Gemini REST API call ─────────────────────────────────────────────────────
async function callGeminiV1(apiKey, prompt, model = "gemini-2.0-flash-lite") {
  const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
      }),
    },
    12000 // 12s timeout for Gemini
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Gemini v1 API error ${res.status}: ${err?.error?.message || res.statusText}`);
  }
  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
}

// ─── Provider Registry ────────────────────────────────────────────────────────
// Add new providers here to integrate them easily
export const AI_PROVIDERS = {
  gemini: {
    name: "Gemini",
    model: ENV_GEMINI_MODEL,
    hasKey: () => Boolean(ENV_GEMINI),
    providerFn: async (message, settings) => {
      const apiKey = settings?.geminiKey || ENV_GEMINI;
      if (!apiKey) throw new Error("Missing Gemini API key.");
      if (isCooling("gemini")) throw new Error("Gemini is cooling down (429). Skipping.");

      console.log(`Using Gemini (source: ${settings?.geminiKey ? "settings" : "env"})`);

      const prompt = `You are a quiz setup assistant. Parse this user request and extract quiz configuration.

User request: "${message}"

Return ONLY a valid JSON object with exactly these fields:
{
  "questionCount": <number extracted from request, default 10>,
  "difficulty": <"easy"|"medium"|"hard", default "medium">,
  "mode": <"sequential"|"random"|"mistakes", default "sequential">,
  "rangeStart": <number, default 1>,
  "rangeEnd": <number, default 50>,
  "timerMinutes": <number, default 5>
}

Return ONLY the JSON object, no explanation, no markdown, no backticks.`;

      const text = await callGeminiV1(apiKey, prompt, settings?.geminiModel || ENV_GEMINI_MODEL);
      clearCooling("gemini");

      try {
        const cfg = JSON.parse(text);
        const qCount = Math.max(1, Number(cfg.questionCount) || 10);
        const rStart = Math.max(1, Number(cfg.rangeStart) || 1);
        const rEnd = Math.max(rStart, Number(cfg.rangeEnd) || 50);
        const parsedConfig = {
          questionCount: qCount,
          difficulty: ["easy","medium","hard"].includes(cfg.difficulty) ? cfg.difficulty : "medium",
          mode: ["sequential","random","mistakes"].includes(cfg.mode) ? cfg.mode : "sequential",
          rangeStart: rStart, rangeEnd: rEnd,
          timerMinutes: Math.max(1, Number(cfg.timerMinutes) || 5),
        };
        return {
          provider: "Gemini",
          reply: `✅ Quiz configured! ${parsedConfig.questionCount} questions | ${parsedConfig.difficulty} | ${parsedConfig.mode} mode | range ${parsedConfig.rangeStart}–${parsedConfig.rangeEnd} | ${parsedConfig.timerMinutes} min timer.\n\nClick "Apply to Quiz Setup" below to use these settings.`,
          quizConfig: parsedConfig,
        };
      } catch {
        return { provider: "Gemini", reply: text || "Please try again with a clearer format.", quizConfig: null };
      }
    },
    rateLimits: { daily: 1000, perMinute: 15 }, // Gemini 2.5 Flash-Lite limits
  },
  sarvam: {
    name: "Sarvam",
    model: "sarvam-m",
    hasKey: () => Boolean(ENV_SARVAM),
    providerFn: async (message, settings) => {
      const apiKey = settings?.sarvamKey || ENV_SARVAM;
      if (!apiKey) throw new Error("Missing Sarvam API key.");
      if (isCooling("sarvam")) throw new Error("Sarvam is cooling down. Skipping.");

      console.log("🚀 Using Sarvam.ai (sarvam-m) provider.");

      const prompt = `You are a quiz setup assistant. Parse this user request and extract quiz configuration.

User request: "${message}"

Return ONLY a valid JSON object:
{
  "questionCount": <number, default 10>,
  "difficulty": <"easy"|"medium"|"hard", default "medium">,
  "mode": <"sequential"|"random"|"mistakes", default "sequential">,
  "rangeStart": <number, default 1>,
  "rangeEnd": <number, default 50>,
  "timerMinutes": <number, default 5>
}
Return ONLY the JSON, no markdown, no backticks.`;

      const text = await callSarvam(apiKey, prompt);
      clearCooling("sarvam");

      try {
        const cfg = JSON.parse(text.replace(/^```json\n?/, "").replace(/\n?```$/, ""));
        const qCount = Math.max(1, Number(cfg.questionCount) || 10);
        const rStart = Math.max(1, Number(cfg.rangeStart) || 1);
        const rEnd = Math.max(rStart, Number(cfg.rangeEnd) || 50);
        const parsedConfig = {
          questionCount: qCount,
          difficulty: ["easy","medium","hard"].includes(cfg.difficulty) ? cfg.difficulty : "medium",
          mode: ["sequential","random","mistakes"].includes(cfg.mode) ? cfg.mode : "sequential",
          rangeStart: rStart, rangeEnd: rEnd,
          timerMinutes: Math.max(1, Number(cfg.timerMinutes) || 5),
        };
        return {
          provider: "Sarvam",
          reply: `✅ Quiz configured via Sarvam AI! ${parsedConfig.questionCount} questions | ${parsedConfig.difficulty} | ${parsedConfig.mode} mode | range ${parsedConfig.rangeStart}–${parsedConfig.rangeEnd}.\n\nClick "Apply to Quiz Setup" below to use these settings.`,
          quizConfig: parsedConfig,
        };
      } catch {
        return { provider: "Sarvam", reply: text, quizConfig: null };
      }
    },
    rateLimits: { daily: Infinity, perMinute: Infinity }, // Sarvam has no known limits
  }
};

// Usage tracking for rate limiting
const _usage = {
  gemini: { daily: 0, minute: 0, lastReset: Date.now() },
  sarvam: { daily: 0, minute: 0, lastReset: Date.now() }
};

function resetUsageIfNeeded(provider) {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const minuteMs = 60 * 1000;
  
  if (now - _usage[provider].lastReset > dayMs) {
    _usage[provider].daily = 0;
    _usage[provider].lastReset = now;
  }
  
  if (now - (_usage[provider].minuteReset || 0) > minuteMs) {
    _usage[provider].minute = 0;
    _usage[provider].minuteReset = now;
  }
}

function canUseProvider(provider) {
  resetUsageIfNeeded(provider);
  const limits = AI_PROVIDERS[provider].rateLimits;
  return _usage[provider].daily < limits.daily && _usage[provider].minute < limits.perMinute;
}

function incrementUsage(provider) {
  _usage[provider].daily++;
  _usage[provider].minute++;
  _usage[provider].minuteReset = _usage[provider].minuteReset || Date.now();
}

// ─── Flexible Provider System ────────────────────────────────────────────────
// Smart fallback system that supports easy addition of new AI providers
export async function getQuizData(message, settings) {
  const preferred = settings?.primaryAI || settings?.provider || "gemini";
  const hasGemini = Boolean(settings?.geminiKey || settings?.geminiApiKey || ENV_GEMINI);
  const hasSarvam = Boolean(settings?.sarvamKey || ENV_SARVAM);

  // Show cooldown status
  const cooled = Object.keys(AI_PROVIDERS).filter(isCooling);
  if (cooled.length) console.log(`⏩ Skipping (cooling down): ${cooled.join(", ")}`);

  // Build provider order based on preference and availability
  let order = [];
  if (preferred === "sarvam") {
    order = hasSarvam ? ["sarvam", "gemini"] : ["gemini"];
  } else {
    order = hasGemini ? ["gemini", "sarvam"] : ["sarvam"];
  }

  console.log(`\n=== PROVIDER ORDER: ${order.join(" → ")} ===\n`);

  for (const prov of order) {
    if (isCooling(prov)) { console.log(`⏩ ${prov}: skipped (cooldown active)`); continue; }
    
    // Check rate limits for providers with limits
    if (AI_PROVIDERS[prov].rateLimits.daily !== Infinity && !canUseProvider(prov)) {
      console.log(`⚠️ ${prov}: daily/minute limit reached, skipping`);
      continue;
    }

    if (AI_PROVIDERS[prov].hasKey() && (hasGemini || hasSarvam)) {
      try {
        const result = await AI_PROVIDERS[prov].providerFn(message, settings);
        incrementUsage(prov);
        return result;
      } catch (e) { 
        setCooling(prov, e.message); 
        console.warn(`❌ ${prov} →`, e.message.substring(0, 80)); 
      }
    }
  }

  console.log("🔄 All providers failed/cooling. Using Local Engine.");
  return await internalQuizEngine(message, settings);
}

// ─── Internal Fallback Engine ─────────────────────────────────────────────────
async function internalQuizEngine(message, settings) {
  const lines = (message || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const pairs = [];
  for (const line of lines) {
    const m = line.match(/^(.+?)\s*(?:-|:|=)\s*(.+)$/);
    if (m) pairs.push({ term: m[1].trim(), meaning: m[2].trim() });
  }
  const count = Math.min(pairs.length, Number(settings?.count) || 10) || 5;
  const topic = settings?.topic || "General";
  const difficulty = settings?.difficulty || "easy";
  const reply = pairs.length
    ? `Generated a ${difficulty} quiz for ${topic} using ${pairs.length} extracted items.`
    : `External AI services are currently unavailable. Generated a fallback ${difficulty} quiz for ${topic}. Please check your API keys in Settings.`;
  return { provider: "Internal", reply, quizConfig: { topic, difficulty, count, pairs } };
}

// ─── Easy Provider Addition Template ─────────────────────────────────────────
// To add a new AI provider, copy this template and add it to AI_PROVIDERS above:
/*
  newProvider: {
    name: "New Provider",
    model: "model-name",
    hasKey: () => Boolean(import.meta.env?.NEW_PROVIDER_API_KEY || process.env.NEW_PROVIDER_API_KEY),
    providerFn: async (message, settings) => {
      const apiKey = settings?.newProviderKey || import.meta.env?.NEW_PROVIDER_API_KEY || process.env.NEW_PROVIDER_API_KEY;
      if (!apiKey) throw new Error("Missing New Provider API key.");
      if (isCooling("newProvider")) throw new Error("New Provider is cooling down. Skipping.");

      // Your API call logic here
      const text = await yourApiCall(apiKey, message, settings);
      clearCooling("newProvider");

      try {
        const cfg = JSON.parse(text);
        // Parse and return config
        return {
          provider: "New Provider",
          reply: `✅ Quiz configured via New Provider! ...`,
          quizConfig: parsedConfig,
        };
      } catch {
        return { provider: "New Provider", reply: text, quizConfig: null };
      }
    },
    rateLimits: { daily: 100, perMinute: 10 }, // Set appropriate limits
  }
*/