function parseTextToEntries(text) {
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
        entries.push({ term: match[1].trim(), meaning: match[2].trim() });
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

async function runOCR(file) {
  const ocrKey = process.env.OCR_SPACE_KEY;
  if (!ocrKey) return "";
  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const type = file.type || "image/png";

  const response = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    headers: {
      apikey: ocrKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `base64Image=data:${type};base64,${base64}&language=eng&isOverlayRequired=false`,
  });

  if (!response.ok) return "";
  const data = await response.json();
  return data?.ParsedResults?.[0]?.ParsedText || "";
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const category = formData.get("category");

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
      const ocrText = await runOCR(file);
      entries = parseTextToEntries(ocrText);
      return Response.json({ entries });
    }

    // Minimal text extraction fallback for PDF/DOC/DOCX/XLSX without native parser deps.
    if (
      name.endsWith(".pdf") ||
      name.endsWith(".doc") ||
      name.endsWith(".docx") ||
      name.endsWith(".xls") ||
      name.endsWith(".xlsx")
    ) {
      const rawText = Buffer.from(await file.arrayBuffer()).toString("utf-8");
      entries = parseTextToEntries(rawText);
      return Response.json({ entries });
    }

    return Response.json({ error: "Unsupported file type." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message || "Extraction failed." }, { status: 500 });
  }
}
