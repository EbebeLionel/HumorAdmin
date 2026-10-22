import Link from "next/link";
import { displayName, fetchAll, formatDate, requireAdmin, type AdminProfile } from "@/lib/admin";
import { nyDayStart } from "@/lib/captions";
import { SplitLegend, VoteSplit, percent } from "@/components/charts";

const PAGE_SIZE = 50;

type VoteRow = {
  id: string;
  user_id: string;
  vote: 1 | -1;
  created_at: string;
  updated_at: string;
  captions: { id: string; image_id: string; content: string } | null;
};
type CaptionRow = {
  id: string;
  image_id: string;
  content: string;
  upvotes: number;
  downvotes: number;
  score: number;
  created_at: string;
};

const RATING_SORTS = {
  score: "Highest score",
  lowest: "Lowest score",
  votes: "Most votes",
  divisive: "Most divisive",
} as const;
type RatingSort = keyof typeof RATING_SORTS;

// READ upvotes/downvotes (the raw vote log) and ratings (per-caption totals)
export default async function VotesPage({ searchParams }: PageProps<"/votes">) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;
  const view = params.view === "ratings" ? "ratings" : "log";
  const page = Math.max(1, Number(params.page) || 1);

  const [{ count: total }, { count: up }, { count: today }] = await Promise.all([
    supabase.from("caption_votes").select("id", { count: "exact", head: true }),
    supabase.from("caption_votes").select("id", { count: "exact", head: true }).eq("vote", 1),
    supabase.from("caption_votes").select("id", { count: "exact", head: true }).gte("created_at", nyDayStart(0).toISOString()),
  ]);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Votes &amp; ratings</h1>
          <p className="muted">Read-only. Votes are cast by members in the main app.</p>
        </div>
      </header>

      <section className="tiles">
        <div className="tile"><span className="tile-label">Votes</span><strong className="tile-value">{total ?? 0}</strong></div>
        <div className="tile"><span className="tile-label">▲ Funny</span><strong className="tile-value">{up ?? 0}</strong></div>
        <div className="tile"><span className="tile-label">▼ Not funny</span><strong className="tile-value">{(total ?? 0) - (up ?? 0)}</strong></div>
        <div className="tile"><span className="tile-label">Laugh rate</span><strong className="tile-value">{total ? percent((up ?? 0) / total) : "–"}</strong></div>
        <div className="tile"><span className="tile-label">Votes today</span><strong className="tile-value">{today ?? 0}</strong></div>
      </section>

      <nav className="tabs">
        <Link href="/votes" className={view === "log" ? "tab active" : "tab"}>Vote log</Link>
        <Link href="/votes?view=ratings" className={view === "ratings" ? "tab active" : "tab"}>Caption ratings</Link>
      </nav>

      {view === "log" ? <VoteLog params={params} page={page} supabase={supabase} /> : <Ratings params={params} page={page} supabase={supabase} />}
    </>
  );
}

type SectionProps = {
  params: Record<string, string | string[] | undefined>;
  page: number;
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"];
};

