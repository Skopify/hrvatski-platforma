"use client";

/*
  De laatste vangnet: als zelfs de layout niet opbouwt (bijvoorbeeld omdat de
  database niet opent) is er geen stijl, geen navigatie en geen lettertype.
  Daarom staat hier alles inline en zonder afhankelijkheden.
*/
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="nl">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#fbfaf7", color: "#1b1a22" }}>
        <main style={{ maxWidth: 520, margin: "20vh auto", padding: "0 24px", textAlign: "center" }}>
          <h1 style={{ fontSize: 32, margin: "0 0 12px" }}>Er ging iets mis.</h1>
          <p style={{ fontSize: 17, lineHeight: 1.5 }}>
            Je voortgang is niet aangetast. Staat er in het venster van de server een melding over de database, draai dan
            <code> npm run migrate</code> en start opnieuw.
          </p>
          <button
            onClick={reset}
            style={{ marginTop: 20, padding: "12px 24px", fontSize: 16, fontWeight: 700, border: "2px solid #1b1a22", borderRadius: 999, background: "#ffe45c", cursor: "pointer" }}
          >
            Opnieuw proberen
          </button>
        </main>
      </body>
    </html>
  );
}
