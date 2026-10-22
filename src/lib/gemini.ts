import "server-only";
import type { Theme } from "@/lib/captions";

// Tried in order: if the first model is unavailable or rate-limited, fall back to the next
const MODELS = [process.env.GEMINI_MODEL || "gemini-3.5-flash", "gemini-3.5-flash-lite"];

const CAPTION_COUNT = 4;

// Captions used to bolt campus references onto unrelated photos (e.g. "Columbia housing"
// on a picture of a random office tower). The model now lists what it actually sees first,
// every caption has to build on one of those details, and campus/theme references are
// only allowed when they genuinely fit the photo.
export function buildCaptionPrompt(vibeInstructions: string, theme: Theme) {
  return [
    "You write funny captions for photos posted to a humor site for Columbia University undergrads living in Morningside Heights, New York City.",
    `Style: ${vibeInstructions}`,
    `Today's theme is "${theme.name}". If (and only if) the photo plausibly fits it, these references can help: ${theme.context}. Many photos won't fit the theme; then ignore it completely.`,
    "Step 1: In `details`, list 3 to 5 specific, concrete things you can actually see in the photo (objects, setting, text, expressions).",
    `Step 2: In \`captions\`, write exactly ${CAPTION_COUNT} different captions.`,
    "Rules for captions:",
    "- Each caption must build its joke on at least one item from `details`, so anyone reading it next to the photo instantly sees why it belongs to THIS photo.",
    "- Never claim the photo shows a specific place (a Columbia dorm, Butler, John Jay, a dining hall) or situation unless the photo clearly shows it. Don't invent context the photo doesn't support.",
    "- A student point of view is welcome, but only use a Columbia, Morningside or theme reference when it connects naturally to what's in the photo. A sharp joke about the photo beats a forced campus reference.",
    "- No generic jokes that would work on any photo.",
    "- Under 140 characters each. No hashtags. No quotation marks around the caption.",
    "- Keep it clever, not mean: no jokes about anyone's appearance, race, gender, religion, or body.",
    "- Make each caption a different kind of joke.",
  ].join("\n");
}

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
};

export async function generateCaptions(image: { data: string; mimeType: string }, prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  let lastError = "Caption generation failed.";

  for (const model of MODELS) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inline_data: { mime_type: image.mimeType, data: image.data } },
                { text: prompt },
              ],
            },
          ],
          generationConfig: {
            temperature: 1.1,
            responseMimeType: "application/json",
            // details come first so the model looks at the photo before writing jokes
            responseSchema: {
              type: "OBJECT",
              properties: {
                details: { type: "ARRAY", items: { type: "STRING" } },
                captions: { type: "ARRAY", items: { type: "STRING" } },
              },
              required: ["details", "captions"],
              propertyOrdering: ["details", "captions"],
            },
          },
        }),
      }
    );

    const body = (await res.json().catch(() => ({}))) as GeminiResponse;

    if (!res.ok) {
      lastError = body.error?.message ?? `Gemini returned ${res.status}.`;
      // 404: model not available to this key; 429/5xx: try a lighter model
      if (res.status === 404 || res.status === 429 || res.status >= 500) continue;
      throw new Error(lastError);
    }

    if (body.promptFeedback?.blockReason) {
      throw new Error("That photo couldn't be captioned. Try a different one.");
    }

    const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      lastError = "The AI returned something unreadable. Try again.";
      continue;
    }

    const list = (parsed as { captions?: unknown } | null)?.captions;
    const captions = (Array.isArray(list) ? list : [])
      .filter((c): c is string => typeof c === "string")
      .map((c) => c.trim().replace(/^["“]|["”]$/g, ""))
      .filter((c) => c.length > 0 && c.length <= 300)
      .slice(0, CAPTION_COUNT);

    if (captions.length === 0) {
      lastError = "The AI didn't come up with any captions. Try again.";
      continue;
    }

    return { captions, model };
  }

  throw new Error(lastError);
}
