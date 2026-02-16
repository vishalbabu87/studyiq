import { useEffect, useState } from "react";
import { getAllCategories, getEntriesByFile, getFilesByCategory, initDB } from "@/utils/db";

const perPage = 25;

export default function LibraryPage() {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(0);
  const [entries, setEntries] = useState([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    initDB().then(() => getAllCategories().then(setCategories));
  }, []);

  useEffect(() => {
    if (!selectedCategory) return;
    getFilesByCategory(selectedCategory).then((data) => {
      setFiles(data);
      setSelectedFile(0);
      setEntries([]);
    });
  }, [selectedCategory]);

  useEffect(() => {
    if (!selectedFile) return;
    getEntriesByFile(selectedFile).then((data) => {
      setEntries(data);
      setPage(1);
    });
  }, [selectedFile]);

  const totalPages = Math.max(1, Math.ceil(entries.length / perPage));
  const slice = entries.slice((page - 1) * perPage, page * perPage);

  return (
    <section className="grid gap-4 lg:grid-cols-3">
      <div className="glass-card p-5">
        <h2 className="mb-3 text-xl font-semibold">Categories</h2>
        <div className="space-y-2">
          {categories.map((cat) => (
            <button
              type="button"
              key={cat.id}
              onClick={() => setSelectedCategory(cat.name)}
              className={`w-full rounded-xl px-4 py-3 text-left ${
                selectedCategory === cat.name ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "bg-slate-100 dark:bg-slate-900"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card p-5">
        <h2 className="mb-3 text-xl font-semibold">Files</h2>
        <div className="space-y-2">
          {files.map((file) => (
            <button
              type="button"
              key={file.id}
              onClick={() => setSelectedFile(file.id)}
              className={`w-full rounded-xl px-4 py-3 text-left ${
                selectedFile === file.id ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "bg-slate-100 dark:bg-slate-900"
              }`}
            >
              <p className="font-medium">{file.name}</p>
              <p className="text-xs opacity-70">{file.entryCount} entries</p>
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card p-5">
        <h2 className="mb-3 text-xl font-semibold">Entries ({entries.length})</h2>
        <div className="max-h-[440px] space-y-2 overflow-auto">
          {slice.map((entry) => (
            <div key={entry.id} className="rounded-xl bg-slate-100 p-3 dark:bg-slate-900">
              <p className="font-medium">{entry.term}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">{entry.meaning}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Wrong {entry.wrongCount || 0}</p>
            </div>
          ))}
        </div>
        {entries.length > perPage && (
          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg bg-slate-200 px-3 py-1 disabled:opacity-40 dark:bg-slate-800"
            >
              Prev
            </button>
            <span className="text-sm">
              {page}/{totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg bg-slate-200 px-3 py-1 disabled:opacity-40 dark:bg-slate-800"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
