import Link from "next/link";

import { Arrow, Doodle, Sparkle, Squiggle } from "@/components/doodles";
import { Page } from "@/components/ui";

/*
  Een pagina die niet bestaat: een grote vraagteken-sticker, één duidelijke
  weg terug, en een pijl die er expres naartoe wijst.
*/
export default function NotFound() {
  return (
    <Page width="focus">
      <section className="hero animate-pop relative mt-10 bg-pop-pink px-6 pb-10 pt-12 text-center text-on-pop sm:px-12">
        <Sparkle size={30} className="absolute left-8 top-8 -rotate-12" color="var(--color-pop-yellow)" />
        <Sparkle size={20} className="absolute right-10 top-14 rotate-12" color="#ffffff" />

        <div className="mx-auto flex h-24 w-24 -rotate-6 items-center justify-center rounded-[26px] border-2 border-outline bg-surface shadow-[4px_4px_0_#1b1a22]">
          <Doodle name="question" size={62} color="var(--color-pop-yellow)" />
        </div>

        <h1 className="hr-text display mt-8 text-[38px] sm:text-[46px]">
          <span className="relative inline-block pb-3">
            Ova stranica ne postoji.
            <Squiggle slow color="#1b1a22" className="absolute -bottom-0.5 left-0 h-[14px] w-full" />
          </span>
        </h1>
        <p className="hand mt-2 text-[16px] font-bold">Deze pagina bestaat niet.</p>
        <p className="mx-auto mt-4 max-w-sm text-[15.5px] font-medium leading-relaxed">
          Misschien is het adres veranderd, of zat er een tikfout in.
        </p>

        <div className="relative mt-9 inline-block">
          <Arrow className="absolute -left-16 -top-6 hidden h-12 w-14 sm:block" />
          <Link href="/" className="btn btn-primary h-[52px] px-8 text-[16px]">
            Naar het overzicht
          </Link>
        </div>
      </section>
    </Page>
  );
}
