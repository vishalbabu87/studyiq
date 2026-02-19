import { useState, useEffect, useRef } from "react";
import { Wand2, Play, RotateCcw, CheckCircle, XCircle, Clock, Trophy, ChevronRight, Loader2, Zap, FileText, Hash } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { readSettings } from "@/utils/settings";

const DIFFICULTIES = ["easy", "medium", "hard"];
const COUNTS = [5, 10, 15, 20, 25, 30];

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

export default function CraftPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const isLovable = theme === "lovable";

  // Input state
  const [topic, setTopic] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [inputMode, setInputMode] = useState("topic"); // "topic" | "text"
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState("medium");

  // State
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  // Quiz state
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [phase, setPhase] = useState("input"); // "input" | "quiz" | "result"
  const [timeLeft, setTimeLeft] = useState(30);
  const [showExplanation, setShowExplanation] = useState(false);
  const [provider, setProvider] = useState("");
  const timerRef = useRef(null);

  // Timer per question
  useEffect(() => {
    if (phase !== "quiz" || selected !== null) return;
    setTimeLeft(30);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          handleSelect("__timeout__");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [currentIdx, phase]);

  const handleGenerate = async () => {
    const input = inputMode === "topic" ? topic.trim() : pastedText.trim();
    if (!input) { setError("Please enter a topic or paste some text."); return; }
    setError("");
    setGenerating(true);

    try {
      const saved = JSON.parse(localStorage.getItem("studyiq-settings") || "{}");
      const settings = readSettings ? readSettings() : saved;

      const res = await fetch("/api/ai/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: inputMode === "topic" ? `Generate a quiz about: ${input}` : input,
          settings: {
            ...settings,
            questionCount: count,
            difficulty,
            terms: [],
          },
          mode: "generate-quiz",
        }),
      });

      const data = await res.json();

      if (data.type === "error") {
        setError(data.reply || "Generation failed. Check your API keys in Settings.");
        return;
      }
      if (!Array.isArray(data.questions) || data.questions.length === 0) {
        setError("AI did not return valid questions. Try rephrasing your topic.");
        return;
      }

      const shuffled = data.questions.map(q => ({
        ...q,
        options: shuffle(q.options || []),
      }));
      setQuestions(shuffled);
      setAnswers([]);
      setCurrentIdx(0);
      setSelected(null);
      setShowExplanation(false);
      setProvider(data.provider || "AI");
      setPhase("quiz");
    } catch (err) {
      setError(`Failed to generate quiz: ${err.message}. Please try again.`);
    } finally {
      setGenerating(false);
    }
  };

  const handleSelect = (opt) => {
    if (selected !== null) return;
    clearInterval(timerRef.current);
    const q = questions[currentIdx];
    const isCorrect = opt === q.answer;
    setSelected(opt);
    setAnswers(prev => [...prev, {
      question: q.question,
      selected: opt,
      answer: q.answer,
      correct: isCorrect,
      explanation: q.explanation || "",
    }]);
  };

  const handleNext = () => {
    setShowExplanation(false);
    setSelected(null);
    if (currentIdx + 1 >= questions.length) {
      setPhase("result");
    } else {
      setCurrentIdx(i => i + 1);
    }
  };

  const handleRestart = () => {
    setPhase("input");
    setQuestions([]);
    setAnswers([]);
    setCurrentIdx(0);
    setSelected(null);
    setShowExplanation(false);
    setError("");
  };

  const handleRetryWrong = () => {
    const wrongQs = questions.filter((_, i) =>
      answers[i] && !answers[i].correct
    ).map(q => ({ ...q, options: shuffle(q.options || []) }));
    if (wrongQs.length === 0) return;
    setQuestions(wrongQs);
    setAnswers([]);
    setCurrentIdx(0);
    setSelected(null);
    setShowExplanation(false);
    setPhase("quiz");
  };

  const score = answers.filter(a => a.correct).length;
  const pct = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;

  const cardClass = `rounded-2xl border p-6 ${
    isDark ? "bg-gray-800/80 border-gray-700" :
    isLovable ? "bg-white/90 border-pink-200" :
    "bg-white border-gray-200"
  }`;

  const inputClass = `w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${
    isDark ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" :
    isLovable ? "bg-pink-50 border-pink-200 text-gray-800" :
    "bg-gray-50 border-gray-300 text-gray-800"
  }`;

  // ─── INPUT PHASE ─────────────────────────────────────────────────────────────
  if (phase === "input") return (
    <div className={`min-h-screen p-4 md:p-8 ${isDark ? "bg-gray-950 text-white" : isLovable ? "bg-pink-50 text-gray-800" : "bg-gray-50 text-gray-800"}`}>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white">
            <Zap size={14} /> AI Quiz Craft
          </div>
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 bg-clip-text text-transparent">
            Craft a Quiz Instantly
          </h1>
          <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            Type any topic or paste text — AI generates MCQ quiz questions in seconds
          </p>
        </div>

        <div className={cardClass}>
          {/* Input mode tabs */}
          <div className="flex gap-2 mb-5">
            <button
              onClick={() => setInputMode("topic")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                inputMode === "topic" ? "pink-blue-gradient text-white shadow-md" : isDark ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <Hash size={14} /> Enter Topic
            </button>
            <button
              onClick={() => setInputMode("text")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                inputMode === "text" ? "pink-blue-gradient text-white shadow-md" : isDark ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <FileText size={14} /> Paste Text
            </button>
          </div>

          {inputMode === "topic" ? (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Topic</label>
              <input
                type="text"
                placeholder="e.g. Photosynthesis, Indian History, JavaScript Promises..."
                value={topic}
                onChange={e => setTopic(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleGenerate()}
                className={inputClass}
              />
            </div>
          ) : (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Paste Study Text</label>
              <textarea
                placeholder="Paste any text, notes, or study material here and AI will create quiz questions from it..."
                value={pastedText}
                onChange={e => setPastedText(e.target.value)}
                rows={6}
                className={inputClass}
              />
              <p className={`text-xs mt-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                Tip: Works best with structured content like notes, book excerpts, or factual text.
              </p>
            </div>
          )}

          {/* Config row */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-2">Questions</label>
              <div className="flex flex-wrap gap-2">
                {COUNTS.map(n => (
                  <button
                    key={n}
                    onClick={() => setCount(n)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      count === n ? "pink-blue-gradient text-white" : isDark ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Difficulty</label>
              <div className="flex gap-2">
                {DIFFICULTIES.map(d => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`flex-1 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${
                      difficulty === d ? "pink-blue-gradient text-white" : isDark ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full py-3 rounded-xl font-semibold text-white pink-blue-gradient shadow-lg hover:opacity-90 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {generating ? (
              <><Loader2 size={18} className="animate-spin" /> Generating with AI...</>
            ) : (
              <><Wand2 size={18} /> Generate Quiz</>
            )}
          </button>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          {[
            { icon: "⚡", title: "Instant", desc: "AI generates questions in seconds" },
            { icon: "🎯", title: "Any Topic", desc: "History, science, code, anything" },
            { icon: "📊", title: "Track Score", desc: "Review wrong answers after" },
          ].map(c => (
            <div key={c.title} className={`${cardClass} text-center py-4`}>
              <div className="text-2xl mb-1">{c.icon}</div>
              <div className="text-xs font-semibold mb-0.5">{c.title}</div>
              <div className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>{c.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ─── QUIZ PHASE ───────────────────────────────────────────────────────────────
  const q = questions[currentIdx];
  const timerPct = (timeLeft / 30) * 100;

  if (phase === "quiz") return (
    <div className={`min-h-screen p-4 md:p-8 ${isDark ? "bg-gray-950 text-white" : isLovable ? "bg-pink-50 text-gray-800" : "bg-gray-50 text-gray-800"}`}>
      <div className="max-w-2xl mx-auto">
        {/* Progress bar */}
        <div className="flex items-center justify-between mb-4 text-sm">
          <span className={isDark ? "text-gray-400" : "text-gray-500"}>
            Question {currentIdx + 1} / {questions.length}
          </span>
          <div className="flex items-center gap-2">
            <Clock size={14} className={timeLeft <= 10 ? "text-red-500" : isDark ? "text-gray-400" : "text-gray-500"} />
            <span className={`font-mono font-bold ${timeLeft <= 10 ? "text-red-500" : ""}`}>{timeLeft}s</span>
          </div>
        </div>

        {/* Timer bar */}
        <div className={`w-full h-1.5 rounded-full mb-6 ${isDark ? "bg-gray-700" : "bg-gray-200"}`}>
          <div
            className={`h-full rounded-full transition-all duration-1000 ${timerPct > 50 ? "bg-green-500" : timerPct > 25 ? "bg-yellow-500" : "bg-red-500"}`}
            style={{ width: `${timerPct}%` }}
          />
        </div>

        {/* Question progress dots */}
        <div className="flex gap-1.5 mb-6 flex-wrap">
          {questions.map((_, i) => (
            <div
              key={i}
              className={`h-2 flex-1 min-w-[8px] max-w-[32px] rounded-full transition-all ${
                i < answers.length
                  ? answers[i]?.correct ? "bg-green-500" : "bg-red-500"
                  : i === currentIdx
                  ? "bg-purple-500"
                  : isDark ? "bg-gray-700" : "bg-gray-200"
              }`}
            />
          ))}
        </div>

        {/* Question card */}
        <div className={cardClass + " mb-4"}>
          <div className={`text-xs font-medium mb-3 uppercase tracking-wide ${isDark ? "text-purple-400" : "text-purple-600"}`}>
            {provider} · {difficulty}
          </div>
          <p className="text-lg font-semibold leading-relaxed mb-6">{q.question}</p>

          <div className="space-y-3">
            {(q.options || []).map((opt, i) => {
              const letter = ["A", "B", "C", "D"][i];
              const isSelected = selected === opt;
              const isCorrect = opt === q.answer;
              const isTimeout = selected === "__timeout__";

              let optClass = `w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left text-sm font-medium transition-colors cursor-pointer`;

              if (selected === null) {
                optClass += isDark
                  ? " bg-gray-700/50 border-gray-600 hover:border-purple-500 hover:bg-gray-700"
                  : " bg-gray-50 border-gray-200 hover:border-purple-400 hover:bg-purple-50";
              } else if (isCorrect) {
                optClass += " bg-green-50 dark:bg-green-900/30 border-green-500 text-green-700 dark:text-green-400";
              } else if (isSelected && !isCorrect) {
                optClass += " bg-red-50 dark:bg-red-900/30 border-red-500 text-red-700 dark:text-red-400";
              } else {
                optClass += isDark ? " bg-gray-700/30 border-gray-700 opacity-50" : " bg-gray-50 border-gray-200 opacity-50";
              }

              return (
                <button
                  key={opt}
                  onClick={() => handleSelect(opt)}
                  disabled={selected !== null}
                  className={optClass}
                >
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    selected !== null && isCorrect ? "bg-green-500 text-white" :
                    isSelected && !isCorrect ? "bg-red-500 text-white" :
                    isDark ? "bg-gray-600 text-gray-300" : "bg-gray-200 text-gray-600"
                  }`}>
                    {letter}
                  </span>
                  <span className="flex-1">{opt.replace(/^[A-D]\)\s*/, "")}</span>
                  {selected !== null && isCorrect && <CheckCircle size={16} className="text-green-500 flex-shrink-0" />}
                  {isSelected && !isCorrect && <XCircle size={16} className="text-red-500 flex-shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Timeout notice */}
          {selected === "__timeout__" && (
            <div className="mt-4 p-3 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400 text-sm text-center">
              ⏰ Time's up! The correct answer was highlighted above.
            </div>
          )}

          {/* Explanation */}
          {selected !== null && q.explanation && (
            <div className="mt-4">
              <button
                onClick={() => setShowExplanation(v => !v)}
                className={`text-xs font-medium ${isDark ? "text-purple-400 hover:text-purple-300" : "text-purple-600 hover:text-purple-700"}`}
              >
                {showExplanation ? "Hide" : "Show"} explanation
              </button>
              {showExplanation && (
                <div className={`mt-2 p-3 rounded-xl text-sm ${isDark ? "bg-purple-900/20 border border-purple-800 text-purple-300" : "bg-purple-50 border border-purple-200 text-purple-800"}`}>
                  💡 {q.explanation}
                </div>
              )}
            </div>
          )}
        </div>

        {selected !== null && (
          <button
            onClick={handleNext}
            className="w-full py-3 rounded-xl font-semibold text-white pink-blue-gradient shadow-lg hover:opacity-90 transition-all flex items-center justify-center gap-2"
          >
            {currentIdx + 1 >= questions.length ? (
              <><Trophy size={18} /> See Results</>
            ) : (
              <>Next Question <ChevronRight size={18} /></>
            )}
          </button>
        )}
      </div>
    </div>
  );

  // ─── RESULT PHASE ─────────────────────────────────────────────────────────────
  const wrongAnswers = answers.filter(a => !a.correct);

  return (
    <div className={`min-h-screen p-4 md:p-8 ${isDark ? "bg-gray-950 text-white" : isLovable ? "bg-pink-50 text-gray-800" : "bg-gray-50 text-gray-800"}`}>
      <div className="max-w-2xl mx-auto">
        {/* Score card */}
        <div className={cardClass + " text-center mb-6"}>
          <div className="text-5xl mb-3">
            {pct >= 80 ? "🏆" : pct >= 60 ? "🎯" : pct >= 40 ? "📚" : "💪"}
          </div>
          <h2 className="text-2xl font-bold mb-1">
            {pct >= 80 ? "Excellent!" : pct >= 60 ? "Good Job!" : pct >= 40 ? "Keep Practicing!" : "Keep Going!"}
          </h2>
          <p className={`text-sm mb-4 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            You answered {score} out of {questions.length} correctly
          </p>
          {/* Score circle */}
          <div className="relative inline-flex items-center justify-center w-28 h-28 mb-4">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke={isDark ? "#374151" : "#e5e7eb"} strokeWidth="10" />
              <circle cx="50" cy="50" r="40" fill="none"
                stroke={pct >= 80 ? "#22c55e" : pct >= 60 ? "#a855f7" : pct >= 40 ? "#f59e0b" : "#ef4444"}
                strokeWidth="10"
                strokeDasharray={`${2.51 * pct} 251`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute text-2xl font-bold">{pct}%</span>
          </div>
          {/* Stats row */}
          <div className="flex justify-center gap-6 text-sm">
            <div className="text-center">
              <div className="text-green-500 font-bold text-xl">{score}</div>
              <div className={isDark ? "text-gray-400" : "text-gray-500"}>Correct</div>
            </div>
            <div className="text-center">
              <div className="text-red-500 font-bold text-xl">{questions.length - score}</div>
              <div className={isDark ? "text-gray-400" : "text-gray-500"}>Wrong</div>
            </div>
            <div className="text-center">
              <div className="text-purple-500 font-bold text-xl">{questions.length}</div>
              <div className={isDark ? "text-gray-400" : "text-gray-500"}>Total</div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 mb-6">
          <button onClick={handleRestart} className={`flex-1 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${isDark ? "bg-gray-800 hover:bg-gray-700 text-white border border-gray-700" : "bg-white hover:bg-gray-50 text-gray-800 border border-gray-200"}`}>
            <RotateCcw size={16} /> New Quiz
          </button>
          {wrongAnswers.length > 0 && (
            <button onClick={handleRetryWrong} className="flex-1 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-orange-500 to-red-500 hover:opacity-90 transition-all flex items-center justify-center gap-2">
              <Play size={16} /> Retry Wrong ({wrongAnswers.length})
            </button>
          )}
        </div>

        {/* Wrong answers review */}
        {wrongAnswers.length > 0 && (
          <div className={cardClass}>
            <h3 className="font-bold mb-4 text-red-500 flex items-center gap-2">
              <XCircle size={18} /> Review Wrong Answers ({wrongAnswers.length})
            </h3>
            <div className="space-y-4">
              {wrongAnswers.map((a, i) => (
                <div key={i} className={`p-4 rounded-xl ${isDark ? "bg-gray-700/50 border border-gray-600" : "bg-red-50 border border-red-100"}`}>
                  <p className="text-sm font-medium mb-2">{a.question}</p>
                  <div className="flex gap-4 text-xs">
                    <span className="text-red-500">✗ You: {a.selected === "__timeout__" ? "Timed out" : a.selected?.replace(/^[A-D]\)\s*/, "")}</span>
                    <span className="text-green-500">✓ Correct: {a.answer?.replace(/^[A-D]\)\s*/, "")}</span>
                  </div>
                  {a.explanation && (
                    <p className={`text-xs mt-2 ${isDark ? "text-gray-400" : "text-gray-500"}`}>💡 {a.explanation}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
