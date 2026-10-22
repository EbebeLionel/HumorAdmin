"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CAPTION_IMAGES_BUCKET, THEMES, VIBES } from "@/lib/captions";
import { createMedia } from "../actions";

const MAX_DIMENSION = 1280;

// Same as the main app: resize to a JPEG, which also strips EXIF/GPS metadata
async function prepareImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encode failed"))), "image/jpeg", 0.85)
  );
}

export default function NewMediaForm({ userId, defaultTheme }: { userId: string; defaultTheme: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [vibe, setVibe] = useState<string>(VIBES[0].id);
  const [customVibe, setCustomVibe] = useState("");
  const [theme, setTheme] = useState(defaultTheme);
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [captions, setCaptions] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function choose(chosen: File | null) {
    setError(null);
    if (chosen && !chosen.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(chosen);
    setPreview(chosen ? URL.createObjectURL(chosen) : null);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return setError("Choose a photo first.");
    if (mode === "manual" && !captions.trim()) return setError("Write at least one caption.");
    setError(null);

    let blob: Blob;
    try {
      setStatus("Preparing photo…");
      blob = await prepareImage(file);
    } catch {
      setStatus(null);
      return setError("Couldn't read that image. Try a JPG or PNG.");
    }

    setStatus("Uploading…");
    const path = `${userId}/${crypto.randomUUID()}.jpg`;
    const { error: uploadError } = await createClient()
      .storage.from(CAPTION_IMAGES_BUCKET)
      .upload(path, blob, { contentType: "image/jpeg" });
    if (uploadError) {
      setStatus(null);
      return setError(uploadError.message);
    }

    setStatus(mode === "ai" ? "Gemini is writing captions…" : "Saving…");
    const result = await createMedia({
      storagePath: path,
      vibeId: vibe,
      customVibe,
      theme,
      mode,
      captions: captions.split("\n"),
    });
    if ("error" in result) {
      setStatus(null);
      return setError(result.error);
    }
    router.push(`/media/${result.imageId}?msg=Created.`);
  }

  const busy = status !== null;

  return (
    <form onSubmit={onSubmit} className="form">
      <label className="field">
        Photo
        <input type="file" accept="image/*" className="input" disabled={busy} onChange={(e) => choose(e.target.files?.[0] ?? null)} />
      </label>
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Preview" className="preview" />
      )}

      <div className="grid-2">
        <label className="field">
          Vibe
          <select className="input" value={vibe} onChange={(e) => setVibe(e.target.value)} disabled={busy}>
            {VIBES.map((v) => (
              <option key={v.id} value={v.id}>{v.emoji} {v.label}</option>
            ))}
            <option value="custom">✍️ Custom</option>
          </select>
        </label>
        <label className="field">
          Theme
          <select className="input" value={theme} onChange={(e) => setTheme(e.target.value)} disabled={busy}>
            <option value="">No theme</option>
            {THEMES.map((t) => (
              <option key={t.name} value={t.name}>{t.name}</option>
            ))}
          </select>
        </label>
      </div>

      {vibe === "custom" && (
        <label className="field">
          Custom vibe
          <input className="input" value={customVibe} onChange={(e) => setCustomVibe(e.target.value)} maxLength={120} disabled={busy} />
        </label>
      )}

      <fieldset className="radio-row" disabled={busy}>
        <legend>Captions</legend>
        <label>
          <input type="radio" name="mode" checked={mode === "ai"} onChange={() => setMode("ai")} /> Generate with Gemini
        </label>
        <label>
          <input type="radio" name="mode" checked={mode === "manual"} onChange={() => setMode("manual")} /> Write them myself
        </label>
      </fieldset>

      {mode === "manual" && (
        <label className="field">
          One caption per line
          <textarea className="input" rows={4} value={captions} onChange={(e) => setCaptions(e.target.value)} disabled={busy} />
        </label>
      )}

      <button type="submit" className="btn" disabled={busy || !file}>
        {status ?? "Create media"}
      </button>
      {error && <p className="alert alert-error">{error}</p>}
    </form>
  );
}
