import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Sun, Moon, Sparkles, Cpu, Download, Trash2, Check, AlertTriangle } from "lucide-react";
import { clearAllData } from "@/utils/db";
import { defaultSettings, readSettings, saveSettings } from "@/utils/settings";
import { useTheme } from "@/contexts/ThemeContext";
import useWebLLM from "@/utils/useWebLLM";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [settings, setSettings] = useState(defaultSettings);
  const [saved, setSaved] = useState(false);
  
  // WebLLM for offline AI
  const webLLM = useWebLLM();

  useEffect(() => {
    const currentSettings = readSettings();
    setSettings(currentSettings);
  }, []);

  // Keep settings.theme in sync with the live ThemeContext theme
  useEffect(() => {
    setSettings((prev) => ({ ...prev, theme }));
  }, [theme]);

  const save = () => {
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const themeOptions = [
    {
      value: "light",
      label: "Light",
      icon: Sun,
      activeClass: "bg-gradient-to-br from-amber-400 to-yellow-300 text-white shadow-lg shadow-amber-200/50 scale-105 border-transparent",
      hoverClass: "hover:border-amber-300 hover:bg-amber-50 dark:hover:bg-gray-700",
    },
    {
      value: "dark",
      label: "Dark",
      icon: Moon,
      activeClass: "bg-gradient-to-br from-gray-700 to-gray-900 text-white shadow-lg shadow-gray-700/40 scale-105 border-transparent",
      hoverClass: "hover:border-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700",
    },
    {
      value: "lovable",
      label: "Lovable",
      icon: Sparkles,
      activeClass: "bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 text-white shadow-lg shadow-pink-300/50 scale-105 border-transparent",
      hoverClass: "hover:border-purple-300 hover:bg-purple-50 dark:hover:bg-gray-700",
    },
  ];

  return (
    <section className="space-y-3 md:space-y-4">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-lg hover-lift border border-gray-200 dark:border-gray-800">
        <h1 className="text-2xl md:text-4xl font-bold text-gray-900 dark:text-white">Settings</h1>
      </div>

      {/* Appearance */}
      <div className="glass-card p-3 md:p-5">
        <h2 className="mb-3 md:mb-4 text-lg md:text-xl font-semibold text-gray-900 dark:text-white">Appearance</h2>
        <label className="block text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 md:mb-3">
          Theme
        </label>
        <div className="grid grid-cols-3 gap-2 md:gap-3">
          {themeOptions.map(({ value, label, icon: Icon, activeClass, hoverClass }) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setTheme(value);
                setSettings((prev) => ({ ...prev, theme: value }));
              }}
              className={`flex flex-col items-center gap-1 p-2 md:p-3 rounded-lg md:rounded-xl border-2 font-medium text-xs md:text-sm transition-all duration-200 ${
                settings.theme === value
                  ? `${activeClass} theme-btn-active`
                  : `border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 ${hoverClass}`
              }`}
            >
              <Icon size={18} md:size={22} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* AI Settings */}
      <div className="glass-card p-3 md:p-5">
        <h2 className="mb-2 md:mb-3 text-lg md:text-xl font-semibold text-gray-900 dark:text-white">AI Settings</h2>
        <p className="mb-2 text-[10px] md:text-xs text-slate-500 dark:text-slate-400">For production use environment variables on deployment.</p>
        <label className="mb-1 md:mb-2 block text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300">Gemini API Key</label>
        <input
          type="password"
          value={settings.geminiKey}
          onChange={(e) => setSettings((prev) => ({ ...prev, geminiKey: e.target.value }))}
          className="mb-2 md:mb-3 w-full rounded-lg md:rounded-xl border border-slate-300 bg-white px-3 md:px-4 py-2 md:py-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
        <label className="mb-1 md:mb-2 block text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300">OpenAI API Key</label>
        <input
          type="password"
          value={settings.openaiKey}
          onChange={(e) => setSettings((prev) => ({ ...prev, openaiKey: e.target.value }))}
          className="mb-2 md:mb-3 w-full rounded-lg md:rounded-xl border border-slate-300 bg-white px-3 md:px-4 py-2 md:py-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
        <label className="mb-1 md:mb-2 block text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300">Primary AI</label>
        <select
          value={settings.primaryAI}
          onChange={(e) => setSettings((prev) => ({ ...prev, primaryAI: e.target.value }))}
          className="mb-2 md:mb-3 w-full rounded-lg md:rounded-xl border border-slate-300 bg-white px-3 md:px-4 py-2 md:py-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        >
          <option value="gemini">Gemini</option>
          <option value="openai">OpenAI</option>
        </select>
        <label className="mb-3 md:mb-4 flex items-center gap-2 text-xs md:text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={settings.autoFallback}
            onChange={(e) => setSettings((prev) => ({ ...prev, autoFallback: e.target.checked }))}
          />
          Auto fallback
        </label>
        <button
          type="button"
          onClick={save}
          className="rounded-lg md:rounded-xl bg-emerald-600 px-3 md:px-4 py-2 text-sm md:text-base text-white font-medium hover:bg-emerald-700 transition-colors"
        >
          {saved ? "✓ Saved" : "Save"}
        </button>
      </div>

      {/* Offline AI (WebLLM) */}
      <div className="glass-card p-3 md:p-5">
        <h2 className="mb-2 md:mb-3 text-lg md:text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Cpu size={18} md:size={20} className="text-purple-500" />
          Offline AI
        </h2>
        
        {!webLLM.isWebGPUSupported ? (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <AlertTriangle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">WebGPU Not Supported</p>
              <p className="text-sm text-amber-600 dark:text-amber-300 mt-1">
                Your device/browser doesn't support WebGPU. Offline AI requires a modern browser with WebGPU (Chrome 113+, Edge 113+).
              </p>
            </div>
          </div>
        ) : webLLM.error && !webLLM.isLoading ? (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-800 dark:text-red-200">Error</p>
              <p className="text-sm text-red-600 dark:text-red-300 mt-1">{webLLM.error}</p>
            </div>
          </div>
        ) : webLLM.isReady ? (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
            <Check size={20} className="text-emerald-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-emerald-800 dark:text-emerald-200">Offline AI Ready</p>
              <p className="text-sm text-emerald-600 dark:text-emerald-300 mt-1">
                Model: {webLLM.modelName} (~700MB)
              </p>
              <p className="text-xs text-emerald-500 dark:text-emerald-400 mt-1">
                Quiz generation works offline!
              </p>
            </div>
            <button
              type="button"
              onClick={webLLM.resetModel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300 text-sm hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
            >
              <Trash2 size={14} />
              Remove
            </button>
          </div>
        ) : webLLM.isLoading ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Download size={20} className="text-blue-500 animate-bounce" />
              <div className="flex-1">
                <p className="font-medium text-gray-800 dark:text-gray-200">Downloading Model...</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {webLLM.downloadSize} • {webLLM.progress}%
                </p>
              </div>
            </div>
            <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                style={{ width: `${webLLM.progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              First download is ~700MB. After this, AI works completely offline!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Download an AI model to enable offline quiz generation. Works without internet after download!
            </p>
            <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm">
              <p className="font-medium text-gray-800 dark:text-gray-200">Model: {webLLM.modelName}</p>
              <p className="text-gray-500 dark:text-gray-400">Size: ~700MB • Requires WebGPU</p>
            </div>
            <button
              type="button"
              onClick={webLLM.downloadModel}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:from-purple-600 hover:to-pink-600 transition-all"
            >
              <Download size={18} />
              Download Offline AI
            </button>
          </div>
        )}
      </div>

      {/* Data */}
      <div className="glass-card p-3 md:p-5">
        <h2 className="mb-2 md:mb-3 text-lg md:text-xl font-semibold text-gray-900 dark:text-white">Data</h2>
        <p className="mb-2 md:mb-3 text-xs md:text-sm text-gray-600 dark:text-gray-400">This will permanently delete all your files, entries, and quiz history.</p>
        <button
          type="button"
          onClick={async () => {
            if (!window.confirm("Clear all local data? This cannot be undone.")) return;
            await clearAllData();
            navigate("/home", { replace: true });
          }}
          className="rounded-lg md:rounded-xl bg-rose-600 px-3 md:px-4 py-2 text-sm md:text-base text-white font-medium hover:bg-rose-700 transition-colors"
        >
          Clear All Data
        </button>
      </div>
    </section>
  );
}
