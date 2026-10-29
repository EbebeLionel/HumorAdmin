"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminOrNull } from "@/lib/admin";
import { IMAGES_BUCKET, getResource, isValidId, type Resource } from "@/lib/resources";


function go(path: string, message: string, isError = false): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}${isError ? "error" : "msg"}=${encodeURIComponent(message)}`);
}

// Turns the submitted form into a row, using only the fields marked editable
function readForm(resource: Resource, formData: FormData): { values: Record<string, unknown> } | { error: string } {
  const values: Record<string, unknown> = {};

  for (const field of resource.fields.filter((f) => f.editable)) {
    if (field.type === "boolean") {
      values[field.name] = formData.get(field.name) === "on";
      continue;
    }

    let raw = String(formData.get(field.name) ?? "").trim();
    if (resource.lowercase?.includes(field.name)) raw = raw.toLowerCase();

    if (raw === "") {
      if (field.required) return { error: `${field.label} is required.` };
      values[field.name] = null;
      continue;
    }

    if (field.type === "number" || field.type === "fk") {
      const num = Number(raw);
      if (!Number.isFinite(num)) return { error: `${field.label} must be a number.` };
      values[field.name] = num;
    } else if (field.type === "ref") {
      const target = field.ref ? getResource(field.ref) : undefined;
      if (target && !isValidId(target, raw)) return { error: `${field.label} isn't a valid ID.` };
      values[field.name] = raw;
    } else {
      values[field.name] = raw;
    }
  }

  // Light format checks for the access-control tables
  if (typeof values.email_address === "string" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email_address)) {
    return { error: "That doesn't look like an email address." };
  }
  if (typeof values.apex_domain === "string") {
    values.apex_domain = values.apex_domain.replace(/^@/, "");
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(values.apex_domain as string)) {
      return { error: "Enter a domain like columbia.edu (no @, no https://)." };
    }
  }

  return { values };
}

export async function createRecord(resourceKey: string, formData: FormData) {
  const resource = getResource(resourceKey);
  if (!resource?.ops.create) redirect("/");
  const admin = await adminOrNull();
  if (!admin) go(`/${resource.key}/new`, "Not authorized.", true);

  const parsed = readForm(resource, formData);
  if ("error" in parsed) go(`/${resource.key}/new`, parsed.error, true);

  // created_by / modified_by default to auth.uid() in the database
  const { data, error } = await admin.supabase.from(resource.table).insert(parsed.values).select("id").single();
  if (error) go(`/${resource.key}/new`, error.message, true);

  revalidatePath(`/${resource.key}`);
  go(`/${resource.key}/${data.id}`, `${resource.singular} created.`);
}

export async function updateRecord(resourceKey: string, id: string, formData: FormData) {
  const resource = getResource(resourceKey);
  if (!resource?.ops.update || !isValidId(resource, id)) redirect("/");
  const path = `/${resource.key}/${id}`;
  const admin = await adminOrNull();
  if (!admin) go(path, "Not authorized.", true);

  const parsed = readForm(resource, formData);
  if ("error" in parsed) go(`${path}?edit=1`, parsed.error, true);

  const { data, error } = await admin.supabase
    .from(resource.table)
    .update({
      ...parsed.values,
      modified_by_user_id: admin.user.id,
      modified_datetime_utc: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id");
  if (error) go(`${path}?edit=1`, error.message, true);
  if (!data?.length) go(path, "Nothing was updated (row missing or blocked by RLS).", true);

  revalidatePath(`/${resource.key}`);
  go(path, "Saved.");
}

export async function deleteRecord(resourceKey: string, id: string) {
  const resource = getResource(resourceKey);
  if (!resource?.ops.delete || !isValidId(resource, id)) redirect("/");
  const admin = await adminOrNull();
  if (!admin) go(`/${resource.key}/${id}`, "Not authorized.", true);

  const { data, error } = await admin.supabase
    .from(resource.table)
    .delete()
    .eq("id", id)
    .select(resource.table === "images" ? "id, url" : "id");
  if (error) go(`/${resource.key}/${id}`, error.message, true);
  if (!data?.length) go(`/${resource.key}/${id}`, "Nothing was deleted (row missing or blocked by RLS).", true);

  // Images uploaded through this panel live in Storage; remove the file too
  const url = (data[0] as { url?: string | null }).url;
  const marker = `/storage/v1/object/public/${IMAGES_BUCKET}/`;
  if (url?.includes(marker)) {
    await admin.supabase.storage.from(IMAGES_BUCKET).remove([decodeURIComponent(url.split(marker)[1])]);
  }

  revalidatePath(`/${resource.key}`);
  go(`/${resource.key}`, `${resource.singular} deleted.`);
}
