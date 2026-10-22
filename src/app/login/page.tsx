import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/admin";
import GoogleButton from "./GoogleButton";

const ERRORS: Record<string, string> = {
  not_admin: "That account isn't a superadmin. Access is limited to profiles with is_superadmin = true.",
  setup: "Couldn't check admin access. Has the superadmin migration been run on the database?",
  auth_failed: "Google sign-in failed. Please try again.",
  missing_code: "Sign-in was interrupted. Please try again.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { user, profile } = await getAdmin();
  if (user && profile) {
    redirect("/");
  }

  const { error } = await searchParams;
  const message = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <main className="login">
      <div className="login-card">
        <p className="eyebrow">The Humor Project</p>
        <h1>Admin</h1>
        <p className="muted">Restricted area. Sign in with an authorized Google account.</p>
        <GoogleButton />
        {message && <p className="alert alert-error">{message}</p>}
        {user && !profile && (
          <form action="/auth/signout" method="post">
            <button type="submit" className="link-btn">Signed in as {user.email}. Sign out</button>
          </form>
        )}
      </div>
    </main>
  );
}
