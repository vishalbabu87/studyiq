import { useEffect, useState } from "react";
import { Upload, CheckCircle } from "lucide-react";
import { addCategory, addEntry, addFile, addReviewEntry, getAllCategories, initDB } from "@/utils/db";
import { apiUrl } from "@/utils/api";
import { readSettings } from "@/utils/settings";
import { backupVocabulary, initTursoTables } from "@/utils/turso";
import { useTheme } from "@/contexts/ThemeContext";

const acceptedTypes = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.json";

const aiPromptTemplates = [
  {
    label: "Term / Meaning",
    description: "Extract clear term-meaning pairs like the old APK.",
    prompt:
      "Extract every term and its definition from the text. Return a clean list of term: meaning pairs, one per line.",
  },
  {
    label: "Concept Snapshot",
    description: "Focus on formulas, dates, and keywords.",
    prompt:
      "List all formulas, dates, and high-yield keywords from the text with short explanations. Keep it concise.",
  },
  {
    label: "Quiz Prep",
    description: "Build question + answer blocks ready for quiz.",
    prompt:
      "Generate question and answer blocks from the document. Provide at least 5 multiple-choice style entries with clearly labelled answers.",
  },
];

const contentProfiles = [
  { value: "all_terms", label: "All Terms" },
  { value: "nouns_only", label: "Nouns Only" },
  { value: "chapter_unit", label: "Chapter / Unit" },
];

