import { useEffect, useMemo, useState } from "react";
import { getAllCategories, getFilesByCategory, initDB } from "@/utils/db";
import { parseRange } from "@/utils/quiz";

const questionChoices = [10, 25, 50, 100];

export default function QuizSetup({ onStartQuiz, prefill }) {
  // Progressive single-page state
  const [started, setStarted] = useState(false);
  const [categories, setCategories] = useState([]);
  const [files, setFiles] = useState([]);

  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedFile, setSelectedFile] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [rangeText, setRangeText] = useState("1-10");
  const [questionCount, setQuestionCount] = useState(10);
  const [mode, setMode] = useState("sequential");
  const [timerMinutes, setTimerMinutes] = useState(5);

  // Dropdown visibility
  const [catOpen, setCatOpen] = useState(false);
  const [fileOpen, setFileOpen] = useState(false);

  const ready = useMemo(() => {
    const hasCat = Boolean(selectedCategory);
    const hasFile = Boolean(selectedFile);
    const rangeOk = /^\d+\s*[-:]\s*\d+$/.test(rangeText);
    const countOk = Number.isFinite(questionCount) && questionCount > 0;
    return hasCat && hasFile && rangeOk && countOk;
  }, [selectedCategory, selectedFile, rangeText, questionCount]);

  useEffect(() => {
    initDB().then(() => getAllCategories().then(setCategories));
  }, []);

  useEffect(() => {
    if (!selectedCategory) return;
    getFilesByCategory(selectedCategory).then(setFiles);
  }, [selectedCategory]);

  // Autofill from AI or previous session
  useEffect(() => {
    if (!prefill) return;
    setStarted(true);
    if (prefill.category) setSelectedCategory(prefill.category);
    if (prefill.file) setSelectedFile(String(prefill.file));
    if (prefill.rangeStart && prefill.rangeEnd) setRangeText(`${prefill.rangeStart}-${prefill.rangeEnd}`);
    if (prefill.questionCount) setQuestionCount(prefill.questionCount);
    if (prefill.difficulty) setDifficulty(prefill.difficulty);
    if (prefill.mode) setMode(prefill.mode);
    if (prefill.timerMinutes) setTimerMinutes(Math.max(1, prefill.timerMinutes));
  }, [prefill]);

  // When a file is chosen, pre-suggest a sensible range using its sequence pointer
  useEffect(() => {
    if (!selectedFile) return;
    const meta = files.find((f) => String(f.id) === String(selectedFile));
    if (!meta) return;
    const start = meta.sequencePointer || 1;
    const end = Math.max(start, start + Math.max(questionCount - 1, 9));
    setRangeText(`${start}-${end}`);
  }, [selectedFile]);

  const handleBegin = () => {
    const { start, end } = parseRange(rangeText, 1, questionCount);
    onStartQuiz({
      category: selectedCategory,
      file: Number.parseInt(selectedFile, 10),
      rangeStart: start,
      rangeEnd: end,
      questionCount,
      difficulty,
      mode,
      timerMinutes: Math.max(1, timerMinutes),
    });
  };

  return (
    <section className="max-w-5xl mx-auto">
      <div className="text-center mb-8 hero-text-panel py-5 px-6 rounded-2xl">
        <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent">
          Start Quiz
        </h1>
        <p className="text-gray-600 dark:text-gray-400 font-medium">Choose Category → File, then configure details below. Everything on one page.</p>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-lg hover-lift border border-gray-200 dark:border-gray-800">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Quiz Configuration</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Category & File on top • Difficulty • Range/Count • Mode • Timer</p>
          </div>
          {!started && (
            <button
              type="button"
              onClick={() => setStarted(true)}
              className="rounded-xl pink-blue-gradient px-5 py-3 text-sm font-semibold text-white"
            >
              Start Quiz
            </button>
          )}
        </div>

        {started && (
          <div className="space-y-6">
            {/* Top row: Category + File as buttons with dropdowns */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Category selector */}
              <div className="relative">
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Category</label>
                <button
                  type="button"
                  onClick={() => setCatOpen((v) => !v)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                    selectedCategory ? "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500"
                  }`}
                >
                  {selectedCategory || "Choose a category"}
                </button>
                {catOpen && (
                  <div className="absolute z-20 mt-2 w-full max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                    {categories.length === 0 && (
                      <div className="px-3 py-2 text-sm text-slate-500">No categories. Add one in Upload.</div>
                    )}
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setSelectedCategory(cat.name);
                          setSelectedFile("");
                          setCatOpen(false);
                        }}
                        className={`w-full rounded-lg px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 ${
                          selectedCategory === cat.name ? "bg-slate-100 dark:bg-slate-800" : ""
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* File selector (depends on category) */}
              <div className="relative">
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">File</label>
                <button
                  type="button"
                  disabled={!selectedCategory}
                  onClick={() => setFileOpen((v) => !v)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                    selectedFile ? "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500"
                  } ${!selectedCategory ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {selectedFile ? (files.find((f) => String(f.id) === String(selectedFile))?.name || selectedFile) : "Choose a file"}
                </button>
                {fileOpen && selectedCategory && (
                  <div className="absolute z-20 mt-2 w-full max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                    {files.length === 0 && (
                      <div className="px-3 py-2 text-sm text-slate-500">No files in this category.</div>
                    )}
                    {files.map((file) => (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => {
                          setSelectedFile(String(file.id));
                          // Prefill range using sequence pointer
                          const start = file.sequencePointer || 1;
                          const end = Math.max(start, start + Math.max(questionCount - 1, 9));
                          setRangeText(`${start}-${end}`);
                          setFileOpen(false);
                        }}
                        className={`w-full rounded-lg px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 ${
                          String(file.id) === String(selectedFile) ? "bg-slate-100 dark:bg-slate-800" : ""
                        }`}
                      >
                        <div className="font-medium">{file.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{file.entryCount || 0} entries • next pointer: {file.sequencePointer || 1}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Difficulty */}
            <div className={`${!selectedFile ? "opacity-70 pointer-events-none" : ""}`}>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Difficulty</label>
              <div className="flex flex-wrap gap-2">
                {["easy", "medium", "hard"].map((level) => (
                  <button
                    type="button"
                    key={level}
                    onClick={() => setDifficulty(level)}
                    className={`rounded-xl px-4 py-2 capitalize transition ${
                      difficulty === level ? "bg-gradient-to-r from-orange-600 to-red-600 text-white" : "bg-slate-100 dark:bg-slate-800"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            {/* Range and Question Count */}
            <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${!selectedFile ? "opacity-70 pointer-events-none" : ""}`}>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Range (e.g., 1-30)</label>
                <input
                  value={rangeText}
                  onChange={(e) => setRangeText(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Number of Questions</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {questionChoices.map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setQuestionCount(count)}
                      className={`rounded-xl px-4 py-2 text-sm ${
                        questionCount === count ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white" : "bg-slate-100 dark:bg-slate-800"
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min={1}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Math.max(1, Number.parseInt(e.target.value || "1", 10)))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
                />
              </div>
            </div>

            {/* Sequence Mode */}
            <div className={`${!selectedFile ? "opacity-70 pointer-events-none" : ""}`}>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Sequence</label>
              <div className="flex flex-wrap gap-2">
                {[
                  ["sequential", "Sequential"],
                  ["random", "Random"],
                  ["mistakes", "Mistakes Only"],
                ].map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() => setMode(value)}
                    className={`rounded-xl px-4 py-2 transition ${
                      mode === value ? "bg-gradient-to-r from-green-600 to-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-800"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Timer */}
            <div className={`${!selectedFile ? "opacity-70 pointer-events-none" : ""}`}>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Timer (minutes)</label>
              <input
                type="number"
                min={1}
                value={timerMinutes}
                onChange={(e) => setTimerMinutes(Math.max(1, Number.parseInt(e.target.value || "1", 10)))}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            {/* Begin */}
            <div className="flex justify-end">
              <button
                type="button"
                disabled={!ready}
                onClick={handleBegin}
                className="rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-5 py-3 font-semibold text-white disabled:opacity-40"
              >
                Begin
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
