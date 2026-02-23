"use client";

import { useState, useEffect } from "react";
import { CheckCircle, XCircle } from "lucide-react";
import { getEntriesByFile, updateEntry } from "@/utils/db";
import TTSButton from "./TTSButton";

/**
 * v2 - StudyIQ Staging Copy (RESTORING GOOD VERSION UI/UX)
 * This file now contains the exact UI/UX from the "Good Version".
 */
export default function QuizSessionV2({ config, onComplete }) {
  const [entries, setEntries] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongAnswers, setWrongAnswers] = useState([]);

  useEffect(() => {
    loadAndGenerateQuiz();
  }, []);

  const loadAndGenerateQuiz = async () => {
    const fileEntries = await getEntriesByFile(config.file);

    let filteredEntries = fileEntries;
    if (config.mode === "mistakes") {
      filteredEntries = fileEntries.filter((e) => (e.wrongCount || 0) > 0);
    }

    const rangeEntries = filteredEntries.slice(
      config.rangeStart - 1,
      config.rangeEnd,
    );
    setEntries(rangeEntries);

    let selectedEntries = [...rangeEntries];
    if (config.mode === "random") {
      selectedEntries = shuffleArray(selectedEntries);
    }
    selectedEntries = selectedEntries.slice(0, config.questionCount);

    const generatedQuestions = selectedEntries.map((entry) =>
      generateQuestion(entry, rangeEntries),
    );

    setQuestions(generatedQuestions);
  };

  const generateQuestion = (correctEntry, allEntries) => {
    const otherEntries = allEntries.filter((e) => e.id !== correctEntry.id);
    const distractors = shuffleArray(otherEntries).slice(0, 3);

    const options = shuffleArray([
      { text: correctEntry.meaning, isCorrect: true },
      ...distractors.map((d) => ({ text: d.meaning, isCorrect: false })),
    ]);

    return {
      term: correctEntry.term,
      correctMeaning: correctEntry.meaning,
      options,
      entry: correctEntry,
    };
  };

  const shuffleArray = (array) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  const handleAnswerSelect = async (optionIndex) => {
    if (showFeedback) return;

    setSelectedAnswer(optionIndex);
    setShowFeedback(true);

    const question = questions[currentIndex];
    const isCorrect = question.options[optionIndex].isCorrect;

    const updatedCorrectCount = isCorrect ? correctCount + 1 : correctCount;
    const updatedWrongAnswers = isCorrect
      ? wrongAnswers
      : [...wrongAnswers, question.entry];

    if (isCorrect) {
      setCorrectCount(updatedCorrectCount);
    } else {
      setWrongAnswers(updatedWrongAnswers);
    }

    const updatedEntry = {
      ...question.entry,
      attemptCount: (question.entry.attemptCount || 0) + 1,
      wrongCount: isCorrect
        ? question.entry.wrongCount || 0
        : (question.entry.wrongCount || 0) + 1,
      lastAttempted: Date.now(),
    };
    await updateEntry(updatedEntry);

    setTimeout(() => {
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setSelectedAnswer(null);
        setShowFeedback(false);
      } else {
        onComplete({
          total: questions.length,
          correct: updatedCorrectCount,
          wrong: updatedWrongAnswers.length,
          wrongEntries: updatedWrongAnswers,
          config,
        });
      }
    }, 1500);
  };

  if (questions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-lg text-gray-600 dark:text-gray-400">
          Loading quiz...
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Question {currentIndex + 1} of {questions.length}
          </span>
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Score: {correctCount}/{currentIndex + (showFeedback ? 1 : 0)}
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all duration-300"
            style={{
              width: `${((currentIndex + 1) / questions.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-2xl border border-gray-200 dark:border-gray-800 mb-6">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
              {currentQuestion.term}
            </h2>
            <TTSButton text={currentQuestion.term} />
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Choose the correct meaning:
          </p>
        </div>

        {/* Options */}
        <div className="space-y-3">
          {currentQuestion.options.map((option, index) => {
            const isSelected = selectedAnswer === index;
            const isCorrect = option.isCorrect;
            let buttonClass =
              "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700";

            if (showFeedback && isSelected) {
              buttonClass = isCorrect
                ? "bg-green-500 text-white ring-4 ring-green-300"
                : "bg-red-500 text-white ring-4 ring-red-300";
            } else if (showFeedback && isCorrect) {
              buttonClass = "bg-green-500 text-white ring-4 ring-green-300";
            }

            return (
              <button
                key={index}
                onClick={() => handleAnswerSelect(index)}
                disabled={showFeedback}
                className={`w-full p-4 rounded-xl text-left transition-all font-medium ${buttonClass} disabled:cursor-not-allowed flex items-center gap-3`}
              >
                <span className="flex-1">{option.text}</span>
                {showFeedback &&
                  isSelected &&
                  (isCorrect ? (
                    <CheckCircle size={24} />
                  ) : (
                    <XCircle size={24} />
                  ))}
                {showFeedback && isCorrect && !isSelected && (
                  <CheckCircle size={24} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
