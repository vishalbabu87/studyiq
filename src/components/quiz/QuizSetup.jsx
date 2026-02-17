import { useEffect, useMemo, useState } from "react";
import { getAllCategories, getFilesByCategory, initDB } from "@/utils/db";
import { parseRange } from "@/utils/quiz";

const questionChoices = [10, 25, 50, 100];

export default function QuizSetup({ onStartQuiz, prefill }) {
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [categories, setCategories] = useState([]);
  const [files, setFiles] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedFile, setSelectedFile] = useState("");
  const [rangeText, setRangeText] = useState("1-10");
  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState("medium");
  const [mode, setMode] = useState("sequential");
  const [timerMinutes, setTimerMinutes] = useState(5);

  const steps = useMemo(
    () => ["Category", "File", "Range", "Question Count", "Difficulty", "Mode", "Timer"],
    [],
  );

  useEffect(() => {
    initDB().then(() => getAllCategories().then(setCategories));
  }, []);

  useEffect(() => {
    if (!selectedCategory) return;
    getFilesByCategory(selectedCategory).then(setFiles);
  }, [selectedCategory]);

  useEffect(() => {
    if (!prefill) return;
    setStarted(true);
    if (prefill.category) setSelectedCategory(prefill.category);
    if (prefill.file) setSelectedFile(prefill.file);
    if (prefill.rangeStart && prefill.rangeEnd) {
      setRangeText(`${prefill.rangeStart}-${prefill.rangeEnd}`);
    }
    if (prefill.questionCount) setQuestionCount(prefill.questionCount);
    if (prefill.difficulty) setDifficulty(prefill.difficulty);
    if (prefill.mode) setMode(prefill.mode);
  }, [prefill]);

  const canContinue = () => {
    if (step === 0) return Boolean(selectedCategory);
    if (step === 1) return Boolean(selectedFile);
    if (step === 2) return /^\d+\s*[-:]\s*\d+$/.test(rangeText);
    return true;
  };

  const onSubmit = () => {
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
    <section className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-3 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent">
          Start Quiz
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Step {step + 1} of {steps.length}: {steps[step]}
        </p>
      </div>

      <div className="mb-6">
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div className="h-2 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-xl border border-gray-200 dark:border-gray-800">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Quiz Configuration</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">Step-by-step flow with sequence support</p>
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
        <>
          <div className="mb-5 text-xs text-slate-500 dark:text-slate-400">
            {steps.map((item, index) => (
              <span key={item} className={index === step ? "font-semibold text-slate-900 dark:text-slate-100" : ""}>
                {index > 0 ? " -> " : ""}
                {item}
              </span>
            ))}
          </div>

          {step === 0 && (
            <div className="space-y-2">
              {categories.length === 0 && <p>No category found. Add category in Upload first.</p>}
              {categories.map((cat) => (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`w-full rounded-xl border px-4 py-3 text-left ${
                    selectedCategory === cat.name
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white border-transparent"
                      : "border-slate-200 bg-gray-50 dark:border-slate-800 dark:bg-slate-800/50"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-2">
              {files.map((file) => (
                <button
                  type="button"
                  key={file.id}
                  onClick={() => {
                    setSelectedFile(String(file.id));
                    const start = file.sequencePointer || 1;
                    const end = start + Math.max(questionCount - 1, 9);
                    setRangeText(`${start}-${end}`);
                  }}
                  className={`w-full rounded-xl border px-4 py-3 text-left ${
                    String(file.id) === selectedFile
                      ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white border-transparent"
                      : "border-slate-200 bg-gray-50 dark:border-slate-800 dark:bg-slate-800/50"
                  }`}
                >
                  <div className="font-medium">{file.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {file.entryCount || 0} entries | next pointer: {file.sequencePointer || 1}
                  </div>
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div>
              <label className="mb-2 block text-sm">Range (example: 1-30, 51-100)</label>
              <input
                value={rangeText}
                onChange={(e) => setRangeText(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="flex gap-2">
                {questionChoices.map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setQuestionCount(count)}
                  className={`rounded-xl px-4 py-2 text-sm ${
                    questionCount === count
                        ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                        : "bg-slate-100 dark:bg-slate-800"
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
          )}

          {step === 4 && (
            <div className="flex gap-2">
              {["easy", "medium", "hard"].map((level) => (
                <button
                  type="button"
                  key={level}
                  onClick={() => setDifficulty(level)}
                  className={`rounded-xl px-4 py-2 capitalize ${
                    difficulty === level ? "bg-gradient-to-r from-orange-600 to-red-600 text-white" : "bg-slate-100 dark:bg-slate-800"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          )}

          {step === 5 && (
            <div className="flex gap-2">
              {[
                ["sequential", "Sequential"],
                ["random", "Random"],
                ["mistakes", "Mistakes Only"],
              ].map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => setMode(value)}
                  className={`rounded-xl px-4 py-2 ${
                    mode === value ? "bg-gradient-to-r from-green-600 to-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-800"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {step === 6 && (
            <div>
              <label className="mb-2 block text-sm">Timer (minutes)</label>
              <input
                type="number"
                min={1}
                value={timerMinutes}
                onChange={(e) => setTimerMinutes(Math.max(1, Number.parseInt(e.target.value || "1", 10)))}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
          )}

          <div className="mt-6 flex justify-between">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="rounded-xl bg-gray-200 dark:bg-gray-700 px-4 py-2 disabled:opacity-40"
            >
              Back
            </button>
            {step < steps.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
                disabled={!canContinue()}
                className="rounded-xl pink-blue-gradient px-4 py-2 text-white disabled:opacity-40"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={onSubmit}
                className="rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-2 font-semibold text-white"
              >
                Launch Quiz
              </button>
            )}
          </div>
        </>
      )}
      </div>
    </section>
  );
}
