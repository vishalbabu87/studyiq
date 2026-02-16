import { useEffect, useMemo, useState } from "react";
import { getEntriesByFile, updateEntry } from "@/utils/db";
import { makeQuizSession } from "@/utils/quiz";

export default function QuizSession({ config, onComplete }) {
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongEntries, setWrongEntries] = useState([]);
  const [timeLeft, setTimeLeft] = useState((config.timerMinutes || 5) * 60);
  const [usedRange, setUsedRange] = useState({ start: config.rangeStart, end: config.rangeEnd });
  const [totalEntries, setTotalEntries] = useState(0);

  const progress = useMemo(
    () => (questions.length > 0 ? ((current + 1) / questions.length) * 100 : 0),
    [current, questions.length],
  );

  useEffect(() => {
    let active = true;
    getEntriesByFile(config.file).then((entries) => {
      if (!active) return;
      setTotalEntries(entries.length);
      const session = makeQuizSession({
        entries,
        mode: config.mode,
        difficulty: config.difficulty,
        questionCount: config.questionCount,
        rangeStart: config.rangeStart,
        rangeEnd: config.rangeEnd,
      });
      setQuestions(session.questions);
      setUsedRange(session.usedRange);
    });

    return () => {
      active = false;
    };
  }, [config]);

  useEffect(() => {
    if (!questions.length) return;
    if (timeLeft <= 0) {
      onComplete({
        total: questions.length,
        correct: correctCount,
        wrong: questions.length - correctCount,
        wrongEntries,
        config,
        usedRange,
        totalEntries,
      });
      return;
    }
    const timer = setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, questions.length, correctCount, wrongEntries, onComplete, config, usedRange, totalEntries]);

  const handleAnswer = async (idx) => {
    if (showResult) return;
    setSelectedOption(idx);
    setShowResult(true);

    const question = questions[current];
    const picked = question.options[idx];
    const isCorrect = picked?.isCorrect;

    if (isCorrect) {
      setCorrectCount((v) => v + 1);
    } else {
      setWrongEntries((prev) => [...prev, question.entry]);
    }

    await updateEntry({
      ...question.entry,
      attemptCount: (question.entry.attemptCount || 0) + 1,
      wrongCount: isCorrect ? question.entry.wrongCount || 0 : (question.entry.wrongCount || 0) + 1,
      lastAttempted: Date.now(),
    });

    setTimeout(() => {
      if (current < questions.length - 1) {
        setCurrent((v) => v + 1);
        setSelectedOption(null);
        setShowResult(false);
      } else {
        const finalCorrect = isCorrect ? correctCount + 1 : correctCount;
        const finalWrongEntries = isCorrect ? wrongEntries : [...wrongEntries, question.entry];
        onComplete({
          total: questions.length,
          correct: finalCorrect,
          wrong: questions.length - finalCorrect,
          wrongEntries: finalWrongEntries,
          config,
          usedRange,
          totalEntries,
        });
      }
    }, 900);
  };

  if (!questions.length) {
    return <section className="glass-card p-6">Loading quiz session...</section>;
  }

  const currentQuestion = questions[current];
  const minuteText = `${Math.floor(timeLeft / 60)
    .toString()
    .padStart(2, "0")}:${(timeLeft % 60).toString().padStart(2, "0")}`;

  return (
    <section className="glass-card p-6 sm:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 text-sm">
        <div>
          Q {current + 1}/{questions.length} | score {correctCount}/{current + (showResult ? 1 : 0)}
        </div>
        <div className="rounded-lg bg-slate-900 px-3 py-1 text-white dark:bg-slate-100 dark:text-slate-900">
          {minuteText}
        </div>
      </div>

      <div className="mb-6 h-2 rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          className="h-2 rounded-full bg-gradient-to-r from-sky-500 via-indigo-500 to-fuchsia-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <h2 className="mb-2 text-2xl font-bold">{currentQuestion.prompt}</h2>
      <p className="mb-5 text-sm text-slate-600 dark:text-slate-300">
        {currentQuestion.direction === "term_to_meaning" ? "Choose correct meaning" : "Choose correct term"}
      </p>

      <div className="space-y-3">
        {currentQuestion.options.map((option, idx) => {
          let stateClass = "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900";
          if (showResult && selectedOption === idx && option.isCorrect) stateClass = "border-emerald-400 bg-emerald-500/20";
          if (showResult && selectedOption === idx && !option.isCorrect) stateClass = "border-rose-400 bg-rose-500/20";
          if (showResult && option.isCorrect) stateClass = "border-emerald-400 bg-emerald-500/20";

          return (
            <button
              type="button"
              key={`${currentQuestion.id}-${idx}`}
              onClick={() => handleAnswer(idx)}
              disabled={showResult}
              className={`w-full rounded-xl border px-4 py-3 text-left transition ${stateClass}`}
            >
              {option.text}
            </button>
          );
        })}
      </div>
    </section>
  );
}
