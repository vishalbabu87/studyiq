import { useEffect, useState } from "react";
import { Upload, CheckCircle, AlertCircle, Loader, Plus } from "lucide-react";
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

      const response = await fetch("/api/extract", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Upload failed");

      const cleanEntries = uniqueByTermMeaning(result.entries || []);
      setLogs((prev) => [...prev, `Extracted ${cleanEntries.length} terms`]);
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent">
            Upload Learning Materials
          </h1>
          <p className="text-gray-600 dark:text-gray-400">Supported: PDF, DOC, DOCX, XLSX, CSV, TXT, JPG, PNG, JSON</p>
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
    </div>
  );
}
