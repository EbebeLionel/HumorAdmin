// One entry per database table the admin panel manages. The generic pages in
// src/app/(admin)/[resource] render list, detail, create and edit screens from these,
// and the server actions only ever write the fields marked `editable` here.

export type FieldType = "text" | "textarea" | "longtext" | "number" | "boolean" | "fk" | "ref";

export type Field = {
  name: string;
  label: string;
  type: FieldType;
  list?: boolean; // show as a column on the list page
  editable?: boolean; // part of the create/edit form
  required?: boolean;
  // fk: a small lookup table shown as a dropdown, displayed by its label column
  fk?: { table: string; label: string };
  // fk / ref: the admin resource the value points to, so it renders as a link
  ref?: string;
  hint?: string;
};

export type Related = { resource: string; column: string; title: string };

export type Resource = {
  key: string;
  table: string;
  title: string;
  singular: string;
  icon: string;
  group: string;
  description: string;
  idType: "number" | "uuid";
  order: { column: string; ascending: boolean }[];
  search?: string[];
  ops: { create?: boolean; update?: boolean; delete?: boolean };
  // "estimated" for big tables, where an exact count would be slow
  count: "exact" | "estimated";
  fields: Field[];
  related?: Related[];
  imageField?: string; // a column holding an images.id to preview on the detail page
  // thumbnail on the list page: this row's own url column, or the linked image's url
  thumb?: "url" | "images.url";
  // lowercases these fields before saving (emails, domains)
  lowercase?: string[];
};

const NEWEST = [{ column: "created_datetime_utc", ascending: false }];

