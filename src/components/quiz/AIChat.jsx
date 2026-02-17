import { useState } from "react";
import { readSettings } from "@/utils/settings";

export default function AIChat({ onClose, onApplyConfig }) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [draftConfig, setDraftConfig] = useState(null);
  const [history, setHistory] = useState([
    {
      role: "assistant",
      content: 'Say: "Generate 30 hard MCQs from 1-50, sequential" or "use only page 3".',
    },
  ]);

  const send = async () => {
    if (!message.trim() || loading) return;
    const current = message.trim();
    const settings = readSettings();
    const providerLabel = settings.primaryAI === "openai" ? "OpenAI" : "Gemini";

    setLoading(true);
    setMessage("");
    setStatus(`Trying ${providerLabel}...`);
    setHistory((prev) => [...prev, { role: "user", content: current }]);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 11000);
      const response = await fetch("/api/ai/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: current, settings }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));
      const raw = await response.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(`AI API returned non-JSON (${response.status}).`);
      }
      if (!response.ok) {
        throw new Error(data?.reply || data?.error || "AI API request failed.");
      }

      if (data.fallbackUsed) {
        setStatus(`Switched to ${data.provider || "local"} (fallback active)`);
      } else {
        setStatus(`Provider: ${data.provider || "local"} | fallback: no`);
      }
      setHistory((prev) => [...prev, { role: "assistant", content: data.reply }]);

      if (data.quizConfig) {
        setDraftConfig(data.quizConfig);
        setStatus((prev) => `${prev} | config ready`);
      }
    } catch (error) {
      const message = error?.name === "AbortError" ? "AI timeout -> local fallback only" : `AI unavailable -> local fallback only (${error.message || "request failed"})`;
      setStatus(message);
      setHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          content: error?.name === "AbortError"
            ? "AI took too long. Local setup still works instantly."
            : "Unable to reach AI provider. Local setup still works. Check Gemini key in Settings or Vercel env.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
      <section className="glass-card flex h-[78vh] w-full max-w-2xl flex-col p-0">
        <header className="border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">AI Quiz Assistant</h3>
            <button type="button" onClick={onClose} className="rounded-lg bg-slate-200 px-3 py-1 dark:bg-slate-800">
              Close
            </button>
          </div>
          {status && <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{status}</p>}
        </header>

        <div className="flex-1 space-y-3 overflow-auto p-4">
          {history.map((msg, index) => (
            <div key={`${msg.role}-${index}`} className={msg.role === "user" ? "text-right" : "text-left"}>
              <p
                className={`inline-block rounded-2xl px-4 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                }`}
              >
                {msg.content}
              </p>
            </div>
          ))}
        </div>

        <footer className="border-t border-slate-200 p-4 dark:border-slate-800">
          <div className="flex gap-2">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
              placeholder="Generate 25 hard questions from 1-50"
            />
            <button
              type="button"
              disabled={loading}
              onClick={send}
              className="rounded-xl pink-blue-gradient px-5 py-3 text-white disabled:opacity-50"
            >
              {loading ? "Thinking..." : "Send"}
            </button>
          </div>
          {draftConfig && (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  onApplyConfig(draftConfig);
                  onClose();
                }}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                Apply to Quiz Setup
              </button>
            </div>
          )}
        </footer>
      </section>
    </div>
  );
}
