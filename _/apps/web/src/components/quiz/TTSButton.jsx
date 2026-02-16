"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useState } from "react";

export default function TTSButton({ text }) {
  const [speaking, setSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSpeak = async () => {
    if (speaking) {
      // Stop speech
      setSpeaking(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/integrations/text-to-speech/speech?text=${encodeURIComponent(text)}`,
      );

      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);

        setSpeaking(true);
        audio.play();

        audio.onended = () => {
          setSpeaking(false);
          URL.revokeObjectURL(audioUrl);
        };
      }
    } catch (error) {
      console.error("TTS error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleSpeak}
      disabled={loading}
      className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-all disabled:opacity-50"
      title={speaking ? "Stop" : "Listen"}
    >
      {speaking ? <VolumeX size={20} /> : <Volume2 size={20} />}
    </button>
  );
}
