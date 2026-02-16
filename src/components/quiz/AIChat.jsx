import { useState } from "react";
import { readSettings } from "@/utils/settings";

export default function AIChat({ onClose, onApplyConfig }) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
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

    setLoading(true);
    setMessage("");
    setHistory((prev) => [...prev, { role: "user", content: current }]);

    try {
      const response = await fetch("/api/ai/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: current, settings }),
      });
      const data = await response.json();

      setStatus(`Provider: ${data.provider || "local"} | fallback: ${data.fallbackUsed ? "yes" : "no"}`);
      setHistory((prev) => [...prev, { role: "assistant", content: data.reply }]);

      if (data.quizConfig) {
        onApplyConfig(data.quizConfig);
        onClose();
      }
    } catch {
      setStatus("AI unavailable -> local fallback only");
      setHistory((prev) => [
        ...prev,
        { role: "assistant", content: "Unable to reach AI provider. Use setup flow or retry." },
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
              {loading ? "..." : "Send"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
