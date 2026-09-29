"use client";

import Link from "next/link";
import { useState } from "react";

import { Doodle } from "./doodles";

/*
  De formulieren voor inloggen, een account maken en een wachtwoord herstellen. Ze praten met
  /api/auth/*; de melding die daar terugkomt staat in gewone taal en wordt hier alleen getoond.
*/
const post = async (pad: string, data: Record<string, unknown>) => {
  const r = await fetch(pad, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  return (await r.json().catch(() => ({ ok: false, melding: "Er ging iets mis. Probeer het nog eens." }))) as Record<string, unknown> & { ok: boolean; melding?: string };
};

function Veld({
  label,
  naam,
  type = "text",
  waarde,
  zet,
  autoComplete,
  hint,
  verplicht = true,
}: {
  label: string;
  naam: string;
  type?: string;
  waarde: string;
  zet: (v: string) => void;
  autoComplete?: string;
  hint?: string;
  verplicht?: boolean;
}) {
  const [zien, setZien] = useState(false);
  const wachtwoord = type === "password";
  return (
    <label className="block">
      <span className="hand mb-1.5 block text-[14.5px] font-bold">{label}</span>
      <span className="relative block">
        <input
          name={naam}
          type={wachtwoord && zien ? "text" : type}
          value={waarde}
          onChange={(e) => zet(e.target.value)}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required={verplicht}
          className="input h-[52px] w-full rounded-full px-5 text-[16px] font-medium"
        />
        {wachtwoord ? (
          <button
            type="button"
            onClick={() => setZien((z) => !z)}
            aria-label={zien ? "Verberg wachtwoord" : "Toon wachtwoord"}
            className="hand absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-3 py-1 text-[13px] font-bold text-ink-secondary"
          >
            {zien ? "verberg" : "toon"}
          </button>
        ) : null}
      </span>
      {hint ? <span className="mt-1 block text-[13px] font-medium text-ink-secondary">{hint}</span> : null}
    </label>
  );
}

const Kaart = ({ pop, titel, tekst, children }: { pop: string; titel: string; tekst?: string; children: React.ReactNode }) => (
  <section className={`hero px-6 py-7 text-on-pop ${pop}`}>
    <h1 className="display text-[30px] leading-tight">{titel}</h1>
    {tekst ? <p className="mt-2 text-[15px] font-medium leading-relaxed">{tekst}</p> : null}
    <div className="mt-5">{children}</div>
  </section>
);

const Fout = ({ tekst }: { tekst: string }) =>
  tekst ? (
    <p role="alert" className="rounded-[16px] border-2 border-outline bg-pop-pink px-4 py-2.5 text-[14.5px] font-bold">
      {tekst}
    </p>
  ) : null;

/* ------------------------------------------------------------- inloggen --- */

export function LoginForm({ terug }: { terug?: string }) {
  const [naam, setNaam] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [fout, setFout] = useState("");
  const [bezig, setBezig] = useState(false);

  async function verstuur(e: React.FormEvent) {
    e.preventDefault();
    setBezig(true);
    setFout("");
    const r = await post("/api/auth/inloggen", { naam, wachtwoord, terug });
    if (r.ok) window.location.href = (r.terug as string) || "/";
    else {
      setFout(r.melding ?? "Inloggen lukte niet.");
      setBezig(false);
    }
  }

  return (
    <Kaart pop="bg-pop-sky" titel="Welkom terug" tekst="Log in om verder te leren waar je gebleven was.">
      <form onSubmit={verstuur} className="space-y-4">
        <Veld label="Gebruikersnaam" naam="naam" waarde={naam} zet={setNaam} autoComplete="username" />
        <Veld label="Wachtwoord" naam="wachtwoord" type="password" waarde={wachtwoord} zet={setWachtwoord} autoComplete="current-password" />
        <Fout tekst={fout} />
        <button type="submit" disabled={bezig} className="btn btn-primary h-[52px] w-full text-[16px] disabled:opacity-60">
          {bezig ? "Even kijken…" : "Inloggen"}
        </button>
      </form>
      <p className="mt-5 flex flex-wrap justify-between gap-2 text-[14.5px] font-bold">
        <Link href="/wachtwoord-vergeten" className="tap-link underline decoration-2 underline-offset-4">
          Wachtwoord vergeten?
        </Link>
        <Link href="/registreren" className="tap-link underline decoration-2 underline-offset-4">
          Nieuw account
        </Link>
      </p>
    </Kaart>
  );
}

/* ---------------------------------------------------- herstelcode tonen --- */

function HerstelcodeScherm({ code, titel, volgende }: { code: string; titel: string; volgende: { href: string; label: string } }) {
  const [gekopieerd, setGekopieerd] = useState(false);
  const [bewaard, setBewaard] = useState(false);
  return (
    <Kaart
      pop="bg-pop-yellow"
      titel={titel}
      tekst="Dit is je herstelcode. Zonder mail is dit de enige manier om in te komen als je je wachtwoord vergeet. Je ziet hem maar één keer."
    >
      <p className="num rounded-[20px] border-2 border-outline bg-white px-3 py-4 text-center text-[26px] tracking-[0.12em]" aria-label="Herstelcode">
        {code}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setGekopieerd(true);
            } catch {
              setGekopieerd(false);
            }
          }}
          className="btn btn-ghost h-11 px-5 text-[14.5px]"
        >
          {gekopieerd ? "Gekopieerd" : "Kopieer"}
        </button>
        <button type="button" onClick={() => window.print()} className="btn btn-ghost h-11 px-5 text-[14.5px]">
          Print
        </button>
      </div>
      <label className="mt-5 flex items-start gap-3 text-[15px] font-bold leading-snug">
        <input type="checkbox" checked={bewaard} onChange={(e) => setBewaard(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[#3b4cff]" />
        Ik heb de code bewaard (op papier of in een wachtwoordmanager).
      </label>
      <a
        href={volgende.href}
        aria-disabled={!bewaard}
        onClick={(e) => !bewaard && e.preventDefault()}
        className={`btn btn-primary mt-5 h-[52px] w-full text-[16px] ${bewaard ? "" : "pointer-events-none opacity-50"}`}
      >
        {volgende.label}
      </a>
    </Kaart>
  );
}

/* ---------------------------------------------------------- registreren --- */

export function RegistreerForm({ eerste, overnemen }: { eerste: boolean; overnemen: boolean }) {
  const [naam, setNaam] = useState("");
  const [weergave, setWeergave] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [herhaal, setHerhaal] = useState("");
  const [fout, setFout] = useState("");
  const [bezig, setBezig] = useState(false);
  const [code, setCode] = useState<string | null>(null);

  async function verstuur(e: React.FormEvent) {
    e.preventDefault();
    if (wachtwoord !== herhaal) return setFout("De twee wachtwoorden zijn niet hetzelfde.");
    setBezig(true);
    setFout("");
    const r = await post("/api/auth/registreren", { naam, weergavenaam: weergave || naam, wachtwoord });
    if (r.ok) setCode(r.herstelcode as string);
    else {
      setFout(r.melding ?? "Registreren lukte niet.");
      setBezig(false);
    }
  }

  if (code) return <HerstelcodeScherm code={code} titel="Je account staat klaar" volgende={{ href: "/", label: "Naar Hrvatski" }} />;

  return (
    <Kaart
      pop="bg-pop-mint"
      titel={eerste ? "Maak je account" : "Nieuw account"}
      tekst={
        eerste
          ? overnemen
            ? "Dit eerste account wordt de eigenaar. Je bestaande voortgang op deze computer wordt aan dit account gekoppeld (met eerst een back-up)."
            : "Dit eerste account wordt de eigenaar: die beheert de andere accounts."
          : "Elk account heeft zijn eigen voortgang. Niemand anders ziet wat jij doet."
      }
    >
      <form onSubmit={verstuur} className="space-y-4">
        <Veld label="Gebruikersnaam" naam="naam" waarde={naam} zet={setNaam} autoComplete="username" hint="3 tot 24 tekens: letters, cijfers, punt, streepje." />
        <Veld label="Hoe mogen we je noemen? (mag leeg)" naam="weergavenaam" waarde={weergave} zet={setWeergave} autoComplete="nickname" verplicht={false} />
        <Veld label="Wachtwoord" naam="wachtwoord" type="password" waarde={wachtwoord} zet={setWachtwoord} autoComplete="new-password" hint="Minstens 8 tekens. Een zin van drie woorden is sterk en makkelijk te onthouden." />
        <Veld label="Wachtwoord nog eens" naam="herhaal" type="password" waarde={herhaal} zet={setHerhaal} autoComplete="new-password" />
        <Fout tekst={fout} />
        <button type="submit" disabled={bezig} className="btn btn-primary h-[52px] w-full text-[16px] disabled:opacity-60">
          {bezig ? "Account maken…" : "Account maken"}
        </button>
      </form>
      {!eerste ? (
        <p className="mt-5 text-[14.5px] font-bold">
          Heb je al een account?{" "}
          <Link href="/inloggen" className="tap-link underline decoration-2 underline-offset-4">
            Inloggen
          </Link>
        </p>
      ) : null}
    </Kaart>
  );
}

/* ----------------------------------------------------- wachtwoord vergeten --- */

export function VergetenForm() {
  const [naam, setNaam] = useState("");
  const [herstelcode, setHerstelcode] = useState("");
  const [nieuw, setNieuw] = useState("");
  const [fout, setFout] = useState("");
  const [bezig, setBezig] = useState(false);
  const [code, setCode] = useState<string | null>(null);

  async function verstuur(e: React.FormEvent) {
    e.preventDefault();
    setBezig(true);
    setFout("");
    const r = await post("/api/auth/vergeten", { naam, herstelcode, nieuw });
    if (r.ok) setCode(r.nieuweHerstelcode as string);
    else {
      setFout(r.melding ?? "Dat lukte niet.");
      setBezig(false);
    }
  }

  if (code) return <HerstelcodeScherm code={code} titel="Nieuw wachtwoord ingesteld" volgende={{ href: "/inloggen", label: "Nu inloggen" }} />;

  return (
    <Kaart pop="bg-pop-lilac" titel="Wachtwoord vergeten" tekst="Vul je gebruikersnaam en de herstelcode in die je bij het maken van je account hebt gekregen.">
      <form onSubmit={verstuur} className="space-y-4">
        <Veld label="Gebruikersnaam" naam="naam" waarde={naam} zet={setNaam} autoComplete="username" />
        <Veld label="Herstelcode" naam="herstelcode" waarde={herstelcode} zet={setHerstelcode} autoComplete="off" hint="Zoiets als ABCD-EFGH-JKLM-NPQR." />
        <Veld label="Nieuw wachtwoord" naam="nieuw" type="password" waarde={nieuw} zet={setNieuw} autoComplete="new-password" />
        <Fout tekst={fout} />
        <button type="submit" disabled={bezig} className="btn btn-primary h-[52px] w-full text-[16px] disabled:opacity-60">
          {bezig ? "Even kijken…" : "Nieuw wachtwoord instellen"}
        </button>
      </form>
      <p className="mt-5 text-[14.5px] font-bold">
        Ook de code kwijt? De eigenaar kan een tijdelijk wachtwoord voor je maken.{" "}
        <Link href="/inloggen" className="tap-link underline decoration-2 underline-offset-4">
          Terug
        </Link>
      </p>
    </Kaart>
  );
}

export { Doodle };
