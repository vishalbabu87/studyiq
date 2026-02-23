"use client";

import { useState, useEffect } from "react";
import AIChat from "@/components/quiz/AIChat";
import QuizResults from "@/components/quiz/QuizResults";
import QuizSession from "@/components/quiz/QuizSession";
import QuizSetup from "@/components/quiz/QuizSetup";
import { addQuizHistory, getFileById, saveFilePointer } from "@/utils/db";
import { nextSequentialRange } from "@/utils/quiz";
import { Sparkles, FileText, TrendingUp, History, Brain, Target, Zap, ChevronLeft, Layout } from "lucide-react";
import { Link } from "react-router";

/**
 * v2 - StudyIQ Quiz Staging Copy
 * This is a cloned version of the "Peak" Quiz Page for new feature development.
 * Your original quiz/page.jsx is untouched.
 */
export default function QuizPageV2() {
  const [stage, setStage] = useState("setup");
  const [config, setConfig] = useState(null);
  const [results, setResults] = useState(null);
  const [showAI, setShowAI] = useState(false);
  const [prefill, setPrefill] = useState(null);
  const [recentQuizzes, setRecentQuizzes] = useState([]);

  // Experimental: Load recent history to show in setup
  useEffect(() => {
    // Logic to fetch recent history would go here
  }, []);

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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black/95 transition-colors duration-300">

      {/* V2 Header Bar */}
      <div className="sticky top-0 z-50 w-full backdrop-blur-xl bg-white/70 dark:bg-black/70 border-b border-black/5 dark:border-white/5 px-6 py-4 flex items-center justify-between">
         <div className="flex items-center gap-3">
            <Link to="/" className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors">
                <ChevronLeft size={20} className="dark:text-white" />
            </Link>
            <h1 className="font-black text-xl tracking-tight dark:text-white flex items-center gap-2">
                <Target size={20} className="text-orange-500" />
                Practice Hub
            </h1>
         </div>
         <div className="flex items-center gap-2">
            <div className="text-[10px] font-black uppercase text-orange-600 bg-orange-100 dark:bg-orange-900/30 px-3 py-1 rounded-full">
                Live Mode
            </div>
         </div>
      </div>

      <div className="relative w-full max-w-4xl mx-auto px-4 pt-8 pb-32">

        {stage === "setup" && (
          <div className="w-full flex flex-col gap-10">

            {/* V2 Quick Action Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Refined AI Generation Card */}
              <button
                onClick={() => setShowAI(true)}
                className="group relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 p-1 shadow-2xl transition-all duration-500 hover:scale-[1.02]"
              >
                <div className="bg-white/10 dark:bg-black/20 backdrop-blur-md h-full p-8 flex flex-col gap-6 rounded-[2.4rem]">
                    <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-inner group-hover:rotate-12 transition-transform">
                        <Sparkles className="text-white" size={32} />
                    </div>
                    <div className="text-left">
                        <h3 className="text-3xl font-black text-white mb-2 uppercase tracking-tight">AI Generation</h3>
                        <p className="text-white/80 text-sm font-bold leading-tight">Prompt your way to a perfect study session</p>
                    </div>
                </div>
                <div className="absolute top-6 right-8">
                    <Zap size={24} className="text-white/40 animate-pulse" />
                </div>
              </button>

              {/* Refined Manual Configuration Card */}
              <div className="group relative overflow-hidden rounded-[2.5rem] bg-white dark:bg-gray-900/50 p-1 border-2 border-black/5 dark:border-white/5 shadow-xl transition-all duration-500 hover:shadow-purple-500/10">
                <div className="p-8 h-full flex flex-col gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center group-hover:-rotate-12 transition-transform">
                        <Layout className="text-purple-600" size={32} />
                    </div>
                    <div>
                        <h3 className="text-3xl font-black dark:text-white mb-2 uppercase tracking-tight">Custom Lab</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest leading-tight">Fine-tune every detail of your test</p>
                    </div>
                </div>
              </div>
            </div>

            {/* V2 Integrated Setup Section */}
            <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between px-2">
                    <h2 className="text-xl font-black dark:text-white uppercase tracking-tighter flex items-center gap-2">
                        <Brain size={20} className="text-purple-500" />
                        Quiz Lab Settings
                    </h2>
                    <button className="text-[10px] font-black uppercase text-purple-600 bg-purple-100 dark:bg-purple-900/20 px-3 py-1.5 rounded-full">
                        Reset Config
                    </button>
                </div>

                <div className="glass-card bg-white/40 dark:bg-gray-900/40 p-8 rounded-[3rem] border border-white/20 dark:border-white/5 shadow-2xl">
                    <QuizSetup onStartQuiz={startQuiz} prefill={prefill} />
                </div>
            </div>

            {/* V2 Recent Activity Sub-Section (Placeholder) */}
            <div className="px-2">
                <div className="flex items-center gap-2 mb-4">
                    <History size={18} className="text-gray-400" />
                    <span className="text-sm font-black text-gray-400 uppercase tracking-widest">Recent Sessions</span>
                </div>
                <div className="bg-black/5 dark:bg-white/5 rounded-3xl p-6 text-center border border-dashed border-gray-300 dark:border-gray-800">
                    <p className="text-xs font-bold text-gray-400 uppercase">Complete a quiz to see your history here</p>
                </div>
            </div>

          </div>
        )}

        {stage === "quiz" && config && <QuizSession config={config} onComplete={onComplete} />}
        {stage === "results" && results && (
          <QuizResults
            results={results}
            onRetestWrong={retestWrong}
            onContinueSequence={continueSequence}
            onNewQuiz={() => setStage("setup")}
          />
        )}

      </div>

      {/* V2 Refined Floating AI Button */}
      {stage === "setup" && (
        <button
          type="button"
          onClick={() => setShowAI(true)}
          className="fixed bottom-8 right-8 w-20 h-20 rounded-[2rem] bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 text-white shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center z-50 border-4 border-white/50 backdrop-blur-md group"
        >
          <div className="relative">
            <Sparkles size={32} className="group-hover:rotate-12 transition-transform" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full animate-ping"></div>
          </div>
        </button>
      )}

      {showAI && (
        <AIChat
          onClose={() => setShowAI(false)}
          onApplyConfig={(aiConfig) => {
            // ... same logic as original ...
            setPrefill(aiConfig);
            setStage("setup");
          }}
        />
      )}
    </div>
  );
}
