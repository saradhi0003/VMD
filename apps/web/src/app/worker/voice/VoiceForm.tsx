"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Field, Textarea } from "@/components/ui";
import { processVoice } from "./actions";

function SubmitButton({ hasText }: { hasText: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={!hasText || pending} className="w-full">
      {pending ? "Understanding…" : "Continue"}
    </Button>
  );
}

// Minimal typing for the vendor-prefixed Web Speech API.
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
};

export function VoiceForm() {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      setSupported(false);
      return;
    }
    const rec = new Ctor();
    rec.lang = "en-IN";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) {
        const alt = e.results[i]?.[0];
        if (alt) t += alt.transcript;
      }
      setText(t);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
  }, []);

  const toggle = () => {
    const rec = recRef.current;
    if (!rec) return;
    if (listening) {
      rec.stop();
      setListening(false);
    } else {
      setText("");
      rec.start();
      setListening(true);
    }
  };

  return (
    <form action={processVoice} className="space-y-4">
      {supported && (
        <button
          type="button"
          onClick={toggle}
          className={`grid w-full place-items-center gap-2 rounded-card border-2 px-6 py-8 text-center transition ${
            listening
              ? "border-warn/40 bg-warn/10 text-warn"
              : "border-line bg-surface text-ink hover:border-navy/40"
          }`}
        >
          <span className={`text-4xl ${listening ? "animate-pulse" : ""}`}>{listening ? "🔴" : "🎤"}</span>
          <span className="text-base font-semibold">{listening ? "Listening… tap to stop" : "Tap to speak"}</span>
        </button>
      )}
      <Field
        label={supported ? "Transcript" : "Type your entry"}
        hint='e.g. "Ganga gave 12 litres this morning, fat 4.2"'
      >
        <Textarea
          name="transcript"
          rows={3}
          required
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Say or type the milk entry…"
        />
      </Field>
      <SubmitButton hasText={text.trim().length > 0} />
    </form>
  );
}
