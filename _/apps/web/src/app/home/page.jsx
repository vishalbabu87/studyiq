"use client";

import { useEffect, useState } from "react";
import { TrendingUp, FileText, Target, Award, Brain, Zap } from "lucide-react";
import {
  getAllEntries,
  getAllFiles,
  getAllQuizHistory,
  initDB,
} from "@/utils/db";

export default function HomePage() {
  const [stats, setStats] = useState({
    totalFiles: 0,
    totalEntries: 0,
    totalAttempts: 0,
    accuracy: 0,
    weakWords: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      await initDB();

      const [entries, files, history] = await Promise.all([
        getAllEntries(),
        getAllFiles(),
        getAllQuizHistory(),
      ]);

      let totalCorrect = 0;
      let totalQuestions = 0;

      history.forEach((quiz) => {
        totalCorrect += quiz.correct || 0;
        totalQuestions += quiz.total || 0;
      });

      const accuracy =
        totalQuestions > 0
          ? Math.round((totalCorrect / totalQuestions) * 100)
          : 0;
      const weakWords = entries.filter((e) => (e.wrongCount || 0) >= 2).length;

      setStats({
        totalFiles: files.length,
        totalEntries: entries.length,
        totalAttempts: history.length,
        accuracy,
        weakWords,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const statCards = [
    {
      icon: FileText,
      label: "Total Files",
      value: stats.totalFiles,
      color: "from-blue-500 to-cyan-500",
    },
    {
      icon: Brain,
      label: "Total Terms",
      value: stats.totalEntries,
      color: "from-purple-500 to-pink-500",
    },
    {
      icon: Target,
      label: "Quiz Attempts",
      value: stats.totalAttempts,
      color: "from-orange-500 to-red-500",
    },
    {
      icon: Award,
      label: "Accuracy",
      value: `${stats.accuracy}%`,
      color: "from-green-500 to-emerald-500",
    },
    {
      icon: Zap,
      label: "Weak Terms",
      value: stats.weakWords,
      color: "from-yellow-500 to-orange-500",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-pink-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Welcome to{" "}
            <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent">
              StudyIQ
            </span>
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg max-w-2xl mx-auto">
            Your intelligent learning companion powered by AI and smart quiz
            generation
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-lg hover-lift border border-gray-200 dark:border-gray-800"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg`}
                  >
                    <Icon className="text-white" size={24} />
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">
                      {stat.value}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {stat.label}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <a href="/upload">
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-lg hover-lift cursor-pointer border border-gray-200 dark:border-gray-800 group">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
                <FileText className="text-white" size={28} />
              </div>
              <h3 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
                Upload Files
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Upload PDFs, documents, images, or JSON files to extract terms
                and definitions
              </p>
            </div>
          </a>

          <a href="/quiz">
            <div className="bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 rounded-3xl p-8 shadow-2xl hover-lift cursor-pointer group">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <TrendingUp className="text-white" size={28} />
              </div>
              <h3 className="text-2xl font-bold mb-2 text-white">Start Quiz</h3>
              <p className="text-white/90">
                Create custom quizzes with AI or test yourself with sequential
                learning
              </p>
            </div>
          </a>
        </div>
      </div>

      <style jsx global>{`
        .hover-lift {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .hover-lift:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
        }
      `}</style>
    </div>
  );
}
