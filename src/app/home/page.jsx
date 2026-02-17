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
    <div className="bg-transparent">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Welcome to{" "}
            <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent">
              StudyIQ
            </span>
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg max-w-2xl mx-auto">
            Your intelligent learning companion powered by AI and smart quiz generation
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-lg hover-lift border border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-lg`}>
                    <Icon className="text-white" size={24} />
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">{card.value}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">{card.label}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link to="/upload">
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-lg hover-lift cursor-pointer border border-gray-200 dark:border-gray-800 group">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
                <FileText className="text-white" size={28} />
              </div>
              <h3 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">Upload Files</h3>
              <p className="text-gray-600 dark:text-gray-400">Upload PDFs, documents, images, or JSON files to extract terms and definitions</p>
            </div>
          </Link>

          <Link to="/quiz">
            <div className="bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 rounded-3xl p-8 shadow-2xl hover-lift cursor-pointer group">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <TrendingUp className="text-white" size={28} />
              </div>
              <h3 className="text-2xl font-bold mb-2 text-white">Start Quiz</h3>
              <p className="text-white/90">Create custom quizzes with AI or test yourself with sequential learning</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
