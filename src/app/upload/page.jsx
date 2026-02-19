import { useEffect, useState } from "react";
import { Upload, CheckCircle, AlertCircle, Loader, Plus } from "lucide-react";
import { addCategory, addEntry, addFile, getAllCategories, initDB } from "@/utils/db";
import { apiUrl } from "@/utils/api";

const acceptedTypes = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.json";

function uniqueByTermMeaning(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    const key = `${entry.term}:::${entry.meaning}`.toLowerCase();
    if (!entry.term || !entry.meaning || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseTextToEntries(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const patterns = [/^(.+?)\s*[-–—]\s*(.+)$/, /^(.+?)\s*:\s*(.+)$/, /^(.+?)\s*=\s*(.+)$/];
  const entries = [];

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
  const skipHeader = rows[0]?.toLowerCase().includes("term") ? 1 : 0;
  const entries = [];

  for (let i = skipHeader; i < rows.length; i += 1) {
    const [term, meaning] = rows[i].split(",").map((cell) => cell?.trim()?.replace(/^"|"$/g, ""));
    if (term && meaning) entries.push({ term, meaning });
  }

  return entries;
}

async function extractEntriesLocally(selectedFile) {
  const name = String(selectedFile?.name || "").toLowerCase();
  const type = String(selectedFile?.type || "").toLowerCase();

  if (type === "application/json" || name.endsWith(".json")) {
    const data = JSON.parse(await selectedFile.text());
    if (Array.isArray(data)) {
      return data
        .map((row) => ({ term: row.term || row.word || "", meaning: row.meaning || row.definition || "" }))
        .filter((row) => row.term && row.meaning);
    }
    if (Array.isArray(data?.entries)) {
      return data.entries
        .map((row) => ({ term: row.term || row.word || "", meaning: row.meaning || row.definition || "" }))
        .filter((row) => row.term && row.meaning);
    }
    return [];
  }

  if (type === "text/csv" || name.endsWith(".csv")) {
    return parseCSV(await selectedFile.text());
  }

  if (type === "text/plain" || name.endsWith(".txt")) {
    return parseTextToEntries(await selectedFile.text());
  }

  if (name.endsWith(".pdf") || name.endsWith(".doc") || name.endsWith(".docx") || name.endsWith(".xls") || name.endsWith(".xlsx")) {
    const rawText = new TextDecoder("utf-8", { fatal: false }).decode(await selectedFile.arrayBuffer());
    return parseTextToEntries(rawText);
  }

  return [];
}

export default function UploadPage() {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [file, setFile] = useState(null);
  const [pageRange, setPageRange] = useState("1-5");
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    initDB().then(() => getAllCategories().then(setCategories));
  }, []);

  const createCategory = async () => {
    if (!newCategory.trim()) return;
    await addCategory({ name: newCategory.trim(), createdAt: Date.now() });
    const data = await getAllCategories();
    setCategories(data);
    setSelectedCategory(newCategory.trim());
    setNewCategory("");
    setShowCreate(false);
  };

  const upload = async () => {
    if (!file) return setError("Please select a file.");
    if (!selectedCategory) return setError("Please select a category.");

    setBusy(true);
    setError("");
    setLogs(["Starting upload..."]);
    setProgress(10);

    try {
      const body = new FormData();
      body.append("file", file);
      body.append("category", selectedCategory);
      body.append("pageRange", pageRange);

      setLogs((prev) => [...prev, "Uploading file..."]);
      setProgress(30);

      let extractedEntries = [];
      let usedAI = false;
      
      const fileName = file.name.toLowerCase();
      const isBinary = /\.(pdf|doc|docx|xlsx|xls)$/i.test(fileName);

      // For binary files (PDF, DOC, DOCX, XLSX), use server-side parsing
      if (isBinary) {
        setLogs((prev) => [...prev, `📤 Uploading ${fileName.split('.').pop().toUpperCase()} file for AI extraction...`]);
        
        try {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("settings", JSON.stringify({}));
          
          const response = await fetch(apiUrl("/api/parse"), {
            method: "POST",
            body: formData
          });
          
          const result = await response.json();
          
          if (result.ok && result.entries && result.entries.length > 0) {
            extractedEntries = result.entries;
            usedAI = result.usedAI;
            setLogs((prev) => [...prev, 
              result.usedAI 
                ? `🤖 AI extracted ${result.entries.length} terms from ${result.textLength || 'unknown'} characters`
                : `📝 Extracted ${result.entries.length} terms`
            ]);
          } else {
            throw new Error(result.error || "No terms found");
          }
        } catch (parseError) {
          // Fallback to local extraction
          setLogs((prev) => [...prev, `⚠️ Server parse failed: ${parseError.message}, trying local...`]);
          extractedEntries = await extractEntriesLocally(file);
          usedAI = false;
        }
      } else {
        // For text files (TXT, CSV, JSON), use local extraction first
        const localEntries = await extractEntriesLocally(file);
        
        if (localEntries.length >= 3) {
          extractedEntries = localEntries;
          setLogs((prev) => [...prev, `Local extraction found ${localEntries.length} terms`]);
        } else {
          // Try AI for noisy text
          setLogs((prev) => [...prev, "Local extraction weak, trying AI..."]);
          try {
            const fileText = await file.text();
            const response = await fetch(apiUrl("/api/ai/quiz"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                message: fileText.slice(0, 8000),
                settings: {},
                mode: "extract-terms"
              })
            });
            
            const result = await response.json();
            
            if (result.entries && result.entries.length > 0) {
              extractedEntries = result.entries;
              usedAI = true;
              setLogs((prev) => [...prev, `🤖 AI extracted ${result.entries.length} terms`]);
            } else {
              extractedEntries = localEntries;
              setLogs((prev) => [...prev, "AI found no terms, using local"]);
            }
          } catch (apiError) {
            extractedEntries = localEntries;
            setLogs((prev) => [...prev, `AI failed: ${apiError.message}, using local`]);
          }
        }
      }

      const cleanEntries = uniqueByTermMeaning(extractedEntries);
      if (!cleanEntries.length) {
        throw new Error("No term-meaning pairs found. Use lines like 'term - meaning' or upload JSON/CSV with term+meaning columns.");
      }

      setLogs((prev) => [
        ...prev,
        `${usedAI ? "🤖 AI extracted" : "📝 Extracted"} ${cleanEntries.length} terms`,
      ]);
      setProgress(60);

      const fileId = await addFile({
        name: file.name,
        category: selectedCategory,
        uploadedAt: Date.now(),
        entryCount: cleanEntries.length,
        type: file.type || "application/octet-stream",
        sequencePointer: 1,
      });

      setLogs((prev) => [...prev, "Saving to database..."]);
      setProgress(80);

      for (const entry of cleanEntries) {
        await addEntry({
          term: entry.term,
          meaning: entry.meaning,
          category: selectedCategory,
          sourceFile: fileId,
          pageNumber: entry.pageNumber || null,
          wrongCount: 0,
          attemptCount: 0,
          lastAttempted: null,
        });
      }

      setLogs((prev) => [...prev, "Upload complete"]);
      setProgress(100);
      setFile(null);
    } catch (err) {
      setError(err.message || "Upload failed");
      setLogs((prev) => [...prev, `Error: ${err.message || "unknown"}`]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-lg hover-lift border border-gray-200 dark:border-gray-800 text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent">
            Upload Learning Materials
          </h1>
          <p className="text-gray-600 dark:text-gray-400">Supported: PDF, DOC, DOCX, XLSX, CSV, TXT, JPG, PNG, JSON</p>
          <p className="text-xs text-purple-600 dark:text-purple-400 mt-1 font-medium">✨ AI-powered: automatically extracts terms from noisy text</p>
        </div>

        {/* JSON Format Guide */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 shadow-lg mb-6 border border-gray-200 dark:border-gray-800">
          <details>
            <summary className="cursor-pointer font-semibold text-sm text-gray-700 dark:text-gray-300 select-none flex items-center gap-2">
              📋 Accepted JSON formats (click to expand)
            </summary>
            <div className="mt-3 space-y-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Best format: a simple JSON array. Use any of these field names — the app auto-detects them.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  {
                    label: "Word + Meaning",
                    code: `[\n  {"word":"break a leg",\n   "meaning":"wish good luck"},\n  {"word":"hit the sack",\n   "meaning":"go to sleep"}\n]`,
                    note: "Most universal format"
                  },
                  {
                    label: "Term + Meaning",
                    code: `[\n  {"term":"ubiquitous",\n   "meaning":"present everywhere"},\n  {"term":"ephemeral",\n   "meaning":"short-lived"}\n]`,
                    note: "Works for vocabulary"
                  },
                  {
                    label: "Word + Definition",
                    code: `[\n  {"word":"photosynthesis",\n   "definition":"light→food\nprocess"},\n  {"word":"osmosis",\n   "definition":"water through\nmembrane"}\n]`,
                    note: "Also works"
                  },
                ].map(({ label, code, note }) => (
                  <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                    <div className="text-xs font-bold text-purple-600 dark:text-purple-400 mb-1">{label}</div>
                    <pre className="text-xs text-gray-700 dark:text-gray-300 overflow-x-auto whitespace-pre-wrap font-mono">{code}</pre>
                    <div className="text-xs text-gray-500 mt-1">✓ {note}</div>
                  </div>
                ))}
              </div>
              <div className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2">
                💡 <strong>Tip:</strong> Even noisy TXT/PDF files work — the AI engine will automatically extract only the term-meaning pairs and ignore page numbers, headers, and example sentences.
              </div>
            </div>
          </details>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-lg mb-6 border border-gray-200 dark:border-gray-800">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Select Category *</label>
          {!showCreate ? (
            <div className="flex gap-3">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
              >
                <option value="">Choose a category...</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.name}>
                    {category.name}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => setShowCreate(true)} className="px-6 py-3 rounded-xl pink-blue-gradient text-white font-medium flex items-center gap-2">
                <Plus size={18} />
                New
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Enter category name..."
                className="flex-1 px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
              />
              <button type="button" onClick={createCategory} className="px-6 py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-medium">
                Create
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="px-6 py-3 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium">
                Cancel
              </button>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-lg border border-gray-200 dark:border-gray-800">
          <div
            className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-12 text-center hover:border-purple-500 transition-all cursor-pointer"
            onClick={() => document.getElementById("fileInput").click()}
          >
            {file ? (
              <div className="space-y-4">
                <CheckCircle className="mx-auto text-green-500" size={48} />
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">{file.name}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{(file.size / 1024).toFixed(2)} KB</div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className="mx-auto text-gray-400" size={48} />
                <div>
                  <div className="font-medium text-gray-900 dark:text-white mb-1">Drop file here or click to browse</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">All supported formats</div>
                </div>
              </div>
            )}

            <input id="fileInput" type="file" accept={acceptedTypes} onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" />
          </div>

          <div className="mt-4">
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">Page Number / Range</label>
            <input
              value={pageRange}
              onChange={(e) => setPageRange(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
              placeholder="1-5"
            />
          </div>

          {file && (
            <button
              type="button"
              onClick={upload}
              disabled={busy || !selectedCategory}
              className="w-full mt-6 px-6 py-4 rounded-xl pink-blue-gradient text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy ? (
                <>
                  <Loader className="animate-spin" size={20} />
                  Processing...
                </>
              ) : (
                "Extract & Save"
              )}
            </button>
          )}

          {progress > 0 && (
            <div className="mt-6">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className="h-2 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {logs.length > 0 && (
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm text-gray-600 dark:text-gray-300 space-y-1">
              {logs.map((log, i) => (
                <div key={`${log}-${i}`}>{log}</div>
              ))}
            </div>
          )}

          {error && (
            <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
              <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
              <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
            </div>
          )}
        </div>
    </div>
  );
}
