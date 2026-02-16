"use client";

import { useEffect, useState } from "react";
import QuizSetup from "@/components/quiz/QuizSetup";
import QuizSession from "@/components/quiz/QuizSession";
import QuizResults from "@/components/quiz/QuizResults";
import AIChat from "@/components/quiz/AIChat";
import { MessageCircle } from "lucide-react";

export default function QuizPage() {
  const [stage, setStage] = useState("setup"); // 'setup', 'quiz', 'results', 'chat'
  const [quizConfig, setQuizConfig] = useState(null);
  const [quizResults, setQuizResults] = useState(null);
  const [showAIChat, setShowAIChat] = useState(false);

  const handleStartQuiz = (config) => {
    setQuizConfig(config);
    setStage("quiz");
  };

  const handleQuizComplete = (results) => {
    setQuizResults(results);
    setStage("results");
  };

  const handleReturnToSetup = () => {
    setStage("setup");
    setQuizConfig(null);
    setQuizResults(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-pink-50 to-orange-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {stage === "setup" && <QuizSetup onStartQuiz={handleStartQuiz} />}

        {stage === "quiz" && quizConfig && (
          <QuizSession config={quizConfig} onComplete={handleQuizComplete} />
        )}

        {stage === "results" && quizResults && (
          <QuizResults
            results={quizResults}
            onReturnToSetup={handleReturnToSetup}
            onContinue={() => setStage("setup")}
          />
        )}

        {/* AI Chat Button */}
        {!showAIChat && (
          <button
            onClick={() => setShowAIChat(true)}
            className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-2xl hover:scale-110 transition-transform flex items-center justify-center z-50"
          >
            <MessageCircle size={24} />
          </button>
        )}

        {/* AI Chat Modal */}
        {showAIChat && (
          <AIChat
            onClose={() => setShowAIChat(false)}
            onStartQuiz={handleStartQuiz}
          />
        )}
      </div>
    </div>
  );
}
