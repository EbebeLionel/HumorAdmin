import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { getDailyTheme } from "@/lib/captions";
import NewMediaForm from "./NewMediaForm";

export default async function NewMediaPage() {
  const { user } = await requireAdmin();

  return (
    <>
      <p><Link href="/media" className="text-link">← All media</Link></p>
      <header className="page-head">
        <div>
          <h1>New media</h1>
          <p className="muted">Upload a photo, then let Gemini caption it or write the captions yourself. It goes live in the app right away.</p>
        </div>
      </header>
      <section className="card">
        <NewMediaForm userId={user.id} defaultTheme={getDailyTheme().name} />
      </section>
    </>
  );
}
