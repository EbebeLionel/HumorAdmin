import Link from "next/link";
import { notFound } from "next/navigation";
import { displayName, formatDate, requireAdmin, type AdminProfile } from "@/lib/admin";
import { CUSTOM_VIBE_PREFIX, THEMES, VIBES } from "@/lib/captions";
import { VoteSplit } from "@/components/charts";
import SubmitButton from "@/components/SubmitButton";
import { addCaptions, deleteCaption, deleteMedia, updateCaption, updateMedia } from "../actions";

type Image = {
  id: string;
  user_id: string;
  storage_path: string;
  image_url: string;
  vibe: string;
  theme: string | null;
  created_at: string;
  captions: {
    id: string;
    content: string;
    model: string;
    prompt: string;
    upvotes: number;
    downvotes: number;
    score: number;
    created_at: string;
  }[];
};

// READ + UPDATE + DELETE one photo and its captions
export default async function MediaDetail({ params, searchParams }: PageProps<"/media/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { msg, error: errorMsg } = await searchParams;

  const { supabase } = await requireAdmin();
  const { data: image } = await supabase
    .from("images")
    .select("id, user_id, storage_path, image_url, vibe, theme, created_at, captions (id, content, model, prompt, upvotes, downvotes, score, created_at)")
    .eq("id", id)
    .maybeSingle<Image>();
  if (!image) notFound();

  image.captions.sort((a, b) => b.score - a.score || a.created_at.localeCompare(b.created_at));
  const { data: owner } = await supabase
    .from("profiles")
    .select("first_name, last_name, email")
    .eq("id", image.user_id)
    .maybeSingle<Pick<AdminProfile, "first_name" | "last_name" | "email">>();

  const isCustom = image.vibe.startsWith(CUSTOM_VIBE_PREFIX);
  const votes = image.captions.reduce((sum, c) => sum + c.upvotes + c.downvotes, 0);

  return (
    <>
      <p><Link href="/media" className="text-link">← All media</Link></p>
      <header className="page-head">
        <div>
          <h1>Photo</h1>
          <p className="muted">
            Posted by <Link href={`/users/${image.user_id}`} className="text-link">{displayName(owner)}</Link> ·{" "}
            {formatDate(image.created_at, true)} · {image.captions.length} captions · {votes} votes
          </p>
        </div>
        <form action={deleteMedia}>
          <input type="hidden" name="imageId" value={image.id} />
          <SubmitButton
            className="btn btn-danger"
            pendingLabel="Deleting…"
            confirm="Delete this photo, all its captions and votes, and the file in storage? This can't be undone."
          >
            Delete photo
          </SubmitButton>
        </form>
      </header>

      {typeof msg === "string" && <p className="alert">{msg}</p>}
      {typeof errorMsg === "string" && <p className="alert alert-error">{errorMsg}</p>}

      <div className="detail">
        <section className="card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.image_url} alt="" className="detail-photo" />
          <p className="muted small"><code>{image.storage_path}</code></p>
        </section>

        <section className="card">
          <h2>Details</h2>
          <form action={updateMedia} className="form">
            <input type="hidden" name="imageId" value={image.id} />
            <label className="field">
              Vibe
              <select name="vibe" defaultValue={isCustom ? "custom" : image.vibe} className="input">
                {VIBES.map((v) => (
                  <option key={v.id} value={v.id}>{v.emoji} {v.label}</option>
                ))}
                <option value="custom">✍️ Custom</option>
              </select>
            </label>
            <label className="field">
              Custom vibe text <span className="muted small">(used when Vibe is Custom)</span>
              <input
                name="customVibe"
                className="input"
                defaultValue={isCustom ? image.vibe.slice(CUSTOM_VIBE_PREFIX.length) : ""}
                maxLength={120}
              />
            </label>
            <label className="field">
              Theme
              <select name="theme" defaultValue={image.theme ?? ""} className="input">
                <option value="">No theme</option>
                {THEMES.map((t) => (
                  <option key={t.name} value={t.name}>{t.name}</option>
                ))}
              </select>
            </label>
            <SubmitButton pendingLabel="Saving…">Save details</SubmitButton>
          </form>
        </section>
      </div>

      <section className="card">
        <h2>Captions</h2>
        <ul className="edit-captions">
          {image.captions.map((c) => (
            <li key={c.id}>
              <form action={updateCaption} className="caption-form">
                <input type="hidden" name="imageId" value={image.id} />
                <input type="hidden" name="captionId" value={c.id} />
                <textarea name="content" defaultValue={c.content} className="input" rows={2} maxLength={300} required />
                <div className="caption-form-foot">
                  <VoteSplit up={c.upvotes} down={c.downvotes} />
                  <span className="muted small">
                    ▲ {c.upvotes} ▼ {c.downvotes} · score {c.score} · <code>{c.model}</code>
                  </span>
                  <span className="spacer" />
                  <SubmitButton className="btn btn-sm" pendingLabel="Saving…">Save</SubmitButton>
                  <SubmitButton
                    className="btn btn-sm btn-danger"
                    pendingLabel="Deleting…"
                    confirm="Delete this caption and its votes?"
                    formAction={deleteCaption}
                  >
                    Delete
                  </SubmitButton>
                </div>
              </form>
              <details className="prompt">
                <summary className="muted small">Prompt</summary>
                <pre>{c.prompt}</pre>
              </details>
            </li>
          ))}
          {image.captions.length === 0 && <li className="muted">No captions yet.</li>}
        </ul>
      </section>

      <div className="grid-2">
        <section className="card">
          <h2>Add captions by hand</h2>
          <form action={addCaptions} className="form">
            <input type="hidden" name="imageId" value={image.id} />
            <input type="hidden" name="mode" value="manual" />
            <label className="field">
              One caption per line
              <textarea name="content" className="input" rows={3} required />
            </label>
            <SubmitButton pendingLabel="Adding…">Add captions</SubmitButton>
          </form>
        </section>
        <section className="card">
          <h2>Generate more with AI</h2>
          <p className="muted small">Asks Gemini for a fresh batch using this photo&apos;s vibe and theme.</p>
          <form action={addCaptions} className="form">
            <input type="hidden" name="imageId" value={image.id} />
            <input type="hidden" name="mode" value="ai" />
            <SubmitButton pendingLabel="Generating…">✨ Generate captions</SubmitButton>
          </form>
        </section>
      </div>
    </>
  );
}
