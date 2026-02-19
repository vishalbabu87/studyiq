/**
 * Server-side file parsing route
 * Uses pdf-parse, mammoth, xlsx to extract text from binary files
 * Then uses AI to extract term-meaning pairs from the text
 */

import { data } from "react-router";

// Dynamic imports
async function getPdfParse() {
  try {
    return (await import('pdf-parse')).default;
  } catch { return null; }
}

async function getMammoth() {
  try {
    return (await import('mammoth')).default;
  } catch { return null; }
}

async function getXLSX() {
  try {
    return (await import('xlsx')).default;
  } catch { return null; }
}

// Env vars
const ENV_GEMINI = import.meta.env?.GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
const ENV_SARVAM = import.meta.env?.SARVAM_API_KEY || process.env.SARVAM_API_KEY || "";

// Fetch with timeout
async function fetchWithTimeout(url, options, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
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
    25000
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
        generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
      }),
    },
    20000
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Gemini API error ${res.status}: ${err?.error?.message || res.statusText}`);
  }
  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
}

// Comprehensive multi-format extraction (NO AI NEEDED for structured files)
function extractPairsComprehensive(text) {
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

  const lines = text.split(/\r?\n/);
  
  // Noise patterns to filter out (headers, batch markers, etc.)
  const noisePatterns = [
    /^batch\s*\d+/i,
    /^clean\s*&?\s*valid/i,
    /^idioms?\s*\d+/i,
    /^✅\s*batch/i,
    /^this list is very large/i,
    /^i('ll| will) (start|do)/i,
    /^exactly as per/i,
    /^_{3,}$/,
    /^={3,}$/,
    /^\d+\s*-\s*\d+\s*idioms?$/i,
    /^terms?\s*\(\d+\)$/i,
  ];
  
  // Check if line is noise/header
  const isNoise = (line) => {
    for (const pattern of noisePatterns) {
      if (pattern.test(line)) return true;
    }
    return false;
  };
  
  // ─── FORMAT B: Multi-line with "Meaning:" keyword ───
  // Pattern: "1. term" followed by "Meaning: definition" on next line
  let currentTerm = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines and noise
    if (!line || isNoise(line)) continue;
    
    // Check for "Meaning:" line
    const meaningMatch = line.match(/^Meaning:\s*(.+)$/i);
    if (meaningMatch && currentTerm) {
      out.push({ term: currentTerm, meaning: meaningMatch[1].trim() });
      currentTerm = null;
      continue;
    }
    
    // Check for "Definition:" line
    const defMatch = line.match(/^(Definition|Def):\s*(.+)$/i);
    if (defMatch && currentTerm) {
      out.push({ term: currentTerm, meaning: defMatch[2].trim() });
      currentTerm = null;
      continue;
    }
    
    // Skip "Example:" lines
    if (/^Example:/i.test(line)) {
      currentTerm = null;
      continue;
    }
    
    // Check for numbered term line: "1. term" or "1) term" or "1- term"
    const numMatch = line.match(/^\d+[\.\)\-]\s*(.+)$/);
    if (numMatch) {
      const potentialTerm = numMatch[1].trim();
      
      // Check if it also contains meaning on same line (Format A)
      // Pattern: "1. term – meaning" or "1. term - meaning"
      const inlineMatch = potentialTerm.match(/^(.+?)\s*[–—\-:]\s*(.+)$/);
      if (inlineMatch && inlineMatch[2].length > 10) {
        // Format A: meaning is on same line
        out.push({ term: inlineMatch[1].trim(), meaning: inlineMatch[2].trim() });
        currentTerm = null;
      } else {
        // Could be Format B: term only, meaning on next line
        currentTerm = potentialTerm;
      }
      continue;
    }
    
    // ─── FORMAT A: Same-line patterns ───
    
    // Pattern: "term – meaning" with em-dash or hyphen
    const dashMatch = line.match(/^(.+?)\s*[–—]\s*(.+)$/);
    if (dashMatch && dashMatch[1].length > 2 && dashMatch[2].length > 5) {
      // Skip if it looks like a header/noise
      if (!/^(page|chapter|batch|example|note)/i.test(dashMatch[1])) {
        out.push({ term: dashMatch[1].trim(), meaning: dashMatch[2].trim() });
        currentTerm = null;
        continue;
      }
    }
    
    // Pattern: "term - meaning" with regular hyphen (but not part of word)
    const hyphenMatch = line.match(/^(.+?)\s+-\s+(.+)$/);
    if (hyphenMatch && hyphenMatch[1].length > 2 && hyphenMatch[2].length > 5) {
      if (!/^(page|chapter|batch|example|note)/i.test(hyphenMatch[1])) {
        out.push({ term: hyphenMatch[1].trim(), meaning: hyphenMatch[2].trim() });
        currentTerm = null;
        continue;
      }
    }
    
    // Pattern: "term: meaning" (but not "Meaning: ..." which we handle above)
    const colonMatch = line.match(/^(.+?):\s*(.+)$/);
    if (colonMatch && colonMatch[1].length > 2 && colonMatch[2].length > 3) {
      if (!/^(meaning|definition|example|page|chapter|note)/i.test(colonMatch[1])) {
        out.push({ term: colonMatch[1].trim(), meaning: colonMatch[2].trim() });
        currentTerm = null;
        continue;
      }
    }
    
    // Pattern: "term = meaning"
    const eqMatch = line.match(/^(.+?)\s*=\s*(.+)$/);
    if (eqMatch && eqMatch[1].length > 2 && eqMatch[2].length > 3) {
      out.push({ term: eqMatch[1].trim(), meaning: eqMatch[2].trim() });
      currentTerm = null;
      continue;
    }
    
    // CSV format: "term, meaning"
    if (line.includes(",") && !line.match(/^\d/)) {
      const parts = line.split(",").map(s => s.trim()).filter(Boolean);
      if (parts.length === 2 && parts[0].length > 2 && parts[1].length > 3) {
        out.push({ term: parts[0], meaning: parts[1] });
        currentTerm = null;
        continue;
      }
    }
  }
  
  // Deduplicate
  const seen = new Set();
  return out.filter(item => {
    const key = `${item.term}:::${item.meaning}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Keep old function name for compatibility