async function VoteLog({ params, page, supabase }: SectionProps) {
  const filter = params.vote === "up" ? 1 : params.vote === "down" ? -1 : null;
  const userId = typeof params.user === "string" && /^[0-9a-f-]{36}$/i.test(params.user) ? params.user : null;

  let query = supabase
    .from("caption_votes")
    .select("id, user_id, vote, created_at, updated_at, captions (id, image_id, content)", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (filter) query = query.eq("vote", filter);
  if (userId) query = query.eq("user_id", userId);
  const { data, count, error } = await query.returns<VoteRow[]>();
  const votes = data ?? [];

  const ids = [...new Set(votes.map((v) => v.user_id))];
  const { data: voters } = ids.length
    ? await supabase.from("profiles").select("id, first_name, last_name, email").in("id", ids)
    : { data: [] };
  const voterById = new Map((voters ?? []).map((p) => [p.id as string, p as Pick<AdminProfile, "first_name" | "last_name" | "email">]));

  const link = (changes: Record<string, string | null>) => {
    const search = new URLSearchParams();
    const merged = { vote: filter === 1 ? "up" : filter === -1 ? "down" : null, user: userId, page: null, ...changes };
    for (const [k, v] of Object.entries(merged)) if (v) search.set(k, v);
    return `/votes?${search}`;
  };
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <>
      <div className="toolbar">
        <Link href={link({ vote: null })} className={filter === null ? "chip active" : "chip"}>All</Link>
        <Link href={link({ vote: "up" })} className={filter === 1 ? "chip active" : "chip"}>▲ Funny</Link>
        <Link href={link({ vote: "down" })} className={filter === -1 ? "chip active" : "chip"}>▼ Not funny</Link>
        {userId && (
          <Link href={link({ user: null })} className="chip active">
            Voter: {displayName(voterById.get(userId))} ✕
          </Link>
        )}
      </div>

      {error && <p className="alert alert-error">Couldn&apos;t load votes: {error.message}</p>}

      <section className="card table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Voter</th>
              <th>Vote</th>
              <th>Caption</th>
              <th>Cast</th>
              <th>Last changed</th>
            </tr>
          </thead>
          <tbody>
            {votes.map((v) => (
              <tr key={v.id}>
                <td>
                  <Link href={link({ user: v.user_id })} className="text-link" title="Show only this voter">
                    {displayName(voterById.get(v.user_id))}
                  </Link>
                </td>
                <td>{v.vote === 1 ? <span className="vote-up">▲ Funny</span> : <span className="vote-down">▼ Not funny</span>}</td>
                <td>
                  {v.captions ? (
                    <Link href={`/media/${v.captions.image_id}`} className="text-link">{v.captions.content}</Link>
                  ) : (
                    <span className="muted">Deleted</span>
                  )}
                </td>
                <td>{formatDate(v.created_at, true)}</td>
                <td>{v.updated_at !== v.created_at ? formatDate(v.updated_at, true) : <span className="muted">–</span>}</td>
              </tr>
            ))}
            {votes.length === 0 && (
              <tr><td colSpan={5} className="muted">No votes.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <Pager page={page} pages={pages} link={(p) => link({ page: String(p) })} />
    </>
  );
}

async function Ratings({ params, page, supabase }: SectionProps) {
  const sort: RatingSort = typeof params.sort === "string" && params.sort in RATING_SORTS ? (params.sort as RatingSort) : "score";
  const { rows, error } = await fetchAll<CaptionRow>(supabase, "captions", "id, image_id, content, upvotes, downvotes, score, created_at");

  const totalVotes = (c: CaptionRow) => c.upvotes + c.downvotes;
  const balance = (c: CaptionRow) => (totalVotes(c) ? Math.abs(c.score) / totalVotes(c) : 1);
  const sorted = rows
    .filter((c) => sort !== "divisive" || (c.upvotes > 0 && c.downvotes > 0))
    .sort((a, b) =>
      sort === "lowest"
        ? a.score - b.score
        : sort === "votes"
          ? totalVotes(b) - totalVotes(a)
          : sort === "divisive"
            ? balance(a) - balance(b) || totalVotes(b) - totalVotes(a)
            : b.score - a.score || b.upvotes - a.upvotes
    );
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const slice = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const link = (s: RatingSort, p = 1) => `/votes?view=ratings&sort=${s}${p > 1 ? `&page=${p}` : ""}`;

  return (
    <>
      <div className="toolbar">
        {Object.entries(RATING_SORTS).map(([key, label]) => (
          <Link key={key} href={link(key as RatingSort)} className={sort === key ? "chip active" : "chip"}>{label}</Link>
        ))}
        <span className="spacer" />
        <SplitLegend />
      </div>

      {error && <p className="alert alert-error">Couldn&apos;t load ratings: {error.message}</p>}

      <section className="card table-card">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Caption</th>
              <th>Split</th>
              <th className="num">▲</th>
              <th className="num">▼</th>
              <th className="num">Score</th>
              <th className="num">Laugh rate</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((c, i) => (
              <tr key={c.id}>
                <td className="muted">{(page - 1) * PAGE_SIZE + i + 1}</td>
                <td><Link href={`/media/${c.image_id}`} className="text-link">{c.content}</Link></td>
                <td className="split-cell"><VoteSplit up={c.upvotes} down={c.downvotes} /></td>
                <td className="num">{c.upvotes}</td>
                <td className="num">{c.downvotes}</td>
                <td className="num">{c.score}</td>
                <td className="num">{totalVotes(c) ? percent(c.upvotes / totalVotes(c)) : "–"}</td>
              </tr>
            ))}
            {slice.length === 0 && (
              <tr><td colSpan={7} className="muted">No captions.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <Pager page={page} pages={pages} link={(p) => link(sort, p)} />
    </>
  );
}

function Pager({ page, pages, link }: { page: number; pages: number; link: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav className="pager" aria-label="Pages">
      {page > 1 ? <Link href={link(page - 1)} className="btn btn-ghost">← Prev</Link> : <span />}
      <span className="muted">Page {page} of {pages}</span>
      {page < pages ? <Link href={link(page + 1)} className="btn btn-ghost">Next →</Link> : <span />}
    </nav>
  );
}
