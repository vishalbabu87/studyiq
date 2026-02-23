"use client";

import { useEffect, useState } from "react";
import { TrendingUp, FileText, Target, Award, Brain, Zap, CheckCircle, Sparkles, Layout, Globe, Search, Settings } from "lucide-react";
import { Link } from "react-router";
import { getAllEntries, getAllFiles, getAllQuizHistory, initDB } from "@/utils/db";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * v2 - StudyIQ Staging Copy
 * This is a cloned version of the "Peak" Home Page for new feature development.
 * Experimental changes go here first.
 */
export default function HomePageV2() {
  const [stats, setStats] = useState({
    totalFiles: 0,
    totalEntries: 0,
    totalAttempts: 0,
    accuracy: 0,
    weakWords: 0,
  });
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState("dashboard");

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

  const isDark = theme === "dark";
  const textColor = isDark ? "#ffffff" : "#000000";

  return (
    <div className="min-h-screen transition-colors duration-300 bg-gray-50 dark:bg-black/95">

      {/* Experimental Top Navigation Bar */}
      <div className="sticky top-0 z-50 w-full backdrop-blur-xl bg-white/70 dark:bg-black/70 border-b border-black/5 dark:border-white/5 px-6 py-4 flex items-center justify-between">
         <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-orange-500 flex items-center justify-center">
                <Brain size={18} className="text-white" />
            </div>
            <span className="font-black text-xl tracking-tight dark:text-white">StudyIQ <span className="text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-600 px-1.5 py-0.5 rounded-full uppercase ml-1">v2</span></span>
         </div>
         <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors text-gray-500">
                <Search size={20} />
            </button>
            <button className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors text-gray-500">
                <Settings size={20} />
            </button>
         </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col items-center">

        {/* Dynamic Welcome Header with Glass Backdrop */}
        <div className="relative w-full max-w-4xl p-12 rounded-[3rem] overflow-hidden mb-12 group">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 via-pink-500/10 to-orange-400/10 dark:from-purple-900/20 dark:to-orange-900/20 group-hover:scale-110 transition-transform duration-700"></div>
            <div className="relative text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/50 dark:bg-white/10 border border-white/20 backdrop-blur-md mb-6 animate-bounce-subtle">
                    <Sparkles size={14} className="text-orange-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest dark:text-white/70 text-gray-600">AI Powered Insights Ready</span>
                </div>
                <h1 className="text-5xl md:text-7xl font-black mb-4 tracking-tighter">
                    <span className="text-gray-900 dark:text-white">Elevate your</span><br/>
                    <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent italic drop-shadow-sm">
                        Knowledge
                    </span>
                </h1>
                <p className="max-w-md mx-auto text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                    Transform your study materials into interactive quizzes and track your progress with smart analytics.
                </p>
            </div>
        </div>

        {/* Action Center - New V2 Layout */}
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">

            {/* Upload Card - Refined Design */}
            <Link to="/upload" className="relative group overflow-hidden rounded-[2.5rem] bg-white dark:bg-gray-900/50 p-1 border-2 border-black/5 dark:border-white/5 hover:border-purple-500/50 transition-all duration-500 shadow-xl hover:shadow-purple-500/10">
                <div className="p-8 flex flex-col gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg group-hover:rotate-6 transition-transform">
                        <FileText className="text-white" size={32} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black dark:text-white mb-1">Add Content</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest">Process PDFs, Text & Links</p>
                    </div>
                </div>
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-purple-500 text-white p-2 rounded-full">
                        <Zap size={16} />
                    </div>
                </div>
            </Link>

            {/* Quiz Card - Refined Design */}
            <Link to="/quiz" className="relative group overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 p-1 transition-all duration-500 shadow-2xl hover:shadow-orange-500/20">
                <div className="bg-white/5 dark:bg-black/20 backdrop-blur-sm h-full p-8 flex flex-col gap-6 rounded-[2.4rem]">
                    <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 group-hover:-rotate-6 transition-transform">
                        <TrendingUp className="text-white" size={32} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-white mb-1">Take Quiz</h3>
                        <p className="text-sm text-white/70 font-bold uppercase tracking-widest">Test Your Mastery</p>
                    </div>
                </div>
                <div className="absolute top-4 right-4">
                    <div className="bg-white/20 backdrop-blur-md text-white p-2 rounded-full border border-white/30">
                        <Sparkles size={16} />
                    </div>
                </div>
            </Link>
        </div>

        {/* Stats Section - New V2 Compact Design */}
        <div className="w-full max-w-4xl">
            <div className="flex items-center justify-between mb-8 px-4">
                <h2 className="text-xl font-black dark:text-white uppercase tracking-tighter flex items-center gap-2">
                    <Layout size={20} className="text-purple-500" />
                    Activity Overview
                </h2>
                <button className="text-[10px] font-black uppercase text-purple-600 bg-purple-50 dark:bg-purple-900/20 px-3 py-1.5 rounded-full hover:bg-purple-100 transition-colors">
                    View Details
                </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                {[
                    { icon: FileText, label: "Files", value: stats.totalFiles, color: "text-blue-500", bg: "bg-blue-500/10" },
                    { icon: Brain, label: "Terms", value: stats.totalEntries, color: "text-purple-500", bg: "bg-purple-500/10" },
                    { icon: Award, label: "Accuracy", value: `${stats.accuracy}%`, color: "text-green-500", bg: "bg-green-500/10" },
                    { icon: Zap, label: "Weak", value: stats.weakWords, color: "text-orange-500", bg: "bg-orange-500/10" },
                ].map((stat, i) => (
                    <div key={i} className="bg-white dark:bg-gray-900/40 p-6 rounded-3xl border border-black/5 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow">
                        <div className={`w-10 h-10 ${stat.bg} rounded-xl flex items-center justify-center mb-4`}>
                            <stat.icon size={20} className={stat.color} />
                        </div>
                        <div className="text-2xl font-black dark:text-white">{stat.value}</div>
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{stat.label}</div>
                    </div>
                ))}
            </div>
        </div>

      </div>
    </div>
  );
}
