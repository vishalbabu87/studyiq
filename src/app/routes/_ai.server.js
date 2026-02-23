const PROVIDERS = {
  GEMINI: "gemini",
  XAI: "xai",
  GROQ: "groq",
  CLOUDFLARE: "cloudflare",
  HUGGINGFACE: "huggingface",
  SARVAM: "sarvam",
  SUPABASE: "supabase",
  LOCAL: "local",
};

const DEFAULT_PROVIDER_ORDER = [
  PROVIDERS.GEMINI,
  PROVIDERS.XAI,
  PROVIDERS.GROQ,
  PROVIDERS.CLOUDFLARE,
  PROVIDERS.SUPABASE,
  PROVIDERS.SARVAM,
  PROVIDERS.HUGGINGFACE,
];

const DEFAULT_DAILY_REQUEST_LIMITS = {
  [PROVIDERS.GEMINI]: 1400,
  [PROVIDERS.XAI]: 8000,
  [PROVIDERS.GROQ]: 10000,
  [PROVIDERS.CLOUDFLARE]: 9000,
  [PROVIDERS.SUPABASE]: 20000,
  [PROVIDERS.SARVAM]: 5000,
  [PROVIDERS.HUGGINGFACE]: 15000,
};

function parsePositiveInt(value, fallback = 0) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

const ENV = {
  geminiKey: import.meta.env?.GEMINI_API_KEY || process.env.GEMINI_API_KEY || "",
  geminiModel:
    import.meta.env?.GEMINI_MODEL ||
    process.env.GEMINI_MODEL ||
    "gemini-2.0-flash-lite",
  geminiDailyLimit: parsePositiveInt(
    import.meta.env?.GEMINI_DAILY_LIMIT || process.env.GEMINI_DAILY_LIMIT,
    DEFAULT_DAILY_REQUEST_LIMITS[PROVIDERS.GEMINI],
  ),
  xaiKey: import.meta.env?.XAI_API_KEY || process.env.XAI_API_KEY || "",
  xaiModel:
    import.meta.env?.XAI_MODEL ||
    process.env.XAI_MODEL ||
    "grok-4-latest",
  xaiUrl: import.meta.env?.XAI_API_URL || process.env.XAI_API_URL || "https://api.x.ai/v1/chat/completions",
  xaiDailyLimit: parsePositiveInt(
    import.meta.env?.XAI_DAILY_LIMIT || process.env.XAI_DAILY_LIMIT,
    DEFAULT_DAILY_REQUEST_LIMITS[PROVIDERS.XAI],
  ),
  groqKey: import.meta.env?.GROQ_API_KEY || process.env.GROQ_API_KEY || "",
  groqModel:
    import.meta.env?.GROQ_MODEL ||
    process.env.GROQ_MODEL ||
    "llama-3.1-8b-instant",
  groqDailyLimit: parsePositiveInt(
    import.meta.env?.GROQ_DAILY_LIMIT || process.env.GROQ_DAILY_LIMIT,
    DEFAULT_DAILY_REQUEST_LIMITS[PROVIDERS.GROQ],
  ),
  cloudflareApiToken:
    import.meta.env?.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || "",
  cloudflareAccountId:
    import.meta.env?.CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || "",
  cloudflareModel:
    import.meta.env?.CLOUDFLARE_AI_MODEL ||
    process.env.CLOUDFLARE_AI_MODEL ||
    "@cf/meta/llama-3.1-8b-instruct",
  cloudflareAiUrl:
    import.meta.env?.CLOUDFLARE_AI_URL || process.env.CLOUDFLARE_AI_URL || "",
  cloudflareDailyLimit: parsePositiveInt(
    import.meta.env?.CLOUDFLARE_DAILY_LIMIT || process.env.CLOUDFLARE_DAILY_LIMIT,
    DEFAULT_DAILY_REQUEST_LIMITS[PROVIDERS.CLOUDFLARE],
  ),
  sarvamKey: import.meta.env?.SARVAM_API_KEY || process.env.SARVAM_API_KEY || "",
  sarvamDailyLimit: parsePositiveInt(
    import.meta.env?.SARVAM_DAILY_LIMIT || process.env.SARVAM_DAILY_LIMIT,
    DEFAULT_DAILY_REQUEST_LIMITS[PROVIDERS.SARVAM],
  ),
  huggingfaceKey:
    import.meta.env?.HUGGINGFACE_API_KEY || process.env.HUGGINGFACE_API_KEY || "",
  huggingfaceModel:
    import.meta.env?.HUGGINGFACE_MODEL ||
    process.env.HUGGINGFACE_MODEL ||
    "google/gemma-2-2b-it",
  huggingfaceDailyLimit: parsePositiveInt(
    import.meta.env?.HUGGINGFACE_DAILY_LIMIT || process.env.HUGGINGFACE_DAILY_LIMIT,
    DEFAULT_DAILY_REQUEST_LIMITS[PROVIDERS.HUGGINGFACE],
  ),
  supabaseUrl: import.meta.env?.SUPABASE_URL || process.env.SUPABASE_URL || "",
  supabaseKey: import.meta.env?.SUPABASE_KEY || process.env.SUPABASE_KEY || "",
  supabaseDailyLimit: parsePositiveInt(
    import.meta.env?.SUPABASE_DAILY_LIMIT || process.env.SUPABASE_DAILY_LIMIT,
    DEFAULT_DAILY_REQUEST_LIMITS[PROVIDERS.SUPABASE],
  ),
  supabaseAiFunction:
    import.meta.env?.SUPABASE_AI_FUNCTION ||
    process.env.SUPABASE_AI_FUNCTION ||
    "gemma-chat",
};

