import Link from "next/link";
import { formatDate, requireAdmin } from "@/lib/admin";
import { GROUPS, RESOURCES } from "@/lib/resources";
import { BarList, TableView } from "@/components/charts";

export const dynamic = "force-dynamic";

const SAMPLE = 1000; // most recent LLM responses used for the pipeline health charts

type ResponseRow = {
  llm_model_id: number;
  humor_flavor_id: number;
  processing_time_seconds: number;
  created_datetime_utc: string;
};

function seconds(value: number) {
  return `${value.toFixed(value < 10 ? 1 : 0)}s`;
}

export default async function Dashboard() {
  const { supabase } = await requireAdmin();

  const [counts, responses, models, flavors, requests] = await Promise.all([
    Promise.all(
      RESOURCES.map(async (r) => {
        const { count, error } = await supabase.from(r.table).select("id", { count: r.count, head: true });
        return { resource: r, count: count ?? 0, error };
      })
    ),
    supabase
      .from("llm_model_responses")
      .select("llm_model_id, humor_flavor_id, processing_time_seconds, created_datetime_utc")
      .order("created_datetime_utc", { ascending: false })
      .limit(SAMPLE)
      .returns<ResponseRow[]>(),
    supabase.from("llm_models").select("id, name"),
    supabase.from("humor_flavors").select("id, slug"),
    supabase
      .from("caption_requests")
      .select("id, image_id, profile_id, created_datetime_utc, images(url)")
      .order("id", { ascending: false })
      .limit(6),
  ]);

  const failed = counts.find((c) => c.error)?.error ?? responses.error;
  const modelName = new Map((models.data ?? []).map((m) => [m.id as number, m.name as string]));
  const flavorSlug = new Map((flavors.data ?? []).map((f) => [f.id as number, f.slug as string]));

  // Latency and volume per model / per prompt chain over the sample
  const byModel = new Map<number, { n: number; total: number }>();
  const byFlavor = new Map<number, number>();
  for (const r of responses.data ?? []) {
    const m = byModel.get(r.llm_model_id) ?? { n: 0, total: 0 };
    m.n++;
    m.total += Number(r.processing_time_seconds) || 0;
    byModel.set(r.llm_model_id, m);
    byFlavor.set(r.humor_flavor_id, (byFlavor.get(r.humor_flavor_id) ?? 0) + 1);
  }
  const modelRows = [...byModel.entries()]
    .map(([id, m]) => ({ id, name: modelName.get(id) ?? `Model ${id}`, n: m.n, avg: m.total / m.n }))
    .sort((a, b) => b.avg - a.avg);
  const flavorRows = [...byFlavor.entries()]
    .map(([id, n]) => ({ id, slug: flavorSlug.get(id) ?? `Flavor ${id}`, n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 10);
  const sample = responses.data ?? [];
  const oldest = sample.at(-1)?.created_datetime_utc;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Crackd pipeline</p>
          <h1>Dashboard</h1>
          <p className="muted">Everything the caption pipeline stores, and how it&apos;s performing.</p>
        </div>
      </header>

      {failed && <p className="alert alert-error">Some data failed to load: {failed.message}</p>}

      {GROUPS.map((group) => (
        <section key={group} className="dash-group">
          <h2 className="sub-head">{group}</h2>
          <div className="tiles">
            {counts
              .filter((c) => c.resource.group === group)
              .map(({ resource, count }) => (
                <Link key={resource.key} href={`/${resource.key}`} className="tile tile-link">
                  <span className="tile-value">
                    {resource.count === "estimated" ? "≈" : ""}
                    {count.toLocaleString()}
                  </span>
                  <span className="tile-label">
                    {resource.icon} {resource.title}
                  </span>
                </Link>
              ))}
          </div>
        </section>
      ))}

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h2>Average latency by model</h2>
            <span className="muted small">Last {sample.length.toLocaleString()} LLM responses</span>
          </div>
          {modelRows.length ? (
            <>
              <BarList
                data={modelRows.map((m) => ({
                  key: String(m.id),
                  label: m.name,
                  value: m.avg,
                  display: seconds(m.avg),
                  tip: `${m.name}: ${seconds(m.avg)} average over ${m.n} responses`,
                }))}
              />
              <TableView
                headers={["Model", "Responses", "Avg seconds"]}
                rows={modelRows.map((m) => [m.name, m.n, m.avg.toFixed(2)])}
              />
            </>
          ) : (
            <p className="muted small">No LLM responses yet.</p>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Busiest prompt chains</h2>
            <span className="muted small">{oldest ? `Since ${formatDate(oldest, true)}` : "No data"}</span>
          </div>
          {flavorRows.length ? (
            <>
              <BarList
                data={flavorRows.map((f) => ({
                  key: String(f.id),
                  label: f.slug,
                  value: f.n,
                  display: f.n.toLocaleString(),
                  tip: `${f.slug}: ${f.n} LLM responses`,
                }))}
              />
              <TableView headers={["Prompt chain", "Responses"]} rows={flavorRows.map((f) => [f.slug, f.n])} />
            </>
          ) : (
            <p className="muted small">No LLM responses yet.</p>
          )}
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Latest generation requests</h2>
          <Link href="/caption-requests" className="text-link small">All requests →</Link>
        </div>
        <div className="thumb-grid">
          {(requests.data ?? []).map((req) => {
            const url = (req.images as unknown as { url: string | null } | null)?.url;
            return (
              <Link key={req.id as number} href={`/caption-requests/${req.id}`} className="thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {url ? <img src={url} alt="" loading="lazy" /> : <span className="thumb-empty">No image</span>}
                <span className="small">Request #{String(req.id)}</span>
                <span className="muted small">{formatDate(req.created_datetime_utc as string, true)}</span>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}
