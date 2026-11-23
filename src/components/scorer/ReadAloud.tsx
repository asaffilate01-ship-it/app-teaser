import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import type { CommentaryLine } from "@/lib/commentary";
import { linesToSpeak, speechText } from "@/lib/spoken-commentary";

/** "Read out balls" switch: speaks new ball-by-ball lines with the device's own voice (free, no AI credits). */
export function ReadAloud({ lines }: { lines: CommentaryLine[] }) {
  const [supported, setSupported] = useState(false);
  const [on, setOn] = useState(false);
  const spoken = useRef(new Set<string>());

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    if (!on || !supported) return;
    const next = linesToSpeak(lines, spoken.current);
    for (const line of lines) spoken.current.add(line.id);
    for (const line of next) {
      const utterance = new SpeechSynthesisUtterance(speechText(line));
      utterance.lang = "en-GB";
      utterance.rate = 1.02;
      window.speechSynthesis.speak(utterance);
    }
  }, [lines, on, supported]);

  if (!supported) return null;
  const toggle = () => {
    if (on) {
      window.speechSynthesis.cancel();
      spoken.current.clear();
    }
    setOn(!on);
  };
  return (
    <button type="button" className="read-aloud" aria-pressed={on} onClick={toggle}>
      {on ? <Volume2 className="size-4" aria-hidden="true" /> : <VolumeX className="size-4" aria-hidden="true" />}
      {on ? "Reading out" : "Read out balls"}
    </button>
  );
}