const cooldowns = new Map();
const COOLDOWN_MS = 2 * 60 * 1000;
const providerUsage = new Map();
const SERVER_ONLY_PROVIDER_KEYS = String(
  import.meta.env?.SERVER_ONLY_PROVIDER_KEYS || process.env.SERVER_ONLY_PROVIDER_KEYS || "1",
) !== "0";

function normalizeProvider(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw === "auto") return "any";
  if (raw === "hf") return PROVIDERS.HUGGINGFACE;
  if (raw === "grok" || raw === "x.ai") return PROVIDERS.XAI;
  if (raw === "cf" || raw === "workers-ai" || raw === "cloudflare-ai") return PROVIDERS.CLOUDFLARE;
  return raw;
}

function cleanText(text) {
  return String(text || "").trim();
}

function splitMeaningExample(rawMeaning, rawExample = "") {
  const initialMeaning = cleanText(rawMeaning);
  const initialExample = cleanText(rawExample);
  if (!initialMeaning && !initialExample) {
    return { meaning: "", example: "" };
  }

  const normalizeExample = (value) =>
    cleanText(value)
      .replace(/^(example|eg|e\.g\.)\s*[:\-]\s*/i, "")
      .replace(/^[\-–—:\s]+/, "")
      .trim();

  const markerPatterns = [
    /\bexample\s*[:\-]\s*/i,
    /\be\.g\.\s*/i,
    /\beg\.\s*[:\-]?\s*/i,
    /\bfor\s+example[,:\s]+/i,
  ];

  let meaning = initialMeaning;
  let example = initialExample;

  if (meaning) {
    const lower = meaning.toLowerCase();
    let markerIndex = -1;
    let markerLength = 0;
    for (const pattern of markerPatterns) {
      const match = lower.match(pattern);
      if (match && (markerIndex < 0 || match.index < markerIndex)) {
        markerIndex = match.index;
        markerLength = String(match[0] || "").length;
      }
    }

    if (markerIndex >= 0) {
      const left = cleanText(meaning.slice(0, markerIndex));
      const right = cleanText(meaning.slice(markerIndex + markerLength));
      if (left) meaning = left;
      if (!example && right) example = right;
    }
  }

  return {
    meaning: cleanText(meaning),
    example: normalizeExample(example),
  };
}

