import { AreaChart, BarList, LineChart, StatTile } from "@/components/charts";
import { Bolt, Page, PageHeader } from "@/components/ui";
import { VoiceCheck } from "@/components/VoiceCheck";
import { milestones, type Milestone } from "@/lib/milestones";
import {
  dailyStats,
  dueForecast,
  getProfile,
  nearMissStats,
  overallAccuracy,
  productiveShare,
  RANKS,
  rankFor,
  timeSpent,
  topicMastery,
  totalMinutes,
  vocabGrowth,
  vocabStats,
  weakPoints,
} from "@/lib/stats";

export const dynamic = "force-dynamic";

const GROUPS: Milestone["group"][] = ["Volhouden", "Woordenschat", "Vakmanschap", "Verhalen"];

export default function ProgressPage() {
  const profile = getProfile();
  const { rank, next } = rankFor(profile.xp);
  const accuracy = overallAccuracy();
  const vocab = vocabStats();
  const minutes = totalMinutes();
  const productive = productiveShare();
  const near = nearMissStats();
  const days = dailyStats(30);
  const growth = vocabGrowth(30);
  const topics = topicMastery().filter((t) => t.seen > 0 || t.attempts > 0);
  const weak = weakPoints(4, 8);
  const forecast = dueForecast(14);
  const time = timeSpent(14);
  const marks = milestones();
  const hours = minutes / 60;

  const started = accuracy.total > 0;

  return (
    <Page>
      <PageHeader
        title="Voortgang"
        intro="XP meet inspanning, niet vaardigheid. Daarom staat er naast elke teller ook wat je daadwerkelijk beheerst — geschat met de retentiecurve van FSRS, die meeweegt hoe lang geleden je iets voor het laatst zag."
      />

      <section className="stagger mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="h-full" style={{ "--i": 0 } as React.CSSProperties}>
          <StatTile
            label="Totaal XP"
            value={profile.xp.toLocaleString("nl-NL")}
            sub={next ? `${rank.code} → ${next.code}` : rank.code}
            tone="gold"
            icon={<Bolt />}
          />
        </div>
        <div className="h-full" style={{ "--i": 1 } as React.CSSProperties}>
          <StatTile
            label="Tijd besteed"
            value={
              minutes >= 60
                ? `${Math.floor(minutes / 60)}u ${Math.round(minutes % 60)}m`
                : `${Math.round(minutes)}m`
            }
            sub="over alle sessies"
          />
        </div>
        <div className="h-full" style={{ "--i": 2 } as React.CSSProperties}>
          <StatTile
            label="Antwoorden"
            value={`${accuracy.total}`}
            sub={started ? `${Math.round(accuracy.accuracy * 100)}% goed` : "nog geen"}
            tone="accent"
          />
        </div>
        <div className="h-full" style={{ "--i": 3 } as React.CSSProperties}>
          <StatTile
            label="Productief"
            value={started ? `${Math.round(productive * 100)}%` : "—"}
            sub="zelf geproduceerd i.p.v. herkend"
            tone={productive >= 0.5 ? "good" : "warm"}
            meter={productive}
          />
        </div>
      </section>

      {/* Uren tegenover de CEFR-richtlijn. XP zegt wat je hier gedaan hebt;
          uren zeggen wat een niveau werkelijk kost. */}
      <section className="card mb-8 px-6 py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="display-soft text-[19px] text-ink">Uren tegenover het niveau</h2>
            <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-ink-secondary">
              Een CEFR-niveau kost volgens de gangbare richtlijn 100 tot 200 begeleide
              lesuren, en dat loopt op naarmate je hoger komt. Geen enkele app levert die
              uren in zijn eentje — dit platform is een deel ervan, naast lezen, luisteren
              en praten met mensen.
            </p>
          </div>
          <div className="text-right">
            <p className="display tabular text-[34px] leading-none text-ink">
              {hours < 10 ? hours.toFixed(1) : Math.round(hours)}
              <span className="ml-1 text-[16px] text-ink-muted">u</span>
            </p>
            <p className="mt-1.5 text-[12px] text-ink-muted">hier gemaakt</p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {RANKS.map((r) => {
            const done = hours >= r.hours;
            const pct = Math.min(1, hours / r.hours);
            return (
              <div key={r.code} className="grid grid-cols-[58px_1fr_auto] items-center gap-3">
                <span
                  className={`text-[12px] font-bold ${
                    r.code === rank.code ? "text-accent" : done ? "text-good-ink" : "text-ink-muted"
                  }`}
                >
                  {r.code}
                </span>
                <div className="h-2 w-full overflow-hidden rounded-full bg-sunken">
                  <div
                    className={`h-full rounded-full transition-[width] duration-700 ${
                      done ? "bg-good" : "bg-accent"
                    }`}
                    style={{ width: `${Math.max(pct * 100, pct > 0 ? 2 : 0)}%` }}
                  />
                </div>
                <span className="tabular w-24 text-right text-[12px] text-ink-muted">
                  {Math.round(hours)} / {r.hours} u
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-8 grid gap-4 lg:grid-cols-2">
        <LineChart
          data={days.map((d) => ({ label: d.date.slice(5), value: d.accuracy }))}
          title="Accuratesse over tijd"
          percent
        />
        <AreaChart
          data={growth.map((d) => ({ label: d.date.slice(5), value: d.total }))}
          title="Woordenschat — woorden aangeraakt"
        />
      </section>

      <section className="mb-8 grid gap-4 lg:grid-cols-2">
        <BarList
          title="Beheersing per onderwerp"
          data={topics.map((t) => ({
            label: t.topic,
            value: t.mastery,
            sub: `${t.seen}/${t.itemCount}`,
          }))}
          emptyLabel="Nog geen onderwerpen aangeraakt"
        />
        <BarList
          title="Zwakke punten — accuratesse"
          data={weak.map((t) => ({
            label: t.topic,
            value: t.accuracy,
            emphasis: t.accuracy < 0.7,
          }))}
          emptyLabel={
            started
              ? "Geen enkel onderwerp onder de 90% — niets om bij te sturen"
              : "Nog te weinig antwoorden voor een patroon"
          }
        />
      </section>

      <section className="mb-8 grid gap-4 lg:grid-cols-2">
        <BarList
          title="Herhalingen komende twee weken"
          data={forecast.map((d) => ({ label: d.date.slice(5), value: d.count }))}
          percent={false}
          emptyLabel="Nog niets ingepland"
        />
        <BarList
          title="Minuten per dag, laatste 14 dagen"
          data={time.map((d) => ({ label: d.date.slice(5), value: Math.round(d.minutes) }))}
          percent={false}
          emptyLabel="Nog geen sessies"
        />
      </section>

      <section className="card mb-8 px-6 py-6">
        <h2 className="display-soft text-[19px] text-ink">Bijna goed</h2>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-ink-secondary">
          Antwoorden die zijn goedgekeurd maar een diakritisch teken of één letter misten.
          Deze tellen mee als goed, maar komen wél sneller terug — en ze staan hier apart,
          omdat het weglaten van č, ć, š, ž en đ dé structurele fout van een Nederlandstalige
          is en in een gemiddelde onzichtbaar zou blijven.
        </p>
        <div className="mt-5 flex flex-wrap items-baseline gap-10">
          <div>
            <p className="display tabular text-[30px] leading-none text-warm">{near.nearMiss}</p>
            <p className="mt-2 text-[12px] text-ink-muted">bijna-goed antwoorden</p>
          </div>
          <div>
            <p className="display tabular text-[30px] leading-none text-ink">
              {near.total ? `${Math.round(near.share * 100)}%` : "—"}
            </p>
            <p className="mt-2 text-[12px] text-ink-muted">van alle goedgekeurde antwoorden</p>
          </div>
        </div>
      </section>

      <section className="card mb-8 px-6 py-6">
        <h2 className="display-soft text-[19px] text-ink">Woordenschat</h2>
        <div className="mt-5 grid grid-cols-3 gap-6">
          {[
            { v: vocab.total, l: "in de content", tone: "text-ink" },
            { v: vocab.seen, l: "minstens één keer gezien", tone: "text-ink" },
            { v: vocab.solid, l: "stevig (≥ 21 dagen stabiel)", tone: "text-accent" },
          ].map((s) => (
            <div key={s.l}>
              <p className={`display tabular text-[30px] leading-none ${s.tone}`}>{s.v}</p>
              <p className="mt-2 text-[12px] leading-snug text-ink-muted">{s.l}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-sunken">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-700"
            style={{ width: `${vocab.total ? (vocab.seen / vocab.total) * 100 : 0}%` }}
          />
        </div>
      </section>

      {/* Mijlpalen. Geen verborgen badges: je ziet waar je naartoe werkt. */}
      <section className="mb-8">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 className="display-soft text-[19px] text-ink">Mijlpalen</h2>
          <span className="tabular text-[12.5px] text-ink-muted">
            {marks.filter((m) => m.done).length} van {marks.length} behaald
          </span>
        </div>

        <div className="space-y-6">
          {GROUPS.map((group) => {
            const inGroup = marks.filter((m) => m.group === group);
            if (inGroup.length === 0) return null;
            return (
              <div key={group}>
                <h3 className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.07em] text-ink-muted">
                  {group}
                </h3>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {inGroup.map((m) => {
                    const pct = Math.min(1, m.goal > 0 ? m.value / m.goal : 0);
                    return (
                      <li
                        key={m.id}
                        className={`card px-5 py-4 ${m.done ? "border-good/40 bg-good-wash" : ""}`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Behaald: vinkje. Nog niet: een lege ring. De breuk
                              en de balk zeggen al hoe ver je bent — een cijfer
                              in de bol erbij leest als een tweede telling. */}
                          <span
                            aria-hidden
                            className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                              m.done
                                ? "bg-good text-white"
                                : "border-2 border-line-strong bg-transparent"
                            }`}
                          >
                            {m.done ? (
                              <svg width="13" height="13" viewBox="0 0 16 16">
                                <path
                                  d="M3 8.4 6.2 11.6 13 4.8"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.6"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            ) : null}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <p
                                className={`text-[14px] font-bold ${m.done ? "text-good-ink" : "text-ink"}`}
                              >
                                {m.title}
                              </p>
                              <span className="tabular shrink-0 text-[12px] font-semibold text-ink-muted">
                                {Math.min(m.value, m.goal)}/{m.goal}
                              </span>
                            </div>
                            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-secondary">
                              {m.hint}
                            </p>
                            {!m.done ? (
                              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-sunken">
                                <div
                                  className="h-full rounded-full bg-accent transition-[width] duration-700"
                                  style={{ width: `${Math.max(pct * 100, pct > 0 ? 3 : 0)}%` }}
                                />
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <VoiceCheck />
    </Page>
  );
}
