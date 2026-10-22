import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL, missingSupabaseEnv } from "@/lib/supabase/env";

// The only routes reachable without being a superadmin: the login wall itself
const PUBLIC_PATHS = ["/login", "/auth/callback", "/auth/signout"];

// Every other route requires a signed-in user whose profiles.is_superadmin is true.
// Pages and server actions check again (requireAdmin), and RLS checks a third time.
export async function proxy(request: NextRequest) {
  const missing = missingSupabaseEnv();
  if (missing.length) {
    return new NextResponse(
      `Admin panel is misconfigured. Missing environment variables: ${missing.join(", ")}. Add them in Vercel → Settings → Environment Variables, then redeploy.`,
      { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } }
    );
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    }
  );

  // Refreshes the session cookie if it has expired
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return response;
  }

  const deny = (error?: string) => {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = error ? `?error=${error}` : "";
    return NextResponse.redirect(url);
  };

  if (!user) {
    return deny();
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .maybeSingle<{ is_superadmin: boolean }>();

  if (error) {
    return deny("setup");
  }
  if (!profile?.is_superadmin) {
    return deny("not_admin");
  }

  return response;
}

export const config = {
  // Run on everything except static assets
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
