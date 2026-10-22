"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminOrNull } from "@/lib/admin";
import {
  CAPTION_IMAGES_BUCKET,
  CUSTOM_VIBE_PREFIX,
  cleanCustomVibe,
  getDailyTheme,
  getThemeByName,
  getVibe,
} from "@/lib/captions";
import { buildCaptionPrompt, generateCaptions } from "@/lib/gemini";

const MANUAL_MODEL = "manual (admin)";
const MANUAL_PROMPT = "Written by an admin in the admin panel.";
const MAX_CAPTION_LENGTH = 300;

type Vibe = { id: string; instructions: string };

// A preset vibe id, or "custom" plus the text the admin typed
function resolveVibe(vibeId: string, customVibe: string): Vibe | null {
  if (vibeId === "custom") {
    const text = cleanCustomVibe(customVibe);
    return text.length >= 3
      ? { id: `${CUSTOM_VIBE_PREFIX}${text}`, instructions: `The user asked for this direction, follow it: "${text}"` }
      : null;
  }
  const vibe = getVibe(vibeId);
  return vibe ? { id: vibe.id, instructions: vibe.instructions } : null;
}

function vibeInstructions(stored: string) {
  if (stored.startsWith(CUSTOM_VIBE_PREFIX)) {
    return `The user asked for this direction, follow it: "${stored.slice(CUSTOM_VIBE_PREFIX.length)}"`;
  }
  return getVibe(stored)?.instructions ?? "Be funny.";
}

function cleanCaptions(lines: string[]) {
  return lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.slice(0, MAX_CAPTION_LENGTH));
}

async function aiCaptions(imageUrl: string, vibe: string, themeName: string | null) {
  const res = await fetch(imageUrl, { cache: "no-store" });
  if (!res.ok) throw new Error("Couldn't read the photo.");
  const data = Buffer.from(await res.arrayBuffer()).toString("base64");
  const mimeType = res.headers.get("content-type") ?? "image/jpeg";
  const prompt = buildCaptionPrompt(vibeInstructions(vibe), getThemeByName(themeName) ?? getDailyTheme());
  const { captions, model } = await generateCaptions({ data, mimeType }, prompt);
  return captions.map((content) => ({ content, prompt, model }));
}

function back(imageId: string, message: string, isError = false): never {
  redirect(`/media/${imageId}?${isError ? "error" : "msg"}=${encodeURIComponent(message)}`);
}

export type CreateResult = { error: string } | { imageId: string };

// CREATE: the browser has already uploaded the photo to Storage at `storagePath`
export async function createMedia(input: {
  storagePath: string;
  vibeId: string;
  customVibe: string;
  theme: string;
  mode: "ai" | "manual";
  captions: string[];
}): Promise<CreateResult> {
  const admin = await adminOrNull();
  if (!admin) return { error: "Not authorized." };
  const { supabase, user } = admin;

  if (!input.storagePath.startsWith(`${user.id}/`) || input.storagePath.includes("..")) {
    return { error: "Invalid upload." };
  }
  const removeUpload = () => supabase.storage.from(CAPTION_IMAGES_BUCKET).remove([input.storagePath]);

  const vibe = resolveVibe(input.vibeId, input.customVibe);
  if (!vibe) {
    await removeUpload();
    return { error: "Pick a vibe (custom vibes need at least 3 characters)." };
  }
  const theme = getThemeByName(input.theme)?.name ?? null;

  const {
    data: { publicUrl },
  } = supabase.storage.from(CAPTION_IMAGES_BUCKET).getPublicUrl(input.storagePath);

  let rows: { content: string; prompt: string; model: string }[];
  try {
    rows =
      input.mode === "ai"
        ? await aiCaptions(publicUrl, vibe.id, theme)
        : cleanCaptions(input.captions).map((content) => ({ content, prompt: MANUAL_PROMPT, model: MANUAL_MODEL }));
  } catch (err) {
    await removeUpload();
    return { error: err instanceof Error ? err.message : "Caption generation failed." };
  }
  if (rows.length === 0) {
    await removeUpload();
    return { error: "Add at least one caption." };
  }

  const { data: image, error } = await supabase
    .from("images")
    .insert({ user_id: user.id, storage_path: input.storagePath, image_url: publicUrl, vibe: vibe.id, theme })
    .select("id")
    .single();
  if (error) {
    await removeUpload();
    return { error: error.message };
  }

  const { error: captionError } = await supabase
    .from("captions")
    .insert(rows.map((row) => ({ ...row, image_id: image.id, user_id: user.id })));
  if (captionError) {
    await supabase.from("images").delete().eq("id", image.id);
    await removeUpload();
    return { error: captionError.message };
  }

  revalidatePath("/media");
  return { imageId: image.id };
}

