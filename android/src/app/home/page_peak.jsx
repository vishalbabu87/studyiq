"use client";

import { useEffect, useState } from "react";
import { TrendingUp, FileText, Target, Award, Brain, Zap, CheckCircle } from "lucide-react";
import { Link } from "react-router";
import { getAllEntries, getAllFiles, getAllQuizHistory, initDB } from "@/utils/db";
import { useTheme } from "@/contexts/ThemeContext";

export default function HomePage() {
  const [stats, setStats] = useState({
    totalFiles: 0,
    totalEntries: 0,
    totalAttempts: 0,
    accuracy: 0,
    weakWords: 0,
  });
  const { theme } = useTheme();

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

      const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
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
    { icon: FileText, label: "Files", value: stats.totalFiles, color: "from-blue-500 to-cyan-500" },
    { icon: Brain, label: "Terms", value: stats.totalEntries, color: "from-purple-500 to-pink-500" },
    { icon: Target, label: "Attempts", value: stats.totalAttempts, color: "from-orange-500 to-red-500" },
    { icon: Award, label: "Accuracy", value: `${stats.accuracy}%`, color: "from-green-500 to-emerald-500" },
    { icon: Zap, label: "Weak", value: stats.weakWords, color: "from-yellow-500 to-orange-500" },
    { icon: CheckCircle, label: "Completed", value: "0", color: "from-teal-500 to-cyan-500" },
  ];

  const isDark = theme === "dark";
  const textColor = isDark ? "#ffffff" : "#000000";

  return (
    <div className="min-h-screen transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col items-center">

        {/* Welcome Section */}
        <div className="text-center mb-8 w-full">
          <h1 className="text-3xl md:text-5xl font-black mb-2 flex items-center justify-center gap-2">
            <span style={{ color: textColor }}>Welcome to</span>
            <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent italic">
              StudyIQ
            </span>
          </h1>
          <p className="text-sm md:text-lg font-bold uppercase tracking-widest opacity-70" style={{ color: textColor }}>
            Your AI-powered learning companion
          </p>
        </div>

        {/* Stats Grid - 3x2 Grid restored */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-2xl mb-10">
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div key={index} className="glass-card flex flex-col items-center justify-center p-4 border border-white/20 min-h-[100px] hover:scale-[1.02] transition-transform shadow-xl">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg mb-2`}>
                  <Icon className="text-white" size={20} />
                </div>
                <div className="text-xl font-black" style={{ color: textColor }}>{stat.value}</div>
                <div className="text-[9px] font-black uppercase text-gray-500 tracking-tighter">{stat.label}</div>
              </div>
            );
          })}
        </div>

        {/* PEAK VERSION: Large Cards restored to Home Page */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl pb-10">
          <Link to="/upload" className="block active-scale">
            <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 shadow-2xl flex items-center gap-6 group border-2 border-black dark:border-gray-800">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                <FileText className="text-white" size={32} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Upload</h3>
                <p className="text-gray-500 dark:text-gray-400 font-bold text-xs uppercase tracking-widest">Process PDFs & Docs</p>
              </div>
            </div>
          </Link>

          <Link to="/quiz" className="block active-scale">
            <div className="bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 rounded-[2.5rem] p-8 shadow-2xl flex items-center gap-6 group border-2 border-black dark:border-transparent">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform border border-white/30">
                <TrendingUp className="text-white" size={32} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-white uppercase tracking-tight">Start Quiz</h3>
                <p className="text-white/80 font-bold text-xs uppercase tracking-widest">Test Your Knowledge</p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
