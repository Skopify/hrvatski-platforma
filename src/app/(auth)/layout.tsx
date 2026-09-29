import Link from "next/link";

import { Doodle } from "@/components/doodles";
import { Logo } from "@/components/ui";

export const dynamic = "force-dynamic";

/*
  De pagina's voor wie nog niet binnen is: inloggen, een account maken, een wachtwoord
  herstellen. Geen navigatie en geen data: hier is nog niemand, dus ook nog geen voortgang.
*/
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10 pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))]">
      <Link href="/" className="mb-8 flex items-center justify-center gap-3" aria-label="Hrvatski">
        <Logo size={46} />
        <span className="leading-none">
          <span className="display block text-[30px]">Hrvatski</span>
          <span className="hand mt-1 block text-[14px] font-bold text-ink-secondary">Kroatisch leren</span>
        </span>
      </Link>
      {children}
      <p className="hand mt-8 flex items-center justify-center gap-2 text-center text-[13.5px] font-bold text-ink-secondary">
        <Doodle name="check" size={16} stroke={2.6} /> Je voortgang blijft op deze computer.
      </p>
    </main>
  );
}
