import { useState, useCallback, useEffect } from "react";
import { IconVolume2, IconVolumeX } from "./Icons";

interface Props {
  text: string;
  className?: string;
}

/**
 * Text-to-Speech (TTS) component using browser's native SpeechSynthesis API.
 * Provides a simple toggle button for reading text aloud.
 */
export function ReadAloudButton({ text, className }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
  }, []);

  const play = useCallback(() => {
    if (!text) return;
    
    // Cancel any current speech
    window.speechSynthesis.cancel();
    
    // Remove markdown symbols for cleaner reading
    const cleanText = text
      .replace(/```[\s\S]*?```/g, "Code block omitted.") // Omit code blocks for brevity
      .replace(/`([^`]+)`/g, "$1") // Inline code
      .replace(/[*_~#]/g, "") // Markdown formatting
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"); // Links

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Choose a high-quality voice
    const setVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const preferredNames = ["Google", "Siri", "Premium", "Daniel", "Samantha", "Karen"];
      const voice = voices.find(v => 
        preferredNames.some(name => v.name.includes(name)) && v.lang.startsWith("en")
      ) || voices.find(v => v.lang.startsWith("en"));
      if (voice) utterance.voice = voice;
    };

    setVoice();
    // If voices aren't loaded yet on some browsers, listen for them
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = setVoice;
    }

    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = (e) => {
      console.error("SpeechSynthesis error:", e);
      setIsPlaying(false);
    };
    
    setIsPlaying(true);
    window.speechSynthesis.speak(utterance);
  }, [text]);

  // Clean up if component unmounts
  useEffect(() => {
    return () => {
      if (isPlaying) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isPlaying]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPlaying) {
      stop();
    } else {
      play();
    }
  }, [isPlaying, play, stop]);

  // Note: On mobile, voices are often empty until an interaction.
  // We'll show the button regardless and let the speak function handle it.

  return (
    <button
      className={className}
      onClick={handleToggle}
      title={isPlaying ? "Stop" : "Read aloud"}
      aria-label={isPlaying ? "Stop" : "Read aloud"}
    >
      {isPlaying ? <IconVolumeX size={14} /> : <IconVolume2 size={14} />}
    </button>
  );
}
