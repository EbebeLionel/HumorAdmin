// Supabase calls the public key "anon" in older projects and "publishable" in newer ones,
// so accept either name.
//
// The literal `process.env.NEXT_PUBLIC_*` reads are replaced with the values at build time
// (that's how the browser gets them). The computed-key reads below are not, so on the
// server they also pick up variables that only exist at runtime.
const URL_NAME = "NEXT_PUBLIC_SUPABASE_URL";
const KEY_NAMES = ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];

const builtUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const builtKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

function runtime(name: string) {
  return typeof process !== "undefined" ? (process.env[name] ?? "").trim() : "";
}

export const SUPABASE_URL = builtUrl.trim() || runtime(URL_NAME);
export const SUPABASE_KEY = builtKey.trim() || KEY_NAMES.map(runtime).find(Boolean) || "";

// If anything is missing, describe what the server can see (lengths only, never values)
// so a misconfigured deploy says what's wrong instead of a bare 500
export function missingSupabaseEnv() {
  if (SUPABASE_URL && SUPABASE_KEY) return null;
  const describe = (name: string, built: string) =>
    `${name}: at build ${built.trim() ? `${built.length} chars` : "missing"}, at runtime ${
      runtime(name) ? `${runtime(name).length} chars` : "missing"
    }`;
  // Variable names only (JSON-quoted so stray spaces show), never values
  const names = typeof process !== "undefined" ? Object.keys(process.env) : [];
  const supabaseNames = names.filter((name) => /supabase/i.test(name)).map((name) => JSON.stringify(name));
  return [
    describe(URL_NAME, builtUrl),
    describe(KEY_NAMES[0], process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""),
    describe(KEY_NAMES[1], process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ""),
    `GEMINI_API_KEY at runtime: ${runtime("GEMINI_API_KEY") ? "set" : "missing"}`,
    `Vercel environment: ${runtime("VERCEL_ENV") || "unknown"} (target ${runtime("VERCEL_TARGET_ENV") || "unknown"}), ${names.length} variables visible`,
    `Variable names containing "supabase": ${supabaseNames.join(", ") || "none"}`,
  ];
}