export function cleanJsonFence(text) {
  return cleanText(text)
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");
}

export function parseJsonLoose(text, fallback = null) {
  const cleaned = cleanJsonFence(text);
  if (!cleaned) return fallback;

  try {
    return JSON.parse(cleaned);
  } catch {
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {}
    }
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]);
      } catch {}
    }
    return fallback;
  }
}

function shouldCooldown(message) {
  const msg = String(message || "").toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("exceeded")
  );
}

function isCooling(provider) {
  const t = cooldowns.get(provider);
  return Boolean(t && Date.now() - t < COOLDOWN_MS);
}

function setCooling(provider, message) {
  if (shouldCooldown(message)) {
    cooldowns.set(provider, Date.now());
  }
}

function clearCooling(provider) {
  cooldowns.delete(provider);
}

function utcDayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getUsageRecord(provider) {
  const today = utcDayKey();
  const current = providerUsage.get(provider);
  if (!current || current.day !== today) {
    const next = { day: today, count: 0 };
    providerUsage.set(provider, next);
    return next;
  }
  return current;
}

function getProviderDailyLimit(provider, config, settings = {}) {
  const mapLimit = parsePositiveInt(settings?.providerDailyLimits?.[provider], 0);
  if (mapLimit > 0) return mapLimit;

  const flatKey = `${provider}DailyLimit`;
  const settingsLimit = parsePositiveInt(settings?.[flatKey], 0);
  if (settingsLimit > 0) return settingsLimit;

  const configLimit = parsePositiveInt(config?.[flatKey], 0);
  if (configLimit > 0) return configLimit;

  return parsePositiveInt(DEFAULT_DAILY_REQUEST_LIMITS[provider], 0);
}

function isDailyLimited(provider, config, settings = {}) {
  const limit = getProviderDailyLimit(provider, config, settings);
  if (!limit) return { limited: false, count: 0, limit: 0 };
  const usage = getUsageRecord(provider);
  return { limited: usage.count >= limit, count: usage.count, limit };
}

function markProviderAttempt(provider) {
  const usage = getUsageRecord(provider);
  usage.count += 1;
  providerUsage.set(provider, usage);
}

