import { useState } from "react";
import AIChat from "@/components/quiz/AIChat";
import QuizResults from "@/components/quiz/QuizResults";
import QuizSession from "@/components/quiz/QuizSession";
import QuizSetup from "@/components/quiz/QuizSetup";
import { addQuizHistory, getFileById, saveFilePointer } from "@/utils/db";
import { nextSequentialRange } from "@/utils/quiz";

export default function QuizPage() {
  const [stage, setStage] = useState("setup");
  const [config, setConfig] = useState(null);
  const [results, setResults] = useState(null);
  const [showAI, setShowAI] = useState(false);
  const [prefill, setPrefill] = useState(null);

  const startQuiz = (quizConfig) => {
    setConfig(quizConfig);
    setStage("quiz");
  };

  const onComplete = async (result) => {
    setResults(result);
    setStage("results");
    await addQuizHistory({
      timestamp: Date.now(),
      total: result.total,
      correct: result.correct,
      wrong: result.wrong,
      accuracy: result.total > 0 ? Math.round((result.correct / result.total) * 100) : 0,
      config: result.config,
    });

    if (result.config.mode === "sequential") {
      await saveFilePointer(result.config.file, result.usedRange.end + 1);
    }
  };

  const continueSequence = async () => {
    if (!results) return;
    const file = await getFileById(results.config.file);
    const next = nextSequentialRange(results.usedRange.end, results.config.questionCount, file?.entryCount || results.totalEntries);
    if (!next) {
      setStage("setup");
      setPrefill({
        ...results.config,
        rangeStart: 1,
        rangeEnd: Math.max(1, results.config.questionCount),
      });
      return;
    }
    startQuiz({
      ...results.config,
      mode: "sequential",
      rangeStart: next.start,
      rangeEnd: next.end,
    });
  };

  const retestWrong = () => {
    if (!results) return;
    startQuiz({
      ...results.config,
      mode: "mistakes",
      rangeStart: results.usedRange.start,
      rangeEnd: results.usedRange.end,
      questionCount: Math.max(1, results.wrongEntries.length),
    });
  };

  const weakImprove = () => {
    if (!results) return;
    setStage("setup");
    setPrefill({
      ...results.config,
      mode: "mistakes",
      rangeStart: results.usedRange.start,
      rangeEnd: results.usedRange.end,
    });
  };

  return (
    <section className="space-y-4">
      {stage === "setup" && (
        <div className="glass-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">AI Quiz Creator</p>
            <h2 className="text-xl font-bold">Describe your quiz and auto-fill setup</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Example: Generate 30 hard MCQs from range 1-50 in random mode.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAI(true)}
            className="pink-blue-gradient rounded-xl px-5 py-3 font-semibold text-white shadow-lg"
          >
            Create with AI
          </button>
        </div>
      )}

      {stage === "setup" && <QuizSetup onStartQuiz={startQuiz} prefill={prefill} />}
      {stage === "quiz" && config && <QuizSession config={config} onComplete={onComplete} />}
      {stage === "results" && results && (
        <QuizResults
          results={results}
          onRetestWrong={retestWrong}
          onContinueSequence={continueSequence}
          onWeakFocus={weakImprove}
          onNewQuiz={() => {
            setPrefill(null);
            setStage("setup");
          }}
        />
      )}

      <button
        type="button"
        onClick={() => setShowAI(true)}
        className="fixed bottom-6 right-6 rounded-full pink-blue-gradient px-6 py-4 font-semibold text-white shadow-xl"
      >
        AI Quiz
      </button>

      {showAI && (
        <AIChat
          onClose={() => setShowAI(false)}
          onApplyConfig={(aiConfig) => {
            const merged = {
              category: aiConfig.category || "",
              file: Number.parseInt(aiConfig.file || "0", 10) || 0,
              rangeStart: aiConfig.rangeStart || 1,
              rangeEnd: aiConfig.rangeEnd || 10,
              questionCount: aiConfig.questionCount || 10,
              difficulty: aiConfig.difficulty || "medium",
              mode: aiConfig.mode || "sequential",
              timerMinutes: aiConfig.timerMinutes || 5,
            };
            setPrefill(merged);
            setStage("setup");
          }}
        />
      )}
    </section>
  );
}
