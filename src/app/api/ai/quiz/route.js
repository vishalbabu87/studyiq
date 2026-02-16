const schemaDefaults = {
  questionCount: 10,
  difficulty: "medium",
  mode: "sequential",
  rangeStart: 1,
  rangeEnd: 10,
  timerMinutes: 5,
};

function normalizeConfig(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    questionCount: Math.max(1, Number.parseInt(raw.questionCount || schemaDefaults.questionCount, 10)),
    difficulty: ["easy", "medium", "hard"].includes(raw.difficulty) ? raw.difficulty : "medium",
    mode: ["sequential", "random", "mistakes"].includes(raw.mode) ? raw.mode : "sequential",
    rangeStart: Math.max(1, Number.parseInt(raw.rangeStart || schemaDefaults.rangeStart, 10)),
    rangeEnd: Math.max(1, Number.parseInt(raw.rangeEnd || schemaDefaults.rangeEnd, 10)),
    timerMinutes: Math.max(1, Number.parseInt(raw.timerMinutes || schemaDefaults.timerMinutes, 10)),
    category: raw.category || "",
    file: raw.file ? String(raw.file) : "",
  };
}

function localParser(message) {
  const text = String(message || "");
  const count = text.match(/(\d+)\s*(question|questions|mcq|mcqs)/i)?.[1];
  const range = text.match(/(\d+)\s*[-:]\s*(\d+)/);
  const difficulty = text.match(/\b(easy|medium|hard)\b/i)?.[1]?.toLowerCase();
  const mode = text.match(/\b(random|sequential|sequence|mistakes)\b/i)?.[1]?.toLowerCase();

  return normalizeConfig({
    questionCount: count ? Number.parseInt(count, 10) : 10,
    difficulty: difficulty || "medium",
    mode: mode === "sequence" ? "sequential" : mode || "sequential",
    rangeStart: range ? Number.parseInt(range[1], 10) : 1,
    rangeEnd: range ? Number.parseInt(range[2], 10) : 10,
  });
}

function parseModelJSON(content) {
  try {
    return JSON.parse(content);
  } catch {
    const block = content.match(/\{[\s\S]*\}/);
    if (!block) return null;
    try {
      return JSON.parse(block[0]);
    } catch {
      return null;
    }
  }
}

async function askGemini(message, apiKey) {
  if (!apiKey) return null;
  const prompt = `Return valid JSON only: {"reply":"...","quizConfig":{"questionCount":10,"difficulty":"easy|medium|hard","mode":"sequential|random|mistakes","rangeStart":1,"rangeEnd":10,"timerMinutes":5}} based on: ${message}`;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
    },
  );
  if (!response.ok) return null;
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return parseModelJSON(text);
}

async function askOpenAI(message, apiKey) {
  if (!apiKey) return null;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            'Return valid JSON only with keys: reply, quizConfig. quizConfig keys: questionCount,difficulty,mode,rangeStart,rangeEnd,timerMinutes.',
        },
        { role: "user", content: message },
      ],
    }),
  });
  if (!response.ok) return null;
  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content || "";
  return parseModelJSON(text);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const message = body?.message || "";
    const settings = body?.settings || {};

    const geminiKey = process.env.GEMINI_API_KEY || settings.geminiKey;
    const openaiKey = process.env.OPENAI_API_KEY || settings.openaiKey;
    const primary = settings.primaryAI === "openai" ? "openai" : "gemini";
    const allowFallback = settings.autoFallback !== false;

    const providers = primary === "openai" ? ["openai", "gemini"] : ["gemini", "openai"];
    let payload = null;
    let provider = "local";
    let fallbackUsed = false;

    for (let i = 0; i < providers.length; i += 1) {
      const name = providers[i];
      if (name === "gemini") payload = await askGemini(message, geminiKey);
      if (name === "openai") payload = await askOpenAI(message, openaiKey);
      if (payload) {
        provider = name;
        fallbackUsed = i > 0;
        break;
      }
      if (!allowFallback) break;
    }

    if (!payload) {
      const config = localParser(message);
      return Response.json({
        reply: "AI unavailable or limit reached. Local engine config generated.",
        quizConfig: config,
        provider: "local",
        fallbackUsed: true,
      });
    }

    const normalized = normalizeConfig(payload.quizConfig || payload.config || localParser(message));
    return Response.json({
      reply: payload.reply || "Quiz configuration prepared.",
      quizConfig: normalized,
      provider,
      fallbackUsed,
    });
  } catch {
    return Response.json({
      reply: "AI request failed. Falling back to local parser.",
      quizConfig: localParser("10 medium sequential questions 1-10"),
      provider: "local",
      fallbackUsed: true,
    });
  }
}
