function parseTextToEntries(text, pageNumber = null) {
  const entries = [];
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const patterns = [/^(.+?)\s*[-–—]\s*(.+)$/, /^(.+?)\s*:\s*(.+)$/, /^(.+?)\s*=\s*(.+)$/];

  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match?.[1] && match?.[2]) {
        entries.push({ term: match[1].trim(), meaning: match[2].trim(), pageNumber });
        break;
      }
    }
  }

  return entries;
}

function parseCSV(text) {
  const rows = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const start = rows[0]?.toLowerCase().includes("term") ? 1 : 0;
  const entries = [];
  for (let i = start; i < rows.length; i += 1) {
    const [first, second] = rows[i].split(",").map((part) => part?.trim()?.replace(/^"|"$/g, ""));
    if (first && second) entries.push({ term: first, meaning: second });
  }
  return entries;
}

function parsePageRange(pageRangeRaw) {
  const text = String(pageRangeRaw || "").trim();
  const match = text.match(/^(\d+)\s*[-:]\s*(\d+)$/);
  if (!match) return null;
  const start = Math.max(1, Number.parseInt(match[1], 10));
  const end = Math.max(start, Number.parseInt(match[2], 10));
  return { start, end };
}

function pickTermMeaningFromObject(row) {
  if (!row || typeof row !== "object") return null;
  const lowerMap = Object.fromEntries(Object.entries(row).map(([key, value]) => [String(key).toLowerCase(), value]));
  const term =
    lowerMap.term ||
    lowerMap.word ||
    lowerMap.phrase ||
    lowerMap.question ||
    Object.values(row)[0];
  const meaning =
    lowerMap.meaning ||
    lowerMap.definition ||
    lowerMap.answer ||
    Object.values(row)[1];

  if (!term || !meaning) return null;
  return { term: String(term).trim(), meaning: String(meaning).trim() };
}

async function extractPDFText(file) {
  const mod = await import("pdf-parse");
  const pdfParse = mod.default || mod;
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await pdfParse(buffer);
  return String(result?.text || "");
}

async function extractDOCXText(file) {
  const mod = await import("mammoth");
  const mammoth = mod.default || mod;
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await mammoth.extractRawText({ buffer });
  return String(result?.value || "");
}

async function extractXLSXEntries(file) {
  const XLSX = await import("xlsx");
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const entries = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    for (const row of rows) {
      const picked = pickTermMeaningFromObject(row);
      if (picked?.term && picked?.meaning) {
        entries.push(picked);
      }
    }
  }

  return entries;
}

async function runOCR(file, pageRange) {
  const ocrKey = process.env.OCR_SPACE_KEY;
  if (!ocrKey) return "";
  const form = new FormData();
  form.append("file", file, file.name || "upload");
  form.append("language", "eng");
  form.append("isOverlayRequired", "false");
  if (pageRange?.start && pageRange?.end) {
    form.append("pages", `${pageRange.start}-${pageRange.end}`);
  }

  const response = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    headers: {
      apikey: ocrKey,
    },
    body: form,
  });

  if (!response.ok) return "";
  const data = await response.json();
  const parsed = Array.isArray(data?.ParsedResults) ? data.ParsedResults : [];
  return parsed.map((item) => item?.ParsedText || "").filter(Boolean).join("\n");
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const category = formData.get("category");
    const pageRange = parsePageRange(formData.get("pageRange"));

    if (!file || !category) {
      return Response.json({ error: "File and category are required." }, { status: 400 });
    }

    const name = String(file.name || "").toLowerCase();
    const type = String(file.type || "").toLowerCase();
    let entries = [];

    if (type === "application/json" || name.endsWith(".json")) {
      const data = JSON.parse(await file.text());
      if (Array.isArray(data)) {
        entries = data
          .map((row) => ({ term: row.term || row.word || "", meaning: row.meaning || row.definition || "" }))
          .filter((row) => row.term && row.meaning);
      } else if (Array.isArray(data.entries)) {
        entries = data.entries
          .map((row) => ({ term: row.term || row.word || "", meaning: row.meaning || row.definition || "" }))
          .filter((row) => row.term && row.meaning);
      }
      return Response.json({ entries });
    }

    if (type === "text/csv" || name.endsWith(".csv")) {
      entries = parseCSV(await file.text());
      return Response.json({ entries });
    }

    if (type === "text/plain" || name.endsWith(".txt")) {
      entries = parseTextToEntries(await file.text());
      return Response.json({ entries });
    }

    if (name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".png") || type.startsWith("image/")) {
      const ocrText = await runOCR(file, pageRange);
      entries = parseTextToEntries(ocrText);
      return Response.json({ entries });
    }

    if (name.endsWith(".pdf")) {
      const textFromPdf = await extractPDFText(file);
      entries = parseTextToEntries(textFromPdf);
      if (entries.length === 0) {
        const ocrText = await runOCR(file, pageRange);
        entries = parseTextToEntries(ocrText);
      }
      return Response.json({ entries });
    }

    if (name.endsWith(".docx")) {
      const textFromDocx = await extractDOCXText(file);
      entries = parseTextToEntries(textFromDocx);
      return Response.json({ entries });
    }

    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      entries = await extractXLSXEntries(file);
      return Response.json({ entries });
    }

    if (name.endsWith(".doc")) {
      // Legacy DOC binary format is hard to parse without native tools.
      const rawText = Buffer.from(await file.arrayBuffer()).toString("utf-8");
      entries = parseTextToEntries(rawText);
      return Response.json({ entries });
    }

    return Response.json({ error: "Unsupported file type." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message || "Extraction failed." }, { status: 500 });
  }
}
