"use client";

import { useState, useEffect } from "react";
import { Moon, Sun, Heart, Cpu, Server, Wifi, Download, TriangleAlert, Check, ChevronDown, Trash2 } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { getSettings, saveSettings, clearAllData } from "@/utils/settings";
import { useNavigate } from "react-router";

/**
 * v2 - TRUE GOOD VERSION RECONSTRUCTION (from APK)
 * Features: Qwen Local AI, Gemini, Sarvam, Supabase (Gemma 2), Lovable Theme Toggle
 */
export default function SettingsPageV2() {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [settings, setSettings] = useState({
    primaryAI: "gemini",
    geminiKey: "",
    openaiKey: "",
    sarvamKey: "",
    huggingfaceKey: "",
    autoFallback: true,
    theme: "light"
  });
  const [isSaved, setIsSaved] = useState(false);
  const [showAISelector, setShowAISelector] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const s = await getSettings();
      setSettings(s);
    };
    loadSettings();
  }, []);

  const themes = [
    { value: "light", label: "Light", icon: Sun, color: "from-amber-400 to-yellow-300" },
    { value: "dark", label: "Dark", icon: Moon, color: "from-gray-700 to-gray-900" },
    { value: "lovable", label: "Lovable", icon: Heart, color: "from-purple-500 via-pink-500 to-orange-400" }
  ];

  const providers = [
    { value: "gemini", label: "Gemini", icon: Wifi, description: "Google's AI - Fast & Free tier" },
    { value: "supabase", label: "Supabase", icon: Server, description: "Gemma 2 via Supabase - FREE!" },
    { value: "openai", label: "OpenAI", icon: Wifi, description: "ChatGPT - Fast & Reliable" },
    { value: "sarvam", label: "Sarvam", icon: Server, description: "Indian AI - Good for Hindi" },
    { value: "local", label: "Local (Offline)", icon: Cpu, description: "Qwen 2.5 - On-device AI" }
  ];

  const handleSave = async () => {
    await saveSettings(settings);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const selectedProvider = providers.find(p => p.value === settings.primaryAI) || providers[0];

  return (
    <div className="space-y-4 max-w-2xl mx-auto px-4 py-6 pb-32">
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-md border border-gray-200 dark:border-gray-800">
        <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase italic tracking-tighter">Settings</h1>
      </div>

      {/* Appearance */}
      <div className="glass-card p-6 rounded-[2.5rem]">
        <h2 className="text-lg font-black mb-4 dark:text-white uppercase tracking-tight">Appearance</h2>
        <div className="grid grid-cols-3 gap-3">
          {themes.map((t) => (
            <button
              key={t.value}
              onClick={() => { setTheme(t.value); setSettings(prev => ({ ...prev, theme: t.value })); }}
              className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-300 ${
                settings.theme === t.value
                  ? `bg-gradient-to-br ${t.color} text-white border-transparent shadow-lg scale-105`
                  : "border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 text-gray-500"
              }`}
            >
              <t.icon size={24} />
              <span className="text-[10px] font-black uppercase tracking-widest">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* AI Settings */}
      <div className="glass-card p-6 rounded-[2.5rem] space-y-6">
        <h2 className="text-lg font-black dark:text-white uppercase tracking-tight">Intelligence</h2>

        <div className="space-y-4">
          <label className="text-xs font-black uppercase tracking-widest text-gray-400">Primary Provider</label>
          <div className="relative">
            <button
              onClick={() => setShowAISelector(!showAISelector)}
              className="w-full flex items-center justify-between p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-left"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-xl text-purple-600">
                    <selectedProvider.icon size={20} />
                </div>
                <div>
                  <p className="font-black text-sm dark:text-white uppercase">{selectedProvider.label}</p>
                  <p className="text-[10px] text-gray-500 font-bold">{selectedProvider.description}</p>
                </div>
              </div>
              <ChevronDown className={`transition-transform ${showAISelector ? 'rotate-180' : ''}`} />
            </button>

            {showAISelector && (
              <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl overflow-hidden">
                {providers.map(p => (
                  <button
                    key={p.value}
                    onClick={() => { setSettings(prev => ({ ...prev, primaryAI: p.value })); setShowAISelector(false); }}
                    className={`w-full flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${settings.primaryAI === p.value ? 'bg-purple-50 dark:bg-purple-900/10' : ''}`}
                  >
                    <p.icon size={18} className="text-purple-500" />
                    <div className="text-left">
                      <p className="font-black text-sm dark:text-white uppercase">{p.label}</p>
                      <p className="text-[9px] text-gray-500 font-bold">{p.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* API Keys */}
        {["gemini", "openai", "sarvam"].includes(settings.primaryAI) && (
          <div className="space-y-2">
             <label className="text-xs font-black uppercase tracking-widest text-gray-400">API Access Key</label>
             <input
               type="password"
               value={settings[`${settings.primaryAI}Key`]}
               onChange={(e) => setSettings(prev => ({ ...prev, [`${settings.primaryAI}Key`]: e.target.value }))}
               placeholder={`Enter ${settings.primaryAI} key...`}
               className="w-full p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm font-bold"
             />
          </div>
        )}

        <button
          onClick={handleSave}
          className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-black uppercase tracking-widest shadow-lg hover:bg-emerald-700 transition-all"
        >
          {isSaved ? "✓ Settings Saved" : "Save Configuration"}
        </button>
      </div>

      {/* Data Management */}
      <div className="glass-card p-6 rounded-[2.5rem]">
        <h2 className="text-lg font-black mb-4 dark:text-white uppercase tracking-tight">Danger Zone</h2>
        <button
          onClick={async () => { if(window.confirm("Delete everything?")) { await clearAllData(); navigate("/"); } }}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-red-50 dark:bg-red-900/10 text-red-600 font-black uppercase tracking-widest border border-red-200 dark:border-red-900/30"
        >
          <Trash2 size={18} />
          Clear All Local Data
        </button>
      </div>
    </div>
  );
}
