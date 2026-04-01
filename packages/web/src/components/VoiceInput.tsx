import { useState, useCallback, useEffect, useRef } from "react";
import { IconMic, IconMicOff } from "./Icons";

interface Props {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * VoiceInput component using browser's SpeechRecognition API.
 * Provides a simple toggle button for recording voice and returning text.
 */
export function VoiceInput({ onTranscript, disabled, className }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        onTranscript(transcript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
  }, [onTranscript]);

  const toggleRecording = useCallback(() => {
    if (!recognitionRef.current) return;

    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error("Failed to start speech recognition:", err);
      }
    }
  }, [isRecording]);

  if (!isSupported) {
    return (
      <button
        className={`${className} voice-input-btn disabled`}
        title="Speech recognition not supported in this browser"
        disabled
      >
        <IconMicOff size={18} />
      </button>
    );
  }

  return (
    <button
      className={`${className} voice-input-btn ${isRecording ? "recording" : ""}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleRecording();
      }}
      disabled={disabled}
      title={isRecording ? "Stop recording" : "Voice input"}
    >
      <IconMic size={18} className={isRecording ? "pulse-red" : ""} />
    </button>
  );
}