export async function fetchWithTimeout(url, options, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function getProviderConfig(settings = {}) {
  return {
    geminiKey: settings.geminiKey || ENV.geminiKey,
    geminiModel: settings.geminiModel || ENV.geminiModel,
    xaiKey: settings.xaiKey || ENV.xaiKey,
    xaiModel: settings.xaiModel || ENV.xaiModel,
    xaiUrl: settings.xaiUrl || ENV.xaiUrl,
    xaiDailyLimit: parsePositiveInt(settings.xaiDailyLimit, ENV.xaiDailyLimit),
    groqKey: SERVER_ONLY_PROVIDER_KEYS ? ENV.groqKey : settings.groqKey || ENV.groqKey,
    groqModel: settings.groqModel || ENV.groqModel,
    cloudflareApiToken: SERVER_ONLY_PROVIDER_KEYS
      ? ENV.cloudflareApiToken
      : settings.cloudflareApiToken || ENV.cloudflareApiToken,
    cloudflareAccountId: SERVER_ONLY_PROVIDER_KEYS
      ? ENV.cloudflareAccountId
      : settings.cloudflareAccountId || ENV.cloudflareAccountId,
    cloudflareModel: settings.cloudflareModel || ENV.cloudflareModel,
    cloudflareAiUrl: SERVER_ONLY_PROVIDER_KEYS
      ? ENV.cloudflareAiUrl
      : settings.cloudflareAiUrl || ENV.cloudflareAiUrl,
    cloudflareDailyLimit: parsePositiveInt(
      settings.cloudflareDailyLimit,
      ENV.cloudflareDailyLimit,
    ),
    sarvamKey: settings.sarvamKey || ENV.sarvamKey,
    sarvamDailyLimit: parsePositiveInt(settings.sarvamDailyLimit, ENV.sarvamDailyLimit),
    huggingfaceKey: settings.huggingfaceKey || ENV.huggingfaceKey,
    huggingfaceModel: settings.huggingfaceModel || ENV.huggingfaceModel,
    huggingfaceDailyLimit: parsePositiveInt(
      settings.huggingfaceDailyLimit,
      ENV.huggingfaceDailyLimit,
    ),
    geminiDailyLimit: parsePositiveInt(settings.geminiDailyLimit, ENV.geminiDailyLimit),
    groqDailyLimit: parsePositiveInt(settings.groqDailyLimit, ENV.groqDailyLimit),
    supabaseUrl: settings.supabaseUrl || ENV.supabaseUrl,
    supabaseKey: settings.supabaseKey || ENV.supabaseKey,
    supabaseDailyLimit: parsePositiveInt(settings.supabaseDailyLimit, ENV.supabaseDailyLimit),
    supabaseAiFunction:
      settings.supabaseAiFunction || ENV.supabaseAiFunction || "gemma-chat",
  };
}

function getAvailableProviders(config) {
  return {
    [PROVIDERS.GEMINI]: Boolean(config.geminiKey),
    [PROVIDERS.XAI]: Boolean(config.xaiKey),
    [PROVIDERS.GROQ]: Boolean(config.groqKey),
    [PROVIDERS.CLOUDFLARE]: Boolean(config.cloudflareApiToken && (config.cloudflareAiUrl || config.cloudflareAccountId)),
    [PROVIDERS.HUGGINGFACE]: Boolean(config.huggingfaceKey),
    [PROVIDERS.SARVAM]: Boolean(config.sarvamKey),
    [PROVIDERS.SUPABASE]: Boolean(config.supabaseUrl && config.supabaseKey),
  };
}

function parseCustomOrder(settings) {
  const raw = settings?.providerChain;
  if (!raw) return [];
  const list = String(raw)
    .split(",")
    .map((item) => normalizeProvider(item))
    .filter(Boolean);
  return [...new Set(list)];
}

export function buildProviderOrder(settings = {}) {
  const preferred = normalizeProvider(settings.primaryAI || "any");
  if (preferred === PROVIDERS.LOCAL) return [];

  const customOrder = parseCustomOrder(settings);
  const base = customOrder.length ? customOrder : DEFAULT_PROVIDER_ORDER;
  if (!preferred || preferred === "any") return base;

  const ordered = [preferred, ...base];
  return [...new Set(ordered)];
}

async function callGemini(prompt, config, settings) {
  const url = `https://generativelanguage.googleapis.com/v1/models/${config.geminiModel}:generateContent?key=${config.geminiKey}`;
  const res = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: settings?.temperature ?? 0.2,
          maxOutputTokens: settings?.maxTokens ?? 4096,
        },
      }),
    },
    15000,
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `Gemini ${res.status}: ${err?.error?.message || res.statusText || "Request failed"}`,
    );
  }
  const json = await res.json();
  return cleanText(json?.candidates?.[0]?.content?.parts?.[0]?.text);
}

async function callXai(prompt, config, settings) {
  const res = await fetchWithTimeout(
    settings?.xaiUrl || config.xaiUrl,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.xaiKey}`,
      },
      body: JSON.stringify({
        model: settings?.xaiModel || config.xaiModel,
        messages: [{ role: "user", content: prompt }],
        temperature: settings?.temperature ?? 0.2,
        max_tokens: settings?.maxTokens ?? 4096,
      }),
    },
    22000,
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `xAI ${res.status}: ${err?.error?.message || res.statusText || "Request failed"}`,
    );
  }
  const json = await res.json();
  return cleanText(json?.choices?.[0]?.message?.content);
}

async function callGroq(prompt, config, settings) {
  const res = await fetchWithTimeout(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.groqKey}`,
      },
      body: JSON.stringify({
        model: settings?.groqModel || config.groqModel,
        messages: [{ role: "user", content: prompt }],
        temperature: settings?.temperature ?? 0.2,
        max_tokens: settings?.maxTokens ?? 4096,
      }),
    },
    22000,
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `Groq ${res.status}: ${err?.error?.message || res.statusText || "Request failed"}`,
    );
  }
  const json = await res.json();
  return cleanText(json?.choices?.[0]?.message?.content);
}

