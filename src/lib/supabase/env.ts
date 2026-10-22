// Supabase calls the public key "anon" in older projects and "publishable" in newer ones,
// so accept either name. Written out literally so Next can inline them in the browser bundle.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

// Names of whatever is missing, so a misconfigured deploy says what's wrong instead of a bare 500
export function missingSupabaseEnv() {
  return [
    !SUPABASE_URL && "NEXT_PUBLIC_SUPABASE_URL",
    !SUPABASE_KEY && "NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)",
  ].filter(Boolean) as string[];
}
