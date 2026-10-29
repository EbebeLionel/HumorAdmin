import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { fkLabels, fkOptions, getRecord, imageUrl, listRecords, thumbUrl } from "@/lib/records";
import { getResource, isValidId, type Related } from "@/lib/resources";
import FieldValue from "@/components/FieldValue";
import RecordForm from "@/components/RecordForm";
import SubmitButton from "@/components/SubmitButton";
import { deleteRecord, updateRecord } from "../actions";

export const dynamic = "force-dynamic";

const RELATED_PREVIEW = 8;

// Detail view for one row: every field, linked records, and edit/delete when allowed
export default async function ResourceDetailPage({ params, searchParams }: PageProps<"/[resource]/[id]">) {
  const { resource: key, id } = await params;
  const resource = getResource(key);
  if (!resource || !isValidId(resource, id)) notFound();

  const { supabase } = await requireAdmin();
  const search = await searchParams;
  const editing = search.edit === "1" && resource.ops.update;
  const msg = typeof search.msg === "string" ? search.msg : null;
  const errorMsg = typeof search.error === "string" ? search.error : null;

  const { row, error } = await getRecord(supabase, resource, id);
  if (error) {
    return <p className="alert alert-error">Couldn&apos;t load this {resource.singular.toLowerCase()}: {error.message}</p>;
  }
  if (!row) notFound();

  const [labels, options, photo] = await Promise.all([
    fkLabels(supabase, resource, [row], false),
    editing ? fkOptions(supabase, resource) : Promise.resolve({}),
    resource.imageField ? imageUrl(supabase, row[resource.imageField]) : Promise.resolve(null),
  ]);

  const title =
    String(row.slug ?? row.term ?? row.name ?? row.apex_domain ?? row.email_address ?? "") ||
    [row.first_name, row.last_name].filter(Boolean).join(" ") ||
    `${resource.singular} ${resource.idType === "uuid" ? String(row.id).slice(0, 8) : `#${row.id}`}`;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">
            <Link href={`/${resource.key}`} className="text-link">
              {resource.icon} {resource.title}
            </Link>
          </p>
          <h1>{title}</h1>
          <p className="muted mono small">ID {String(row.id)}</p>
        </div>
        <div className="row-actions">
          {resource.ops.update &&
            (editing ? (
              <Link href={`/${resource.key}/${id}`} className="btn btn-ghost">Cancel</Link>
            ) : (
              <Link href={`/${resource.key}/${id}?edit=1`} className="btn">Edit</Link>
            ))}
          {resource.ops.delete && (
            <form action={deleteRecord.bind(null, resource.key, id)}>
              <SubmitButton
                className="btn btn-danger"
                pendingLabel="Deleting…"
                confirm={`Delete this ${resource.singular.toLowerCase()}? This can't be undone.`}
              >
                Delete
              </SubmitButton>
            </form>
          )}
        </div>
      </header>

      {msg && <p className="alert">{msg}</p>}
      {errorMsg && <p className="alert alert-error">{errorMsg}</p>}

      <div className={photo ? "detail" : undefined}>
        <section className="card">
          {editing ? (
            <>
              <h2>Edit {resource.singular.toLowerCase()}</h2>
              <RecordForm
                resource={resource}
                action={updateRecord.bind(null, resource.key, id)}
                row={row}
                options={options}
                submitLabel="Save changes"
              />
            </>
          ) : (
            <dl className="fields">
              {resource.fields.map((f) => (
                <FieldRow key={f.name} label={f.label}>
                  <FieldValue field={f} value={row[f.name]} label={labels[f.name]?.get(String(row[f.name]))} />
                </FieldRow>
              ))}
              <FieldRow label="Created">
                <FieldValue field={{ name: "created_datetime_utc", label: "", type: "text" }} value={row.created_datetime_utc} />
              </FieldRow>
              <FieldRow label="Modified">
                <FieldValue field={{ name: "modified_datetime_utc", label: "", type: "text" }} value={row.modified_datetime_utc} />
              </FieldRow>
              <FieldRow label="Created by">
                <FieldValue field={{ name: "created_by_user_id", label: "", type: "ref", ref: "users" }} value={row.created_by_user_id} />
              </FieldRow>
              <FieldRow label="Modified by">
                <FieldValue field={{ name: "modified_by_user_id", label: "", type: "ref", ref: "users" }} value={row.modified_by_user_id} />
              </FieldRow>
            </dl>
          )}
        </section>

        {photo && (
          <section className="card">
            <h2>Image</h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="" className="detail-photo" />
            <a href={photo} target="_blank" rel="noreferrer" className="text-link small">Open original ↗</a>
          </section>
        )}
      </div>

      {!editing &&
        resource.related?.map((rel) => <RelatedSection key={`${rel.resource}-${rel.column}`} supabase={supabase} rel={rel} id={id} />)}
    </>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

// A short table of rows in another resource that point at this one, with a link to all of them
async function RelatedSection({ supabase, rel, id }: { supabase: SupabaseClient; rel: Related; id: string }) {
  const resource = getResource(rel.resource);
  const field = resource?.fields.find((f) => f.name === rel.column);
  if (!resource || !field) return null;

  const { rows, count, error } = await listRecords(supabase, resource, {
    page: 1,
    filters: [{ field, value: id }],
  });
  const preview = rows.slice(0, RELATED_PREVIEW);
  const labels = await fkLabels(supabase, resource, preview);
  const listed = resource.fields.filter((f) => f.list && f.name !== rel.column);

  return (
    <section className="card">
      <div className="card-head">
        <h2>
          {resource.icon} {rel.title} <span className="muted small">({count.toLocaleString()})</span>
        </h2>
        {count > 0 && (
          <Link href={`/${resource.key}?f_${rel.column}=${encodeURIComponent(id)}`} className="text-link small">
            View all →
          </Link>
        )}
      </div>
      {error ? (
        <p className="alert alert-error">{error.message}</p>
      ) : preview.length === 0 ? (
        <p className="muted small">None.</p>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <tbody>
              {preview.map((row) => {
                const thumb = thumbUrl(resource, row);
                return (
                  <tr key={String(row.id)}>
                    {resource.thumb && (
                      <td className="thumb-cell">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {thumb ? <img src={thumb} alt="" loading="lazy" /> : <span className="muted">—</span>}
                      </td>
                    )}
                    <td>
                      <Link href={`/${resource.key}/${row.id}`} className="text-link mono">
                        {resource.idType === "uuid" ? `${String(row.id).slice(0, 8)}…` : String(row.id)}
                      </Link>
                    </td>
                    {listed.map((f) => (
                      <td key={f.name} className={f.type === "longtext" || f.type === "textarea" ? "wide" : undefined}>
                        <FieldValue field={f} value={row[f.name]} label={labels[f.name]?.get(String(row[f.name]))} compact />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
