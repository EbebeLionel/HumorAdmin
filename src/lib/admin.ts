import "server-only";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type AdminProfile = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  is_superadmin: boolean;
};

// The signed-in user, if (and only if) they're a superadmin
export async function getAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, profile: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, first_name, last_name, avatar_url, is_superadmin")
    .eq("id", user.id)
    .maybeSingle<AdminProfile>();

  return { supabase, user, profile: profile?.is_superadmin ? profile : null };
}

// For pages and layouts: bounce anyone who isn't a superadmin back to the login wall
export async function requireAdmin() {
  const { supabase, user, profile } = await getAdmin();
  if (!user) {
    redirect("/login");
  }
  if (!profile) {
    redirect("/login?error=not_admin");
  }
  return { supabase, user, profile };
}

// For server actions: same check, but returns null instead of redirecting
export async function adminOrNull() {
  const { supabase, user, profile } = await getAdmin();
  return user && profile ? { supabase, user, profile } : null;
}

export function displayName(profile: Pick<AdminProfile, "first_name" | "last_name" | "email"> | null | undefined) {
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
  return name || profile?.email || "Unknown user";
}

// PostgREST returns at most 1000 rows per request, so page through everything.
// Fine at class-project scale; a bigger app would aggregate in SQL instead.
export async function fetchAll<T>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  pageSize = 1000
): Promise<{ rows: T[]; error: { message: string } | null }> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order("id")
      .range(from, from + pageSize - 1);
    if (error) {
      return { rows, error };
    }
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < pageSize) {
      return { rows, error: null };
    }
  }
}

export function formatDate(iso: string, withTime = false) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: withTime ? undefined : "numeric",
    hour: withTime ? "numeric" : undefined,
    minute: withTime ? "2-digit" : undefined,
    timeZone: "America/New_York",
  });
}
