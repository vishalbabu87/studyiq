"use client";

import { useState, useEffect } from "react";
import { Play, ChevronRight, ChevronLeft } from "lucide-react";
import {
  getAllCategories,
  getFilesByCategory,
  getEntriesByFile,
  initDB,
} from "@/utils/db";

/**
 * v2 - StudyIQ Staging Copy (RESTORING GOOD VERSION UI/UX)
 * This file now contains the exact UI/UX from the "Good Version".
 */
export default function QuizSetupV2({ onStartQuiz }) {
  const [step, setStep] = useState(0);
  const [categories, setCategories] = useState([]);
  const [files, setFiles] = useState([]);

  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedFile, setSelectedFile] = useState("");
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(10);
  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState("medium");
  const [mode, setMode] = useState("sequential");

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      loadFiles();
    }
  }, [selectedCategory]);

  const loadCategories = async () => {
    await initDB();
    const cats = await getAllCategories();
    setCategories(cats);
  };

  const loadFiles = async () => {
    const fileList = await getFilesByCategory(selectedCategory);
    setFiles(fileList);
  };

  const steps = [
    { title: "Select Category", key: "category" },
    { title: "Select File", key: "file" },
    { title: "Set Range", key: "range" },
    { title: "Question Count", key: "count" },
    { title: "Difficulty", key: "difficulty" },
    { title: "Mode", key: "mode" },
  ];

  const handleNext = () => {
    if (step < steps.length - 1) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleStart = () => {
    onStartQuiz({
      category: selectedCategory,
      file: selectedFile,
      rangeStart,
      rangeEnd,
      questionCount,
      difficulty,
      mode,
    });
  };

  const canProceed = () => {
    if (step === 0) return selectedCategory;
    if (step === 1) return selectedFile;
    return true;
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent">
          Start Quiz
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Step {step + 1} of {steps.length}: {steps[step].title}
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all duration-300"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-xl border border-gray-200 dark:border-gray-800">
        {/* Step Content */}
        {step === 0 && (
          <div className="space-y-4">
            <label className="block text-lg font-medium text-gray-900 dark:text-white mb-4">
              Choose a category:
            </label>
            <div className="grid grid-cols-1 gap-3">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`p-4 rounded-xl text-left transition-all ${
                    selectedCategory === cat.name
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                      : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <label className="block text-lg font-medium text-gray-900 dark:text-white mb-4">
              Choose a file:
            </label>
            <div className="grid grid-cols-1 gap-3">
              {files.map((file) => (
                <button
                  key={file.id}
                  onClick={() => setSelectedFile(file.id)}
                  className={`p-4 rounded-xl text-left transition-all ${
                    selectedFile === file.id
                      ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white"
                      : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  <div className="font-medium">{file.name}</div>
                  <div className="text-sm opacity-70">
                    {file.entryCount} terms
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <label className="block text-lg font-medium text-gray-900 dark:text-white mb-4">
              Set question range:
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Start:
                </label>
                <input
                  type="number"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(parseInt(e.target.value) || 1)}
                  min="1"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                  End:
                </label>
                <input
                  type="number"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(parseInt(e.target.value) || 10)}
                  min={rangeStart}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <label className="block text-lg font-medium text-gray-900 dark:text-white mb-4">
              How many questions?
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[10, 25, 50, 100].map((count) => (
                <button
                  key={count}
                  onClick={() => setQuestionCount(count)}
                  className={`py-4 rounded-xl font-medium transition-all ${
                    questionCount === count
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                      : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
            <div className="mt-4">
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                Custom:
              </label>
              <input
                type="number"
                value={questionCount}
                onChange={(e) =>
                  setQuestionCount(parseInt(e.target.value) || 10)
                }
                min="1"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <label className="block text-lg font-medium text-gray-900 dark:text-white mb-4">
              Choose difficulty:
            </label>
            <div className="grid grid-cols-1 gap-3">
              {["easy", "medium", "hard"].map((level) => (
                <button
                  key={level}
                  onClick={() => setDifficulty(level)}
                  className={`py-4 rounded-xl font-medium capitalize transition-all ${
                    difficulty === level
                      ? "bg-gradient-to-r from-orange-600 to-red-600 text-white"
                      : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <label className="block text-lg font-medium text-gray-900 dark:text-white mb-4">
              Choose mode:
            </label>
            <div className="grid grid-cols-1 gap-3">
              {[
                { value: "sequential", label: "Sequential" },
                { value: "random", label: "Random" },
                { value: "mistakes", label: "Mistakes Only" },
              ].map((modeOption) => (
                <button
                  key={modeOption.value}
                  onClick={() => setMode(modeOption.value)}
                  className={`py-4 rounded-xl font-medium transition-all ${
                    mode === modeOption.value
                      ? "bg-gradient-to-r from-green-600 to-emerald-600 text-white"
                      : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  {modeOption.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleBack}
            disabled={step === 0}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
          >
            <ChevronLeft size={20} />
            Back
          </button>

          {step < steps.length - 1 ? (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all"
            >
              Next
              <ChevronRight size={20} />
            </button>
          ) : (
            <button
              onClick={handleStart}
              className="flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:shadow-lg transition-all"
            >
              <Play size={20} />
              Start Quiz
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