async function callCloudflare(prompt, config, settings) {
  const aiUrl =
    settings?.cloudflareAiUrl ||
    config.cloudflareAiUrl ||
    `https://api.cloudflare.com/client/v4/accounts/${config.cloudflareAccountId}/ai/run/${encodeURIComponent(
      settings?.cloudflareModel || config.cloudflareModel,
    )}`;

  const res = await fetchWithTimeout(
    aiUrl,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.cloudflareApiToken}`,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        temperature: settings?.temperature ?? 0.2,
        max_tokens: settings?.maxTokens ?? 4096,
      }),
    },
    22000,
  );

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Cloudflare ${res.status}: ${err || res.statusText || "Request failed"}`);
  }

  const json = await res.json().catch(() => ({}));
  return cleanText(
    json?.result?.response ||
      json?.result?.text ||
      json?.result?.output_text ||
      json?.response ||
      json?.choices?.[0]?.message?.content,
  );
}

async function callSarvam(prompt, config, settings) {
  const res = await fetchWithTimeout(
    "https://api.sarvam.ai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": config.sarvamKey,
      },
      body: JSON.stringify({
        model: settings?.sarvamModel || "sarvam-m",
        messages: [{ role: "user", content: prompt }],
        temperature: settings?.temperature ?? 0.2,
        max_tokens: settings?.maxTokens ?? 4096,
      }),
    },
    22000,
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `Sarvam ${res.status}: ${err?.error?.message || res.statusText || "Request failed"}`,
    );
  }
  const json = await res.json();
  return cleanText(json?.choices?.[0]?.message?.content);
}

async function callHuggingFaceRouter(prompt, config, settings) {
  const res = await fetchWithTimeout(
    "https://router.huggingface.co/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.huggingfaceKey}`,
      },
      body: JSON.stringify({
        model: config.huggingfaceModel,
        messages: [{ role: "user", content: prompt }],
        temperature: settings?.temperature ?? 0.2,
        max_tokens: settings?.maxTokens ?? 4096,
      }),
    },
    25000,
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `HuggingFace ${res.status}: ${err?.error?.message || res.statusText || "Request failed"}`,
    );
  }

  const json = await res.json();
  return cleanText(json?.choices?.[0]?.message?.content);
}

async function callHuggingFaceLegacy(prompt, config, settings) {
  const res = await fetchWithTimeout(
    `https://api-inference.huggingface.co/models/${config.huggingfaceModel}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.huggingfaceKey}`,
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          temperature: settings?.temperature ?? 0.2,
          max_new_tokens: settings?.maxTokens ?? 1024,
        },
      }),
    },
    25000,
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `HuggingFace legacy ${res.status}: ${err?.error || res.statusText || "Request failed"}`,
    );
  }
  const json = await res.json();
  if (Array.isArray(json) && json[0]?.generated_text) {
    return cleanText(json[0].generated_text);
  }
  if (typeof json === "object" && json?.generated_text) {
    return cleanText(json.generated_text);
  }
  return cleanText("");
}

async function callHuggingFace(prompt, config, settings) {
  try {
    return await callHuggingFaceRouter(prompt, config, settings);
  } catch (err) {
    return callHuggingFaceLegacy(prompt, config, settings);
  }
}

