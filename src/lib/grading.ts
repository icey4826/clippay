// Damage grading: one vision call -> strict, validated JSON.
// The model only describes what it sees. Money decisions happen in the rules engine.

import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";

export const DEFECT_TYPES = [
  "crack",
  "chip",
  "scratch",
  "dent",
  "stain",
  "tear",
  "broken_part",
  "missing_part",
  "discoloration",
  "water_damage",
  "other",
] as const;

// Ordered least -> most severe; the rules engine maps these to refund bands.
export const SEVERITIES = ["none", "cosmetic", "minor", "moderate", "severe", "unusable"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const DefectSchema = z.object({
  type: z.enum(DEFECT_TYPES),
  location: z.string().describe("Where on the item, e.g. 'rim, near handle' or 'bottom-left corner of screen'"),
  severity: z.enum(SEVERITIES).exclude(["none"]),
  description: z.string().describe("One short sentence describing the visible damage"),
});

export const GradeSchema = z.object({
  photo_usable: z
    .boolean()
    .describe("False if the item or damage can't be judged (blurry, too dark, item not visible)"),
  looks_like_real_photo: z
    .boolean()
    .describe("False if this looks like a screenshot, drawing, render, stock/catalog image or photo of a screen"),
  item_seen: z.string().describe("What item is in the photo, in a few words"),
  matches_claimed_item: z.boolean().describe("Whether the photo plausibly shows the claimed product"),
  verification_code_read: z
    .string()
    .nullable()
    .describe("The handwritten or on-screen verification code exactly as visible in the photo, or null if none"),
  defects: z.array(DefectSchema).describe("Every distinct visible defect; empty if none"),
  overall_severity: z.enum(SEVERITIES),
  functional_impact: z
    .enum(["none", "partial", "total"])
    .describe("Does the damage stop the item from doing its job?"),
  confidence: z.enum(["low", "medium", "high"]),
  reviewer_note: z.string().describe("Anything a human reviewer should know; empty string if nothing"),
});

export type Grade = z.infer<typeof GradeSchema>;

export interface ClaimContext {
  productName: string;
  buyerDescription?: string;
  expectedCode?: string; // the live-capture code we showed the buyer
}

export interface ImageInput {
  data: string; // base64, no data: prefix
  mimeType: "image/jpeg" | "image/png" | "image/webp";
}

export interface GradeResult {
  grade: Grade;
  codeMatches: boolean | null; // null when no code was expected
  model: string;
  latencyMs: number;
}

const SYSTEM_PROMPT = `You inspect photos of damaged products for a refund claims service.
Describe only what is visible. Do not guess at damage you can't see, and do not take the buyer's description as proof.

Severity scale (use the worst visible defect for overall_severity):
- none: no visible damage
- cosmetic: only noticeable up close; doesn't affect use or how it looks in normal use
- minor: clearly visible but small; item fully works
- moderate: obvious damage that affects appearance or makes use less pleasant
- severe: major damage; item works only partly or poorly
- unusable: broken, unsafe, or can't be used for its purpose

Confidence: high only when the damage and item are clearly visible. Use low if lighting, angle or blur hides detail.
If the buyer's description claims damage you can't see, say so in reviewer_note.
Check whether this is a genuine camera photo of a physical item. Stock images, product renders, drawings, screenshots and photos of a screen are not.
If a short code is written on paper or shown on a screen in the photo, copy it exactly into verification_code_read.`;

// 3.5 Flash: ~5s per grade on the free tier; newer Flash models were 30-120s under load (Oct 2026).
const DEFAULT_MODEL = "gemini-3.5-flash";
const RETRYABLE = new Set([429, 500, 503]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export class DamageGrader {
  private ai: GoogleGenAI;
  readonly model: string;
  readonly thinkingLevel: ThinkingLevel;

  constructor(opts: { apiKey: string; model?: string; thinkingLevel?: ThinkingLevel }) {
    if (!opts.apiKey) throw new Error("GEMINI_API_KEY is required");
    this.ai = new GoogleGenAI({ apiKey: opts.apiKey });
    this.model = opts.model || DEFAULT_MODEL;
    this.thinkingLevel = opts.thinkingLevel ?? ThinkingLevel.LOW;
  }

  // Free tier often answers 429/503 under load; back off and retry a few times.
  private async withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
    for (let i = 1; ; i++) {
      try {
        return await fn();
      } catch (err) {
        if (!(err instanceof ApiError) || !RETRYABLE.has(err.status) || i >= attempts) throw err;
        await sleep(2000 * 2 ** (i - 1) + Math.random() * 1000);
      }
    }
  }

  async grade(images: ImageInput[], claim: ClaimContext): Promise<GradeResult> {
    if (images.length === 0) throw new Error("At least one photo is required");

    const claimText = [
      `Claimed product: ${claim.productName}`,
      claim.buyerDescription ? `Buyer's description: ${claim.buyerDescription}` : null,
      `Photos attached: ${images.length}. Grade the damage across all of them.`,
    ]
      .filter(Boolean)
      .join("\n");

    const started = Date.now();
    const res = await this.withRetry(() => this.ai.models.generateContent({
      model: this.model,
      contents: [
        {
          role: "user",
          parts: [...images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.data } })), { text: claimText }],
        },
      ],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0,
        responseMimeType: "application/json",
        responseJsonSchema: z.toJSONSchema(GradeSchema),
        // Grading is a look-and-describe task; low thinking keeps it fast and steady.
        thinkingConfig: { thinkingLevel: this.thinkingLevel },
      },
    }));
    const latencyMs = Date.now() - started;

    const text = res.text;
    if (!text) {
      const reason = res.candidates?.[0]?.finishReason ?? res.promptFeedback?.blockReason ?? "unknown";
      throw new Error(`Model returned no output (reason: ${reason})`);
    }
    // Validate even though the API enforces the schema: never trust unchecked JSON near money.
    const grade = GradeSchema.parse(JSON.parse(text));

    const codeMatches =
      claim.expectedCode === undefined
        ? null
        : grade.verification_code_read !== null &&
          normalizeCode(grade.verification_code_read) === normalizeCode(claim.expectedCode);

    return { grade, codeMatches, model: this.model, latencyMs };
  }
}

export function graderFromEnv(env: Record<string, string | undefined> = process.env): DamageGrader {
  const level = env.GEMINI_THINKING_LEVEL?.toUpperCase();
  return new DamageGrader({
    apiKey: env.GEMINI_API_KEY ?? "",
    model: env.GEMINI_MODEL,
    thinkingLevel: level && level in ThinkingLevel ? (level as ThinkingLevel) : undefined,
  });
}
