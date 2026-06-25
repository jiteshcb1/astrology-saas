import { SPECIALITY_OPTIONS } from "@/lib/consultant-profile";
import { QUESTION_FIELD_TYPES, QUESTION_REQUIREMENTS, type QuestionInput } from "@/lib/booking-validate";

// Google Gemini content assistant (SP-4.6). REST via fetch (no SDK — Workers-safe, mirrors lib/razorpay).
// The API key is read from process.env at call time and NEVER leaves the server. Every function fails
// gracefully (returns a result object, never throws) so a generation problem can't break a form.

const MODEL = "gemini-2.5-flash"; // current Flash (1.5 retired); fast + cheap, reliable free-tier availability
const BIO_MAX = 300;
const ABOUT_MAX = 2500;
const DESC_MAX = 6000;
const SPEC_MAX = 8;
const Q_MAX = 5;

export function isAiConfigured(): boolean {
  return Boolean(process.env.GOOGLE_AI_STUDIO_API_KEY);
}

// ── Pure helpers (exported for tests) ────────────────────────────────────────
export function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // Models sometimes wrap JSON in ```json fences — try to recover the first {...} block.
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function truncate(s: unknown, max: number): string {
  const str = typeof s === "string" ? s : "";
  return str.trim().slice(0, max);
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

// Keep only canonical specialities (case-insensitive match → canonical label), deduped, capped.
export function sanitizeSpecialities(input: unknown): string[] {
  const arr = asStringArray(input);
  const out: string[] = [];
  for (const raw of arr) {
    const match = SPECIALITY_OPTIONS.find((o) => o.toLowerCase() === raw.trim().toLowerCase());
    if (match && !out.includes(match)) out.push(match);
    if (out.length >= SPEC_MAX) break;
  }
  return out;
}

// Strip obviously unsafe HTML from AI output (defense-in-depth; consultant also reviews before saving).
export function stripUnsafeHtml(html: string): string {
  return html
    .replace(/<\s*(script|style|iframe|object|embed)[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}

// Coerce raw AI question objects into valid QuestionInput[] (drop malformed, cap count).
export function coerceQuestions(input: unknown): QuestionInput[] {
  if (!Array.isArray(input)) return [];
  const out: QuestionInput[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const label = truncate(o.label, 160);
    if (!label) continue;
    const fieldType = (QUESTION_FIELD_TYPES as readonly string[]).includes(String(o.fieldType))
      ? (o.fieldType as QuestionInput["fieldType"])
      : "short_text";
    const requirement = (QUESTION_REQUIREMENTS as readonly string[]).includes(String(o.requirement))
      ? (o.requirement as QuestionInput["requirement"])
      : "optional";
    const options = fieldType === "select" ? asStringArray(o.options).map((s) => s.trim()).filter(Boolean).slice(0, 8) : [];
    if (fieldType === "select" && options.length === 0) continue; // a dropdown needs options
    out.push({ label, fieldType, requirement, options });
    if (out.length >= Q_MAX) break;
  }
  return out;
}

function langLine(locale: string): string {
  if (locale === "hi") return "Write ALL output text in natural Hindi (Devanagari script).";
  if (locale === "hinglish") return "Write ALL output text in Hinglish — a natural conversational mix of Hindi and English, in Latin (Roman) script.";
  return "Write ALL output text in clear, natural English.";
}

// Map a questionnaire language choice ("English" | "Hindi" | "Hinglish") to a locale. null if unrecognized.
export function localeFromChoice(value: unknown): string | null {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "hinglish") return "hinglish";
  if (v === "hindi") return "hi";
  if (v === "english") return "en";
  return null;
}

// ── Gemini call (never throws) ───────────────────────────────────────────────
async function callGemini(prompt: string): Promise<unknown | null> {
  const key = process.env.GOOGLE_AI_STUDIO_API_KEY ?? "";
  if (!key) return null;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.7, maxOutputTokens: 2048 },
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    return safeParseJson(text);
  } catch {
    return null;
  }
}

