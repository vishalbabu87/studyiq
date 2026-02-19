import { data } from "react-router";
import { getQuizData } from "../../utils/aiProviders.js";

// Read env vars: Vite SSR uses import.meta.env, Node fallback uses process.env
const ENV_GEMINI = import.meta.env?.GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
const ENV_SARVAM = import.meta.env?.SARVAM_API_KEY || process.env.SARVAM_API_KEY || "";
const ENV_GEMINI_MODEL = import.meta.env?.GEMINI_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

// ─── Provider Cooldown Cache ─────────────────────────────────────────────────
// When a provider returns 429/quota error, skip it for 2 minutes.
// This makes the chatbot FAST — no waiting for known-failed providers.
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

// ─── Generate MCQ Questions (AI Craft + Quiz page) ───────────────────────────
async function generateQuizQuestions(message, settings) {
  const count = Math.max(1, Math.min(50, Number(settings?.questionCount) || 10));
  const difficulty = ["easy","medium","hard"].includes(settings?.difficulty) ? settings.difficulty : "medium";
  const hasLocalTerms = Array.isArray(settings?.terms) && settings.terms.length > 0;

  let prompt;
  if (hasLocalTerms) {
    const termsList = settings.terms.slice(0, 60)
      .map(t => `"${String(t.term||"").replace(/"/g,"'")}" = "${String(t.meaning||"").replace(/"/g,"'")}"`).join("\n");
    prompt = `Create exactly ${count} ${difficulty} multiple choice questions from these term-meaning pairs:

${termsList}

Rules: Each question asks "What does X mean?" or "Which term means Y?"
4 options: 1 correct, 3 distractors from other terms. Vary direction.

Return ONLY a valid JSON array, no markdown:
[{"question":"...","options":["A) ...","B) ...","C) ...","D) ..."],"answer":"A) ...","explanation":"..."}]`;
  } else {
    const topic = (message || "general knowledge")
      .replace(/quiz me on|generate quiz|create quiz|test me on|quiz about|questions about/gi, "").trim() || "general knowledge";
    prompt = `Create exactly ${count} ${difficulty}-difficulty multiple choice questions about: "${topic}"

Rules: Clear specific questions. 4 options A) B) C) D) — exactly 1 correct. Answer must exactly match one option.

Return ONLY a valid JSON array, no markdown:
[{"question":"...","options":["A) ...","B) ...","C) ...","D) ..."],"answer":"A) ...","explanation":"..."}]`;
  }

  const geminiKey = settings?.geminiKey || ENV_GEMINI;
  const sarvamKey = settings?.sarvamKey || ENV_SARVAM;
  let rawText = null;
  let usedProvider = "Gemini";

  // Try Gemini (unless cooling down)
  if (geminiKey && !isCooling("gemini")) {
    try {
      rawText = await callGeminiV1(geminiKey, prompt, settings?.geminiModel || "gemini-2.0-flash-lite");
      clearCooling("gemini");
    } catch (e) {
      setCooling("gemini", e.message);
      console.warn("⚠️ Gemini quiz gen failed →", e.message.substring(0, 80));
    }
  } else if (isCooling("gemini")) {
    console.log("⏩ Gemini cooling down — going straight to Sarvam for quiz generation");
  }

  // Fallback to Sarvam
  if (!rawText && sarvamKey && !isCooling("sarvam")) {
    try {
      console.log("🔄 Quiz gen: using Sarvam.ai");
      rawText = await callSarvam(sarvamKey, prompt);
      clearCooling("sarvam");
      usedProvider = "Sarvam";
    } catch (e) {
      setCooling("sarvam", e.message);
      console.warn("⚠️ Sarvam quiz gen failed →", e.message.substring(0, 80));
    }
  }

  if (!rawText) throw new Error("All AI providers failed. Check your API keys in Settings.");

  const raw = rawText.replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/\s*```$/i,"");

  let questions;
  try {
    questions = JSON.parse(raw);
  } catch {
    // Try to extract JSON array from response
    const match = raw.match(/\[[\s\S]+\]/);
    if (match) questions = JSON.parse(match[0]);
    else throw new Error("AI returned invalid JSON. Try again.");
  }

  if (!Array.isArray(questions) || questions.length === 0)
    throw new Error("AI returned empty questions. Try a different topic.");

  return {
    provider: usedProvider,
    type: "quiz-questions",
    reply: `✅ Generated ${questions.length} ${difficulty} questions${hasLocalTerms ? " from your library" : ` about "${(message||"").slice(0,40)}"`}.`,
    questions,
  };
}

// ─── Extract Terms from Text ──────────────────────────────────────────────────
export async function extractTermsFromText(rawText, settings) {
  const truncated = rawText.slice(0, 8000);
  const prompt = `Extract ONLY term-meaning pairs from this text. Ignore page numbers, headers, examples, footnotes.

Text:
${truncated}

Return ONLY a valid JSON array:
[{"term":"...","meaning":"..."}]

If no clear pairs found, return: []`;

  const geminiKey = settings?.geminiKey || ENV_GEMINI;
  if (geminiKey && !isCooling("gemini")) {
    try {
      const raw = (await callGeminiV1(geminiKey, prompt))
        .replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/\s*```$/i,"");
      const pairs = JSON.parse(raw);
      if (Array.isArray(pairs) && pairs.length > 0) { clearCooling("gemini"); return pairs; }
    } catch (e) { setCooling("gemini", e.message); }
  }

  const sarvamKey = settings?.sarvamKey || ENV_SARVAM;
  if (sarvamKey && !isCooling("sarvam")) {
    try {
      console.log("🔄 extractTerms: using Sarvam.ai");
      const raw = (await callSarvam(sarvamKey, prompt))
        .replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/\s*```$/i,"");
      const pairs = JSON.parse(raw);
      if (Array.isArray(pairs) && pairs.length > 0) { clearCooling("sarvam"); return pairs; }
    } catch (e) { setCooling("sarvam", e.message); }
  }

  return null;
}

// ─── Main Action Handler ──────────────────────────────────────────────────────
export async function action({ request }) {
  let message, settings, mode;
  try {
    const body = await request.json();
    message = body.message;
    settings = body.settings;
    mode = body.mode;
  } catch {
    return { type: "error", reply: "Invalid request format." };
  }

  // Mode: generate actual MCQ questions (AI Craft page + Quiz page)
  if (mode === "generate-quiz") {
    try {
      return await generateQuizQuestions(message, settings);
    } catch (err) {
      console.error("Quiz generation failed:", err.message);
      return { type: "error", reply: `Quiz generation failed: ${err.message}` };
    }
  }

  // Mode: extract term-meaning pairs from raw text
  if (mode === "extract-terms") {
    try {
      const pairs = await extractTermsFromText(message, settings);
      return { type: "extracted-terms", entries: pairs || [] };
    } catch (err) {
      return { type: "extracted-terms", entries: [] };
    }
  }

  // Default mode: chatbot quiz config (used by Quiz page AI chat)
  console.log("🎯 AI Quiz Request received:", {
    message: (message||"").substring(0, 50) + "...",
    settings: { primaryAI: settings?.primaryAI, hasGeminiKey: !!settings?.geminiKey },
  });

  try {
    const result = await getQuizData(message, settings);
    console.log("✅ AI Quiz Result:", {
      provider: result.provider,
      reply: (result.reply||"").substring(0, 50) + "...",
      hasQuizConfig: !!result.quizConfig,
    });
    return { ...result, fallbackUsed: result.provider === "Internal" };
  } catch (error) {
    console.error("❌ All providers failed:", error);
    try {
      const out = await internalQuizEngine(message || "", settings || {});
      return { ...out, fallbackUsed: true };
    } catch (e) {
      return data({ error: "All quiz generation methods failed.", details: e.message }, { status: 500 });
    }
  }
}
