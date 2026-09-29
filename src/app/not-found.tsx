import Link from "next/link";

import { Page } from "@/components/ui";

/*
  Een pagina die niet bestaat: een rustige lege staat die zegt wat er aan de
  hand is en één weg terug biedt.
*/
export default function NotFound() {
  return (
    <Page width="focus">
      <section className="card animate-pop mt-10 px-6 py-12 text-center sm:px-12">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] bg-accent-wash text-accent">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20.5 20.5-4.2-4.2" />
            <path d="M8.5 11h5" />
          </svg>
        </div>
        <h1 className="hr-text display mt-6 text-[28px]">Ova stranica ne postoji.</h1>
        <p className="mt-1 text-[15px] text-ink-muted">Deze pagina bestaat niet.</p>
        <p className="mx-auto mt-4 max-w-sm text-[15px] leading-relaxed text-ink-secondary">
          Misschien is het adres veranderd, of zat er een tikfout in.
        </p>
        <Link href="/" className="btn btn-primary mt-7 h-11 px-6 text-[15px]">
          Naar het overzicht
        </Link>
      </section>
    </Page>
  );
}
