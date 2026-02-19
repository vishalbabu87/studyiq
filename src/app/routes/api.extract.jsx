// Extract route - handles file/text extraction with AI assistance
// Self-contained to avoid circular imports

import { data } from "react-router";

// Read env vars
const ENV_GEMINI = import.meta.env?.GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
const ENV_SARVAM = import.meta.env?.SARVAM_API_KEY || process.env.SARVAM_API_KEY || "";

// Fetch with timeout
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

// Sarvam API call
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
    20000
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Sarvam API error ${res.status}: ${err?.error?.message || res.statusText}`);
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content?.trim() || "";
}

// Gemini API call
async function callGemini(apiKey, prompt, model = "gemini-2.0-flash-lite") {
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
    15000
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Gemini API error ${res.status}: ${err?.error?.message || res.statusText}`);
  }
  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
}

// Local heuristic extraction (fallback - always works)
function extractPairsHeuristic(text) {
  const out = [];
  if (!text) return out;

  // Try JSON array first
  try {
    const j = JSON.parse(text);
    if (Array.isArray(j)) {
      for (const it of j) {
        const term = it.term || it.word || it.phrase || "";
        const meaning = it.meaning || it.definition || it.def || "";
        if (term && meaning) out.push({ term: String(term).trim(), meaning: String(meaning).trim() });
      }
      if (out.length) return out;
    }
  } catch {}

  // Line-based patterns
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const l = line.trim();
    if (!l) continue;

    // Skip noise lines
    if (/^(page|chapter|example|note|see also|reference|www|http|\d+$)/i.test(l)) continue;
    if (l.length < 3 || l.length > 200) continue;

    // term - meaning
    let m = l.match(/^(.+?)\s*[-–—]\s*(.+)$/);
    if (m && m[1].length < 80 && m[2].length < 150) {
      out.push({ term: m[1].trim(), meaning: m[2].trim() });
      continue;
    }

    // term: meaning
    m = l.match(/^(.+?)\s*:\s*(.+)$/);
    if (m && m[1].length < 80 && m[2].length < 150 && !m[1].includes(":")) {
      out.push({ term: m[1].trim(), meaning: m[2].trim() });
      continue;
    }

    // CSV format
    const parts = l.split(",").map(s => s.trim()).filter(Boolean);
    if (parts.length === 2 && parts[0].length < 80 && parts[1].length < 150) {
      out.push({ term: parts[0], meaning: parts[1] });
    }
  }
  return out;
}

// AI-powered extraction
async function extractWithAI(rawText, settings) {
  const truncated = rawText.slice(0, 8000);
  const prompt = `Extract ONLY clean term-meaning pairs from this text.

IMPORTANT RULES:
1. IGNORE: page numbers, headers, footers, chapter titles, examples, footnotes, URLs
2. Each pair should be: a word/phrase AND its definition/meaning
3. DO NOT include example sentences as terms
4. DO NOT include noise like "Page 45", "Chapter 3", "See also"

Text:
${truncated}

Return ONLY a valid JSON array (no markdown):
[{"term":"...","meaning":"..."}]

If no clear term-meaning pairs found, return: []`;

  const geminiKey = settings?.geminiKey || ENV_GEMINI;
  const sarvamKey = settings?.sarvamKey || ENV_SARVAM;

  // Try Gemini first
  if (geminiKey) {
    try {
      console.log("🔄 Extract: trying Gemini...");
      const raw = await callGemini(geminiKey, prompt);
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
      const pairs = JSON.parse(cleaned);
      if (Array.isArray(pairs) && pairs.length > 0) {
        console.log(`✅ Gemini extracted ${pairs.length} pairs`);
        return pairs;
      }
    } catch (e) {
      console.warn("Gemini extract failed:", e.message?.substring(0, 60));
    }
  }

  // Try Sarvam
  if (sarvamKey) {
    try {
      console.log("🔄 Extract: trying Sarvam...");
      const raw = await callSarvam(sarvamKey, prompt);
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
      const pairs = JSON.parse(cleaned);
      if (Array.isArray(pairs) && pairs.length > 0) {
        console.log(`✅ Sarvam extracted ${pairs.length} pairs`);
        return pairs;
      }
    } catch (e) {
      console.warn("Sarvam extract failed:", e.message?.substring(0, 60));
    }
  }

  return null;
}

// Main action handler
export async function action({ request }) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let rawText = "";
    let entries = [];
    let usedAI = false;

    // Handle JSON body (for API calls)
    if (contentType.includes("application/json")) {
      const body = await request.json();
      rawText = body.message || body.text || "";
      
      // First try local heuristic
      entries = extractPairsHeuristic(rawText);
      
      // If weak results, try AI
      if (entries.length < 3) {
        const aiEntries = await extractWithAI(rawText, body.settings || {});
        if (aiEntries && aiEntries.length > 0) {
          entries = aiEntries;
          usedAI = true;
        }
      }
      
      return { 
        ok: true, 
        entries,
        count: entries.length,
        usedAI 
      };
    }

    // Handle FormData (for file uploads)
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");

      if (!file) {
        return { error: "No file provided" };
      }

      const fileName = (file.name || "").toLowerCase();

      // Handle JSON file
      if (fileName.endsWith(".json")) {
        const text = await file.text();
        const jsonData = JSON.parse(text);
        if (Array.isArray(jsonData)) {
          entries = jsonData
            .map(item => ({
              term: item.term || item.word || item.key || "",
              meaning: item.meaning || item.definition || item.value || ""
            }))
            .filter(item => item.term && item.meaning);
          return { ok: true, entries, count: entries.length };
        }
      }

      // Handle CSV file
      if (fileName.endsWith(".csv")) {
        rawText = await file.text();
        const lines = rawText.split(/\r?\n/).filter(line => line.trim());
        const skipHeader = lines[0]?.toLowerCase().includes("term") ? 1 : 0;
        for (let i = skipHeader; i < lines.length; i++) {
          const [term, meaning] = lines[i].split(",").map(cell => cell?.trim()?.replace(/^"|"$/g, ""));
          if (term && meaning) entries.push({ term, meaning });
        }
        if (entries.length > 0) {
          return { ok: true, entries, count: entries.length };
        }
      }

      // Handle TXT and other files
      if (fileName.endsWith(".txt") || file.type === "text/plain") {
        rawText = await file.text();
      } else {
        // For PDF, DOC, etc - try to decode as text
        try {
          rawText = new TextDecoder("utf-8", { fatal: false }).decode(await file.arrayBuffer());
        } catch {
          rawText = "";
        }
      }

      // Try local extraction first
      entries = extractPairsHeuristic(rawText);

      // If weak results, use AI
      if (entries.length < 3 && rawText.length > 10) {
        const aiEntries = await extractWithAI(rawText, {});
        if (aiEntries && aiEntries.length > 0) {
          entries = aiEntries;
          usedAI = true;
        }
      }

      return {
        ok: true,
        entries,
        count: entries.length,
        usedAI,
        message: entries.length > 0 ? `Extracted ${entries.length} terms` : "No terms found"
      };
    }

    // Handle plain text body
    rawText = await request.text();
    entries = extractPairsHeuristic(rawText);
    
    if (entries.length < 3) {
      const aiEntries = await extractWithAI(rawText, {});
      if (aiEntries && aiEntries.length > 0) {
        entries = aiEntries;
        usedAI = true;
      }
    }

    return { ok: true, entries, count: entries.length, usedAI };

  } catch (error) {
    console.error("Extract API error:", error);
    return { error: "Failed to extract terms", details: error.message };
  }
}
