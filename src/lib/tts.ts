"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/*
  De spreeksnelheden.

  Waarom hier meer staat dan een getal: de rate van de Web Speech API werkt maar
  één kant op. Sneller vragen gaat prima, langzamer nauwelijks — de compacte stem
  van macOS heeft een ondergrens en negeert de rest. Gemeten op deze machine met
  dezelfde zin:

      rate 0.85  →  4111 ms      rate 0.5  →  4911 ms   (slechts 19% trager)
      rate 1.5   →  2661 ms                             (wél evenredig sneller)

  Vandaar dat traag afspelen niet met de rate wordt gedaan maar door de zin in
  stukken te knippen en er stilte tussen te zetten. Diezelfde zin per woord met
  220 ms ertussen duurt 8470 ms — 76% trager, en dát is te volgen.
*/
export const TTS_RATES = [
  { value: 0.5, label: "Heel langzaam", split: "word" as const, gap: 260 },
  { value: 0.7, label: "Langzaam", split: "word" as const, gap: 90 },
  { value: 0.85, label: "Normaal", split: "none" as const, gap: 0 },
] as const;

/**
 * In welke happen een zin wordt uitgesproken.
 *
 * Ook de middelste stand knipt per woord. Knippen op leestekens klonk logischer,
 * maar een korte zin heeft er vaak maar één — dan bleef het bij twee happen en
 * was "Langzaam" nauwelijks te onderscheiden van "Normaal". Het verschil tussen
 * de twee trage standen zit nu in de lengte van de stilte, niet in de plek.
 */
function chunk(text: string, rate: number): string[] {
  const preset = TTS_RATES.find((r) => r.value === rate);
  if (!preset || preset.split === "none") return [text];
  return text.split(/\s+/).filter(Boolean);
}

function gapFor(rate: number): number {
  return TTS_RATES.find((r) => r.value === rate)?.gap ?? 0;
}

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

/** Een neurale stem van de server; klinkt beter dan wat de browser heeft. */
export interface ServerVoice {
  id: string;
  label: string;
  gender: "vrouw" | "man";
}

const SERVER_VOICE_KEY = "hrvatski.tts.servervoice";

export interface TtsState {
  /** Alle stemmen die de browser aanbiedt (leeg tot voiceschanged vuurt). */
  voices: SpeechSynthesisVoice[];
  /** Neurale stemmen van Azure; leeg als er geen sleutel is ingesteld. */
  serverVoices: ServerVoice[];
  /** Welke serverstem in gebruik is, of null als de browserstem het doet. */
  serverVoice: string | null;
  setServerVoice: (id: string) => void;
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
  /** Volgnummer van de lopende opdracht, om een ketting te kunnen afbreken. */
  const speakToken = useRef(0);
  const [serverVoices, setServerVoices] = useState<ServerVoice[]>([]);
  const [serverVoiceName, setServerVoiceName] = useState<string | null>(null);
  /** Het element dat serveraudio afspeelt; hergebruikt zodat stoppen werkt. */
  const audioRef = useRef<HTMLAudioElement | null>(null);
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
    setServerVoiceName(window.localStorage.getItem(SERVER_VOICE_KEY));

