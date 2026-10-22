import Link from "next/link";
import { displayName, requireAdmin } from "@/lib/admin";
import SideNav from "./SideNav";

export const dynamic = "force-dynamic";

// Every page in the admin area renders inside this layout, which re-checks superadmin access
export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const { profile } = await requireAdmin();

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark" aria-hidden="true">😂</span>
          Humor Admin
        </Link>
        <SideNav />
        <div className="sidebar-user">
          <span className="muted small">Signed in as</span>
          <strong>{displayName(profile)}</strong>
          <form action="/auth/signout" method="post">
            <button type="submit" className="link-btn">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