function uniqueByTermMeaning(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    const key = `${entry.term}:::${entry.meaning}`.toLowerCase();
    if (!entry.term || !entry.meaning || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizePageRangeInput(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (/^(all|all\s+pages|\*)$/i.test(value)) return "all";

  const match = value.match(/^(\d+)(?:\s*[-:]\s*(\d+))?$/);
  if (!match) return null;

  const start = Number.parseInt(match[1], 10);
  const end = Number.parseInt(match[2] || match[1], 10);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end < start) {
    return null;
  }
  return start === end ? String(start) : `${start}-${end}`;
}

export default function UploadPage() {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [file, setFile] = useState(null);
  const [pageRange, setPageRange] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [contentProfile, setContentProfile] = useState("all_terms");
  const [profileSubject, setProfileSubject] = useState("");
  const [profileUnit, setProfileUnit] = useState("");
  const [profileChapter, setProfileChapter] = useState("");
  const [strictMode, setStrictMode] = useState(false);
  const [extractionMode, setExtractionMode] = useState("hybrid");
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    initDB().then(() => getAllCategories().then(setCategories));
    const appSettings = readSettings();
    setStrictMode(Boolean(appSettings?.strictExtraction));
    const profile = String(appSettings?.contentProfile || "").toLowerCase();
    if (profile === "all_terms" || profile === "nouns_only" || profile === "chapter_unit") {
      setContentProfile(profile);
    }
    const mode = String(appSettings?.extractionMode || "").toLowerCase();
    if (mode === "local_first" || mode === "ai_only" || mode === "hybrid") {
      setExtractionMode(mode);
    } else {
      setExtractionMode(appSettings?.localFirstPipeline === false ? "hybrid" : "local_first");
    }
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
    const normalizedPageRange = normalizePageRangeInput(pageRange);
    if (normalizedPageRange === null) {
      return setError("Page range must be `all`, a single page like `5`, or a range like `5-12`.");
    }

    setBusy(true);
    setError("");
    setLogs(["Starting upload..."]);
    setProgress(10);

    try {
      const appSettings = readSettings();
      setLogs((prev) => [...prev, "Uploading file to parser backend..."]);

      const requestSettings = {
        ...appSettings,
        aiPrompt: customPrompt.trim(),
        pageRange: normalizedPageRange,
        strictExtraction: strictMode,
        extractionMode,
        contentProfile,
        profileSubject: profileSubject.trim(),
        profileUnit: profileUnit.trim(),
        profileChapter: profileChapter.trim(),
      };

      const formData = new FormData();
      formData.append("file", file);
      formData.append("settings", JSON.stringify(requestSettings));
      formData.append("pageRange", normalizedPageRange);
      formData.append("aiPrompt", customPrompt.trim());

      const response = await fetch(apiUrl("/api/parse"), {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      setProgress(55);
      if (!result.ok) {
        throw new Error(result.error || result.details || "Parser failed");
      }
      if (result.pageRangeApplied) {
        setLogs((prev) => [...prev, `Page range applied: ${result.pageRangeApplied}`]);
      } else if (normalizedPageRange === "all") {
        setLogs((prev) => [...prev, "Page range applied: all pages"]);
      }
      if (result.filterReport) {
        setLogs((prev) => [
          ...prev,
          `Filter report: kept ${result.filterReport.keptCount}/${result.filterReport.totalInput}, dropped ${result.filterReport.droppedCount}.`,
        ]);
        const sampleDrops = (result.filterReport.items || [])
          .filter((item) => !item.kept)
          .slice(0, 3)
          .map((item) => `${item.term}: ${item.reason}`);
        if (sampleDrops.length) {
          setLogs((prev) => [...prev, `Dropped sample -> ${sampleDrops.join(" | ")}`]);
        }
      }
      if (result.qualityReport) {
        setLogs((prev) => [
          ...prev,
          `Quality gate: accepted ${result.qualityReport.acceptedCount}/${result.qualityReport.totalInput}, rejected ${result.qualityReport.rejectedCount}.`,
        ]);
        const noisySample = (result.qualityReport.sampleRejected || [])
          .slice(0, 3)
          .map((item) => `${item.term}: ${item.reason}`);
        if (noisySample.length) {
          setLogs((prev) => [...prev, `Rejected sample -> ${noisySample.join(" | ")}`]);
        }
      }
      if (Array.isArray(result.providersUsed) && result.providersUsed.length) {
        setLogs((prev) => [...prev, `Providers used: ${result.providersUsed.join(" -> ")}`]);
      }
      if (Array.isArray(result.providerErrors) && result.providerErrors.length) {
        setLogs((prev) => [...prev, `Provider fallback notes: ${result.providerErrors.slice(0, 3).join(" | ")}`]);
      }

      if (Array.isArray(result.entries) && result.entries.length > 0) {
        const cleanEntries = uniqueByTermMeaning(result.entries);

        setLogs((prev) => [...prev, `Extracted ${cleanEntries.length} terms. Saving to library...`]);
        setProgress(72);

        const fileId = await addFile({
          name: file.name,
          category: selectedCategory,
          uploadedAt: Date.now(),
          entryCount: cleanEntries.length,
          type: file.type || "application/octet-stream",
          sequencePointer: 1,
          extractionMode: result.extractionMode || extractionMode,
          pipelineMode: result.pipelineMode || "unknown",
          contentProfile: result.contentProfile || contentProfile,
          profileSubject: result.profileContext?.subject || profileSubject.trim(),
          profileUnit: result.profileContext?.unit || profileUnit.trim(),
          profileChapter: result.profileContext?.chapter || profileChapter.trim(),
          reviewCount: Number.parseInt(result.reviewCount, 10) || 0,
          providersUsed: Array.isArray(result.providersUsed) ? result.providersUsed : [],
          providerErrors: Array.isArray(result.providerErrors) ? result.providerErrors : [],
        });

        for (const entry of cleanEntries) {
          await addEntry({
            term: entry.term,
            meaning: entry.meaning,
            example: entry.example || "",
            category: selectedCategory,
            sourceFile: fileId,
            wrongCount: 0,
            attemptCount: 0,
            lastAttempted: null,
            subject: entry.subject || profileSubject.trim(),
            subjectLabel: entry.subjectLabel || "",
            factType: entry.factType || "",
            quizTypes: Array.isArray(entry.quizTypes) ? entry.quizTypes : [],
            confidence: Number.isFinite(entry.confidence) ? entry.confidence : null,
            tags: Array.isArray(entry.tags) ? entry.tags : [],
            unit: entry.unit || profileUnit.trim(),
            chapter: entry.chapter || profileChapter.trim(),
          });
        }

        if (Array.isArray(result.reviewEntries) && result.reviewEntries.length > 0) {
          for (const review of result.reviewEntries) {
            await addReviewEntry({
              term: review.term || "",
              meaning: review.meaning || "",
              example: review.example || "",
              category: selectedCategory,
              sourceFile: fileId,
              reviewReason: review.reviewReason || "Rejected by quality gate",
              confidence: Number.isFinite(review.confidence) ? review.confidence : null,
              subject: review.subject || profileSubject.trim(),
              unit: review.unit || profileUnit.trim(),
              chapter: review.chapter || profileChapter.trim(),
              createdAt: Date.now(),
              reviewed: false,
            });
          }
          setLogs((prev) => [...prev, `Review queue saved: ${result.reviewEntries.length} rejected entries.`]);
        }

        // Best-effort cloud backup (does not block successful local save).
        try {
          await initTursoTables();
          const backedUp = await backupVocabulary(
            cleanEntries.map((entry) => ({
              term: entry.term,
              meaning: entry.meaning,
              category: selectedCategory,
            }))
          );
          if (backedUp) {
            setLogs((prev) => [...prev, "Backup synced to Turso."]);
          } else {
            setLogs((prev) => [...prev, "Turso backup unavailable; local save complete."]);
          }
        } catch (backupError) {
          setLogs((prev) => [...prev, `Turso backup skipped: ${backupError.message}`]);
        }

        setLogs((prev) => [...prev, "Upload successful!"]);
        setProgress(100);
        setFile(null);
      } else {
        throw new Error(
          strictMode && customPrompt.trim()
            ? "Strict mode found no prompt-matched entries, so nothing was saved."
            : Number.parseInt(result.reviewCount, 10) > 0
              ? "No clean entries passed quality checks. Try page range/prompt refinement."
              : result.error || "No term-meaning entries found in this file.",
        );
      }
    } catch (err) {
      setError(err.message || "Upload failed");
      setLogs((prev) => [...prev, `Error: ${err.message}`]);
    } finally {
      setBusy(false);
    }
  };

  const isDark = theme === "dark";
  const textColor = isDark ? "#ffffff" : "#000000";

  // PEAK VERSION: Black box with white text for specific inputs
  const highContrastInput = "w-full px-3 py-2.5 rounded-xl border-2 border-white bg-black text-white text-sm font-bold shadow-md placeholder:text-gray-500";

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="glass-card rounded-3xl p-6 border-2 border-black dark:border-gray-800 text-center mb-6">
          <h1 className="text-2xl font-black uppercase tracking-tight italic" style={{ color: textColor }}>
            Upload Material
          </h1>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">AI-Powered Symbol Purge System</p>
        </div>

        <div className="glass-card rounded-2xl p-5 border-2 border-black dark:border-gray-800 mb-4">
          <div
            className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-10 text-center hover:border-purple-500 transition-all cursor-pointer"
            onClick={() => document.getElementById("fileInput").click()}
          >
            {file ? (
              <div className="space-y-2">
                <CheckCircle className="mx-auto text-green-500" size={32} />
                <div className="font-black text-black dark:text-white uppercase text-sm">{file.name}</div>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="mx-auto text-gray-400" size={32} />
                <div className="font-black text-gray-500 uppercase text-xs">Tap to choose PDF or DOCX</div>
              </div>
            )}
            <input id="fileInput" type="file" accept={acceptedTypes} onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">Page Range</label>
              <input value={pageRange} onChange={(e) => setPageRange(e.target.value)} className={highContrastInput} placeholder="all (leave blank)" />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setPageRange("all")}
                  className="rounded-lg border border-black bg-white px-2 py-1 text-[10px] font-black uppercase text-black"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setPageRange("")}
                  className="rounded-lg border border-black bg-white px-2 py-1 text-[10px] font-black uppercase text-black"
                >
                  Clear
                </button>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">AI Custom Prompt</label>
              <input value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} className={highContrastInput} placeholder="e.g. Extract only dates" />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">Extraction Mode</label>
              <select
                value={extractionMode}
                onChange={(e) => setExtractionMode(e.target.value)}
                className={highContrastInput}
              >
                <option value="hybrid">Hybrid (local + AI)</option>
                <option value="local_first">Local-first</option>
                <option value="ai_only">AI-only</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">Content Profile</label>
              <select
                value={contentProfile}
                onChange={(e) => setContentProfile(e.target.value)}
                className={highContrastInput}
              >
                {contentProfiles.map((profile) => (
                  <option key={profile.value} value={profile.value}>
                    {profile.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">Subject (optional)</label>
              <input
                value={profileSubject}
                onChange={(e) => setProfileSubject(e.target.value)}
                className={highContrastInput}
                placeholder="e.g. Physics"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">Unit (optional)</label>
              <input
                value={profileUnit}
                onChange={(e) => setProfileUnit(e.target.value)}
                className={highContrastInput}
                placeholder="e.g. Unit 2"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">Chapter (optional)</label>
              <input
                value={profileChapter}
                onChange={(e) => setProfileChapter(e.target.value)}
                className={highContrastInput}
                placeholder="e.g. Kinematics"
              />
            </div>
          </div>
          <label className="mt-4 inline-flex items-center gap-2 rounded-xl border-2 border-black bg-white px-3 py-2 text-[11px] font-black uppercase text-black">
            <input
              type="checkbox"
              checked={strictMode}
              onChange={(e) => setStrictMode(e.target.checked)}
            />
            Strict mode: save only prompt-matched entries
          </label>

          <div className="mt-5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase text-gray-500 tracking-[0.3em]">AI Prompt Map</p>
              <span className="text-[10px] text-gray-400 uppercase tracking-[0.2em]">Tap to reuse</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 mt-3">
              {aiPromptTemplates.map((template) => (
                <button
                  key={template.label}
                  type="button"
                  onClick={() => setCustomPrompt(template.prompt)}
                  className="rounded-2xl p-3 text-left text-white bg-gradient-to-br from-pink-500 via-purple-600 to-indigo-500 shadow-lg hover:shadow-[0_20px_30px_rgba(236,72,153,0.4)] transition-all"
                >
                  <div className="text-sm font-black">{template.label}</div>
                  <p className="text-[10px] opacity-80 mt-1">{template.description}</p>
                </button>
              ))}
            </div>
          </div>

          {file && (
            <button onClick={upload} disabled={busy || !selectedCategory} className="w-full mt-6 px-4 py-4 rounded-xl pink-blue-gradient text-white font-black uppercase shadow-xl active:scale-95 transition-all">
              {busy ? "Processing..." : "EXTRACT & SAVE"}
            </button>
          )}
        </div>

        <div className="glass-card rounded-2xl p-5 border-2 border-black dark:border-gray-800">
          <label className="block text-[10px] font-black uppercase text-gray-500 mb-2">Target Category</label>
          <div className="flex gap-2">
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="flex-1 bg-white border-2 border-black rounded-xl px-3 py-2.5 text-sm font-bold text-black">
              <option value="">Select Category...</option>
              {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <button onClick={() => setShowCreate(!showCreate)} className="px-4 py-2 rounded-xl bg-black text-white font-black uppercase text-xs">New</button>
          </div>
          {showCreate && (
            <div className="mt-3 flex gap-2 animate-in slide-in-from-top-2">
              <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="New Category..." className="flex-1 bg-white border-2 border-black rounded-xl px-3 py-2 text-sm text-black" />
              <button onClick={createCategory} className="bg-green-600 text-white rounded-xl px-4 border-2 border-black font-black uppercase text-xs">ADD</button>
            </div>
          )}
        </div>
    </div>
  );
}