    // Eén keer vragen of er neurale stemmen zijn. Zo niet, dan blijft alles bij
    // het oude en merkt de rest van het platform hier niets van.
    let cancelled = false;
    fetch("/api/spraak/status")
      .then((r) => r.json())
      .then((d: { available: boolean; voices: ServerVoice[] }) => {
        if (!cancelled && d.available) setServerVoices(d.voices);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const setServerVoice = useCallback((id: string) => {
    setServerVoiceName(id);
    window.localStorage.setItem(SERVER_VOICE_KEY, id);
  }, []);

  /** De serverstem die gebruikt wordt, of null als er geen beschikbaar is. */
  const serverVoice = useMemo(() => {
    if (!serverVoices.length) return null;
    const chosen = serverVoices.find((v) => v.id === serverVoiceName);
    return (chosen ?? serverVoices[0]!).id;
  }, [serverVoices, serverVoiceName]);

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

  /** De oude weg: de stem van het besturingssysteem, in happen als het traag moet. */
  const browserSpeak = useCallback(
    (text: string, wanted: number, onEnd?: () => void) => {
      if (!supported || !voice) {
        onEnd?.();
        return;
      }
      const parts = chunk(text, wanted);
      const gap = gapFor(wanted);

      // Elke nieuwe opdracht krijgt een eigen nummer. Een ketting die nog loopt
      // ziet dat het nummer veranderd is en stopt zichzelf — zonder dat zou een
      // tweede klik twee stemmen door elkaar laten praten.
      const mine = ++speakToken.current;
      const afgebroken = () => mine !== speakToken.current;

      const finish = () => {
        if (afgebroken()) return;
        setSpeaking(false);
        onEnd?.();
      };

      const zeg = (i: number) => {
        if (afgebroken()) return;
        if (i >= parts.length) {
          finish();
          return;
        }
        const u = new SpeechSynthesisUtterance(parts[i]!);
        u.voice = voice;
        u.lang = voice.lang;
        u.rate = wanted;
        u.pitch = 1;
        u.volume = 1;
        let stepDone = false;
        const next = () => {
          if (stepDone) return;
          stepDone = true;
          if (afgebroken()) return;
          // Stilte tussen de happen: dát maakt het traag, niet de rate.
          setTimeout(() => zeg(i + 1), i + 1 < parts.length ? gap : 0);
        };
        u.onstart = () => setSpeaking(true);
        u.onend = next;
        u.onerror = next;
        window.speechSynthesis.speak(u);
      };

      // WebKit negeert rate en voice als je meteen na cancel() spreekt: de
      // annulering is dan nog bezig en de nieuwe utterance krijgt de standaard
      // instellingen. Eén tick wachten is genoeg om dat te voorkomen.
      window.speechSynthesis.cancel();
      setTimeout(() => zeg(0), 60);
    },
    [rate, supported, voice],
  );

  const speak = useCallback(
    (text: string, rateOverride?: number, onEnd?: () => void) => {
      if (!text) {
        onEnd?.();
        return;
      }
      const wanted = rateOverride ?? rate;

      // Is er een neurale stem, dan die. Azure volgt de snelheid wél netjes op,
      // dus daar is het hakken in woorden niet nodig — de zin blijft heel en
      // klinkt alsnog trager.
      if (serverVoice) {
        const mine = ++speakToken.current;
        audioRef.current?.pause();
        const url = `/api/spraak?tekst=${encodeURIComponent(text)}&stem=${serverVoice}&tempo=${wanted}`;
        const el = new Audio(url);
        audioRef.current = el;
        const done = () => {
          if (mine !== speakToken.current) return;
          setSpeaking(false);
          onEnd?.();
        };
        el.onplaying = () => setSpeaking(true);
        el.onended = done;
        // Mislukt het ophalen — geen netwerk, sleutel ingetrokken — dan alsnog
        // de browserstem, zodat een oefening nooit stil blijft.
        el.onerror = () => {
          if (mine !== speakToken.current) return;
          browserSpeak(text, wanted, onEnd);
        };
        void el.play().catch(() => {
          if (mine === speakToken.current) browserSpeak(text, wanted, onEnd);
        });
        return;
      }

      browserSpeak(text, wanted, onEnd);
    },

    [browserSpeak, rate, serverVoice],
  );

  const stop = useCallback(() => {
    // Het nummer ophogen breekt een lopende ketting af; zonder dat zou de
    // volgende hap na de pauze alsnog beginnen.
    speakToken.current++;
    audioRef.current?.pause();
    if (supported) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  return {
    voices,
    voice,
    croatianVoices,
    setVoiceName,
    serverVoices,
    serverVoice,
    setServerVoice,
    supported,
    ready,
    speaking,
    rate,
    setRate,
    speak,
    stop,
  };
}
