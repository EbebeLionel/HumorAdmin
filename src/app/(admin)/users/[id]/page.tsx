import Link from "next/link";
import { notFound } from "next/navigation";
import { displayName, formatDate, requireAdmin, type AdminProfile } from "@/lib/admin";
import { getVibeLabel } from "@/lib/captions";
import { percent } from "@/components/charts";

type Profile = AdminProfile & { created_at: string; updated_at: string };
type VoteRow = {
  id: string;
  vote: 1 | -1;
  created_at: string;
  captions: { id: string; image_id: string; content: string; upvotes: number; downvotes: number } | null;
};

export default async function UserPage({ params }: PageProps<"/users/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { supabase } = await requireAdmin();
  const [{ data: profile }, { data: images }, { data: votes, count: voteTotal }, { count: upTotal }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, first_name, last_name, avatar_url, is_superadmin, created_at, updated_at")
      .eq("id", id)
      .maybeSingle<Profile>(),
    supabase
      .from("images")
      .select("id, image_url, vibe, theme, created_at, captions (score)")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .returns<{ id: string; image_url: string; vibe: string; theme: string | null; created_at: string; captions: { score: number }[] }[]>(),
    supabase
      .from("caption_votes")
      .select("id, vote, created_at, captions (id, image_id, content, upvotes, downvotes)", { count: "exact" })
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<VoteRow[]>(),
    supabase.from("caption_votes").select("id", { count: "exact", head: true }).eq("user_id", id).eq("vote", 1),
  ]);

  if (!profile) notFound();

  return (
    <>
      <p><Link href="/users" className="text-link">← All users</Link></p>
      <header className="page-head">
        <div className="person person-lg">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="" className="avatar" />
          ) : (
            <span className="avatar avatar-empty">{displayName(profile).charAt(0).toUpperCase()}</span>
          )}
          <div>
            <h1>{displayName(profile)}</h1>
            <p className="muted">{profile.email}</p>
          </div>
        </div>
      </header>

      <section className="tiles">
        <div className="tile">
          <span className="tile-label">Photos</span>
          <strong className="tile-value">{images?.length ?? 0}</strong>
        </div>
        <div className="tile">
          <span className="tile-label">Votes cast</span>
          <strong className="tile-value">{voteTotal ?? 0}</strong>
        </div>
        <div className="tile">
          <span className="tile-label">Laugh rate</span>
          <strong className="tile-value">{voteTotal ? percent((upTotal ?? 0) / voteTotal) : "–"}</strong>
        </div>
      </section>

      <section className="card">
        <h2>Profile record</h2>
        <dl className="fields">
          <dt>User id</dt><dd><code>{profile.id}</code></dd>
          <dt>First name</dt><dd>{profile.first_name ?? "–"}</dd>
          <dt>Last name</dt><dd>{profile.last_name ?? "–"}</dd>
          <dt>Email</dt><dd>{profile.email ?? "–"}</dd>
          <dt>Superadmin</dt><dd>{profile.is_superadmin ? "Yes" : "No"}</dd>
          <dt>Joined</dt><dd>{formatDate(profile.created_at, true)}</dd>
          <dt>Updated</dt><dd>{formatDate(profile.updated_at, true)}</dd>
        </dl>
      </section>

      <section className="card">
        <h2>Photos ({images?.length ?? 0})</h2>
        {images?.length ? (
          <div className="thumb-grid">
            {images.map((img) => {
              const vibe = getVibeLabel(img.vibe);
              const best = Math.max(0, ...img.captions.map((c) => c.score));
              return (
                <Link key={img.id} href={`/media/${img.id}`} className="thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.image_url} alt="" loading="lazy" />
                  <span className="small">{vibe ? `${vibe.emoji} ${vibe.label}` : img.vibe}</span>
                  <span className="muted small">best ▲ {best} · {formatDate(img.created_at)}</span>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="muted">No photos.</p>
        )}
      </section>

      <section className="card table-card">
        <h2>Latest votes</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Vote</th>
              <th>Caption</th>
              <th className="num">Caption tally</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {votes?.map((v) => (
              <tr key={v.id}>
                <td>{v.vote === 1 ? <span className="vote-up">▲ Funny</span> : <span className="vote-down">▼ Not funny</span>}</td>
                <td>
                  {v.captions ? (
                    <Link href={`/media/${v.captions.image_id}`} className="text-link">{v.captions.content}</Link>
                  ) : (
                    <span className="muted">Deleted caption</span>
                  )}
                </td>
                <td className="num">{v.captions ? `${v.captions.upvotes} / ${v.captions.downvotes}` : "–"}</td>
                <td>{formatDate(v.created_at, true)}</td>
              </tr>
            ))}
            {!votes?.length && (
              <tr><td colSpan={4} className="muted">No votes.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
