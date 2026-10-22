import Link from "next/link";
import { displayName, formatDate, requireAdmin, type AdminProfile } from "@/lib/admin";
import { CUSTOM_VIBE_PREFIX, THEMES, VIBES, getVibeLabel } from "@/lib/captions";

const PAGE_SIZE = 24;

type ImageRow = {
  id: string;
  user_id: string;
  image_url: string;
  vibe: string;
  theme: string | null;
  created_at: string;
  captions: { score: number; upvotes: number; downvotes: number }[];
};

// READ AI generated media: every photo with its captions' totals
export default async function MediaPage({ searchParams }: PageProps<"/media">) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;
  const vibe = typeof params.vibe === "string" ? params.vibe : "";
  const theme = typeof params.theme === "string" ? params.theme : "";
  const order = params.order === "oldest" ? "oldest" : "newest";
  const page = Math.max(1, Number(params.page) || 1);
  const msg = typeof params.msg === "string" ? params.msg : null;

  let query = supabase
    .from("images")
    .select("id, user_id, image_url, vibe, theme, created_at, captions (score, upvotes, downvotes)", { count: "exact" })
    .order("created_at", { ascending: order === "oldest" })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (vibe === "custom") query = query.like("vibe", `${CUSTOM_VIBE_PREFIX}%`);
  else if (vibe) query = query.eq("vibe", vibe);
  if (theme) query = query.eq("theme", theme);

  const { data, count, error } = await query.returns<ImageRow[]>();
  const images = data ?? [];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const userIds = [...new Set(images.map((img) => img.user_id))];
  const { data: owners } = userIds.length
    ? await supabase.from("profiles").select("id, email, first_name, last_name").in("id", userIds)
    : { data: [] };
  const ownerById = new Map((owners ?? []).map((p) => [p.id as string, p as Pick<AdminProfile, "first_name" | "last_name" | "email">]));

  const pageLink = (p: number) => {
    const search = new URLSearchParams({ ...(vibe && { vibe }), ...(theme && { theme }), order, page: String(p) });
    return `/media?${search}`;
  };

  return (
    <>
      <header className="page-head">
        <div>
          <h1>AI media</h1>
          <p className="muted">{count ?? 0} photos and their AI captions</p>
        </div>
        <Link href="/media/new" className="btn">+ New media</Link>
      </header>

      {msg && <p className="alert">{msg}</p>}
      {error && <p className="alert alert-error">Couldn&apos;t load media: {error.message}</p>}

      <form className="toolbar" action="/media">
        <select name="vibe" defaultValue={vibe} className="input" aria-label="Vibe">
          <option value="">All vibes</option>
          {VIBES.map((v) => (
            <option key={v.id} value={v.id}>{v.emoji} {v.label}</option>
          ))}
          <option value="custom">✍️ Custom vibes</option>
        </select>
        <select name="theme" defaultValue={theme} className="input" aria-label="Theme">
          <option value="">All themes</option>
          {THEMES.map((t) => (
            <option key={t.name} value={t.name}>{t.name}</option>
          ))}
        </select>
        <select name="order" defaultValue={order} className="input" aria-label="Order">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
        <button type="submit" className="btn">Apply</button>
        {(vibe || theme || order !== "newest") && <Link href="/media" className="btn btn-ghost">Clear</Link>}
      </form>

      {images.length === 0 ? (
        <section className="card empty">
          <p>No media matches these filters.</p>
        </section>
      ) : (
        <div className="media-grid">
          {images.map((img) => {
            const label = getVibeLabel(img.vibe);
            const best = img.captions.length ? Math.max(...img.captions.map((c) => c.score)) : 0;
            const votes = img.captions.reduce((sum, c) => sum + c.upvotes + c.downvotes, 0);
            return (
              <Link key={img.id} href={`/media/${img.id}`} className="media-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.image_url} alt="" loading="lazy" />
                <div className="media-card-body">
                  <span className="small">{label ? `${label.emoji} ${label.label}` : img.vibe}</span>
                  {img.theme && <span className="muted small">📅 {img.theme}</span>}
                  <span className="muted small">
                    {img.captions.length} captions · {votes} votes · best ▲ {best}
                  </span>
                  <span className="muted small">
                    {displayName(ownerById.get(img.user_id))} · {formatDate(img.created_at)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {pages > 1 && (
        <nav className="pager" aria-label="Pages">
          {page > 1 ? <Link href={pageLink(page - 1)} className="btn btn-ghost">← Prev</Link> : <span />}
          <span className="muted">Page {page} of {pages}</span>
          {page < pages ? <Link href={pageLink(page + 1)} className="btn btn-ghost">Next →</Link> : <span />}
        </nav>
      )}
    </>
  );
}
