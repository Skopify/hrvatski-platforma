"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export interface TtsState {
  /** Alle stemmen die de browser aanbiedt (leeg tot voiceschanged vuurt). */
  voices: SpeechSynthesisVoice[];
  /** De gekozen Kroatische stem, of null als die er niet is. */
  voice: SpeechSynthesisVoice | null;
  /** Of de browser überhaupt spraaksynthese aanbiedt. */
  supported: boolean;
  /** Klaar met laden — pas dan zegt `voice === null` echt iets. */
  ready: boolean;
  speaking: boolean;
  /** `onEnd` vuurt ook bij afbreken, zodat een ketting nooit blijft hangen. */
  speak: (text: string, rate?: number, onEnd?: () => void) => void;
  stop: () => void;
}

/**
 * Kroatische spraak via de Web Speech API.
 *
 * Belangrijk: macOS installeert standaard géén Kroatische stem. Zonder die stem
 * valt speechSynthesis terug op de systeemstem, die Kroatisch uitspreekt alsof het
 * Engels is — dat is schadelijker dan geen audio. Daarom spreekt deze hook niets
 * uit als er geen hr-stem is, en meldt de interface wat je moet installeren.
 */
export function useCroatianTts(): TtsState {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [ready, setReady] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  // Bewust als state en niet tijdens de render bepaald: op de server bestaat
  // window niet, dus een directe check zou een andere HTML opleveren dan de
  // eerste client-render en de hydratie breken.
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setReady(true);
      return;
    }
    setSupported(true);

    const load = () => {
      const list = window.speechSynthesis.getVoices();
      if (list.length) {
        setVoices(list);
        setReady(true);
      }
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    // Chromium levert de lijst soms pas na een tick; na 1.5s is het antwoord echt.
    const t = setTimeout(() => setReady(true), 1500);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
      clearTimeout(t);
    };
  }, []);

  const voice = useMemo(() => {
    const hr = voices.filter((v) => v.lang?.toLowerCase().replace("_", "-").startsWith("hr"));
    if (hr.length) return hr.find((v) => v.localService) ?? hr[0];
    return null;
  }, [voices]);

  const speak = useCallback(
    (text: string, rate = 0.9, onEnd?: () => void) => {
      if (!supported || !voice || !text) {
        onEnd?.();
        return;
      }
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = rate;
      u.pitch = 1;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        setSpeaking(false);
        onEnd?.();
      };
      u.onstart = () => setSpeaking(true);
      u.onend = finish;
      u.onerror = finish;
      window.speechSynthesis.speak(u);
    },
    [supported, voice],
  );

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  return { voices, voice, supported, ready, speaking, speak, stop };
}
