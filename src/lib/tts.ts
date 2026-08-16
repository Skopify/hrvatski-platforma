"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/** De spreeksnelheden die je kunt kiezen, van traag naar gewoon. */
export const TTS_RATES = [
  { value: 0.5, label: "Heel langzaam" },
  { value: 0.7, label: "Langzaam" },
  { value: 0.85, label: "Normaal" },
] as const;

const RATE_KEY = "hrvatski.tts.rate";
const VOICE_KEY = "hrvatski.tts.voice";
const DEFAULT_RATE = 0.85;

/**
 * Hoe goed een stem waarschijnlijk klinkt, alleen af te leiden uit de naam.
 *
 * De Web Speech API geeft geen kwaliteitsveld, maar de aanbieders zetten het
 * wél in de naam. Microsoft levert via Edge gratis neurale stemmen ("Natural",
 * "Online") die hoorbaar beter zijn dan de compacte stem die macOS standaard
 * installeert; Apple hangt er "Enhanced" of "Premium" achter zodra je de
 * grotere download hebt gehaald.
 *
 * Zonder deze weging koos het platform altijd de lokale stem, en dat is precies
 * de slechtste die er is.
 */
function voiceScore(v: SpeechSynthesisVoice): number {
  const n = v.name.toLowerCase();
  if (n.includes("natural") || n.includes("neural")) return 3;
  if (n.includes("premium")) return 3;
  if (n.includes("enhanced") || n.includes("verbeterd")) return 2;
  if (n.includes("online")) return 2;
  return v.localService ? 1 : 0;
}

export interface TtsState {
  /** Alle stemmen die de browser aanbiedt (leeg tot voiceschanged vuurt). */
  voices: SpeechSynthesisVoice[];
  /** De gekozen Kroatische stem, of null als die er niet is. */
  voice: SpeechSynthesisVoice | null;
  /** Alle Kroatische stemmen, beste eerst — de keuzelijst. */
  croatianVoices: SpeechSynthesisVoice[];
  /** Zelf een stem kiezen; blijft bewaard. */
  setVoiceName: (name: string) => void;
  /** Of de browser überhaupt spraaksynthese aanbiedt. */
  supported: boolean;
  /** Klaar met laden — pas dan zegt `voice === null` echt iets. */
  ready: boolean;
  speaking: boolean;
  /** De onthouden spreeksnelheid; geldt ook voor automatisch afspelen. */
  rate: number;
  setRate: (rate: number) => void;
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
  // De snelheid wordt onthouden. Zonder dat viel elke luisteroefening terug op
  // normaal tempo zodra hij automatisch afspeelde, en moest je opnieuw op
  // "langzamer" klikken — precies de knop waarvan je dacht dat hij niets deed.
  const [rate, setRateState] = useState(DEFAULT_RATE);
  const [voiceName, setVoiceNameState] = useState<string | null>(null);
  // Bewust als state en niet tijdens de render bepaald: op de server bestaat
  // window niet, dus een directe check zou een andere HTML opleveren dan de
  // eerste client-render en de hydratie breken.
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    // Pas na de eerste render lezen: op de server bestaat localStorage niet, en
    // een afwijkende eerste client-render zou de hydratie breken.
    const stored = Number(window.localStorage.getItem(RATE_KEY));
    if (TTS_RATES.some((r) => r.value === stored)) setRateState(stored);
    setVoiceNameState(window.localStorage.getItem(VOICE_KEY));
  }, []);

  const setRate = useCallback((next: number) => {
    setRateState(next);
    window.localStorage.setItem(RATE_KEY, String(next));
  }, []);

  const setVoiceName = useCallback((name: string) => {
    setVoiceNameState(name);
    window.localStorage.setItem(VOICE_KEY, name);
  }, []);

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

  /** Alle Kroatische stemmen, beste eerst. */
  const croatianVoices = useMemo(() => {
    const hr = voices.filter((v) => v.lang?.toLowerCase().replace("_", "-").startsWith("hr"));
    return [...hr].sort((a, b) => voiceScore(b) - voiceScore(a) || a.name.localeCompare(b.name));
  }, [voices]);

  const voice = useMemo(() => {
    if (!croatianVoices.length) return null;
    // Eerder gekozen stem wint; anders de best scorende. Vroeger stond hier een
    // voorkeur voor localService, wat betekende dat een neurale stem uit Edge
    // altijd verloor van de compacte stem van het systeem.
    return croatianVoices.find((v) => v.name === voiceName) ?? croatianVoices[0];
  }, [croatianVoices, voiceName]);

  const speak = useCallback(
    (text: string, rateOverride?: number, onEnd?: () => void) => {
      if (!supported || !voice || !text) {
        onEnd?.();
        return;
      }
      const wanted = rateOverride ?? rate;

      const utter = () => {
        const u = new SpeechSynthesisUtterance(text);
        u.voice = voice;
        u.lang = voice.lang;
        u.rate = wanted;
        u.pitch = 1;
        u.volume = 1;
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
      };

      // WebKit negeert rate en voice als je meteen na cancel() spreekt: de
      // annulering is dan nog bezig en de nieuwe utterance krijgt de standaard
      // instellingen. Eén tick wachten is genoeg om dat te voorkomen.
      window.speechSynthesis.cancel();
      setTimeout(utter, 60);
    },
    [rate, supported, voice],
  );

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  return {
    voices,
    voice,
    croatianVoices,
    setVoiceName,
    supported,
    ready,
    speaking,
    rate,
    setRate,
    speak,
    stop,
  };
}
