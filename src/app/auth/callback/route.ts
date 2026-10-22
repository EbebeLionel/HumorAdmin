import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Google redirects here via Supabase with a one-time ?code=
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", request.url));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login?error=auth_failed", request.url));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", data.user.id)
    .maybeSingle<{ is_superadmin: boolean }>();

  // Don't leave a session lying around for someone who isn't allowed in
  if (!profile?.is_superadmin) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=not_admin", request.url));
  }

  return NextResponse.redirect(new URL("/", request.url));
}
