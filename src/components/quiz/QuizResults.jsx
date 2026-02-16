export default function QuizResults({ results, onRetestWrong, onContinueSequence, onNewQuiz, onWeakFocus }) {
  const accuracy = results.total ? Math.round((results.correct / results.total) * 100) : 0;

  return (
    <section className="glass-card p-6 sm:p-8">
      <h2 className="mb-5 text-3xl font-bold">Quiz Complete</h2>
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-emerald-500/15 p-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">Right</p>
          <p className="text-2xl font-bold">{results.correct}</p>
        </div>
        <div className="rounded-2xl bg-rose-500/15 p-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">Wrong</p>
          <p className="text-2xl font-bold">{results.wrong}</p>
        </div>
        <div className="rounded-2xl bg-sky-500/15 p-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">Accuracy</p>
          <p className="text-2xl font-bold">{accuracy}%</p>
        </div>
      </div>

      {results.wrongEntries.length > 0 && (
        <div className="mb-6 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
          <h3 className="mb-2 font-semibold">Weak Points</h3>
          <div className="max-h-48 space-y-2 overflow-auto">
            {results.wrongEntries.map((entry, idx) => (
              <div key={`${entry.id}-${idx}`} className="rounded-xl bg-slate-100 p-3 dark:bg-slate-900">
                <p className="font-medium">{entry.term}</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">{entry.meaning}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <button type="button" onClick={onRetestWrong} className="rounded-xl bg-amber-500 px-4 py-3 text-white">
          Retest Wrong
        </button>
        <button type="button" onClick={onWeakFocus} className="rounded-xl bg-fuchsia-600 px-4 py-3 text-white">
          Weak Improvement
        </button>
        <button type="button" onClick={onContinueSequence} className="rounded-xl bg-emerald-600 px-4 py-3 text-white">
          Continue Sequence
        </button>
        <button
          type="button"
          onClick={onNewQuiz}
          className="rounded-xl bg-slate-900 px-4 py-3 text-white dark:bg-slate-100 dark:text-slate-900"
        >
          New Quiz
        </button>
      </div>
    </section>
  );
}
