export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const category = formData.get("category");

    if (!file || !category) {
      return Response.json(
        { error: "File and category required" },
        { status: 400 },
      );
    }

    const fileType = file.type;
    const fileName = file.name;
    let extractedText = "";
    let entries = [];

    // Handle JSON files
    if (fileType === "application/json" || fileName.endsWith(".json")) {
      const jsonContent = await file.text();
      const jsonData = JSON.parse(jsonContent);

      if (Array.isArray(jsonData)) {
        entries = jsonData.map((item) => ({
          term: item.term || item.word || "",
          meaning: item.meaning || item.definition || item.desc || "",
        }));
      }
      return Response.json({ entries });
    }

    // Handle CSV files
    else if (fileType === "text/csv" || fileName.endsWith(".csv")) {
      const csvText = await file.text();
      const lines = csvText.split("\n").filter((line) => line.trim());
      const startIndex = lines[0].toLowerCase().includes("term") ? 1 : 0;

      for (let i = startIndex; i < lines.length; i++) {
        const parts = lines[i]
          .split(",")
          .map((p) => p.trim().replace(/^"|"$/g, ""));
        if (parts.length >= 2) {
          entries.push({ term: parts[0], meaning: parts[1] });
        }
      }
      return Response.json({ entries });
    }

    // Handle TXT files
    else if (fileType === "text/plain" || fileName.endsWith(".txt")) {
      extractedText = await file.text();
    }

    // Handle PDF files
    else if (fileType === "application/pdf" || fileName.endsWith(".pdf")) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      extractedText = buffer.toString("utf-8").replace(/[^\x20-\x7E\n]/g, " ");
    }

    // Handle Images - OCR
    else if (
      fileType.startsWith("image/") ||
      fileName.match(/\.(jpg|jpeg|png|gif)$/i)
    ) {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");

      try {
        const response = await fetch("https://api.ocr.space/parse/image", {
          method: "POST",
          headers: {
            apikey: "K87899142388957",
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: `base64Image=data:${fileType};base64,${base64}&language=eng`,
        });

        const data = await response.json();
        extractedText = data.ParsedResults?.[0]?.ParsedText || "";
      } catch (error) {
        console.error("OCR error:", error);
      }
    }

    // Handle DOCX files
    else if (fileName.endsWith(".docx") || fileName.endsWith(".doc")) {
      const arrayBuffer = await file.arrayBuffer();
      const text = Buffer.from(arrayBuffer).toString("utf-8");
      const matches = text.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
      if (matches) {
        extractedText = matches.map((m) => m.replace(/<[^>]+>/g, "")).join(" ");
      }
    }

    // Handle XLSX files
    else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      const arrayBuffer = await file.arrayBuffer();
      const text = Buffer.from(arrayBuffer).toString("utf-8");
      const lines = text.split("\n").filter((line) => line.trim());

      for (const line of lines) {
        const parts = line.split(/[\t,]/).map((p) => p.trim());
        if (parts.length >= 2 && parts[0] && parts[1]) {
          entries.push({ term: parts[0], meaning: parts[1] });
        }
      }

      if (entries.length > 0) {
        return Response.json({ entries });
      }
    }

    // Parse extracted text into entries
    if (extractedText) {
      entries = parseTextToEntries(extractedText);
    }

    return Response.json({ entries });
  } catch (error) {
    console.error("Extraction error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

function parseTextToEntries(text) {
  const entries = [];
  const lines = text.split("\n").filter((line) => line.trim());

  for (const line of lines) {
    const patterns = [
      /^(.+?)\s*[-–—]\s*(.+)$/,
      /^(.+?)\s*:\s*(.+)$/,
      /^(.+?)\s*=\s*(.+)$/,
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match && match[1] && match[2]) {
        entries.push({
          term: match[1].trim(),
          meaning: match[2].trim(),
        });
        break;
      }
    }
  }

  return entries;
}
