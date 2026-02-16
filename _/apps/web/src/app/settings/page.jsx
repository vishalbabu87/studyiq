"use client";

import { useState, useEffect } from "react";
import { Key, Trash2, Save, Sun, Moon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { clearAllData } from "@/utils/db";

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const [geminiKey, setGeminiKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = () => {
    setGeminiKey(localStorage.getItem("gemini-key") || "");
    setOpenaiKey(localStorage.getItem("openai-key") || "");
  };

  const handleSave = () => {
    localStorage.setItem("gemini-key", geminiKey);
    localStorage.setItem("openai-key", openaiKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearData = async () => {
    if (
      confirm(
        "Are you sure? This will delete all your files, categories, and quiz history.",
      )
    ) {
      await clearAllData();
      alert("All data cleared!");
      window.location.href = "/home";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-pink-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-8 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent">
          Settings
        </h1>

        {/* Theme */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-lg border border-gray-200 dark:border-gray-800 mb-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            {theme === "dark" ? <Moon size={24} /> : <Sun size={24} />}
            Appearance
          </h3>
          <button
            onClick={toggleTheme}
            className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            {theme === "dark" ? (
              <>
                <Sun size={20} />
                Switch to Light Mode
              </>
            ) : (
              <>
                <Moon size={20} />
                Switch to Dark Mode
              </>
            )}
          </button>
        </div>

        {/* API Keys */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-lg border border-gray-200 dark:border-gray-800 mb-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Key size={24} className="text-purple-600" />
            AI API Keys
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Gemini API Key (Primary)
              </label>
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="Enter your Gemini API key..."
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                OpenAI API Key (Fallback)
              </label>
              <input
                type="password"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="Enter your OpenAI API key..."
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>

            <button
              onClick={handleSave}
              className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <Save size={20} />
              {saved ? "Saved!" : "Save Keys"}
            </button>
          </div>

          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
            <p className="text-sm text-blue-700 dark:text-blue-400">
              <strong>Note:</strong> Keys are stored locally in your browser.
              Get keys from{" "}
              <a
                href="https://ai.google.dev/"
                target="_blank"
                rel="noopener"
                className="underline"
              >
                Google AI Studio
              </a>{" "}
              and{" "}
              <a
                href="https://platform.openai.com/"
                target="_blank"
                rel="noopener"
                className="underline"
              >
                OpenAI
              </a>
              .
            </p>
          </div>
        </div>

        {/* Data Management */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Trash2 size={24} className="text-red-600" />
            Data Management
          </h3>

          <button
            onClick={handleClearData}
            className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-red-600 to-red-700 text-white font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <Trash2 size={20} />
            Clear All Data
          </button>

          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <p className="text-sm text-red-700 dark:text-red-400">
              <strong>Warning:</strong> This will permanently delete all files,
              categories, entries, and quiz history from your browser.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
