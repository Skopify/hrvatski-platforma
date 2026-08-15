"use client";

/**
 * Een Nederlands toetsenbord heeft geen č, ć, š, ž of đ. Zonder deze rij zou de
 * leerder ze structureel weglaten — en dan traint het platform precies de fout die
 * het moet afleren.
 */
const CHARS = ["č", "ć", "š", "ž", "đ", "Č", "Ć", "Š", "Ž", "Đ"];

export function SpecialChars({ onInsert }: { onInsert: (ch: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CHARS.map((ch) => (
        <button
          key={ch}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onInsert(ch)}
          className="hr-text h-8 w-8 rounded-md border border-line bg-surface text-[14px] text-ink-secondary transition-colors hover:border-accent-ring hover:bg-accent-wash hover:text-accent"
          aria-label={`Voeg ${ch} in`}
        >
          {ch}
        </button>
      ))}
    </div>
  );
}
