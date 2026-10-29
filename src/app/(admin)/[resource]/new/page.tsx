import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { fkOptions } from "@/lib/records";
import { getResource } from "@/lib/resources";
import RecordForm from "@/components/RecordForm";
import { createRecord } from "../actions";
import ImageUploadForm from "./ImageUploadForm";

export const dynamic = "force-dynamic";

export default async function NewResourcePage({ params, searchParams }: PageProps<"/[resource]/new">) {
  const { resource: key } = await params;
  const resource = getResource(key);
  if (!resource?.ops.create) notFound();

  const { supabase, user } = await requireAdmin();
  const { error } = await searchParams;
  const options = await fkOptions(supabase, resource);

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">
            <Link href={`/${resource.key}`} className="text-link">
              {resource.icon} {resource.title}
            </Link>
          </p>
          <h1>New {resource.singular.toLowerCase()}</h1>
        </div>
      </header>
      {typeof error === "string" && <p className="alert alert-error">{error}</p>}
      <section className="card narrow">
        {resource.key === "images" ? (
          <ImageUploadForm userId={user.id} />
        ) : (
          <RecordForm resource={resource} action={createRecord.bind(null, resource.key)} options={options} submitLabel="Create" />
        )}
      </section>
    </>
  );
}
