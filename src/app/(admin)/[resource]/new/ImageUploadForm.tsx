"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { IMAGES_BUCKET } from "@/lib/resources";
import { createImage } from "./image-actions";

const MAX_BYTES = 10 * 1024 * 1024;

// CREATE images: upload a file to Storage (or paste a URL), then save the row
export default function ImageUploadForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"upload" | "url">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function chooseFile(chosen: File | null) {
    setError(null);
    if (chosen && !chosen.type.startsWith("image/")) return setError("Please choose an image file.");
    if (chosen && chosen.size > MAX_BYTES) return setError("Images must be 10 MB or smaller.");
    setFile(chosen);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(chosen ? URL.createObjectURL(chosen) : null);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);

    let url = String(form.get("url") ?? "");
    if (mode === "upload") {
      if (!file) return setError("Choose an image to upload.");
      setStatus("Uploading…");
      const supabase = createClient();
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(IMAGES_BUCKET)
        .upload(path, file, { contentType: file.type });
      if (uploadError) {
        setStatus(null);
        return setError(`Upload failed: ${uploadError.message}`);
      }
      url = supabase.storage.from(IMAGES_BUCKET).getPublicUrl(path).data.publicUrl;
    }

    setStatus("Saving…");
    const result = await createImage({
      url,
      image_description: String(form.get("image_description") ?? ""),
      additional_context: String(form.get("additional_context") ?? ""),
      is_public: form.get("is_public") === "on",
      is_common_use: form.get("is_common_use") === "on",
    });
    if ("error" in result) {
      setStatus(null);
      return setError(result.error);
    }
    router.push(`/images/${result.id}?msg=${encodeURIComponent("Image created.")}`);
  }

  const busy = status !== null;

  return (
    <form onSubmit={onSubmit} className="form">
      <div className="tabs" role="tablist">
        <button type="button" className={mode === "upload" ? "tab active" : "tab"} onClick={() => setMode("upload")}>
          Upload a file
        </button>
        <button type="button" className={mode === "url" ? "tab active" : "tab"} onClick={() => setMode("url")}>
          Use an image URL
        </button>
      </div>

      {mode === "upload" ? (
        <label className="field">
          <span>Image file <span className="required">*</span></span>
          <input
            type="file"
            accept="image/*"
            className="input"
            onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
            disabled={busy}
          />
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Preview" className="detail-photo" />
          )}
        </label>
      ) : (
        <label className="field">
          <span>Image URL <span className="required">*</span></span>
          <input name="url" type="url" className="input" placeholder="https://…" required disabled={busy} />
        </label>
      )}

      <label className="field">
        <span>Description</span>
        <textarea name="image_description" className="input" rows={3} disabled={busy} />
      </label>
      <label className="field">
        <span>Additional context</span>
        <textarea name="additional_context" className="input" rows={2} disabled={busy} />
      </label>
      <label className="check">
        <input type="checkbox" name="is_public" disabled={busy} /> Public
      </label>
      <label className="check">
        <input type="checkbox" name="is_common_use" disabled={busy} /> Common use
      </label>

      <button type="submit" className="btn" disabled={busy}>
        {status ?? "Create image"}
      </button>
      {error && <p className="alert alert-error">{error}</p>}
    </form>
  );
}
