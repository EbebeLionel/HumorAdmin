import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getResource, type Field, type Resource } from "@/lib/resources";

export type Row = Record<string, unknown> & { id: string | number };

export const PAGE_SIZE = 25;
const AUDIT = "created_datetime_utc, modified_datetime_utc, created_by_user_id, modified_by_user_id";

// PostgREST's or() filter syntax uses , ( ) as separators, so strip them from search text
function cleanSearch(q: string) {
  return q.replace(/[,()*%\\]/g, " ").trim();
}

export function listColumns(resource: Resource) {
  const cols = ["id", ...resource.fields.filter((f) => f.list).map((f) => f.name), "created_datetime_utc"];
  if (resource.thumb === "url" && !cols.includes("url")) cols.push("url");
  if (resource.thumb === "images.url") cols.push("images(url)");
  return [...new Set(cols)].join(", ");
}

// Filters arrive as ?f_<column>=value; only declared fields may be filtered on
export function readFilters(resource: Resource, params: Record<string, string | string[] | undefined>) {
  const filters: { field: Field; value: string }[] = [];
  for (const field of resource.fields) {
    const value = params[`f_${field.name}`];
    if (typeof value === "string" && value !== "") filters.push({ field, value });
  }
  return filters;
}

export async function listRecords(
  supabase: SupabaseClient,
  resource: Resource,
  opts: { q?: string; page: number; filters: { field: Field; value: string }[] }
) {
  let query = supabase
    .from(resource.table)
    .select(listColumns(resource), { count: resource.count })
    .range((opts.page - 1) * PAGE_SIZE, opts.page * PAGE_SIZE - 1);

  for (const { column, ascending } of resource.order) {
    query = query.order(column, { ascending, nullsFirst: false });
  }
  for (const { field, value } of opts.filters) {
    query = field.type === "boolean" ? query.eq(field.name, value === "true") : query.eq(field.name, value);
  }
  const q = cleanSearch(opts.q ?? "");
  if (q && resource.search?.length) {
    query = query.or(resource.search.map((col) => `${col}.ilike.%${q}%`).join(","));
  }

  const { data, count, error } = await query;
  return { rows: (data ?? []) as unknown as Row[], count: count ?? 0, error };
}

export async function getRecord(supabase: SupabaseClient, resource: Resource, id: string) {
  const columns = ["id", ...resource.fields.map((f) => f.name), AUDIT];
  const { data, error } = await supabase
    .from(resource.table)
    .select([...new Set(columns)].join(", "))
    .eq("id", id)
    .maybeSingle();
  return { row: data as unknown as Row | null, error };
}

// { fieldName: { id: label } } for every fk field, covering just the ids on screen
export async function fkLabels(supabase: SupabaseClient, resource: Resource, rows: Row[], onlyListed = true) {
  const out: Record<string, Map<string, string>> = {};
  await Promise.all(
    resource.fields
      .filter((f) => f.type === "fk" && f.fk && (!onlyListed || f.list))
      .map(async (field) => {
        const ids = [...new Set(rows.map((r) => r[field.name]).filter((v) => v !== null && v !== undefined))];
        out[field.name] = new Map();
        if (ids.length === 0) return;
        const { data } = await supabase.from(field.fk!.table).select(`id, ${field.fk!.label}`).in("id", ids);
        for (const item of (data ?? []) as unknown as Record<string, unknown>[]) {
          out[field.name].set(String(item.id), String(item[field.fk!.label] ?? item.id));
        }
      })
  );
  return out;
}

// Dropdown options for the create/edit form
export async function fkOptions(supabase: SupabaseClient, resource: Resource) {
  const out: Record<string, { value: string; label: string }[]> = {};
  await Promise.all(
    resource.fields
      .filter((f) => f.type === "fk" && f.fk && f.editable)
      .map(async (field) => {
        const { data } = await supabase
          .from(field.fk!.table)
          .select(`id, ${field.fk!.label}`)
          .order(field.fk!.label)
          .limit(1000);
        out[field.name] = ((data ?? []) as unknown as Record<string, unknown>[]).map((item) => ({
          value: String(item.id),
          label: String(item[field.fk!.label] ?? item.id),
        }));
      })
  );
  return out;
}

export async function countRelated(supabase: SupabaseClient, resourceKey: string, column: string, id: string) {
  const resource = getResource(resourceKey);
  if (!resource) return null;
  const { count } = await supabase
    .from(resource.table)
    .select("id", { count: "exact", head: true })
    .eq(column, id);
  return count ?? 0;
}

export async function imageUrl(supabase: SupabaseClient, imageId: unknown) {
  if (typeof imageId !== "string" || !imageId) return null;
  const { data } = await supabase.from("images").select("url").eq("id", imageId).maybeSingle<{ url: string | null }>();
  return data?.url ?? null;
}

export function thumbUrl(resource: Resource, row: Row) {
  if (resource.thumb === "url") return (row.url as string | null) ?? null;
  if (resource.thumb === "images.url") return ((row.images as { url: string | null } | null)?.url as string | null) ?? null;
  return null;
}

export function truncate(text: string, max = 140) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
