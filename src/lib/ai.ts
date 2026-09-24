import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/**
 * Thin wrapper around the Claude API for structured JSON outputs.
 * Everything that calls it has a deterministic fallback, so the app keeps
 * running (templates + keyword rules) when no API key is configured.
 */

export const aiEnabled = () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
export const aiModel = () => process.env.AI_MODEL || "claude-opus-5";

let client: Anthropic | null = null;
function getClient() {
  client ??= new Anthropic();
  return client;
}

export class AiUnavailable extends Error {}

/**
 * Ask Claude for a JSON object matching `schema`. `jsonSchema` is the JSON Schema
 * sent as the output format; `schema` validates what comes back.
 */
export async function generateJson<T>(opts: {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  jsonSchema: Record<string, unknown>;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<T> {
  if (!aiEnabled()) throw new AiUnavailable("ANTHROPIC_API_KEY not set");
  const response = await getClient().beta.messages.create({
    model: aiModel(),
    max_tokens: opts.maxTokens ?? 16000,
    // Server-side fallback: if a safety classifier declines, the API retries on
    // Anthropic's recommended fallback model instead of returning a refusal.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: {
      effort: opts.effort ?? "medium",
      format: { type: "json_schema", schema: opts.jsonSchema },
    },
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
  });
  if (response.stop_reason === "refusal") throw new Error("Claude declined the request");
  if (response.stop_reason === "max_tokens") throw new Error("Claude response was truncated");
  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return opts.schema.parse(JSON.parse(text));
}
