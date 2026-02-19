import { useEffect, useState } from "react";
import { TrendingUp, FileText, Target, Award, Brain, Zap } from "lucide-react";
import { Link } from "react-router";
import { getAllEntries, getAllFiles, getAllQuizHistory, initDB } from "@/utils/db";

export default function HomePage() {
  const [stats, setStats] = useState({
    totalFiles: 0,
    totalEntries: 0,
    totalAttempts: 0,
    accuracy: 0,
    weakWords: 0,
  });

  useEffect(() => {
    initDB().then(async () => {
      const [entries, files, history] = await Promise.all([getAllEntries(), getAllFiles(), getAllQuizHistory()]);

      let correct = 0;
      let total = 0;
      history.forEach((quiz) => {
        correct += quiz.correct || 0;
        total += quiz.total || 0;
      });

      setStats({
        totalFiles: files.length,
        totalEntries: entries.length,
        totalAttempts: history.length,
        accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
        weakWords: entries.filter((entry) => (entry.wrongCount || 0) >= 2).length,
      });
    });
  }, []);

  const statCards = [
    { icon: FileText, label: "Total Files", value: stats.totalFiles, color: "from-blue-500 to-cyan-500" },
    { icon: Brain, label: "Total Terms", value: stats.totalEntries, color: "from-purple-500 to-pink-500" },
    { icon: Target, label: "Quiz Attempts", value: stats.totalAttempts, color: "from-orange-500 to-red-500" },
    { icon: Award, label: "Accuracy", value: `${stats.accuracy}%`, color: "from-green-500 to-emerald-500" },
    { icon: Zap, label: "Weak Terms", value: stats.weakWords, color: "from-yellow-500 to-orange-500" },
  ];

  return (
    <div className="transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-3 md:px-4 py-4 md:py-8">
        <div className="text-center mb-6 md:mb-12 hero-text-panel py-6 md:py-8 px-4 md:px-6 rounded-2xl md:rounded-3xl">
          <h1 className="text-2xl md:text-5xl font-bold mb-2 md:mb-4">
            Welcome to{" "}
            <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent dark:text-white dark:bg-none">
              StudyIQ
            </span>
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm md:text-lg max-w-2xl mx-auto">
            Your intelligent learning companion powered by AI
          </p>
        </div>

        {/* Stats Cards - Equal size grid */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4 mb-4 md:mb-8">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="bg-white dark:bg-gray-900 rounded-xl md:rounded-2xl p-3 md:p-4 shadow-lg border border-gray-200 dark:border-gray-800 flex flex-col justify-between min-h-[80px] md:min-h-[100px]">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className={`w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-lg flex-shrink-0`}>
                    <Icon className="text-white" size={14} md:size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white truncate">{card.value}</div>
                    <div className="text-[10px] md:text-xs text-gray-600 dark:text-gray-400 truncate">{card.label}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Cards - Equal size grid */}
        <div className="grid grid-cols-2 gap-2 md:gap-4">
          <Link to="/upload">
            <div className="bg-white dark:bg-gray-900 rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg hover-lift cursor-pointer border border-gray-200 dark:border-gray-800 group h-full">
              <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-lg">
                <FileText className="text-white" size={18} md:size={24} />
              </div>
              <h3 className="text-base md:text-xl font-bold mb-1 text-gray-900 dark:text-white">Upload</h3>
              <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 line-clamp-2">Upload PDFs, documents, images, or JSON files</p>
            </div>
          </Link>

          <Link to="/quiz">
            <div className="bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 rounded-xl md:rounded-2xl p-4 md:p-6 shadow-xl hover-lift cursor-pointer group h-full">
              <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <TrendingUp className="text-white" size={18} md:size={24} />
              </div>
              <h3 className="text-base md:text-xl font-bold mb-1 text-white">Start Quiz</h3>
              <p className="text-white/80 text-xs md:text-sm line-clamp-2">Create custom quizzes with AI or test yourself</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
