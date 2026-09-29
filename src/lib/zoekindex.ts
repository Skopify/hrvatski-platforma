import type { CommandItem } from "@/components/CommandMenu";
import { SECTIONS } from "@/components/sections";
import { loadLessons, loadStories } from "@/lib/content";
import { loadModules } from "@/lib/modules";

/** Alles waar het zoekvenster (⌘K) naartoe kan springen. */
export function searchIndex(): CommandItem[] {
  const pages: CommandItem[] = SECTIONS.map((s) => ({
    group: "Ga naar",
    label: s.label,
    href: s.href,
    section: s.key,
  }));
  const lessons: CommandItem[] = loadLessons().map((l) => ({
    group: "Lessen",
    label: `Les ${l.number} · ${l.title_hr}`,
    sub: l.title_nl,
    href: `/lessen/${l.number}`,
    section: "lessen",
  }));
  const stories: CommandItem[] = loadStories().map((s) => ({
    group: "Verhalen",
    label: s.title_hr,
    sub: s.title_nl,
    href: `/verhalen/${s.slug}`,
    section: "verhalen",
  }));
  const grammar: CommandItem[] = loadModules().map((m) => ({
    group: "Grammatica",
    label: m.title_nl,
    href: `/grammatica/${m.code}`,
    section: "grammatica",
  }));
  return [...pages, ...lessons, ...stories, ...grammar];
}
