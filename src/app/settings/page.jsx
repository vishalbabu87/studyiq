import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { clearAllData } from "@/utils/db";
import { defaultSettings, readSettings, saveSettings } from "@/utils/settings";

export default function SettingsPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(defaultSettings);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSettings(readSettings());
  }, []);

  const save = () => {
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <section className="space-y-4">
      <h1 className="text-4xl font-bold">Settings</h1>

      <div className="glass-card p-5">
        <h2 className="mb-3 text-xl font-semibold">Appearance</h2>
        <p className="rounded-xl bg-white/70 px-4 py-2 text-sm font-medium text-slate-700">
          Lovable Light Theme is active.
        </p>
      </div>

      <div className="glass-card p-5">
        <h2 className="mb-3 text-xl font-semibold">AI Settings</h2>
        <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">For production use environment variables on deployment.</p>
        <label className="mb-2 block text-sm font-medium">Gemini API Key</label>
        <input
          type="password"
          value={settings.geminiKey}
          onChange={(e) => setSettings((prev) => ({ ...prev, geminiKey: e.target.value }))}
          className="mb-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
        />
        <label className="mb-2 block text-sm font-medium">OpenAI API Key</label>
        <input
          type="password"
          value={settings.openaiKey}
          onChange={(e) => setSettings((prev) => ({ ...prev, openaiKey: e.target.value }))}
          className="mb-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
        />
        <label className="mb-2 block text-sm font-medium">Primary AI</label>
        <select
          value={settings.primaryAI}
          onChange={(e) => setSettings((prev) => ({ ...prev, primaryAI: e.target.value }))}
          className="mb-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="gemini">Gemini</option>
          <option value="openai">OpenAI</option>
        </select>
        <label className="mb-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.autoFallback}
            onChange={(e) => setSettings((prev) => ({ ...prev, autoFallback: e.target.checked }))}
          />
          Auto fallback
        </label>
        <button type="button" onClick={save} className="rounded-xl bg-emerald-600 px-4 py-2 text-white">
          {saved ? "Saved" : "Save"}
        </button>
      </div>

      <div className="glass-card p-5">
        <h2 className="mb-3 text-xl font-semibold">Data</h2>
        <button
          type="button"
          onClick={async () => {
            if (!window.confirm("Clear all local data?")) return;
            await clearAllData();
            navigate("/home", { replace: true });
          }}
          className="rounded-xl bg-rose-600 px-4 py-2 text-white"
        >
          Clear Data
        </button>
      </div>
    </section>
  );
}