const CONTEXT = "You are helping a consultant on an Indian astrology consulting platform write polished, warm, professional, trustworthy content. Avoid hype and false claims.";

export type GenResult<T> = { ok: true; data: T } | { ok: false };

// ── Profile generation ───────────────────────────────────────────────────────
export interface ProfileGen {
  bio: string;
  about: string;
  specialities: string[];
}

export async function generateProfileContent(answers: Record<string, unknown>, locale = "en"): Promise<GenResult<ProfileGen>> {
  const prompt = `${CONTEXT}
Based on the consultant's answers below, write their public profile.
${langLine(locale)}
Return ONLY a JSON object with exactly these keys:
- "bio": a single punchy tagline line (max 140 characters).
- "about": a warm 3-4 short paragraph "about me" (plain text, separate paragraphs with blank lines).
- "specialities": an array of 5-8 strings chosen ONLY from this allowed list (use the exact strings): ${JSON.stringify(SPECIALITY_OPTIONS)}.
Consultant's answers: ${JSON.stringify(answers)}`;
  const json = await callGemini(prompt);
  if (!json || typeof json !== "object") return { ok: false };
  const o = json as Record<string, unknown>;
  const bio = truncate(o.bio ?? o.tagline, BIO_MAX);
  const about = truncate(o.about ?? o.bio_long ?? o.description, ABOUT_MAX);
  const specialities = sanitizeSpecialities(o.specialities);
  if (!bio && !about) return { ok: false };
  return { ok: true, data: { bio, about, specialities } };
}

// ── Package description generation ───────────────────────────────────────────
export interface PackageGen {
  description: string;
  title: string;
}

export async function generatePackageContent(
  answers: Record<string, unknown>,
  ctx: { title?: string; durationLabel?: string },
  locale = "en",
): Promise<GenResult<PackageGen>> {
  const prompt = `${CONTEXT}
Write a consultation package (session) description.
Existing context — title: ${JSON.stringify(ctx.title ?? "")}, duration: ${JSON.stringify(ctx.durationLabel ?? "")}.
${langLine(locale)}
Return ONLY a JSON object with exactly these keys:
- "description": a 2-3 paragraph description as simple HTML using only <p>, <strong>, <em>, <ul>, <li>, <a> tags — cover what the session includes, who it's for, what they'll receive, and a warm closing line.
- "title": a concise session title (max 60 chars). If a title was already provided above, return that same title.
Consultant's answers: ${JSON.stringify(answers)}`;
  const json = await callGemini(prompt);
  if (!json || typeof json !== "object") return { ok: false };
  const o = json as Record<string, unknown>;
  const description = stripUnsafeHtml(truncate(o.description ?? o.html, DESC_MAX));
  const title = truncate(o.title, 60) || (ctx.title ?? "");
  if (!description) return { ok: false };
  return { ok: true, data: { description, title } };
}

// ── Intake question generation ───────────────────────────────────────────────
export async function generateIntakeQuestions(
  ctx: { title?: string; description?: string },
  locale = "en",
): Promise<GenResult<{ questions: QuestionInput[] }>> {
  const prompt = `${CONTEXT}
Generate 3-5 useful pre-booking intake questions for this session so the consultant can prepare.
Session title: ${JSON.stringify(ctx.title ?? "")}. Description: ${JSON.stringify(truncate(ctx.description, 1000))}.
${langLine(locale)}
Return ONLY a JSON object with key "questions": an array of objects, each with:
- "label": the question text.
- "fieldType": one of ${JSON.stringify(QUESTION_FIELD_TYPES)}.
- "requirement": one of ${JSON.stringify(QUESTION_REQUIREMENTS)}.
- "options": an array of strings (only for "select", otherwise []).
Prefer date for birth date, short_text for birth time/place, long_text for free questions.`;
  const json = await callGemini(prompt);
  if (!json || typeof json !== "object") return { ok: false };
  const questions = coerceQuestions((json as Record<string, unknown>).questions);
  if (questions.length === 0) return { ok: false };
  return { ok: true, data: { questions } };
}
