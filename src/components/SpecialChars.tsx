"use client";

/**
 * Een Nederlands toetsenbord heeft geen č, ć, š, ž of đ. Zonder deze rij zou de
 * leerder ze structureel weglaten — en dan traint het platform precies de fout die
 * het moet afleren.
 *
 * Op telefoon en iPad (aanraakscherm) staat de rij er niet: daar wissel je gewoon van
 * toetsenbordtaal en heeft het toetsenbord zelf alle Kroatische letters. Zie
 * .special-chars in globals.css.
 *
 * Getekend als toetsen van het iPhone-toetsenbord: een lichte kap met een
 * schaduwrand eronder, die bij aanraken meteen inzakt. Kleine letters eerst,
 * de hoofdletters na een tussenruimte — zo vind je ze op de tast.
 */
const LOWER = ["č", "ć", "š", "ž", "đ"];
const UPPER = ["Č", "Ć", "Š", "Ž", "Đ"];

export function SpecialChars({ onInsert }: { onInsert: (ch: string) => void }) {
  const key = (ch: string) => (
    <button
      key={ch}
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onInsert(ch)}
      className="hr-text flex h-10 min-w-[38px] items-center justify-center rounded-[9px] bg-surface px-2 text-[17px] text-ink shadow-[0_1px_0_rgb(0_0_0/0.28),0_0_0_0.5px_rgb(0_0_0/0.06)] transition-[transform,background-color] duration-100 active:translate-y-px active:scale-95 active:bg-sunken dark:bg-[#5a5a5e] dark:shadow-[0_1px_0_rgb(0_0_0/0.6)]"
      aria-label={`Voeg ${ch} in`}
    >
      {ch}
    </button>
  );
  return (
    <div className="special-chars flex flex-wrap items-center gap-1.5">
      {LOWER.map(key)}
      <span aria-hidden className="w-2" />
      {UPPER.map(key)}
    </div>
  );
}
