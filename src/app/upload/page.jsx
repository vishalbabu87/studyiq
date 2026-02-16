import { useEffect, useState } from "react";
import { addCategory, addEntry, addFile, getAllCategories, initDB } from "@/utils/db";

const acceptedTypes = ".pdf,.doc,.docx,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.json";

function uniqueByTermMeaning(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    const key = `${entry.term}:::${entry.meaning}`.toLowerCase();
    if (!entry.term || !entry.meaning || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

  const reloadCategories = async () => {
    await initDB();
    const data = await getAllCategories();
    setCategories(data);
  };

  useEffect(() => {
    reloadCategories();
  }, []);

  const createCategory = async () => {
    if (!newCategory.trim()) return;
    await addCategory({ name: newCategory.trim(), createdAt: Date.now() });
    setSelectedCategory(newCategory.trim());
    setNewCategory("");
    setShowCreate(false);
    reloadCategories();
  };

  const upload = async () => {
    if (!file) return setError("Choose a file.");
    if (!selectedCategory) return setError("Select or create category first.");

    setBusy(true);
    setError("");
    setProgress(5);
    setLogs(["Preparing extraction request..."]);

    try {
      const body = new FormData();
      body.append("file", file);
      body.append("category", selectedCategory);
      body.append("pageRange", pageRange);

      setProgress(20);
      setLogs((prev) => [...prev, "Uploading to extractor..."]);
      const response = await fetch("/api/extract", { method: "POST", body });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Extraction failed");
      }

      const cleanEntries = uniqueByTermMeaning(result.entries || []);
      setProgress(60);
      setLogs((prev) => [...prev, `Detected ${cleanEntries.length} valid pairs.`]);

      const fileId = await addFile({
        name: file.name,
        category: selectedCategory,
        uploadedAt: Date.now(),
        entryCount: cleanEntries.length,
        type: file.type || "application/octet-stream",
        sequencePointer: 1,
      });

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

      setProgress(100);
      setLogs((prev) => [...prev, "Saved to local database."]);
      setFile(null);
    } catch (err) {
      setError(err.message || "Upload failed");
      setLogs((prev) => [...prev, `Error: ${err.message || "unknown"}`]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-4xl font-bold">Upload & Extract</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">Assign every file to a category. JSON is supported.</p>
      </div>

      <div className="glass-card p-5">
        <label className="mb-2 block text-sm font-semibold">Category</label>
        {!showCreate ? (
          <div className="flex gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => setShowCreate(true)} className="rounded-xl bg-slate-900 px-4 py-2 text-white dark:bg-slate-100 dark:text-slate-900">
              New
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createCategory();
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
              placeholder="Category name"
            />
            <button type="button" onClick={createCategory} className="rounded-xl bg-emerald-600 px-4 py-2 text-white">
              Save
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="rounded-xl bg-slate-200 px-4 py-2 dark:bg-slate-800">
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="glass-card p-5">
        <label className="mb-2 block text-sm font-semibold">File</label>
        <input
          type="file"
          accept={acceptedTypes}
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
        />
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Supports PDF, DOC, DOCX, XLSX, CSV, TXT, JPG, PNG, JSON
        </p>

        <label className="mb-2 mt-4 block text-sm font-semibold">Page Number / Range (for OCR focus)</label>
        <input
          value={pageRange}
          onChange={(e) => setPageRange(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
          placeholder="1-5"
        />

        <button
          type="button"
          onClick={upload}
          disabled={busy}
          className="mt-5 rounded-xl bg-gradient-to-r from-sky-500 via-indigo-500 to-fuchsia-500 px-5 py-3 font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Extracting..." : "Extract & Save"}
        </button>

        {progress > 0 && (
          <div className="mt-4 h-2 rounded-full bg-slate-200 dark:bg-slate-800">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-sky-500 via-indigo-500 to-fuchsia-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {logs.length > 0 && (
          <div className="mt-4 rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-900">
            {logs.map((log, idx) => (
              <p key={`${log}-${idx}`}>{log}</p>
            ))}
          </div>
        )}
        {error && <p className="mt-3 text-sm font-medium text-rose-500">{error}</p>}
      </div>
    </section>
  );
}
