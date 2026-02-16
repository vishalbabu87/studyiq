"use client";

import { useEffect, useState } from "react";
import { Folder, FileText, Trash2, Eye } from "lucide-react";
import {
  getAllCategories,
  getAllFiles,
  getFilesByCategory,
  getEntriesByFile,
  initDB,
} from "@/utils/db";

export default function LibraryPage() {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [entries, setEntries] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const entriesPerPage = 25;

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      loadFiles(selectedCategory);
    }
  }, [selectedCategory]);

  useEffect(() => {
    if (selectedFile) {
      loadEntries(selectedFile);
    }
  }, [selectedFile]);

  const loadCategories = async () => {
    try {
      await initDB();
      const cats = await getAllCategories();
      setCategories(cats);
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  };

  const loadFiles = async (categoryName) => {
    try {
      const categoryFiles = await getFilesByCategory(categoryName);
      setFiles(categoryFiles);
    } catch (error) {
      console.error("Error loading files:", error);
    }
  };

  const loadEntries = async (fileId) => {
    try {
      const fileEntries = await getEntriesByFile(fileId);
      setEntries(fileEntries);
      setCurrentPage(1);
    } catch (error) {
      console.error("Error loading entries:", error);
    }
  };

  const paginatedEntries = entries.slice(
    (currentPage - 1) * entriesPerPage,
    currentPage * entriesPerPage,
  );

  const totalPages = Math.ceil(entries.length / entriesPerPage);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50 to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-8 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent">
          Your Library
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Categories */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
              <Folder size={24} className="text-purple-600" />
              Categories
            </h2>
            <div className="space-y-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat.name);
                    setSelectedFile(null);
                    setEntries([]);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all ${
                    selectedCategory === cat.name
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                      : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
              {categories.length === 0 && (
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  No categories yet. Upload files to get started.
                </p>
              )}
            </div>
          </div>

          {/* Files */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
              <FileText size={24} className="text-blue-600" />
              Files
            </h2>
            <div className="space-y-2">
              {files.map((file) => (
                <button
                  key={file.id}
                  onClick={() => setSelectedFile(file.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all ${
                    selectedFile === file.id
                      ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white"
                      : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  <div className="font-medium truncate">{file.name}</div>
                  <div className="text-sm opacity-70">
                    {file.entryCount} terms
                  </div>
                </button>
              ))}
              {selectedCategory && files.length === 0 && (
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  No files in this category yet.
                </p>
              )}
              {!selectedCategory && (
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Select a category to view files.
                </p>
              )}
            </div>
          </div>

          {/* Entries */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-lg border border-gray-200 dark:border-gray-800 lg:col-span-1">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
              <Eye size={24} className="text-green-600" />
              Terms ({entries.length})
            </h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {paginatedEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl"
                >
                  <div className="font-semibold text-gray-900 dark:text-white mb-1">
                    {entry.term}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {entry.meaning}
                  </div>
                  {entry.wrongCount > 0 && (
                    <div className="mt-2 text-xs text-red-500">
                      Wrong: {entry.wrongCount} times
                    </div>
                  )}
                </div>
              ))}
              {selectedFile && entries.length === 0 && (
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  No entries found in this file.
                </p>
              )}
              {!selectedFile && (
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Select a file to view terms.
                </p>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
