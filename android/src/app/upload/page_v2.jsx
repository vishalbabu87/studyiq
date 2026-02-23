"use client";

import { useState, useEffect } from "react";
import {
  Upload,
  FileText,
  Image,
  File,
  CheckCircle,
  AlertCircle,
  Loader,
  Plus,
} from "lucide-react";
import {
  getAllCategories,
  addCategory,
  addFile,
  addEntry,
  initDB,
} from "@/utils/db";

/**
 * v2 - StudyIQ Staging Copy (RESTORING GOOD VERSION UI/UX)
 * This file now contains the exact UI/UX from the "Good Version".
 */
export default function UploadPageV2() {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [extractionLog, setExtractionLog] = useState([]);
  const [progress, setProgress] = useState(0);
  const [pageRange, setPageRange] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      await initDB();
      const cats = await getAllCategories();
      setCategories(cats);
    } catch (err) {
      console.error("Error loading categories:", err);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;

    try {
      await addCategory({
        name: newCategoryName.trim(),
        createdAt: Date.now(),
      });
      await loadCategories();
      setSelectedCategory(newCategoryName.trim());
      setNewCategoryName("");
      setShowNewCategory(false);
    } catch (err) {
      console.error("Error adding category:", err);
      setError("Failed to create category");
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setExtractionLog([]);
      setProgress(0);
    }
  };

  const handleUpload = async () => {
    if (!file || !selectedCategory) {
      setError("Please select a file and category");
      return;
    }

    setUploading(true);
    setError(null);
    setExtractionLog(["Starting upload..."]);
    setProgress(10);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", selectedCategory);

      setExtractionLog((prev) => [...prev, "Uploading file..."]);
      setProgress(30);

      const response = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `Upload failed: ${response.statusText}`,
        );
      }

      const data = await response.json();

      setExtractionLog((prev) => [
        ...prev,
        `Extracted ${data.entries.length} terms`,
      ]);
      setProgress(60);

      // Save file metadata
      const fileId = await addFile({
        name: file.name,
        category: selectedCategory,
        uploadedAt: Date.now(),
        entryCount: data.entries.length,
        type: file.type,
      });

      setExtractionLog((prev) => [...prev, "Saving to database..."]);
      setProgress(80);

      // Save entries
      for (const entry of data.entries) {
        await addEntry({
          term: entry.term,
          meaning: entry.meaning,
          category: selectedCategory,
          sourceFile: fileId,
          pageNumber: entry.pageNumber || null,
          wrongCount: 0,
          attemptCount: 0,
          lastAttempted: null,
        });
      }

      setExtractionLog((prev) => [...prev, "✓ Upload complete!"]);
      setProgress(100);

      setTimeout(() => {
        setFile(null);
        setPageRange("");
        setProgress(0);
        setExtractionLog([]);
      }, 2000);
    } catch (err) {
      console.error("Upload error:", err);
      setError(err.message || "Upload failed");
      setExtractionLog((prev) => [...prev, `✗ Error: ${err.message}`]);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent">
            Upload Learning Materials
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Supported: TXT, CSV, JSON (Use formatted text files for best
            results)
          </p>
        </div>

        {/* Category Selection */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-lg mb-6 border border-gray-200 dark:border-gray-800">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Select Category *
          </label>

          {!showNewCategory ? (
            <div className="flex gap-3">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
              >
                <option value="">Choose a category...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setShowNewCategory(true)}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium hover:shadow-lg transition-all flex items-center gap-2"
              >
                <Plus size={18} />
                New
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Enter category name..."
                className="flex-1 px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                onKeyPress={(e) => e.key === "Enter" && handleAddCategory()}
              />
              <button
                onClick={handleAddCategory}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-medium hover:shadow-lg transition-all"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowNewCategory(false);
                  setNewCategoryName("");
                }}
                className="px-6 py-3 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* File Upload */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-lg border border-gray-200 dark:border-gray-800">
          <div
            className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-12 text-center hover:border-purple-500 dark:hover:border-purple-500 transition-all cursor-pointer"
            onClick={() => document.getElementById("fileInput").click()}
          >
            {file ? (
              <div className="space-y-4">
                <CheckCircle className="mx-auto text-green-500" size={48} />
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {file.name}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {(file.size / 1024).toFixed(2)} KB
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className="mx-auto text-gray-400" size={48} />
                <div>
                  <div className="font-medium text-gray-900 dark:text-white mb-1">
                    Drop file here or click to browse
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    TXT, CSV, JSON only
                  </div>
                </div>
              </div>
            )}
            <input
              id="fileInput"
              type="file"
              accept=".txt,.csv,.json"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Upload Button */}
          {file && (
            <button
              onClick={handleUpload}
              disabled={uploading || !selectedCategory}
              className="w-full mt-6 px-6 py-4 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white font-semibold hover:shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader className="animate-spin" size={20} />
                  Processing...
                </>
              ) : (
                "Extract & Save"
              )}
            </button>
          )}

          {/* Progress */}
          {progress > 0 && (
            <div className="mt-6">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Extraction Log */}
          {extractionLog.length > 0 && (
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Extraction Log:
              </div>
              <div className="space-y-1">
                {extractionLog.map((log, index) => (
                  <div
                    key={index}
                    className="text-sm text-gray-600 dark:text-gray-400"
                  >
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
              <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
              <div className="text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
