"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { AppIcon, SECTIONS, type SectionKey } from "./sections";

/*
  Het zoekvenster (⌘K): overal vandaan meteen naar een pagina, les, verhaal
  of grammaticaonderwerp. Zoals in Linear of Raycast, maar met de rust van
  Spotlight: één veld, resultaten per groep, pijltjes en Enter.

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
        className="palette-backdrop absolute inset-0 bg-black/25 backdrop-blur-[3px] dark:bg-black/50"
        onClick={() => setOpen(false)}
      />
      <div
        data-open={open}
        role="dialog"
        aria-label="Zoeken"
        className="palette-panel liquid relative mx-auto mt-[12vh] w-[min(640px,calc(100vw-24px))] overflow-hidden rounded-[26px]"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-[var(--material-edge)] px-5">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-ink-muted" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20.5 20.5-4.2-4.2" />
          </svg>
          <input
            ref={input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Zoek een les, verhaal of onderwerp…"
            aria-label="Zoeken"
            className="h-14 w-full bg-transparent text-[17px] text-ink outline-none placeholder:text-ink-muted"
          />
          <kbd className="hidden shrink-0 rounded-md bg-sunken px-1.5 py-0.5 text-[11px] font-semibold text-ink-muted sm:inline">esc</kbd>
        </div>

        <ul ref={list} className="thin-scroll max-h-[52vh] overflow-y-auto p-2" role="listbox">
          {results.length === 0 ? (
            <li className="px-4 py-10 text-center text-[14px] text-ink-muted">
              Niets gevonden voor “{query}”.
            </li>
          ) : null}
          {results.map((it, i) => {
            const header = it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            const section = SECTIONS.find((s) => s.key === it.section)!;
            return (
              <li key={`${it.href}-${i}`} role="presentation">
                {header ? (
                  <p className="px-3 pb-1 pt-3 text-[12px] font-semibold text-ink-muted">{header}</p>
                ) : null}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === cursor}
                  data-i={i}
                  onMouseMove={() => setCursor(i)}
                  onClick={() => go(it)}
                  className={`flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors duration-100 ${
                    i === cursor ? "bg-accent-fill text-white" : "text-ink"
                  }`}
                >
                  <AppIcon section={section} size={30} />
                  <span className="min-w-0 flex-1">
                    <span className="hr-text block truncate text-[15px] font-semibold">{it.label}</span>
                    {it.sub ? (
                      <span className={`block truncate text-[12.5px] ${i === cursor ? "text-white/80" : "text-ink-muted"}`}>
                        {it.sub}
                      </span>
                    ) : null}
                  </span>
                  {i === cursor ? (
                    <kbd className="shrink-0 rounded-md bg-white/20 px-1.5 py-0.5 text-[11px] font-semibold">↵</kbd>
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
  return (
    <button
      type="button"
      onClick={openSearch}
      aria-label="Zoeken"
      className={`group flex items-center gap-2.5 rounded-[12px] text-ink-muted transition-colors hover:text-ink ${className}`}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="m20.5 20.5-4.2-4.2" />
      </svg>
      {compact ? null : (
        <>
          <span className="flex-1 text-left text-[14px]">Zoeken</span>
          <kbd className="rounded-md bg-surface px-1.5 py-0.5 text-[11px] font-semibold shadow-[var(--lift-1)]">⌘K</kbd>
        </>
      )}
    </button>
  );
}
