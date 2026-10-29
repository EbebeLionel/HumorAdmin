import Link from "next/link";
import { formatDate } from "@/lib/admin";
import { truncate } from "@/lib/records";
import type { Field } from "@/lib/resources";

type Props = {
  field: Field;
  value: unknown;
  label?: string; // resolved fk label
  compact?: boolean; // list cell: shorten long text
};

// Renders one column value: booleans as badges, refs as links, long text as a prompt block
export default function FieldValue({ field, value, label, compact }: Props) {
  if (value === null || value === undefined || value === "") {
    return <span className="muted">—</span>;
  }

  if (field.type === "boolean") {
    return value ? <span className="badge">Yes</span> : <span className="muted small">No</span>;
  }

  if (field.type === "fk" || field.type === "ref") {
    const text = label ?? (compact && typeof value === "string" && value.length > 12 ? `${value.slice(0, 8)}…` : String(value));
    return field.ref ? (
      <Link href={`/${field.ref}/${value}`} className="text-link" title={String(value)}>
        {text}
      </Link>
    ) : (
      <span>{text}</span>
    );
  }

  if (field.type === "longtext" || field.type === "textarea") {
    const text = String(value);
    return compact ? <span>{truncate(text)}</span> : <pre className="prompt-block">{text}</pre>;
  }

  if (field.name.endsWith("_datetime_utc")) {
    return <span>{formatDate(String(value), true)}</span>;
  }

  return <span>{String(value)}</span>;
}
