import { Page } from "@/components/ui";

/*
  Wat je ziet terwijl een pagina op de server wordt opgebouwd: de vorm van een
  gewone pagina — kop, inleiding, kaarten — in dezelfde krabbelrand als de
  echte, met gestippelde omlijning zodat het leest als "hier komt iets".
  De vlakken ademen zacht.
*/
export default function Loading() {
  return (
    <Page>
      <div aria-busy="true" aria-label="Pagina laadt" className="animate-pulse">
        <div className="mb-5 h-14 w-14 rotate-[-5deg] rounded-tile border-2 border-dashed border-line-strong" />
        <div className="h-12 w-72 max-w-full rounded-xl border-2 border-dashed border-line-strong" />
        <div className="mt-5 h-4 w-[34rem] max-w-full rounded-lg bg-sunken" />
        <div className="mt-2 h-4 w-[26rem] max-w-full rounded-lg bg-sunken" />
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-40 rounded-card border-2 border-dashed border-line-strong" />
          ))}
        </div>
      </div>
    </Page>
  );
}
