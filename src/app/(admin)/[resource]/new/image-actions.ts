"use server";

import { revalidatePath } from "next/cache";
import { adminOrNull } from "@/lib/admin";

export type NewImageInput = {
  url: string;
  image_description: string;
  additional_context: string;
  is_public: boolean;
  is_common_use: boolean;
};

// CREATE an image row. The file itself was uploaded to Storage by the browser
// (or the admin pasted a URL); only the URL goes in the database.
export async function createImage(input: NewImageInput): Promise<{ error: string } | { id: string }> {
  const admin = await adminOrNull();
  if (!admin) return { error: "Not authorized." };

  let url: URL;
  try {
    url = new URL(input.url.trim());
  } catch {
    return { error: "That URL isn't valid." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { error: "Image URLs must start with https://" };
  }

  const { data, error } = await admin.supabase
    .from("images")
    .insert({
      url: url.toString(),
      image_description: input.image_description.trim() || null,
      additional_context: input.additional_context.trim() || null,
      is_public: input.is_public,
      is_common_use: input.is_common_use,
      // RLS: inserted images must belong to the signed-in user
      profile_id: admin.user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/images");
  return { id: data.id as string };
}
