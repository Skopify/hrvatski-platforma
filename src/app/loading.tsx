import { Page } from "@/components/ui";

/*
  Wat je ziet terwijl een pagina op de server wordt opgebouwd: de vorm van een
  gewone pagina — kop, inleiding, kaarten — in plaats van een draaiend rondje.
  De vlakken ademen zacht, zodat duidelijk is dat er iets onderweg is.
*/
export default function Loading() {
  return (
    <Page>
      <div aria-busy="true" aria-label="Pagina laadt" className="animate-pulse">
        <div className="mb-4 h-3 w-[54px] rounded-sm bg-sunken" />
        <div className="h-11 w-64 max-w-full rounded-xl bg-sunken" />
        <div className="mt-4 h-4 w-[34rem] max-w-full rounded-lg bg-sunken" />
        <div className="mt-2 h-4 w-[26rem] max-w-full rounded-lg bg-sunken" />
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="card h-40" />
          ))}
        </div>
      </div>
    </Page>
  );
}
