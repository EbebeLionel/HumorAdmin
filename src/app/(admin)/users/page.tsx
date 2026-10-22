import Link from "next/link";
import { displayName, fetchAll, formatDate, requireAdmin, type AdminProfile } from "@/lib/admin";
import { percent } from "@/components/charts";

type ProfileRow = AdminProfile & { created_at: string };

const SORTS = {
  joined: "Newest",
  photos: "Most photos",
  votes: "Most votes",
  name: "Name",
} as const;
type SortKey = keyof typeof SORTS;

// READ users/profiles. Read-only on purpose: users manage their own profiles in the main app.
export default async function UsersPage({ searchParams }: PageProps<"/users">) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().toLowerCase() : "";
  const sort: SortKey = typeof params.sort === "string" && params.sort in SORTS ? (params.sort as SortKey) : "joined";

  const [profiles, images, votes] = await Promise.all([
    fetchAll<ProfileRow>(supabase, "profiles", "id, email, first_name, last_name, avatar_url, is_superadmin, created_at"),
    fetchAll<{ id: string; user_id: string }>(supabase, "images", "id, user_id"),
    fetchAll<{ id: string; user_id: string; vote: number }>(supabase, "caption_votes", "id, user_id, vote"),
  ]);
  const error = profiles.error ?? images.error ?? votes.error;

  const photoCount = new Map<string, number>();
  for (const img of images.rows) photoCount.set(img.user_id, (photoCount.get(img.user_id) ?? 0) + 1);
  const voteCount = new Map<string, { total: number; up: number }>();
  for (const v of votes.rows) {
    const entry = voteCount.get(v.user_id) ?? { total: 0, up: 0 };
    entry.total++;
    if (v.vote === 1) entry.up++;
    voteCount.set(v.user_id, entry);
  }

  const users = profiles.rows
    .filter((p) => !q || `${p.first_name ?? ""} ${p.last_name ?? ""} ${p.email ?? ""}`.toLowerCase().includes(q))
    .map((p) => ({ ...p, photos: photoCount.get(p.id) ?? 0, votes: voteCount.get(p.id) ?? { total: 0, up: 0 } }))
    .sort((a, b) =>
      sort === "photos"
        ? b.photos - a.photos
        : sort === "votes"
          ? b.votes.total - a.votes.total
          : sort === "name"
            ? displayName(a).localeCompare(displayName(b))
            : b.created_at.localeCompare(a.created_at)
    );

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Users</h1>
          <p className="muted">{profiles.rows.length} profiles · read-only</p>
        </div>
      </header>

      {error && <p className="alert alert-error">Couldn&apos;t load users: {error.message}</p>}

      <form className="toolbar" action="/users">
        <input name="q" defaultValue={q} placeholder="Search name or email" className="input" aria-label="Search users" />
        <select name="sort" defaultValue={sort} className="input" aria-label="Sort by">
          {Object.entries(SORTS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <button type="submit" className="btn">Apply</button>
        {(q || sort !== "joined") && <Link href="/users" className="btn btn-ghost">Clear</Link>}
      </form>

      <section className="card table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Email</th>
              <th>Joined</th>
              <th className="num">Photos</th>
              <th className="num">Votes</th>
              <th className="num">Laugh rate</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <Link href={`/users/${u.id}`} className="person">
                    {u.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.avatar_url} alt="" className="avatar" />
                    ) : (
                      <span className="avatar avatar-empty">{displayName(u).charAt(0).toUpperCase()}</span>
                    )}
                    {[u.first_name, u.last_name].filter(Boolean).join(" ") || <span className="muted">No name yet</span>}
                  </Link>
                </td>
                <td className="muted">{u.email}</td>
                <td>{formatDate(u.created_at)}</td>
                <td className="num">{u.photos}</td>
                <td className="num">{u.votes.total}</td>
                <td className="num">{u.votes.total ? percent(u.votes.up / u.votes.total) : "–"}</td>
                <td>{u.is_superadmin ? <span className="badge">Superadmin</span> : <span className="muted small">Member</span>}</td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">No users match “{q}”.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
