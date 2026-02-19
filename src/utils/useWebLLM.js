/**
 * WebLLM Hook - Offline AI for browsers with WebGPU
 * Model: Llama-3.2-1B-Instruct (smallest, fastest for mobile)
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// Model configuration
const MODEL_ID = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
const MODEL_CACHE_KEY = "webllm_model_loaded";

// Check if WebGPU is available
export function isWebGPUSupported() {
  if (typeof navigator === 'undefined') return false;
  return 'gpu' in navigator;
}

// Storage helpers
function getModelStatus() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const stored = localStorage.getItem(MODEL_CACHE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function setModelStatus(status) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(MODEL_CACHE_KEY, JSON.stringify(status));
  } catch {}
}

export function useWebLLM() {
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [downloadSize, setDownloadSize] = useState(0);
  const engineRef = useRef(null);
  const CreateMLCEngineRef = useRef(null);

  // Load WebLLM module dynamically
  useEffect(() => {
    async function loadModule() {
      try {
        const webllm = await import('@mlc-ai/web-llm');
        CreateMLCEngineRef.current = webllm.CreateMLCEngine;
        
        // Check if model was previously loaded
        const status = getModelStatus();
        if (status?.ready) {
          setIsReady(true);
        }
      } catch (e) {
        console.warn("WebLLM not available:", e.message);
        setError("WebLLM not supported in this environment");
      }
    }
    
    if (isWebGPUSupported()) {
      loadModule();
    } else {
      setError("WebGPU not supported on this device");
    }
  }, []);

  // Download and initialize model
  const downloadModel = useCallback(async () => {
    if (!CreateMLCEngineRef.current || isLoading) return;
    
    setIsLoading(true);
    setError(null);
    setProgress(0);
    
    try {
      console.log("🔄 WebLLM: Starting model download...");
      
      // Create engine with progress callback
      engineRef.current = await CreateMLCEngineRef.current(MODEL_ID, {
        initProgressCallback: (report) => {
          console.log(`📊 WebLLM: ${report.text}`);
          setProgress(Math.round(report.progress * 100));
          
          if (report.text?.includes('Downloading')) {
            // Extract size from progress text if available
            const sizeMatch = report.text.match(/(\d+\.?\d*)\s*(MB|GB)/);
            if (sizeMatch) {
              setDownloadSize(sizeMatch[0]);
            }
          }
        }
      });
      
      setIsReady(true);
      setModelStatus({ ready: true, model: MODEL_ID, loadedAt: Date.now() });
      console.log("✅ WebLLM: Model ready!");
      
    } catch (e) {
      console.error("❌ WebLLM download failed:", e);
      setError(e.message || "Failed to download model");
      setModelStatus(null);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  // Generate completion
  const generate = useCallback(async (prompt, options = {}) => {
    if (!engineRef.current || !isReady) {
      throw new Error("WebLLM not ready. Download model first.");
    }
    
    try {
      const response = await engineRef.current.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 512,
      });
      
      return response.choices[0]?.message?.content || "";
    } catch (e) {
      console.error("WebLLM generation error:", e);
      throw e;
    }
  }, [isReady]);

  // Generate quiz questions (specialized for quiz app)
  const generateQuizQuestions = useCallback(async (topic, count = 5, difficulty = "medium") => {
    const prompt = `Generate ${count} multiple choice quiz questions about "${topic}".
Difficulty: ${difficulty}

Return ONLY a JSON array with this exact format:
[
  {
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct": 0,
    "explanation": "Brief explanation of the answer"
  }
]

Important:
- Exactly 4 options per question
- "correct" is the index (0-3) of the right answer
- No markdown, just raw JSON
- Questions should be ${difficulty} difficulty`;

    const response = await generate(prompt, { maxTokens: 2048, temperature: 0.5 });
    
    // Parse JSON from response
    try {
      const cleaned = response.replace(/```json\s*/i, '').replace(/```\s*/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse WebLLM quiz response");
      return null;
    }
  }, [generate]);

  // Extract terms from text
  const extractTerms = useCallback(async (text) => {
    const truncated = text.slice(0, 3000);
    
    const prompt = `Extract term-meaning pairs from this text. Return ONLY a JSON array:
[{"term": "word", "meaning": "definition"}]

Text:
${truncated}`;

    const response = await generate(prompt, { maxTokens: 2048, temperature: 0.2 });
    
    try {
      const cleaned = response.replace(/```json\s*/i, '').replace(/```\s*/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  }, [generate]);

  // Reset/delete model
  const resetModel = useCallback(async () => {
    if (engineRef.current) {
      try {
        await engineRef.current.unload();
      } catch {}
      engineRef.current = null;
    }
    setIsReady(false);
    setProgress(0);
    setModelStatus(null);
    localStorage.removeItem(MODEL_CACHE_KEY);
  }, []);

  return {
    isWebGPUSupported: isWebGPUSupported(),
    isSupported: isWebGPUSupported() && !error,
    isLoading,
    isReady,
    progress,
    error,
    downloadSize,
    downloadModel,
    resetModel,
    generate,
    generateQuizQuestions,
    extractTerms,
    modelName: MODEL_ID,
  };
}

export default useWebLLM;