const extractPairsHeuristic = extractPairsComprehensive;

// AI extraction
async function extractWithAI(text, settings) {
  const truncated = text.slice(0, 12000); // Allow larger text
  
  const prompt = `You are a data extraction expert. Extract ALL term-meaning pairs from this document.

DOCUMENT TEXT:
${truncated}

RULES:
1. Find ALL word/phrase and definition pairs
2. Skip: page numbers, headers, footers, chapter titles, URLs, example sentences
3. Each pair: term (word/phrase) + meaning (definition)
4. Return ONLY valid JSON array, no markdown

Example output:
[{"term":"ubiquitous","meaning":"present everywhere"},{"term":"ephemeral","meaning":"lasting for a short time"}]

Return the JSON array now:`;

  const geminiKey = settings?.geminiKey || ENV_GEMINI;
  const sarvamKey = settings?.sarvamKey || ENV_SARVAM;

  // Try Gemini first
  if (geminiKey) {
    try {
      console.log("🔄 Parse: trying Gemini...");
      const raw = await callGemini(geminiKey, prompt);
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
      const pairs = JSON.parse(cleaned);
      if (Array.isArray(pairs) && pairs.length > 0) {
        console.log(`✅ Gemini extracted ${pairs.length} pairs`);
        return pairs;
      }
    } catch (e) {
      console.warn("Gemini parse failed:", e.message?.substring(0, 60));
    }
  }

  // Try Sarvam
  if (sarvamKey) {
    try {
      console.log("🔄 Parse: trying Sarvam...");
      const raw = await callSarvam(sarvamKey, prompt);
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
      const pairs = JSON.parse(cleaned);
      if (Array.isArray(pairs) && pairs.length > 0) {
        console.log(`✅ Sarvam extracted ${pairs.length} pairs`);
        return pairs;
      }
    } catch (e) {
      console.warn("Sarvam parse failed:", e.message?.substring(0, 60));
    }
  }

  return null;
}