async function callSupabase(prompt, config, settings) {
  const aiUrl =
    settings?.supabaseAiUrl ||
    `${String(config.supabaseUrl || "").replace(/\/$/, "")}/functions/v1/${config.supabaseAiFunction}`;

  const res = await fetchWithTimeout(
    aiUrl,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.supabaseKey,
        Authorization: `Bearer ${config.supabaseKey}`,
      },
      body: JSON.stringify({
        prompt,
        messages: [{ role: "user", content: prompt }],
        model: settings?.supabaseModel || "gemma",
        temperature: settings?.temperature ?? 0.2,
      }),
    },
    25000,
  );

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Supabase ${res.status}: ${err || res.statusText || "Request failed"}`);
  }

  const json = await res.json().catch(() => ({}));
  return cleanText(
    json?.text ||
      json?.response ||
      json?.message ||
      json?.choices?.[0]?.message?.content ||
      json?.data?.text,
  );
}

async function callProvider(provider, prompt, config, settings) {
  if (provider === PROVIDERS.GEMINI) return callGemini(prompt, config, settings);
  if (provider === PROVIDERS.XAI) return callXai(prompt, config, settings);
  if (provider === PROVIDERS.GROQ) return callGroq(prompt, config, settings);
  if (provider === PROVIDERS.CLOUDFLARE) return callCloudflare(prompt, config, settings);
  if (provider === PROVIDERS.HUGGINGFACE) return callHuggingFace(prompt, config, settings);
  if (provider === PROVIDERS.SARVAM) return callSarvam(prompt, config, settings);
  if (provider === PROVIDERS.SUPABASE) return callSupabase(prompt, config, settings);
  return "";
}

export async function callWithFallback({ prompt, settings = {}, allowEmpty = false }) {
  const config = getProviderConfig(settings);
  const available = getAvailableProviders(config);
  const order = buildProviderOrder(settings);
  const errors = [];

  for (const provider of order) {
    if (!available[provider]) continue;
    if (isCooling(provider)) {
      errors.push(`${provider}: cooling down`);
      continue;
    }
    const usageCheck = isDailyLimited(provider, config, settings);
    if (usageCheck.limited) {
      errors.push(`${provider}: daily limit reached (${usageCheck.count}/${usageCheck.limit})`);
      continue;
    }

    try {
      markProviderAttempt(provider);
      const text = await callProvider(provider, prompt, config, settings);
      if (text || allowEmpty) {
        clearCooling(provider);
        return { provider, text, errors };
      }
      throw new Error("Empty response");
    } catch (error) {
      const message = String(error?.message || error);
      setCooling(provider, message);
      errors.push(`${provider}: ${message}`);
    }
  }

  return { provider: PROVIDERS.LOCAL, text: "", errors };
}

export function normalizeEntries(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((item) => {
      const term = String(
        item?.term || item?.word || item?.phrase || item?.left || item?.subject || "",
      ).trim();
      const rawMeaning = String(
        item?.meaning || item?.definition || item?.def || item?.right || item?.object || "",
      ).trim();
      const rawExample = String(item?.example || item?.usage || item?.sentence || "").trim();
      const split = splitMeaningExample(rawMeaning, rawExample);
      const meaning = split.meaning || rawMeaning;
      const example = split.example;

      const normalized = {
        ...(typeof item === "object" && item ? item : {}),
        term,
        meaning: cleanText(meaning),
      };
      if (example) normalized.example = example;
      return normalized;
    })
    .filter((item) => item.term && item.meaning);
}

export function dedupeEntries(entries) {
  const merged = new Map();
  for (const item of normalizeEntries(entries)) {
    const key = `${item.term}:::${item.meaning}`.toLowerCase();
    const prev = merged.get(key);
    if (!prev) {
      merged.set(key, item);
      continue;
    }
    if (!prev.example && item.example) {
      merged.set(key, { ...prev, example: item.example });
    }
  }
  return [...merged.values()];
}

export { PROVIDERS };
