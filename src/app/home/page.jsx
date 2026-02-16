import { useEffect, useState } from "react";
import { getAllEntries, getAllFiles, getAllQuizHistory, initDB } from "@/utils/db";

export default function HomePage() {
  const [stats, setStats] = useState({
    totalFiles: 0,
    totalEntries: 0,
    totalAttempts: 0,
    accuracy: 0,
    weakCategory: "-",
    weakWords: 0,
  });

  useEffect(() => {
    initDB().then(async () => {
      const [entries, files, history] = await Promise.all([getAllEntries(), getAllFiles(), getAllQuizHistory()]);
      const totals = history.reduce(
        (acc, row) => {
          acc.correct += row.correct || 0;
          acc.total += row.total || 0;
          return acc;
        },
        { correct: 0, total: 0 },
      );
      const categoryMap = new Map();
      entries.forEach((entry) => {
        const wrong = entry.wrongCount || 0;
        categoryMap.set(entry.category, (categoryMap.get(entry.category) || 0) + wrong);
      });
      const weakCategory =
        [...categoryMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || (entries[0]?.category ?? "-");

      setStats({
        totalFiles: files.length,
        totalEntries: entries.length,
        totalAttempts: history.length,
        accuracy: totals.total > 0 ? Math.round((totals.correct / totals.total) * 100) : 0,
        weakCategory,
        weakWords: entries.filter((e) => (e.wrongCount || 0) >= 2).length,
      });
    });
  }, []);

  const cards = [
    { label: "Total Files", value: stats.totalFiles, accent: "from-pink-500 to-fuchsia-500" },
    { label: "Total Entries", value: stats.totalEntries, accent: "from-fuchsia-500 to-violet-500" },
    { label: "Total Attempts", value: stats.totalAttempts, accent: "from-violet-500 to-orange-500" },
    { label: "Accuracy %", value: `${stats.accuracy}%`, accent: "from-orange-500 to-amber-400" },
    { label: "Weak Category", value: stats.weakCategory, accent: "from-rose-500 to-orange-500" },
    { label: "Weak Words", value: stats.weakWords, accent: "from-pink-500 to-rose-500" },
  ];

  return (
    <section className="space-y-8">
      <div className="glass-card soft-glow overflow-hidden p-6">
        <div className="absolute inset-0 opacity-30" />
        <h1 className="mb-2 text-4xl font-black tracking-tight sm:text-5xl">
          <span className="text-strong">Dashboard</span>
        </h1>
        <p className="text-base text-muted">Balanced hybrid engine: local core + AI enhancement.</p>
        <div className="mt-3 h-1.5 w-36 rounded-full pink-blue-gradient" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="glass-card card-hover overflow-hidden p-4">
            <div className={`mb-3 h-1.5 rounded-full bg-gradient-to-r ${card.accent}`} />
            <p className="text-sm font-medium text-muted">{card.label}</p>
            <p className="mt-2 text-3xl font-black leading-none text-slate-900 dark:text-white sm:text-4xl">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <a href="/upload" className="glass-card card-hover block p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Quick Action</p>
          <p className="text-xl font-bold">Upload New Material</p>
          <p className="mt-2 text-sm text-muted">Add files and extract terms into your categories.</p>
        </a>
        <a href="/quiz" className="glass-card card-hover block p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Quick Action</p>
          <p className="text-xl font-bold">Start Focus Quiz</p>
          <p className="mt-2 text-sm text-muted">Run sequential or mistakes-only with timer.</p>
        </a>
      </div>
    </section>
  );
}
