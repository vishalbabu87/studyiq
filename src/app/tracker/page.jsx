import { useEffect, useMemo, useState } from "react";
import {
  addTrackerItem,
  mergeTrackerItems,
  parseWarRoomHtmlToItems,
  readTrackerItems,
  readTrackerSubjects,
  removeTrackerItem,
  saveTrackerItems,
  saveTrackerSubjects,
  toggleTrackerItem,
} from "@/utils/tracker";

export default function TrackerPage() {
  const [items, setItems] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [subject, setSubject] = useState("Quant");
  const [activeSubject, setActiveSubject] = useState("Quant");
  const [newSubject, setNewSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [plannedDate, setPlannedDate] = useState("");
  const [message, setMessage] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    const loadedItems = readTrackerItems();
    const loadedSubjects = readTrackerSubjects();
    setItems(loadedItems);

    const fromItems = [...new Set(loadedItems.map((item) => item.subject))];
    const allSubjects = [...new Set([...loadedSubjects, ...fromItems])];
    setSubjects(allSubjects);
    const initialSubject = allSubjects[0] || "Quant";
    setSubject(initialSubject);
    setActiveSubject(initialSubject);
  }, []);

  useEffect(() => {
    saveTrackerItems(items);
  }, [items]);

  useEffect(() => {
    if (!subjects.length) return;
    saveTrackerSubjects(subjects);
  }, [subjects]);

  const stats = useMemo(() => {
    const total = items.length;
    const completed = items.filter((item) => item.completed).length;
    return { total, completed, left: total - completed };
  }, [items]);

  const itemsBySubject = useMemo(() => {
    const map = new Map();
    subjects.forEach((value) => map.set(value, []));
    items.forEach((item) => {
      if (!map.has(item.subject)) map.set(item.subject, []);
      map.get(item.subject).push(item);
    });

    for (const value of map.values()) {
      value.sort((a, b) => {
        const orderDiff = (Number(a.order) || 0) - (Number(b.order) || 0);
        if (orderDiff !== 0) return orderDiff;
        return a.chapter.localeCompare(b.chapter);
      });
    }
    return map;
  }, [items, subjects]);

  const bySubject = useMemo(() => {
    const map = new Map();
    subjects.forEach((name) => map.set(name, { total: 0, done: 0 }));
    items.forEach((item) => {
      if (!map.has(item.subject)) map.set(item.subject, { total: 0, done: 0 });
      const current = map.get(item.subject);
      current.total += 1;
      if (item.completed) current.done += 1;
    });
    return [...map.entries()];
  }, [items]);

  const activeItems = itemsBySubject.get(activeSubject) || [];
  const pendingItems = activeItems.filter((item) => !item.completed);
  const completedItems = activeItems.filter((item) => item.completed);

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

  const addSubject = () => {
    const value = newSubject.trim();
    if (!value) return;
    if (subjects.some((item) => item.toLowerCase() === value.toLowerCase())) {
      setNewSubject("");
      return;
    }
    const next = [...subjects, value];
    setSubjects(next);
    setSubject(value);
    setActiveSubject(value);
    setNewSubject("");
  };

  const importFromHtml = async (file) => {
    const html = await file.text();
    const imported = parseWarRoomHtmlToItems(html);
    if (!imported.length) {
      setMessage("No valid schedule found in this HTML.");
      return;
    }
    setItems((prev) => mergeTrackerItems(prev, imported));
    setSubjects((prev) => [...new Set([...prev, ...imported.map((item) => item.subject)])]);
    setMessage(`Imported ${imported.length} chapters from your WarRoom tracker.`);
  };

  const today = new Date().toISOString().slice(0, 10);

  const markDone = (id) => {
    setItems((prev) => toggleTrackerItem(prev, id, true, today));
  };

  const reopen = (id) => {
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
          <div className="grid gap-3 sm:grid-cols-5">
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900"
            >
              {subjects.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <input
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              placeholder="Chapter / topic name"
              className="rounded-xl border border-slate-300 bg-white px-3 py-3 sm:col-span-3 dark:border-slate-700 dark:bg-slate-900"
            />
            <input
              type="date"
              value={plannedDate}
              onChange={(e) => setPlannedDate(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={addManualItem} className="rounded-xl pink-blue-gradient px-4 py-2 text-white">
              Add to Tracker
            </button>
            <input
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="Add new subject"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
            <button type="button" onClick={addSubject} className="rounded-xl bg-violet-600 px-3 py-2 text-sm text-white">
              Add Subject
            </button>
          </div>
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
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Chapters stay in source order per subject. Marking done logs today automatically.
          </p>
        </div>
      </div>

      <div className="glass-card p-5">
        <h2 className="mb-3 text-xl font-semibold">Subject Progress</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {bySubject.map(([name, row]) => {
            const percent = row.total > 0 ? Math.round((row.done / row.total) * 100) : 0;
            const isActive = activeSubject === name;
            return (
              <button
                type="button"
                key={name}
                onClick={() => setActiveSubject(name)}
                className={`rounded-xl border p-3 text-left transition ${
                  isActive
                    ? "border-fuchsia-500 bg-fuchsia-500/10"
                    : "border-slate-200 bg-white/60 dark:border-slate-700 dark:bg-slate-900/50"
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-semibold">{name}</p>
                  <p className="text-xs text-slate-500">{row.done}/{row.total}</p>
                </div>
                <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className="h-2 rounded-full pink-blue-gradient" style={{ width: `${percent}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold">{activeSubject} Chapters</h2>
          <span className="text-xs text-slate-500">Pending {pendingItems.length} • Completed {completedItems.length}</span>
        </div>

        <div className="space-y-2">
          {activeItems.map((item, index) => (
            <div key={item.id} className="rounded-xl border border-slate-200 bg-white/65 p-3 dark:border-slate-800 dark:bg-slate-900/40">
              <div className="grid gap-2 sm:grid-cols-12 sm:items-center">
                <div className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500 sm:col-span-1">{index + 1}</div>
                <div className={`font-medium sm:col-span-5 ${item.completed ? "line-through text-slate-500" : ""}`}>{item.chapter}</div>
                <div className="text-xs text-slate-500 sm:col-span-2">Plan: {item.plannedDate || "-"}</div>
                <div className="text-xs text-slate-500 sm:col-span-2">Done: {item.completedAt || "-"}</div>
                <div className="flex gap-2 sm:col-span-2 sm:justify-end">
                  {item.completed ? (
                    <button type="button" onClick={() => reopen(item.id)} className="rounded-lg bg-amber-500 px-3 py-1 text-sm text-white">
                      Reopen
                    </button>
                  ) : (
                    <button type="button" onClick={() => markDone(item.id)} className="rounded-lg bg-emerald-600 px-3 py-1 text-sm text-white">
                      Mark Done
                    </button>
                  )}
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
          {activeItems.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">No chapters yet in this subject.</p>}
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Completed Log ({activeSubject})</h2>
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
                  <p>{item.chapter}</p>
                  <span className="text-xs text-slate-500">Completed on {item.completedAt || "-"}</span>
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
