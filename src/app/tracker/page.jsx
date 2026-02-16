import { useEffect, useMemo, useState } from "react";
import {
  addTrackerItem,
  mergeTrackerItems,
  parseWarRoomHtmlToItems,
  readTrackerItems,
  removeTrackerItem,
  saveTrackerItems,
  toggleTrackerItem,
  updateTrackerCompletionDate,
} from "@/utils/tracker";

const subjectOptions = ["Quant", "Reasoning", "English", "Science", "Other"];

export default function TrackerPage() {
  const [items, setItems] = useState([]);
  const [subject, setSubject] = useState("Quant");
  const [chapter, setChapter] = useState("");
  const [plannedDate, setPlannedDate] = useState("");
  const [message, setMessage] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    setItems(readTrackerItems());
  }, []);

  useEffect(() => {
    saveTrackerItems(items);
  }, [items]);

  const stats = useMemo(() => {
    const total = items.length;
    const completed = items.filter((item) => item.completed).length;
    return { total, completed, left: total - completed };
  }, [items]);

  const pendingItems = useMemo(() => items.filter((item) => !item.completed), [items]);
  const completedItems = useMemo(() => items.filter((item) => item.completed), [items]);

  const bySubject = useMemo(() => {
    const map = new Map();
    subjectOptions.forEach((name) => map.set(name, { total: 0, done: 0 }));
    items.forEach((item) => {
      if (!map.has(item.subject)) map.set(item.subject, { total: 0, done: 0 });
      const current = map.get(item.subject);
      current.total += 1;
      if (item.completed) current.done += 1;
    });
    return [...map.entries()];
  }, [items]);

  const addManualItem = () => {
    if (!chapter.trim()) return;
    setItems((prev) =>
      addTrackerItem(prev, {
        subject,
        chapter: chapter.trim(),
        plannedDate,
      }),
    );
    setChapter("");
    setPlannedDate("");
  };

  const importFromHtml = async (file) => {
    const html = await file.text();
    const imported = parseWarRoomHtmlToItems(html);
    if (!imported.length) {
      setMessage("No valid schedule found in this HTML.");
      return;
    }
    setItems((prev) => mergeTrackerItems(prev, imported));
    setMessage(`Imported ${imported.length} chapters from your WarRoom tracker.`);
  };

  const today = new Date().toISOString().slice(0, 10);

  const markDoneToday = (id) => {
    setItems((prev) => toggleTrackerItem(prev, id, true, today));
  };

  const reopenItem = (id) => {
    setItems((prev) => toggleTrackerItem(prev, id, false, ""));
  };

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-4xl font-black tracking-tight">
          <span className="bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-500 bg-clip-text text-transparent">Smart Study Tracker</span>
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Add chapter, study anytime, then mark done. No fixed-date lock.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="glass-card card-hover p-4">
          <p className="text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Total</p>
          <p className="text-3xl font-bold">{stats.total}</p>
        </div>
        <div className="glass-card card-hover p-4">
          <p className="text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Completed</p>
          <p className="text-3xl font-bold text-emerald-600">{stats.completed}</p>
        </div>
        <div className="glass-card card-hover p-4">
          <p className="text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Left</p>
          <p className="text-3xl font-bold text-rose-500">{stats.left}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass-card p-5 lg:col-span-2">
          <h2 className="mb-3 text-xl font-semibold">Quick Add Chapter</h2>
          <div className="grid gap-3 sm:grid-cols-4">
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900"
            >
              {subjectOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <input
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              placeholder="Chapter / topic name"
              className="rounded-xl border border-slate-300 bg-white px-3 py-3 sm:col-span-2 dark:border-slate-700 dark:bg-slate-900"
            />
            <input
              type="date"
              value={plannedDate}
              onChange={(e) => setPlannedDate(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
          <button type="button" onClick={addManualItem} className="mt-3 rounded-xl pink-blue-gradient px-4 py-2 text-white">
            Add to Tracker
          </button>
        </div>

        <div className="glass-card p-5">
          <h2 className="mb-3 text-xl font-semibold">Import WarRoom HTML</h2>
          <input
            type="file"
            accept=".html,.htm"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              importFromHtml(file);
            }}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
          {message && <p className="mt-2 text-sm text-sky-600 dark:text-sky-400">{message}</p>}
        </div>
      </div>

      <div className="glass-card p-5">
        <h2 className="mb-3 text-xl font-semibold">Subject Progress</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {bySubject.map(([name, row]) => {
            const percent = row.total > 0 ? Math.round((row.done / row.total) * 100) : 0;
            return (
              <div key={name} className="rounded-xl border border-slate-200 bg-white/60 p-3 dark:border-slate-700 dark:bg-slate-900/50">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-semibold">{name}</p>
                  <p className="text-xs text-slate-500">{row.done}/{row.total}</p>
                </div>
                <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className="h-2 rounded-full pink-blue-gradient" style={{ width: `${percent}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="glass-card p-5">
        <h2 className="mb-3 text-xl font-semibold">Pending Chapters</h2>
        <div className="space-y-2">
          {pendingItems.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-200 bg-white/65 p-3 dark:border-slate-800 dark:bg-slate-900/40">
              <div className="grid gap-2 sm:grid-cols-12 sm:items-center">
                <div className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500 sm:col-span-2">{item.subject}</div>
                <div className="font-medium sm:col-span-4">{item.chapter}</div>
                <div className="text-xs text-slate-500 sm:col-span-2">Planned: {item.plannedDate || "-"}</div>
                <div className="sm:col-span-2">
                  <input
                    type="date"
                    value={item.completedAt || ""}
                    onChange={(e) => setItems((prev) => updateTrackerCompletionDate(prev, item.id, e.target.value))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
                  />
                </div>
                <div className="flex gap-2 sm:col-span-2 sm:justify-end">
                  <button type="button" onClick={() => markDoneToday(item.id)} className="rounded-lg bg-emerald-600 px-3 py-1 text-sm text-white">
                    Done Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setItems((prev) => removeTrackerItem(prev, item.id))}
                    className="rounded-lg bg-rose-600 px-3 py-1 text-sm text-white"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
          {pendingItems.length === 0 && <p className="text-sm text-emerald-600">No pending chapters. Great streak.</p>}
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Completed Chapters</h2>
          <button
            type="button"
            onClick={() => setShowCompleted((value) => !value)}
            className="rounded-lg bg-slate-200 px-3 py-1 text-sm dark:bg-slate-800"
          >
            {showCompleted ? "Hide" : "Show"}
          </button>
        </div>

        {showCompleted && (
          <div className="max-h-60 space-y-2 overflow-auto">
            {completedItems.map((item) => (
              <div key={item.id} className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p>
                    <span className="font-semibold">{item.subject}</span>: {item.chapter}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Done: {item.completedAt || "-"}</span>
                    <button
                      type="button"
                      onClick={() => reopenItem(item.id)}
                      className="rounded-md bg-amber-500 px-2 py-1 text-xs text-white"
                    >
                      Reopen
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {completedItems.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">No completed chapters yet.</p>}
          </div>
        )}
      </div>
    </section>
  );
}
