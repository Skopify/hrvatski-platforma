"use client";

import { useState } from "react";

/*
  De onderdelen van /account. Elk paneel is één handeling met zijn eigen uitkomst; gevaarlijke
  dingen (wachtwoord, herstelcode, account verwijderen) vragen je wachtwoord opnieuw.
*/
const post = async (pad: string, data: Record<string, unknown> = {}) => {
  const r = await fetch(pad, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  return (await r.json().catch(() => ({ ok: false, melding: "Er ging iets mis." }))) as Record<string, unknown> & { ok: boolean; melding?: string };
};

const Paneel = ({ pop = "bg-surface", titel, children }: { pop?: string; titel: string; children: React.ReactNode }) => (
  <section className={`rounded-card border-2 border-outline px-5 py-5 text-on-pop shadow-[var(--hard-sm)] ${pop}`}>
    <h2 className="display text-[22px] leading-tight">{titel}</h2>
    <div className="mt-3">{children}</div>
  </section>
);

const Meld = ({ ok, tekst }: { ok: boolean; tekst: string }) =>
  tekst ? (
    <p role="status" className={`mt-3 rounded-[16px] border-2 border-outline px-3.5 py-2 text-[14.5px] font-bold ${ok ? "bg-pop-mint" : "bg-pop-pink"}`}>
      {tekst}
    </p>
  ) : null;

const inv = "input h-12 w-full rounded-full px-4 text-[16px] font-medium";

export function NaamPaneel({ huidig }: { huidig: string }) {
  const [naam, setNaam] = useState(huidig);
  const [m, setM] = useState({ ok: true, t: "" });
  return (
    <Paneel titel="Je naam">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await post("/api/auth/naam", { weergavenaam: naam });
          setM({ ok: r.ok, t: r.ok ? "Bewaard." : r.melding ?? "Dat lukte niet." });
          if (r.ok) setTimeout(() => location.reload(), 600);
        }}
      >
        <input value={naam} onChange={(e) => setNaam(e.target.value)} className={`${inv} min-w-0 flex-1`} maxLength={40} aria-label="Weergavenaam" />
        <button className="btn btn-primary h-12 px-6 text-[15px]">Bewaar</button>
      </form>
      <Meld ok={m.ok} tekst={m.t} />
    </Paneel>
  );
}

export function WachtwoordPaneel() {
  const [huidig, setHuidig] = useState("");
  const [nieuw, setNieuw] = useState("");
  const [m, setM] = useState({ ok: true, t: "" });
  return (
    <Paneel titel="Wachtwoord wijzigen">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await post("/api/auth/wachtwoord", { huidig, nieuw });
          setM({ ok: r.ok, t: r.ok ? "Gewijzigd. Andere apparaten zijn uitgelogd." : r.melding ?? "Dat lukte niet." });
          if (r.ok) {
            setHuidig("");
            setNieuw("");
          }
        }}
      >
        <input type="password" value={huidig} onChange={(e) => setHuidig(e.target.value)} placeholder="Huidig wachtwoord" autoComplete="current-password" className={inv} required />
        <input type="password" value={nieuw} onChange={(e) => setNieuw(e.target.value)} placeholder="Nieuw wachtwoord (minstens 8 tekens)" autoComplete="new-password" className={inv} required />
        <button className="btn btn-primary h-12 px-6 text-[15px]">Wijzig</button>
      </form>
      <Meld ok={m.ok} tekst={m.t} />
    </Paneel>
  );
}

export function HerstelcodePaneel() {
  const [wachtwoord, setWachtwoord] = useState("");
  const [code, setCode] = useState("");
  const [m, setM] = useState({ ok: true, t: "" });
  return (
    <Paneel titel="Herstelcode vernieuwen" pop="bg-pop-yellow">
      <p className="text-[14.5px] font-medium leading-relaxed">
        Met deze code herstel je je wachtwoord als je het vergeet. Een nieuwe code maakt de oude ongeldig.
      </p>
      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await post("/api/auth/herstelcode", { wachtwoord });
          if (r.ok) setCode(r.herstelcode as string);
          setM({ ok: r.ok, t: r.ok ? "Bewaar deze nieuwe code goed." : r.melding ?? "Dat lukte niet." });
          setWachtwoord("");
        }}
      >
        <input type="password" value={wachtwoord} onChange={(e) => setWachtwoord(e.target.value)} placeholder="Je wachtwoord" autoComplete="current-password" className={`${inv} min-w-0 flex-1`} required />
        <button className="btn btn-ghost h-12 px-6 text-[15px]">Nieuwe code</button>
      </form>
      {code ? <p className="num mt-3 rounded-[18px] border-2 border-outline bg-white py-3 text-center text-[22px] tracking-[0.1em]">{code}</p> : null}
      <Meld ok={m.ok} tekst={m.t} />
    </Paneel>
  );
}

