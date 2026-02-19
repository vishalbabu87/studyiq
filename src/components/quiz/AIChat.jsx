import { useState } from "react";
import { getAllEntries, initDB } from "@/utils/db";
import { makeQuizSession } from "@/utils/quiz";
import { readSettings } from "@/utils/settings";
import { apiUrl } from "@/utils/api";

// Convert makeQuizSession output → AI-generated format used by QuizSession
function localSessionToAIFormat(questions) {
  const labels = ["A", "B", "C", "D"];
  return questions.map((q) => {
    const opts = q.options.slice(0, 4).map((o, i) => `${labels[i]}) ${o.text}`);
    const correctIdx = q.options.findIndex((o) => o.isCorrect);
    const answer = correctIdx >= 0 ? opts[correctIdx] : opts[0];
    return {
      question:
        q.direction === "term_to_meaning"
          ? `What does "${q.prompt}" mean?`
          : `Which term means "${q.prompt}"?`,
      options: opts,
      answer,
      explanation: `"${q.entry.term}" = "${q.entry.meaning}"`,
    };
  });
}

// Detect if the user wants a quiz generated (not just config)
function detectIntent(text) {
  const t = text.toLowerCase().trim();
  
  // Short agreement words → treat as "generate quiz now"
  const isAgreement = /^(yes|yeah|yep|ok|okay|sure|go|start|begin|let's go|lets go|yup|alright|alright then|start quiz|go ahead|do it|generate|generate it|make it)\.?!?$/.test(t);
  
  // Quiz generation patterns - expanded to catch more variations
  const isQuizGen =
    isAgreement ||
    /quiz me|test me|generate quiz|create quiz|make quiz|quiz about|quiz on|questions about|questions on|practice quiz|give me quiz|give quiz|generate questions|create questions|make questions|quiz (from|on|about)|start quiz|play quiz/i.test(t) ||
    // NEW: Detect "X questions" pattern where X is a number
    /\d+\s*(questions?|ques|mcq)\s*(about|on|from|for)/i.test(t) ||
    // NEW: Detect "questions about/on X" at start of sentence
    /^(questions?|ques)\s*(about|on)/i.test(t) ||
    // NEW: Detect topic-based requests like "ask me about X" or "test me on X"
    /(ask|test|quiz)\s+me\s+(about|on)/i.test(t);
    
  const isLocalData =
    /my (file|data|upload|category|entries|terms|words|idioms|notes|content|material)|from my|from the file|from uploaded/i.test(t);
    
  return { isQuizGen, isLocalData, isAgreement };
}

// Extract count/difficulty from message
function extractParams(text) {
  const countMatch = text.match(/\b(\d+)\s*(question|ques|q|mcq|item)/i);
  const count = countMatch ? Math.min(50, Math.max(1, Number(countMatch[1]))) : 10;
  const diff =
    /\bhard\b/.test(text) ? "hard" :
    /\beasy\b/.test(text) ? "easy" : "medium";
  return { count, difficulty: diff };
}

export default function AIChat({ onClose, onApplyConfig }) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [generatedQuestions, setGeneratedQuestions] = useState(null);
  const [pendingConfig, setPendingConfig] = useState(null); // holds config waiting for Apply button
  const [history, setHistory] = useState([
    {
      role: "assistant",
      content:
        '👋 Hi! I can help you in two ways:\n\n🔧 **Configure Quiz**: "Set up 30 hard questions from range 1-50 in random mode"\n\n🎯 **Generate & Play Quiz**: "Quiz me on 10 hard questions about photosynthesis" or "Quiz me on my uploaded idioms"',
    },
  ]);

  const send = async () => {
    if (!message.trim() || loading) return;
    const current = message.trim();
    const settings = readSettings();

    setLoading(true);
    setMessage("");
    setGeneratedQuestions(null);

    const { isQuizGen, isLocalData } = detectIntent(current);
    const { count, difficulty } = extractParams(current);

    setHistory((prev) => [...prev, { role: "user", content: current }]);

    try {
      // ═══════════════════════════════════════════════════════
      // QUIZ GENERATION MODE
      // ═══════════════════════════════════════════════════════
      if (isQuizGen) {

        // ── BRANCH A: User wants quiz from their uploaded local data ──
        if (isLocalData) {
          setStatus("📂 Loading your local data...");
          await initDB();

          // Try to find a matching category from the message
          const catMatch = current.match(
            /(?:from|on|about|my)\s+(?:my\s+)?([a-z0-9 ]+?)(?:\s+data|\s+file|\s+entries|\s+words|\s+idioms|$)/i
          );
          const catHint = catMatch?.[1]?.trim().toLowerCase();

          const allEntries = await getAllEntries();
          let entries = allEntries;
          if (catHint) {
            const filtered = allEntries.filter((e) =>
              (e.category || "").toLowerCase().includes(catHint)
            );
            if (filtered.length >= 4) entries = filtered;
          }

          if (entries.length === 0) {
            setStatus("");
            setHistory((prev) => [...prev, {
              role: "assistant",
              content: "⚠️ No uploaded data found!\n\nPlease upload files first via the Upload page.\n\nTo quiz without local data, ask: \"Quiz me on 10 questions about [any topic]\"",
            }]);
            setLoading(false);
            return;
          }

          setStatus(`✅ Found ${entries.length} terms. Trying AI engine first...`);

          // ── TIER 1: AI Engine (tries Gemini to generate smarter MCQ) ──
          let aiDone = false;
          try {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 15000); // Reduced timeout to 15s
            const res = await fetch(apiUrl("/api/ai/quiz"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                message: current,
                mode: "generate-quiz",
                settings: {
                  ...settings,
                  questionCount: count,
                  difficulty,
                  terms: entries.map((e) => ({ term: e.term, meaning: e.meaning })),
                },
              }),
              signal: ctrl.signal,
            }).finally(() => clearTimeout(t));

            const data = JSON.parse(await res.text());
            if (Array.isArray(data.questions) && data.questions.length > 0) {
              setGeneratedQuestions(data.questions);
              setStatus(`🤖 AI Engine: ${data.questions.length} questions from your data`);
              setHistory((prev) => [...prev, {
                role: "assistant",
                content: `🤖 **AI Engine** generated ${data.questions.length} ${difficulty} questions from your uploaded data!\n\nAI crafted smart distractors and varied question styles.\n\nClick ▶ Attempt Quiz to start!`,
              }]);
              aiDone = true;
            }
          } catch (_aiErr) {
            // AI failed — silently fall through to local engine
          }

          // ── TIER 2: Local Engine fallback (offline, no API needed) ──
          if (!aiDone) {
            setStatus("⚡ AI unavailable — switching to Local Engine...");
            const session = makeQuizSession({
              entries,
              mode: "random",
              difficulty,
              questionCount: Math.min(count, entries.length),
              rangeStart: 1,
              rangeEnd: entries.length,
            });

            if (session.questions.length === 0) {
              setStatus("Failed");
              setHistory((prev) => [...prev, {
                role: "assistant",
                content: "❌ Not enough unique terms in your data to build a quiz (need at least 4 entries). Please upload more data.",
              }]);
              setLoading(false);
              return;
            }

            const formatted = localSessionToAIFormat(session.questions);
            setGeneratedQuestions(formatted);
            setStatus(`⚡ Local Engine: ${formatted.length} questions (offline)`);
            setHistory((prev) => [...prev, {
              role: "assistant",
              content: `⚡ **Local Engine** (offline mode) generated ${formatted.length} ${difficulty} questions from your data!\n\n• AI was unavailable (rate limit / no connection)\n• Local engine used smart distractors from YOUR data\n• Works completely without internet\n\nClick ▶ Attempt Quiz to start!`,
            }]);
          }

        // ── BRANCH B: AI knowledge quiz (topic not in local data) ──
        } else {
          setStatus(`🌐 Generating ${count} ${difficulty} questions via AI...`);

          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 30000);

          const res = await fetch(apiUrl("/api/ai/quiz"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: current,
              mode: "generate-quiz",
              settings: { ...settings, questionCount: count, difficulty },
            }),
            signal: ctrl.signal,
          }).finally(() => clearTimeout(t));

          const raw = await res.text();
          let data;
          try { data = JSON.parse(raw); } catch { throw new Error(`Invalid API response (${res.status})`); }
          if (data.type === "error") throw new Error(data.reply || "AI quiz generation failed");

          if (Array.isArray(data.questions) && data.questions.length > 0) {
            setGeneratedQuestions(data.questions);
            setStatus(`🤖 AI: ${data.questions.length} questions ready`);
            setHistory((prev) => [...prev, {
              role: "assistant",
              content: data.reply || `🤖 Generated ${data.questions.length} questions. Click ▶ Attempt Quiz!`,
            }]);
          } else {
            throw new Error("AI returned no questions. Try rephrasing your request.");
          }
        }

      // ═══════════════════════════════════════════════════════
      // QUIZ CONFIG MODE (not quiz generation)
      // ═══════════════════════════════════════════════════════
      } else {
        setStatus("⚙️ Parsing quiz configuration...");
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 15000);

        const res = await fetch(apiUrl("/api/ai/quiz"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: current, settings }),
          signal: ctrl.signal,
        }).finally(() => clearTimeout(t));

        const raw = await res.text();
        let data;
        try { data = JSON.parse(raw); } catch { throw new Error(`Invalid API response (${res.status})`); }
        if (!res.ok) throw new Error(data?.reply || data?.error || `Error ${res.status}`);

        setStatus(data.fallbackUsed ? `⚡ ${data.provider} (fallback)` : `✅ ${data.provider}`);
        
        // If fallback was used (Sarvam), try to generate quiz questions instead of just config
        if (data.fallbackUsed && data.provider === "Sarvam") {
          setStatus("🔄 Generating quiz questions with Sarvam...");
          try {
            const quizRes = await fetch(apiUrl("/api/ai/quiz"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                message: current,
                mode: "generate-quiz",
                settings: {
                  ...settings,
                  questionCount: count,
                  difficulty,
                  terms: [],
                },
              }),
            });

            const quizData = await quizRes.json();
            if (Array.isArray(quizData.questions) && quizData.questions.length > 0) {
              setGeneratedQuestions(quizData.questions);
              setStatus(`🤖 Sarvam: ${quizData.questions.length} questions ready`);
              setHistory((prev) => [...prev, {
                role: "assistant",
                content: `🤖 **Sarvam AI** generated ${quizData.questions.length} ${difficulty} questions!\n\nClick ▶ Attempt Quiz to start!`,
              }]);
              return; // Skip config mode and go straight to quiz
            }
          } catch (quizErr) {
            // If quiz generation fails, fall back to config mode
            console.warn("Sarvam quiz generation failed:", quizErr.message);
          }
        }

        // Store config for Apply button (don't auto-apply — user must click)
        if (data.quizConfig) {
          setPendingConfig(data.quizConfig);
          // Show clean reply without "Click below" text (button is visible)
          const cleanReply = (data.reply || "")
            .replace(/Click "Apply to Quiz Setup" below to use these settings\./gi, "")
            .replace(/Click Apply to Quiz Setup below\./gi, "")
            .trim();
          setHistory((prev) => [...prev, {
            role: "assistant",
            content: cleanReply || `✅ Quiz configured! Click **Apply to Quiz Setup** button below to fill the form.`,
          }]);
        } else {
          setHistory((prev) => [...prev, { role: "assistant", content: data.reply }]);
        }
      }

    } catch (error) {
      const isAbort = error?.name === "AbortError";
      setStatus(isAbort ? "⏱ Timed out" : "❌ Failed");
      setHistory((prev) => [...prev, {
        role: "assistant",
        content: isAbort
          ? "⏱ Request timed out (30s). The AI took too long to respond. Try a shorter or simpler request."
          : `❌ ${error.message}\n\nTips:\n• Check your Gemini API key in Settings\n• For local data quiz, say "Quiz me on my uploaded data"\n• For any topic, say "Quiz me on [topic]"`,
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
      <section className="glass-card flex h-[82vh] w-full max-w-2xl flex-col p-0 overflow-hidden rounded-2xl shadow-2xl">
        {/* Header */}
        <header className="border-b border-slate-200 dark:border-slate-800 p-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold">🤖 AI Quiz Assistant</h3>
              <p className="text-xs text-slate-500 mt-0.5">Configure quiz setup OR generate playable quiz from topic/your data</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg bg-slate-200 dark:bg-slate-700 px-3 py-1.5 text-sm font-medium">
              Close
            </button>
          </div>
          {status && (
            <div className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg">
              {status}
            </div>
          )}
        </header>

        {/* Messages */}
        <div className="flex-1 space-y-3 overflow-auto p-4">
          {history.map((msg, i) => (
            <div key={`${msg.role}-${i}`} className={msg.role === "user" ? "text-right" : "text-left"}>
              <p
                className={`inline-block rounded-2xl px-4 py-2.5 text-sm max-w-[85%] whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                }`}
              >
                {msg.content}
              </p>
            </div>
          ))}
        </div>

        {/* Apply to Quiz Setup button (config mode) */}
        {pendingConfig && !generatedQuestions && (
          <div className="px-4 pb-2 flex-shrink-0">
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-xl p-3">
              <div className="text-xs text-blue-600 dark:text-blue-400 mb-2 font-medium">
                📋 {pendingConfig.questionCount} questions · {pendingConfig.difficulty} · {pendingConfig.mode} · range {pendingConfig.rangeStart}–{pendingConfig.rangeEnd}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onApplyConfig(pendingConfig);
                    setPendingConfig(null);
                    onClose();
                  }}
                  className="flex-1 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg hover:scale-105 transition-transform"
                >
                  ✅ Apply to Quiz Setup
                </button>
                <button
                  type="button"
                  onClick={() => setPendingConfig(null)}
                  className="rounded-xl bg-slate-200 dark:bg-slate-700 px-3 py-2.5 text-sm font-medium"
                >
                  ✕
                </button>
              </div>
              <p className="text-xs text-blue-500 dark:text-blue-400 mt-1.5">
                ℹ️ This fills Difficulty, Questions, Range, Mode & Timer. You still need to select Category + File.
              </p>
            </div>
          </div>
        )}

        {/* Attempt Quiz button (quiz generation mode) */}
        {generatedQuestions && (
          <div className="px-4 pb-2 flex-shrink-0">
            <div className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 rounded-xl p-3 flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                🎯 {generatedQuestions.length} questions ready!
              </span>
              <button
                type="button"
                onClick={() => {
                  onApplyConfig({
                    mode: "ai-generated",
                    questions: generatedQuestions,
                    questionCount: generatedQuestions.length,
                  });
                  onClose();
                }}
                className="rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg hover:scale-105 transition-transform"
              >
                ▶ Attempt Quiz
              </button>
            </div>
          </div>
        )}

        {/* Input */}
        <footer className="border-t border-slate-200 dark:border-slate-800 p-4 flex-shrink-0">
          <div className="flex gap-2">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              placeholder='Try: "Quiz me on 10 hard questions about WW2" or "30 hard questions from 1-50 random"'
            />
            <button
              type="button"
              disabled={loading}
              onClick={send}
              className="rounded-xl pink-blue-gradient px-5 py-3 text-white font-semibold disabled:opacity-50 text-sm whitespace-nowrap"
            >
              {loading ? "⏳" : "Send"}
            </button>
          </div>
          <div className="mt-2 flex gap-2 flex-wrap">
            {[
              "Quiz me on 10 hard questions about photosynthesis",
              "Quiz me on my uploaded data - 10 medium questions",
              "Set up 25 hard questions from 1-50 random mode",
            ].map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setMessage(ex)}
                className="text-xs px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                {ex.length > 40 ? ex.slice(0, 40) + "…" : ex}
              </button>
            ))}
          </div>
        </footer>
      </section>
    </div>
  );
}