// UPDATE the photo's vibe and theme
export async function updateMedia(formData: FormData) {
  const imageId = String(formData.get("imageId"));
  const admin = await adminOrNull();
  if (!admin) back(imageId, "Not authorized.", true);

  const vibe = resolveVibe(String(formData.get("vibe")), String(formData.get("customVibe") ?? ""));
  if (!vibe) back(imageId, "Pick a vibe (custom vibes need at least 3 characters).", true);
  const themeInput = String(formData.get("theme") ?? "");
  const theme = themeInput ? (getThemeByName(themeInput)?.name ?? null) : null;

  const { error } = await admin.supabase.from("images").update({ vibe: vibe.id, theme }).eq("id", imageId);
  if (error) back(imageId, error.message, true);

  revalidatePath(`/media/${imageId}`);
  back(imageId, "Photo details saved.");
}

// UPDATE one caption's text
export async function updateCaption(formData: FormData) {
  const imageId = String(formData.get("imageId"));
  const captionId = String(formData.get("captionId"));
  const content = String(formData.get("content") ?? "").trim();
  const admin = await adminOrNull();
  if (!admin) back(imageId, "Not authorized.", true);
  if (!content || content.length > MAX_CAPTION_LENGTH) back(imageId, `Captions must be 1–${MAX_CAPTION_LENGTH} characters.`, true);

  const { data, error } = await admin.supabase.from("captions").update({ content }).eq("id", captionId).select("id");
  if (error) back(imageId, error.message, true);
  if (!data?.length) back(imageId, "Caption not updated (check the superadmin migration).", true);

  revalidatePath(`/media/${imageId}`);
  back(imageId, "Caption updated.");
}

// DELETE one caption (its votes go with it)
export async function deleteCaption(formData: FormData) {
  const imageId = String(formData.get("imageId"));
  const captionId = String(formData.get("captionId"));
  const admin = await adminOrNull();
  if (!admin) back(imageId, "Not authorized.", true);

  const { data, error } = await admin.supabase.from("captions").delete().eq("id", captionId).select("id");
  if (error) back(imageId, error.message, true);
  if (!data?.length) back(imageId, "Caption not deleted.", true);

  revalidatePath(`/media/${imageId}`);
  back(imageId, "Caption deleted.");
}

// CREATE more captions on an existing photo: typed by hand, or a fresh batch from Gemini
export async function addCaptions(formData: FormData) {
  const imageId = String(formData.get("imageId"));
  const mode = String(formData.get("mode"));
  const admin = await adminOrNull();
  if (!admin) back(imageId, "Not authorized.", true);
  const { supabase, user } = admin;

  const { data: image } = await supabase
    .from("images")
    .select("id, image_url, vibe, theme")
    .eq("id", imageId)
    .maybeSingle<{ id: string; image_url: string; vibe: string; theme: string | null }>();
  if (!image) back(imageId, "Photo not found.", true);

  let rows: { content: string; prompt: string; model: string }[];
  try {
    rows =
      mode === "ai"
        ? await aiCaptions(image.image_url, image.vibe, image.theme)
        : cleanCaptions(String(formData.get("content") ?? "").split("\n")).map((content) => ({
            content,
            prompt: MANUAL_PROMPT,
            model: MANUAL_MODEL,
          }));
  } catch (err) {
    back(imageId, err instanceof Error ? err.message : "Caption generation failed.", true);
  }
  if (rows.length === 0) back(imageId, "Write at least one caption.", true);

  const { error } = await supabase
    .from("captions")
    .insert(rows.map((row) => ({ ...row, image_id: imageId, user_id: user.id })));
  if (error) back(imageId, error.message, true);

  revalidatePath(`/media/${imageId}`);
  back(imageId, `Added ${rows.length} caption${rows.length === 1 ? "" : "s"}.`);
}

// DELETE the photo, its captions and votes (cascade), and the file in Storage
export async function deleteMedia(formData: FormData) {
  const imageId = String(formData.get("imageId"));
  const admin = await adminOrNull();
  if (!admin) back(imageId, "Not authorized.", true);
  const { supabase } = admin;

  const { data, error } = await supabase.from("images").delete().eq("id", imageId).select("storage_path");
  if (error) back(imageId, error.message, true);
  if (!data?.length) back(imageId, "Photo not deleted (check the superadmin migration).", true);

  await supabase.storage.from(CAPTION_IMAGES_BUCKET).remove(data.map((row) => row.storage_path as string));

  revalidatePath("/media");
  redirect("/media?msg=Photo%20deleted.");
}
