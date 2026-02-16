"use client";

import {
  Trophy,
  TrendingUp,
  AlertCircle,
  Repeat,
  Play,
  Home,
} from "lucide-react";
import { addQuizHistory } from "@/utils/db";
import { useEffect } from "react";

export default function QuizResults({ results, onReturnToSetup, onContinue }) {
  const { total, correct, wrong, wrongEntries, config } = results;
  const accuracy = Math.round((correct / total) * 100);

  useEffect(() => {
    saveHistory();
  }, []);

  const saveHistory = async () => {
    await addQuizHistory({
      timestamp: Date.now(),
      total,
      correct,
      wrong,
      accuracy,
      config,
    });
  };

  const handleRetestWrong = () => {
    // Create new quiz with only wrong answers
    onReturnToSetup();
  };

  const handleContinueSequence = () => {
    // Continue from next range
    onContinue();
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 mb-4 shadow-2xl">
          <Trophy className="text-white" size={40} />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent">
          Quiz Complete!
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Great job! Here's how you did:
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-lg border border-gray-200 dark:border-gray-800 text-center">
          <div className="text-4xl font-bold text-green-600 mb-2">
            {correct}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Correct
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-lg border border-gray-200 dark:border-gray-800 text-center">
          <div className="text-4xl font-bold text-red-600 mb-2">{wrong}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Wrong</div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-lg border border-gray-200 dark:border-gray-800 text-center">
          <div className="text-4xl font-bold text-purple-600 mb-2">
            {accuracy}%
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Accuracy
          </div>
        </div>
      </div>

      {/* Weak Areas */}
      {wrongEntries.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-lg border border-gray-200 dark:border-gray-800 mb-8">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <AlertCircle className="text-orange-500" size={24} />
            Review These Terms:
          </h3>
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {wrongEntries.map((entry, index) => (
              <div
                key={index}
                className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl"
              >
                <div className="font-semibold text-gray-900 dark:text-white mb-1">
                  {entry.term}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {entry.meaning}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={handleRetestWrong}
          className="flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gradient-to-r from-orange-600 to-red-600 text-white font-medium hover:shadow-lg transition-all"
        >
          <Repeat size={20} />
          Retest Wrong
        </button>

        <button
          onClick={handleContinueSequence}
          className="flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-medium hover:shadow-lg transition-all"
        >
          <TrendingUp size={20} />
          Continue Sequence
        </button>

        <button
          onClick={onReturnToSetup}
          className="flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium hover:shadow-lg transition-all"
        >
          <Play size={20} />
          New Quiz
        </button>
      </div>
    </div>
  );
}
