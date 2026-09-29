"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Doodle } from "./doodles";
import { SECTIONS, SectionSticker, type SectionKey } from "./sections";

/*
  Het zoekvenster (⌘K): overal vandaan meteen naar een pagina, les, verhaal
  of grammaticaonderwerp. Één veld, resultaten per groep, pijltjes en Enter.

  Het opent met het toetsenbord en dus honderden keren per dag: daarom heeft
  het geen animatie, alleen aan of uit. (Emils regel: wat je honderd keer per
  dag doet, animeer je niet.)

  Zoeken negeert hoofdletters en dakjes, zodat "cafe" ook "café" en "zivot"
  ook "život" vindt — typen zonder Kroatisch toetsenbord moet gewoon werken.
*/
export interface CommandItem {
  group: string;
  label: string;
  sub?: string;
  href: string;
  section: SectionKey;
}

export const OPEN_SEARCH = "hr-zoek";

export function openSearch() {
  window.dispatchEvent(new Event(OPEN_SEARCH));
}

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "dj");

export function CommandMenu({ items }: { items: CommandItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const results = useMemo(() => {
    const q = fold(query.trim());
    const hits = q
      ? items.filter((it) => fold(`${it.label} ${it.sub ?? ""}`).includes(q))
      : items.filter((it) => it.group === "Ga naar");
    return hits.slice(0, 40);
  }, [items, query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest?.("input, textarea, [contenteditable]");
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "/" && !typing && !open) {
        e.preventDefault();
        setOpen(true);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_SEARCH, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_SEARCH, onOpen);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      requestAnimationFrame(() => input.current?.focus());
    }
  }, [open]);

  useEffect(() => setCursor(0), [query]);

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-i="${cursor}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const go = (it: CommandItem | undefined) => {
    if (!it) return;
    setOpen(false);
    router.push(it.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(results.length - 1, c + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[cursor]);
    }
  };

  let lastGroup = "";

  return (
    <div className={`fixed inset-0 z-[70] ${open ? "" : "pointer-events-none"}`} inert={!open} aria-hidden={!open}>
      <div
        data-open={open}
        className="palette-backdrop absolute inset-0 bg-black/30 dark:bg-black/55"
        onClick={() => setOpen(false)}
      />
      <div
        data-open={open}
        role="dialog"
        aria-label="Zoeken"
        className="palette-panel relative mx-auto mt-[12vh] w-[min(640px,calc(100vw-24px))] overflow-hidden rounded-[28px] border-2 border-outline bg-surface shadow-[6px_6px_0_var(--color-outline)]"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b-2 border-outline px-5">
          <Doodle name="search" size={24} color="var(--color-pop-sky)" />
          <input
            ref={input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Zoek een les, verhaal of onderwerp…"
            aria-label="Zoeken"
            className="no-ring h-14 w-full bg-transparent text-[17px] font-medium text-ink outline-none placeholder:font-normal placeholder:text-ink-muted"
          />
          <kbd className="hand hidden shrink-0 rounded-md border-2 border-outline bg-plane px-1.5 py-0.5 text-[12px] font-bold sm:inline">
            esc
          </kbd>
        </div>

        <ul ref={list} className="thin-scroll max-h-[52vh] overflow-y-auto p-2" role="listbox">
          {results.length === 0 ? (
            <li className="px-4 py-10 text-center text-[14.5px] text-ink-muted">
              Niets gevonden voor “{query}”.
            </li>
          ) : null}
          {results.map((it, i) => {
            const header = it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            const section = SECTIONS.find((s) => s.key === it.section)!;
            const selected = i === cursor;
            return (
              <li key={`${it.href}-${i}`} role="presentation">
                {header ? <p className="eyebrow px-3 pb-1 pt-3">{header}</p> : null}
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  data-i={i}
                  onMouseMove={() => setCursor(i)}
                  onClick={() => go(it)}
                  className={`flex w-full items-center gap-3 rounded-[16px] border-2 px-3 py-2.5 text-left ${
                    selected ? "border-outline bg-pop-yellow text-on-pop" : "border-transparent text-ink"
                  }`}
                >
                  <SectionSticker section={section} size={32} tilt={-4} />
                  <span className="min-w-0 flex-1">
                    <span className="hr-text block truncate text-[15.5px] font-bold">{it.label}</span>
                    {it.sub ? (
                      <span className={`block truncate text-[13px] ${selected ? "text-on-pop" : "text-ink-muted"}`}>
                        {it.sub}
                      </span>
                    ) : null}
                  </span>
                  {selected ? (
                    <kbd className="hand shrink-0 rounded-md border-2 border-outline bg-surface px-1.5 py-0.5 text-[12px] font-bold text-ink">
                      ↵
                    </kbd>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/** Knop die het zoekvenster opent — voor de zijbalk en het overzicht. */
export function SearchButton({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  // Op Windows en Linux is de sneltoets Ctrl+K; de eerste verf blijft ⌘K (server = client).
  const [mac, setMac] = useState(true);
  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);
  return (
    <button
      type="button"
      onClick={openSearch}
      aria-label="Zoeken"
      className={`group flex items-center gap-2.5 text-ink transition-transform duration-150 active:scale-95 ${className}`}
    >
      <Doodle name="search" size={22} color="var(--color-pop-sky)" />
      {compact ? null : (
        <>
          <span className="flex-1 text-left text-[14.5px] font-semibold text-ink-secondary">Zoeken</span>
          <kbd className="hand rounded-md border-2 border-outline bg-surface px-1.5 py-0.5 text-[12px] font-bold">{mac ? "⌘K" : "Ctrl K"}</kbd>
        </>
      )}
    </button>
  );
}