export function VerwijderPaneel({ naam }: { naam: string }) {
  const [open, setOpen] = useState(false);
  const [wachtwoord, setWachtwoord] = useState("");
  const [bevestig, setBevestig] = useState("");
  const [m, setM] = useState({ ok: true, t: "" });
  return (
    <Paneel titel="Account verwijderen" pop="bg-pop-pink">
      <p className="text-[14.5px] font-medium leading-relaxed">
        Dit wist je voortgang en je account. Er blijft een kopie van je voortgang in de map data/backups op deze computer, voor het geval je je bedenkt.
      </p>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost mt-3 h-11 px-5 text-[14.5px]">
          Ik wil dit
        </button>
      ) : (
        <form
          className="mt-3 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await post("/api/auth/verwijderen", { wachtwoord });
            if (r.ok) location.href = "/inloggen";
            else setM({ ok: false, t: r.melding ?? "Dat lukte niet." });
          }}
        >
          <input value={bevestig} onChange={(e) => setBevestig(e.target.value)} placeholder={`Typ je gebruikersnaam: ${naam}`} className={inv} autoComplete="off" />
          <input type="password" value={wachtwoord} onChange={(e) => setWachtwoord(e.target.value)} placeholder="Je wachtwoord" autoComplete="current-password" className={inv} required />
          <button disabled={bevestig.toLowerCase() !== naam.toLowerCase()} className="btn btn-primary h-12 px-6 text-[15px] disabled:opacity-50">
            Verwijder mijn account
          </button>
        </form>
      )}
      <Meld ok={m.ok} tekst={m.t} />
    </Paneel>
  );
}

export function UitlogKnop() {
  return (
    <button
      type="button"
      onClick={async () => {
        await post("/api/auth/uitloggen");
        location.href = "/inloggen";
      }}
      className="btn btn-ghost h-12 px-6 text-[15px]"
    >
      Uitloggen
    </button>
  );
}

/* ------------------------------------------------------------------ beheer --- */

interface Rij {
  id: number;
  naam: string;
  weergavenaam: string;
  rol: string;
  gemaakt: number;
  laatsteLogin: number | null;
}

export function BeheerLijst({ start, registratieOpen, ikId }: { start: Rij[]; registratieOpen: boolean; ikId: number }) {
  const [lijst, setLijst] = useState(start);
  const [open, setOpen] = useState(registratieOpen);
  const [tijdelijk, setTijdelijk] = useState<{ naam: string; wachtwoord: string } | null>(null);
  const [m, setM] = useState({ ok: true, t: "" });
  const dag = (t: number | null) => (t ? new Date(t).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" }) : "nog nooit");

  return (
    <div className="space-y-5">
      <Paneel titel="Nieuwe accounts" pop="bg-pop-sky">
        <label className="flex items-center gap-3 text-[15px] font-bold">
          <input
            type="checkbox"
            checked={open}
            onChange={async (e) => {
              setOpen(e.target.checked);
              await post("/api/beheer/registratie", { open: e.target.checked });
            }}
            className="h-5 w-5 accent-[#3b4cff]"
          />
          Iedereen die bij de app kan, mag een account maken
        </label>
        <p className="mt-2 text-[14px] font-medium">Zet dit uit zodra iedereen die je kent een account heeft.</p>
      </Paneel>

      <ul className="space-y-3">
        {lijst.map((g) => (
          <li key={g.id} className="rounded-card border-2 border-outline bg-surface px-5 py-4 shadow-[var(--hard-sm)]">
            <p className="flex flex-wrap items-baseline gap-x-3">
              <span className="display text-[20px]">{g.weergavenaam}</span>
              <span className="hand text-[14px] font-bold text-ink-secondary">@{g.naam}</span>
              {g.rol === "eigenaar" ? <span className="pill h-7 bg-pop-yellow px-2.5 text-[13px] text-on-pop">eigenaar</span> : null}
            </p>
            <p className="hand mt-1 text-[13.5px] font-bold text-ink-secondary">
              lid sinds {dag(g.gemaakt)} · laatst ingelogd {dag(g.laatsteLogin)}
            </p>
            {g.id !== ikId ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-ghost h-10 px-4 text-[14px]"
                  onClick={async () => {
                    const r = await post("/api/beheer/reset", { id: g.id });
                    if (r.ok) setTijdelijk({ naam: g.naam, wachtwoord: r.tijdelijkWachtwoord as string });
                    else setM({ ok: false, t: r.melding ?? "Dat lukte niet." });
                  }}
                >
                  Tijdelijk wachtwoord
                </button>
                <button
                  type="button"
                  className="btn btn-ghost h-10 px-4 text-[14px]"
                  onClick={async () => {
                    if (!confirm(`${g.weergavenaam} en alle voortgang verwijderen? Er blijft een kopie in data/backups.`)) return;
                    const r = await post("/api/beheer/verwijder", { id: g.id });
                    if (r.ok) setLijst((l) => l.filter((x) => x.id !== g.id));
                    else setM({ ok: false, t: r.melding ?? "Dat lukte niet." });
                  }}
                >
                  Verwijderen
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {tijdelijk ? (
        <Paneel titel={`Tijdelijk wachtwoord voor ${tijdelijk.naam}`} pop="bg-pop-yellow">
          <p className="num rounded-[18px] border-2 border-outline bg-white py-3 text-center text-[22px] tracking-[0.05em]">{tijdelijk.wachtwoord}</p>
          <p className="mt-2 text-[14.5px] font-medium">Geef dit door. Na het inloggen kan de gebruiker het bij Account wijzigen. Alle sessies van deze gebruiker zijn beëindigd.</p>
        </Paneel>
      ) : null}
      <Meld ok={m.ok} tekst={m.t} />
    </div>
  );
}
