import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { getDailyTheme } from "@/lib/captions";
import { loadStats, type RankedCaption } from "@/lib/stats";
import { BarList, ColumnChart, SplitLegend, TableView, VoteSplit, percent } from "@/components/charts";

function hourLabel(hour: number) {
  return hour === 0 ? "12a" : hour < 12 ? `${hour}a` : hour === 12 ? "12p" : `${hour - 12}p`;
}

function dayLabel(key: string) {
  const [, month, day] = key.split("-").map(Number);
  return `${month}/${day}`;
}

export default async function Dashboard() {
  const { supabase } = await requireAdmin();
  const stats = await loadStats(supabase);
  const { totals } = stats;

  const busiestHour = stats.byHour.reduce((a, b) => (b.votes > a.votes ? b : a));
  const funniestHour = stats.byHour
    .filter((h) => h.votes >= 3)
    .reduce<(typeof stats.byHour)[number] | null>((a, b) => (!a || b.up / b.votes > a.up / a.votes ? b : a), null);
  const topVibe = stats.vibes.find((v) => v.votes >= 3);
  const longest = [...stats.lengthBuckets].filter((b) => b.votes > 0).sort((a, b) => b.rate - a.rate)[0];

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Today&apos;s theme · {getDailyTheme().name}</p>
          <h1>Dashboard</h1>
        </div>
      </header>

      {stats.error && <p className="alert alert-error">Some data failed to load: {stats.error.message}</p>}

      <section className="tiles">
        <Tile value={totals.members} label="Members" sub={`${totals.admins} superadmin${totals.admins === 1 ? "" : "s"}`} />
        <Tile value={totals.photos} label="Photos posted" />
        <Tile value={totals.captions} label="AI captions" sub={`${percent(totals.landed)} landed (score > 0)`} />
        <Tile value={totals.votes} label="Votes cast" sub={`${totals.activeVoters} voters this week`} />
        <Tile value={percent(totals.funnyRate)} label="Laugh rate" sub="of all votes are 😂 funny" />
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Votes per day</h2>
          <span className="muted small">Last 30 days, New York time</span>
        </div>
        <ColumnChart
          label="Votes per day, last 30 days"
          labelEvery={5}
          data={stats.activity.map((d) => ({
            key: d.day,
            label: dayLabel(d.day),
            value: d.votes,
            tip: `${dayLabel(d.day)}: ${d.votes} votes · ${d.photos} photos · ${d.members} new members`,
          }))}
        />
        <TableView
          headers={["Day", "Votes", "Photos", "New members"]}
          rows={stats.activity.map((d) => [d.day, d.votes, d.photos, d.members])}
        />
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h2>When is campus funniest?</h2>
            <span className="muted small">Votes by hour of day</span>
          </div>
          <p className="insight">
            {busiestHour.votes > 0 ? (
              <>
                Peak voting is <strong>{hourLabel(busiestHour.hour)}</strong>
                {funniestHour && (
                  <>
                    , but the crowd laughs most at <strong>{hourLabel(funniestHour.hour)}</strong> (
                    {percent(funniestHour.up / funniestHour.votes)} funny)
                  </>
                )}
                .
              </>
            ) : (
              "No votes yet."
            )}
          </p>
          <ColumnChart
            label="Votes by hour of day"
            labelEvery={3}
            data={stats.byHour.map((h) => ({
              key: String(h.hour),
              label: hourLabel(h.hour),
              value: h.votes,
              tip: `${hourLabel(h.hour)}: ${h.votes} votes, ${h.votes ? percent(h.up / h.votes) : "–"} funny`,
            }))}
          />
          <TableView
            headers={["Hour", "Votes", "Funny"]}
            rows={stats.byHour.map((h) => [hourLabel(h.hour), h.votes, h.votes ? percent(h.up / h.votes) : "–"])}
          />
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Which vibe is funniest?</h2>
            <span className="muted small">Share of votes that were 😂</span>
          </div>
          <p className="insight">
            {topVibe ? (
              <>
                <strong>{topVibe.label}</strong> captions get a laugh {percent(topVibe.rate)} of the time.
              </>
            ) : (
              "Not enough votes yet."
            )}
          </p>
          <BarList
            max={1}
            data={stats.vibes.map((v) => ({
              key: v.label,
              label: v.label,
              value: v.rate,
              display: v.votes ? percent(v.rate) : "–",
              tip: `${v.label}: ${percent(v.rate)} funny across ${v.votes} votes on ${v.photos} photos`,
            }))}
          />
          <TableView
            headers={["Vibe", "Photos", "Votes", "Funny"]}
            rows={stats.vibes.map((v) => [v.label, v.photos, v.votes, percent(v.rate)])}
          />
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Daily themes</h2>
            <span className="muted small">Photos posted per theme</span>
          </div>
          <BarList
            data={stats.themes.map((t) => ({
              key: t.theme,
              label: t.theme,
              value: t.photos,
              display: String(t.photos),
              tip: `${t.theme}: ${t.photos} photos, ${t.votes ? percent(t.rate) : "–"} funny`,
            }))}
          />
          <TableView
            headers={["Theme", "Photos", "Votes", "Funny"]}
            rows={stats.themes.map((t) => [t.theme, t.photos, t.votes, t.votes ? percent(t.rate) : "–"])}
          />
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Does length matter?</h2>
            <span className="muted small">Laugh rate by caption length</span>
          </div>
          <p className="insight">
            {longest ? (
              <>
                Captions <strong>{longest.label.toLowerCase()}</strong> land best ({percent(longest.rate)} funny).
              </>
            ) : (
              "Not enough votes yet."
            )}
          </p>
          <BarList
            max={1}
            data={stats.lengthBuckets.map((b) => ({
              key: b.label,
              label: b.label,
              value: b.rate,
              display: b.votes ? percent(b.rate) : "–",
              tip: `${b.label}: ${b.captions} captions, ${b.votes} votes, ${percent(b.rate)} funny`,
            }))}
          />
          <TableView
            headers={["Length", "Captions", "Votes", "Funny"]}
            rows={stats.lengthBuckets.map((b) => [b.label, b.captions, b.votes, percent(b.rate)])}
          />
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Captions</h2>
          <SplitLegend />
        </div>
        <div className="grid-3">
          <CaptionList title="🏆 Hall of fame" captions={stats.hallOfFame} empty="No upvoted captions yet." />
          <CaptionList title="⚖️ Most divisive" captions={stats.divisive} empty="Nothing split the crowd yet." />
          <CaptionList title="🪦 Hall of shame" captions={stats.hallOfShame} empty="No caption has a negative score." />
        </div>
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h2>Top creators</h2>
            <span className="muted small">Total score of their captions</span>
          </div>
          {stats.creators.length === 0 ? (
            <p className="muted">No posts yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Member</th>
                  <th className="num">Photos</th>
                  <th className="num">Score</th>
                </tr>
              </thead>
              <tbody>
                {stats.creators.map((c, i) => (
                  <tr key={c.id}>
                    <td>{i + 1}</td>
                    <td><Link href={`/users/${c.id}`} className="text-link">{c.name}</Link></td>
                    <td className="num">{c.photos}</td>
                    <td className="num">{c.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Voter superlatives</h2>
            <span className="muted small">Min. 10 votes, except most active</span>
          </div>
          <ul className="superlatives">
            <Superlative icon="🗳️" title="Most active" person={stats.people.mostActive} detail={(p) => `${p.votes} votes`} />
            <Superlative icon="😂" title="Easiest laugh" person={stats.people.easiestLaugh} detail={(p) => `${percent(p.rate)} funny`} />
            <Superlative icon="🧐" title="Toughest critic" person={stats.people.toughestCritic} detail={(p) => `${percent(p.rate)} funny`} />
            <Superlative
              icon="🙃"
              title="Biggest contrarian"
              person={stats.people.contrarian}
              detail={(p) => `agrees with the crowd ${percent(p.agreement ?? 0)} of the time`}
            />
          </ul>
          {stats.models.length > 0 && (
            <>
              <h3 className="sub-head">AI models</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Model</th>
                    <th className="num">Captions</th>
                    <th className="num">Funny</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.models.map((m) => (
                    <tr key={m.model}>
                      <td><code>{m.model}</code></td>
                      <td className="num">{m.captions}</td>
                      <td className="num">{m.votes ? percent(m.rate) : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>
      </div>
    </>
  );
}

function Tile({ value, label, sub }: { value: number | string; label: string; sub?: string }) {
  return (
    <div className="tile">
      <span className="tile-label">{label}</span>
      <strong className="tile-value">{value}</strong>
      {sub && <span className="muted small">{sub}</span>}
    </div>
  );
}

function CaptionList({ title, captions, empty }: { title: string; captions: RankedCaption[]; empty: string }) {
  return (
    <div>
      <h3 className="sub-head">{title}</h3>
      {captions.length === 0 ? (
        <p className="muted small">{empty}</p>
      ) : (
        <ol className="caption-list">
          {captions.map((c) => (
            <li key={c.id}>
              <Link href={`/media/${c.image_id}`} className="caption-thumb">
                {c.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.image_url} alt="" loading="lazy" />
                )}
              </Link>
              <div>
                <p>{c.content}</p>
                <div className="caption-meta">
                  <VoteSplit up={c.upvotes} down={c.downvotes} />
                  <span className="muted small">
                    {c.upvotes} / {c.downvotes} · score {c.score}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

type Voter = { id: string; name: string; votes: number; rate: number; agreement: number | null };

function Superlative({
  icon,
  title,
  person,
  detail,
}: {
  icon: string;
  title: string;
  person: Voter | null;
  detail: (p: Voter) => string;
}) {
  return (
    <li>
      <span className="superlative-icon" aria-hidden="true">{icon}</span>
      <div>
        <span className="muted small">{title}</span>
        {person ? (
          <p>
            <Link href={`/users/${person.id}`} className="text-link">{person.name}</Link>{" "}
            <span className="muted small">· {detail(person)}</span>
          </p>
        ) : (
          <p className="muted">Not enough votes yet</p>
        )}
      </div>
    </li>
  );
}
