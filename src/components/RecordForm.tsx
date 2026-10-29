import type { Resource } from "@/lib/resources";
import type { Row } from "@/lib/records";
import SubmitButton from "./SubmitButton";

type Props = {
  resource: Resource;
  action: (formData: FormData) => Promise<void>;
  row?: Row | null;
  options: Record<string, { value: string; label: string }[]>;
  submitLabel: string;
};

// Create/edit form built from the resource's editable fields
export default function RecordForm({ resource, action, row, options, submitLabel }: Props) {
  const fields = resource.fields.filter((f) => f.editable);

  return (
    <form action={action} className="form">
      {fields.map((field) => {
        const current = row?.[field.name];
        const value = current === null || current === undefined ? "" : String(current);
        const label = (
          <>
            {field.label}
            {field.required && <span className="required"> *</span>}
          </>
        );

        if (field.type === "boolean") {
          return (
            <label key={field.name} className="check">
              <input type="checkbox" name={field.name} defaultChecked={Boolean(current)} />
              {label}
            </label>
          );
        }

        return (
          <label key={field.name} className="field">
            <span>{label}</span>
            {field.type === "fk" ? (
              <select name={field.name} defaultValue={value} className="input" required={field.required}>
                <option value="">{field.required ? "Choose…" : "None"}</option>
                {(options[field.name] ?? []).map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : field.type === "textarea" || field.type === "longtext" ? (
              <textarea name={field.name} defaultValue={value} className="input" rows={4} required={field.required} />
            ) : (
              <input
                name={field.name}
                defaultValue={value}
                className="input"
                type={field.type === "number" ? "number" : field.name === "email_address" ? "email" : "text"}
                step={field.type === "number" ? "any" : undefined}
                required={field.required}
              />
            )}
            {field.hint && <span className="muted small">{field.hint}</span>}
          </label>
        );
      })}
      <SubmitButton pendingLabel="Saving…">{submitLabel}</SubmitButton>
    </form>
  );
}