// Main action
export async function action({ request }) {
  try {
    const contentType = request.headers.get("content-type") || "";
    
    // Handle JSON body (text already extracted)
    if (contentType.includes("application/json")) {
      const body = await request.json();
      const text = body.text || body.message || "";
      
      // Try AI extraction
      const aiPairs = await extractWithAI(text, body.settings || {});
      if (aiPairs && aiPairs.length > 0) {
        return { ok: true, entries: aiPairs, count: aiPairs.length, usedAI: true };
      }
      
      // Fall back to heuristic
      const entries = extractPairsHeuristic(text);
      return { ok: true, entries, count: entries.length, usedAI: false };
    }
    
    // Handle FormData (file upload)
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      
      if (!file) {
        return { error: "No file provided" };
      }
      
      const fileName = (file.name || "").toLowerCase();
      const buffer = await file.arrayBuffer();
      let text = "";
      
      // PDF
      if (fileName.endsWith(".pdf")) {
        const pdfParse = await getPdfParse();
        if (pdfParse) {
          try {
            const data = await pdfParse(Buffer.from(buffer));
            text = data.text || "";
            console.log(`📄 PDF parsed: ${text.length} chars`);
          } catch (e) {
            console.error("PDF parse error:", e.message);
          }
        }
      }
      
      // DOCX
      if (fileName.endsWith(".docx")) {
        const mammoth = await getMammoth();
        if (mammoth) {
          try {
            const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
            text = result.value || "";
            console.log(`📄 DOCX parsed: ${text.length} chars`);
          } catch (e) {
            console.error("DOCX parse error:", e.message);
          }
        }
      }
      
      // DOC (try mammoth, might work for some)
      if (fileName.endsWith(".doc")) {
        const mammoth = await getMammoth();
        if (mammoth) {
          try {
            const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
            text = result.value || "";
            console.log(`📄 DOC parsed: ${text.length} chars`);
          } catch (e) {
            console.error("DOC parse error:", e.message);
          }
        }
      }
      
      // XLSX/XLS
      if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        const xlsx = await getXLSX();
        if (xlsx) {
          try {
            const workbook = xlsx.read(buffer, { type: 'array' });
            const sheets = [];
            for (const sheetName of workbook.SheetNames) {
              const sheet = workbook.Sheets[sheetName];
              sheets.push(xlsx.utils.sheet_to_csv(sheet));
            }
            text = sheets.join('\n\n');
            console.log(`📊 Excel parsed: ${text.length} chars`);
          } catch (e) {
            console.error("Excel parse error:", e.message);
          }
        }
      }
      
      // TXT/CSV/JSON
      if (fileName.endsWith(".txt") || fileName.endsWith(".csv") || fileName.endsWith(".json")) {
        text = new TextDecoder().decode(buffer);
      }
      
      // Fallback if no text extracted
      if (!text) {
        text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
        // Clean up binary garbage
        text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
                   .replace(/[^\x20-\x7E\n\r\t\u00A0-\uFFFF]/g, ' ')
                   .replace(/\s+/g, ' ');
      }
      
      // Now extract pairs from text
      const settings = JSON.parse(formData.get("settings") || "{}");
      
      // STEP 1: Always try comprehensive parser FIRST (works for structured files, no AI needed)
      const parsedEntries = extractPairsComprehensive(text);
      console.log(`📝 Parser found ${parsedEntries.length} entries from ${text.length} chars`);
      
      // If parser found many entries, use them (no AI needed!)
      if (parsedEntries.length >= 50) {
        return { ok: true, entries: parsedEntries, count: parsedEntries.length, usedAI: false, textLength: text.length };
      }
      
      // STEP 2: If parser found few/no results, try AI for unstructured text
      // But use full text for AI (no truncation in prompt - let AI decide)
      const isBinary = /\.(pdf|doc|docx|xlsx|xls)$/i.test(fileName);
      
      if (isBinary || text.length > 1000) {
        const aiPairs = await extractWithAI(text, settings);
        if (aiPairs && aiPairs.length > parsedEntries.length) {
          // Combine AI results with parsed results
          const combined = [...aiPairs];
          for (const p of parsedEntries) {
            const key = `${p.term}:::${p.meaning}`.toLowerCase();
            if (!combined.some(c => `${c.term}:::${c.meaning}`.toLowerCase() === key)) {
              combined.push(p);
            }
          }
          return { ok: true, entries: combined, count: combined.length, usedAI: true, textLength: text.length };
        }
      }
      
      // Return parser results
      return { ok: true, entries: parsedEntries, count: parsedEntries.length, usedAI: false, textLength: text.length };
    }
    
    return { error: "Unsupported content type" };
    
  } catch (error) {
    console.error("Parse API error:", error);
    return { error: "Failed to parse file", details: error.message };
  }
}