export const RESOURCES: Resource[] = [
  {
    key: "users",
    table: "profiles",
    title: "Users",
    singular: "User",
    icon: "👥",
    group: "People & access",
    description: "Every profile. Read-only: people manage their own profiles in the app.",
    idType: "uuid",
    order: NEWEST,
    search: ["first_name", "last_name", "email"],
    ops: {},
    count: "exact",
    fields: [
      { name: "first_name", label: "First name", type: "text", list: true },
      { name: "last_name", label: "Last name", type: "text", list: true },
      { name: "email", label: "Email", type: "text", list: true },
      { name: "is_superadmin", label: "Superadmin", type: "boolean", list: true },
      { name: "is_matrix_admin", label: "Matrix admin", type: "boolean" },
      { name: "is_in_study", label: "In study", type: "boolean", list: true },
    ],
    related: [
      { resource: "images", column: "profile_id", title: "Images" },
      { resource: "captions", column: "profile_id", title: "Captions" },
      { resource: "caption-requests", column: "profile_id", title: "Generation requests" },
      { resource: "votes", column: "profile_id", title: "Votes" },
    ],
  },
  {
    key: "signup-domains",
    table: "allowed_signup_domains",
    title: "Allowed signup domains",
    singular: "Signup domain",
    icon: "🌐",
    group: "People & access",
    description: "Email domains (e.g. columbia.edu) whose users may sign up.",
    idType: "number",
    order: [{ column: "apex_domain", ascending: true }],
    search: ["apex_domain"],
    ops: { create: true, update: true, delete: true },
    count: "exact",
    lowercase: ["apex_domain"],
    fields: [
      {
        name: "apex_domain",
        label: "Apex domain",
        type: "text",
        list: true,
        editable: true,
        required: true,
        hint: "Domain only, no @ — e.g. columbia.edu",
      },
    ],
  },
  {
    key: "whitelist",
    table: "whitelist_email_addresses",
    title: "Whitelisted emails",
    singular: "Whitelisted email",
    icon: "✉️",
    group: "People & access",
    description: "Individual addresses allowed in even when their domain isn't.",
    idType: "number",
    order: [{ column: "email_address", ascending: true }],
    search: ["email_address"],
    ops: { create: true, update: true, delete: true },
    count: "exact",
    lowercase: ["email_address"],
    fields: [
      { name: "email_address", label: "Email address", type: "text", list: true, editable: true, required: true },
    ],
  },
  {
    key: "images",
    table: "images",
    title: "Images",
    singular: "Image",
    icon: "🖼️",
    group: "Content",
    description: "Uploaded photos that captions are generated for.",
    idType: "uuid",
    order: NEWEST,
    search: ["image_description", "additional_context"],
    ops: { create: true, update: true, delete: true },
    count: "estimated",
    imageField: "id",
    thumb: "url",
    fields: [
      { name: "url", label: "URL", type: "text", editable: true, required: true },
      { name: "image_description", label: "Description", type: "textarea", list: true, editable: true },
      { name: "additional_context", label: "Additional context", type: "textarea", editable: true },
      { name: "celebrity_recognition", label: "Celebrity recognition", type: "textarea", editable: true },
      { name: "is_public", label: "Public", type: "boolean", list: true, editable: true },
      { name: "is_common_use", label: "Common use", type: "boolean", list: true, editable: true },
      { name: "profile_id", label: "Uploaded by", type: "ref", ref: "users" },
    ],
    related: [
      { resource: "captions", column: "image_id", title: "Captions" },
      { resource: "caption-requests", column: "image_id", title: "Generation requests" },
      { resource: "caption-examples", column: "image_id", title: "Caption examples" },
    ],
  },
  {
    key: "captions",
    table: "captions",
    title: "AI captions",
    singular: "Caption",
    icon: "💬",
    group: "Content",
    description: "AI generated captions, the media users vote on.",
    idType: "uuid",
    order: NEWEST,
    search: ["content"],
    ops: {},
    count: "estimated",
    imageField: "image_id",
    thumb: "images.url",
    fields: [
      { name: "content", label: "Caption", type: "longtext", list: true },
      { name: "like_count", label: "Likes", type: "number", list: true },
      { name: "humor_flavor_id", label: "Humor flavor", type: "fk", fk: { table: "humor_flavors", label: "slug" }, ref: "humor-flavors", list: true },
      { name: "is_public", label: "Public", type: "boolean" },
      { name: "is_featured", label: "Featured", type: "boolean" },
      { name: "image_id", label: "Image", type: "ref", ref: "images" },
      { name: "caption_request_id", label: "Generation request", type: "ref", ref: "caption-requests" },
      { name: "llm_prompt_chain_id", label: "Prompt chain run", type: "ref", ref: "prompt-chains" },
      { name: "profile_id", label: "Requested by", type: "ref", ref: "users" },
    ],
    related: [{ resource: "votes", column: "caption_id", title: "Votes" }],
  },
  {
    key: "votes",
    table: "caption_votes",
    title: "Caption votes",
    singular: "Vote",
    icon: "🗳️",
    group: "Content",
    description: "Every rating users gave a caption.",
    idType: "number",
    order: NEWEST,
    ops: {},
    count: "estimated",
    fields: [
      { name: "vote_value", label: "Vote", type: "number", list: true },
      { name: "caption_id", label: "Caption", type: "ref", ref: "captions", list: true },
      { name: "profile_id", label: "Voter", type: "ref", ref: "users", list: true },
      { name: "is_from_study", label: "From study", type: "boolean", list: true },
    ],
  },
  {
    key: "humor-flavors",
    table: "humor_flavors",
    title: "Prompt chains",
    singular: "Prompt chain (humor flavor)",
    icon: "⛓️",
    group: "Prompt pipeline",
    description: "Humor flavors: each one is a chain of LLM prompt steps that turns an image into captions.",
    idType: "number",
    order: [{ column: "id", ascending: true }],
    search: ["slug", "description"],
    ops: {},
    count: "exact",
    fields: [
      { name: "slug", label: "Slug", type: "text", list: true },
      { name: "description", label: "Description", type: "longtext", list: true },
      { name: "is_pinned", label: "Pinned", type: "boolean", list: true },
    ],
    related: [
      { resource: "flavor-steps", column: "humor_flavor_id", title: "Steps" },
      { resource: "flavor-mix", column: "humor_flavor_id", title: "Mix" },
      { resource: "captions", column: "humor_flavor_id", title: "Captions" },
    ],
  },
  {
    key: "flavor-steps",
    table: "humor_flavor_steps",
    title: "Prompt chain steps",
    singular: "Prompt chain step",
    icon: "🪜",
    group: "Prompt pipeline",
    description: "Each step's model, prompts and input/output types, run in order_by order.",
    idType: "number",
    order: [
      { column: "humor_flavor_id", ascending: true },
      { column: "order_by", ascending: true },
    ],
    search: ["description", "llm_system_prompt", "llm_user_prompt"],
    ops: {},
    count: "exact",
    fields: [
      { name: "humor_flavor_id", label: "Prompt chain", type: "fk", fk: { table: "humor_flavors", label: "slug" }, ref: "humor-flavors", list: true },
      { name: "order_by", label: "Order", type: "number", list: true },
      { name: "humor_flavor_step_type_id", label: "Step type", type: "fk", fk: { table: "humor_flavor_step_types", label: "slug" }, list: true },
      { name: "llm_model_id", label: "Model", type: "fk", fk: { table: "llm_models", label: "name" }, ref: "llm-models", list: true },
      { name: "llm_input_type_id", label: "Input", type: "fk", fk: { table: "llm_input_types", label: "slug" }, list: true },
      { name: "llm_output_type_id", label: "Output", type: "fk", fk: { table: "llm_output_types", label: "slug" }, list: true },
      { name: "llm_temperature", label: "Temperature", type: "number" },
      { name: "description", label: "Description", type: "longtext" },
      { name: "llm_system_prompt", label: "System prompt", type: "longtext" },
      { name: "llm_user_prompt", label: "User prompt", type: "longtext" },
    ],
    related: [{ resource: "llm-responses", column: "humor_flavor_step_id", title: "LLM responses" }],
  },
  {
    key: "flavor-mix",
    table: "humor_flavor_mix",
    title: "Prompt chain mix",
    singular: "Mix entry",
    icon: "🎛️",
    group: "Prompt pipeline",
    description: "How many captions each prompt chain contributes per generation request.",
    idType: "number",
    order: [{ column: "humor_flavor_id", ascending: true }],
    ops: { update: true },
    count: "exact",
    fields: [
      { name: "humor_flavor_id", label: "Prompt chain", type: "fk", fk: { table: "humor_flavors", label: "slug" }, ref: "humor-flavors", list: true },
      { name: "caption_count", label: "Captions per request", type: "number", list: true, editable: true, required: true },
    ],
  },
  {
    key: "terms",
    table: "terms",
    title: "Terms",
    singular: "Term",
    icon: "📖",
    group: "Prompt pipeline",
    description: "Slang and campus vocabulary fed to the prompts.",
    idType: "number",
    order: [
      { column: "priority", ascending: false },
      { column: "term", ascending: true },
    ],
    search: ["term", "definition", "example"],
    ops: { create: true, update: true, delete: true },
    count: "exact",
    fields: [
      { name: "term", label: "Term", type: "text", list: true, editable: true, required: true },
      { name: "definition", label: "Definition", type: "textarea", list: true, editable: true, required: true },
      { name: "example", label: "Example", type: "textarea", editable: true, required: true },
      { name: "term_type_id", label: "Type", type: "fk", fk: { table: "term_types", label: "name" }, list: true, editable: true },
      { name: "priority", label: "Priority", type: "number", list: true, editable: true, required: true, hint: "Higher shows first" },
    ],
  },
  {
    key: "caption-examples",
    table: "caption_examples",
    title: "Generation examples",
    singular: "Caption example",
    icon: "✨",
    group: "Prompt pipeline",
    description: "Few-shot examples of great captions that steer the AI.",
    idType: "number",
    order: [
      { column: "priority", ascending: false },
      { column: "id", ascending: false },
    ],
    search: ["caption", "image_description", "explanation"],
    ops: { create: true, update: true, delete: true },
    count: "exact",
    imageField: "image_id",
    fields: [
      { name: "image_description", label: "Image description", type: "textarea", list: true, editable: true, required: true },
      { name: "caption", label: "Caption", type: "textarea", list: true, editable: true, required: true },
      { name: "explanation", label: "Why it works", type: "textarea", editable: true, required: true },
      { name: "priority", label: "Priority", type: "number", list: true, editable: true, required: true },
      { name: "image_id", label: "Image ID", type: "ref", ref: "images", editable: true, hint: "Optional: an images.id (UUID)" },
    ],
  },
  {
    key: "llm-providers",
    table: "llm_providers",
    title: "LLM providers",
    singular: "LLM provider",
    icon: "🏢",
    group: "LLMs",
    description: "Companies whose models the pipeline calls.",
    idType: "number",
    order: [{ column: "name", ascending: true }],
    search: ["name"],
    ops: { create: true, update: true, delete: true },
    count: "exact",
    fields: [{ name: "name", label: "Name", type: "text", list: true, editable: true, required: true }],
    related: [{ resource: "llm-models", column: "llm_provider_id", title: "Models" }],
  },
  {
    key: "llm-models",
    table: "llm_models",
    title: "LLM models",
    singular: "LLM model",
    icon: "🧠",
    group: "LLMs",
    description: "Models available to prompt chain steps.",
    idType: "number",
    order: [{ column: "name", ascending: true }],
    search: ["name", "provider_model_id"],
    ops: { create: true, update: true, delete: true },
    count: "exact",
    fields: [
      { name: "name", label: "Name", type: "text", list: true, editable: true, required: true },
      { name: "llm_provider_id", label: "Provider", type: "fk", fk: { table: "llm_providers", label: "name" }, ref: "llm-providers", list: true, editable: true, required: true },
      { name: "provider_model_id", label: "Provider model ID", type: "text", list: true, editable: true, required: true, hint: "The ID the provider's API expects, e.g. gpt-4.1-mini" },
      { name: "is_temperature_supported", label: "Supports temperature", type: "boolean", list: true, editable: true },
    ],
    related: [
      { resource: "flavor-steps", column: "llm_model_id", title: "Used by steps" },
      { resource: "llm-responses", column: "llm_model_id", title: "Responses" },
    ],
  },
  {
    key: "caption-requests",
    table: "caption_requests",
    title: "Generation requests",
    singular: "Generation request",
    icon: "📨",
    group: "Observability",
    description: "Every request to generate captions for an image.",
    idType: "number",
    order: [{ column: "id", ascending: false }],
    ops: {},
    count: "estimated",
    imageField: "image_id",
    fields: [
      { name: "image_id", label: "Image", type: "ref", ref: "images", list: true },
      { name: "profile_id", label: "Requested by", type: "ref", ref: "users", list: true },
    ],
    related: [
      { resource: "prompt-chains", column: "caption_request_id", title: "Prompt chain runs" },
      { resource: "llm-responses", column: "caption_request_id", title: "LLM responses" },
      { resource: "captions", column: "caption_request_id", title: "Captions produced" },
    ],
  },
  {
    key: "prompt-chains",
    table: "llm_prompt_chains",
    title: "Prompt chain runs",
    singular: "Prompt chain run",
    icon: "🔗",
    group: "Observability",
    description: "One row per prompt chain executed for a generation request.",
    idType: "number",
    order: [{ column: "id", ascending: false }],
    ops: {},
    count: "estimated",
    fields: [{ name: "caption_request_id", label: "Generation request", type: "ref", ref: "caption-requests", list: true }],
    related: [
      { resource: "llm-responses", column: "llm_prompt_chain_id", title: "LLM responses" },
      { resource: "captions", column: "llm_prompt_chain_id", title: "Captions" },
    ],
  },
  {
    key: "llm-responses",
    table: "llm_model_responses",
    title: "LLM responses",
    singular: "LLM response",
    icon: "📜",
    group: "Observability",
    description: "Raw model output for every step, with the exact prompts and timing.",
    idType: "uuid",
    order: NEWEST,
    search: ["llm_model_response"],
    ops: {},
    count: "estimated",
    fields: [
      { name: "llm_model_id", label: "Model", type: "fk", fk: { table: "llm_models", label: "name" }, ref: "llm-models", list: true },
      { name: "humor_flavor_id", label: "Prompt chain", type: "fk", fk: { table: "humor_flavors", label: "slug" }, ref: "humor-flavors", list: true },
      { name: "processing_time_seconds", label: "Seconds", type: "number", list: true },
      { name: "llm_model_response", label: "Response", type: "longtext", list: true },
      { name: "caption_request_id", label: "Generation request", type: "ref", ref: "caption-requests", list: true },
      { name: "humor_flavor_step_id", label: "Step", type: "ref", ref: "flavor-steps" },
      { name: "llm_prompt_chain_id", label: "Prompt chain run", type: "ref", ref: "prompt-chains" },
      { name: "llm_temperature", label: "Temperature", type: "number" },
      { name: "llm_system_prompt", label: "System prompt", type: "longtext" },
      { name: "llm_user_prompt", label: "User prompt", type: "longtext" },
      { name: "profile_id", label: "Requested by", type: "ref", ref: "users" },
    ],
  },
];

export const GROUPS = ["Content", "Prompt pipeline", "LLMs", "Observability", "People & access"];

export function getResource(key: string) {
  return RESOURCES.find((r) => r.key === key);
}

export function isValidId(resource: Resource, id: string) {
  return resource.idType === "uuid"
    ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    : /^\d{1,18}$/.test(id);
}

// Storage bucket the Crackd schema uses for uploaded photos
export const IMAGES_BUCKET = "images";
