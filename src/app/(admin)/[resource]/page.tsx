import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { PAGE_SIZE, fkLabels, listRecords, readFilters, thumbUrl } from "@/lib/records";
import { getResource } from "@/lib/resources";
import FieldValue from "@/components/FieldValue";

export const dynamic = "force-dynamic";

// List view for any resource in src/lib/resources.ts: search, filters, paging
export default async function ResourceListPage({ params, searchParams }: PageProps<"/[resource]">) {
  const { resource: key } = await params;
  const resource = getResource(key);
  if (!resource) notFound();

  const { supabase } = await requireAdmin();
  const search = await searchParams;
  const q = typeof search.q === "string" ? search.q : "";
  const page = Math.max(1, Number(search.page) || 1);
  const filters = readFilters(resource, search);
  const msg = typeof search.msg === "string" ? search.msg : null;

  const { rows, count, error } = await listRecords(supabase, resource, { q, page, filters });
  const labels = await fkLabels(supabase, resource, rows);
  const listed = resource.fields.filter((f) => f.list);
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const link = (overrides: Record<string, string | null>) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    for (const { field, value } of filters) next.set(`f_${field.name}`, value);
    for (const [k, v] of Object.entries(overrides)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    const s = next.toString();
    return `/${resource.key}${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">{resource.group}</p>
          <h1>
            <span aria-hidden="true">{resource.icon}</span> {resource.title}
          </h1>
          <p className="muted">
            {resource.description} · {resource.count === "estimated" ? "≈" : ""}
            {count.toLocaleString()} rows
          </p>
        </div>
        {resource.ops.create && (
          <Link href={`/${resource.key}/new`} className="btn">
            + New {resource.singular.toLowerCase()}
          </Link>
        )}
      </header>

      <OpsBadges ops={resource.ops} />

      {msg && <p className="alert">{msg}</p>}
      {error && <p className="alert alert-error">Couldn&apos;t load {resource.title.toLowerCase()}: {error.message}</p>}

      {(resource.search?.length || filters.length > 0) && (
        <form className="toolbar" action={`/${resource.key}`}>
          {filters.map(({ field, value }) => (
            <input key={field.name} type="hidden" name={`f_${field.name}`} value={value} />
          ))}
          {resource.search?.length ? (
            <>
              <input
                name="q"
                defaultValue={q}
                className="input"
                placeholder={`Search ${resource.search.join(", ").replaceAll("_", " ")}`}
                aria-label="Search"
              />
              <button type="submit" className="btn">Search</button>
            </>
          ) : null}
          {filters.map(({ field, value }) => (
            <Link key={field.name} href={link({ [`f_${field.name}`]: null, page: null })} className="chip" title="Remove filter">
              {field.label} = {value.length > 12 ? `${value.slice(0, 8)}…` : value} ✕
            </Link>
          ))}
          {q && <Link href={link({ q: null, page: null })} className="btn btn-ghost">Clear search</Link>}
        </form>
      )}

      <section className="card table-card">
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                {resource.thumb && <th aria-label="Preview" />}
                <th>ID</th>
                {listed.map((f) => (
                  <th key={f.name} className={f.type === "number" ? "num" : undefined}>{f.label}</th>
                ))}
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const thumb = thumbUrl(resource, row);
                return (
                  <tr key={String(row.id)}>
                    {resource.thumb && (
                      <td className="thumb-cell">
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumb} alt="" loading="lazy" />
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    )}
                    <td>
                      <Link href={`/${resource.key}/${row.id}`} className="text-link mono" title={String(row.id)}>
                        {resource.idType === "uuid" ? `${String(row.id).slice(0, 8)}…` : String(row.id)}
                      </Link>
                    </td>
                    {listed.map((f) => (
                      <td key={f.name} className={f.type === "number" ? "num" : f.type === "longtext" || f.type === "textarea" ? "wide" : undefined}>
                        <FieldValue field={f} value={row[f.name]} label={labels[f.name]?.get(String(row[f.name]))} compact />
                      </td>
                    ))}
                    <td className="muted nowrap">
                      <FieldValue field={{ name: "created_datetime_utc", label: "", type: "text" }} value={row.created_datetime_utc} />
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && !error && (
                <tr>
                  <td colSpan={listed.length + 3} className="muted">
                    {q || filters.length ? "No rows match." : "No rows yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {pages > 1 && (
        <nav className="pager" aria-label="Pages">
          {page > 1 ? <Link href={link({ page: String(page - 1) })} className="btn btn-ghost">← Prev</Link> : <span />}
          <span className="muted">
            Page {page.toLocaleString()} of {pages.toLocaleString()}
          </span>
          {page < pages ? <Link href={link({ page: String(page + 1) })} className="btn btn-ghost">Next →</Link> : <span />}
        </nav>
      )}
    </>
  );
}

function OpsBadges({ ops }: { ops: { create?: boolean; update?: boolean; delete?: boolean } }) {
  const list = ["Read", ops.create && "Create", ops.update && "Update", ops.delete && "Delete"].filter(Boolean);
  return (
    <p className="ops">
      {list.map((op) => (
        <span key={String(op)} className="chip">{op}</span>
      ))}
    </p>
  );
}
