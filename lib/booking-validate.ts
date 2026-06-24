// Pure, client-safe booking validators (no server imports) — shared by the server cores in lib/booking.ts
// and the client BookingFlow for inline validation.

export interface IntakeQuestion {
  id: string;
  label: string;
  fieldType: string;
  requirement: string;
  options: string[];
}

// ─── Intake question shapes (client-safe; used by the builder + the public form + server cores) ──
export const QUESTION_FIELD_TYPES = ["short_text", "long_text", "select", "date", "email", "phone"] as const;
export type QuestionFieldType = (typeof QUESTION_FIELD_TYPES)[number];
export const QUESTION_REQUIREMENTS = ["required", "optional", "hidden"] as const;
export type QuestionRequirement = (typeof QUESTION_REQUIREMENTS)[number];
export const QUESTION_TYPE_LABELS: Record<QuestionFieldType, string> = {
  short_text: "Short text",
  long_text: "Paragraph",
  select: "Dropdown",
  date: "Date",
  email: "Email",
  phone: "Phone",
};

export interface QuestionInput {
  label: string;
  fieldType: QuestionFieldType;
  requirement: QuestionRequirement;
  options: string[]; // used by select
}

// Pure: keep only well-formed questions (non-empty label; select must have ≥1 option), in order.
export function sanitizeQuestions(raw: QuestionInput[]): QuestionInput[] {
  const out: QuestionInput[] = [];
  for (const q of raw) {
    const label = q.label.trim();
    if (!label) continue;
    const fieldType = (QUESTION_FIELD_TYPES as readonly string[]).includes(q.fieldType) ? q.fieldType : "short_text";
    const requirement = (QUESTION_REQUIREMENTS as readonly string[]).includes(q.requirement) ? q.requirement : "optional";
    const options = fieldType === "select" ? q.options.map((o) => o.trim()).filter(Boolean) : [];
    if (fieldType === "select" && options.length === 0) continue; // a dropdown with no options is dropped
    out.push({ label, fieldType, requirement, options });
  }
  return out;
}
export interface SeekerDetails {
  name: string;
  email: string;
  phone: string;
}

export function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}
export function isValidPhone(v: string): boolean {
  const digits = v.replace(/[^\d]/g, "");
  return /^\+?[\d\s-]+$/.test(v.trim()) && digits.length >= 8 && digits.length <= 15;
}

// Validate intake answers (keyed by question id) against the package's questions. Returns a map of
// questionId → error message; empty means valid. Hidden questions are skipped; required must be filled.
export function validateIntake(questions: IntakeQuestion[], answers: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const q of questions) {
    if (q.requirement === "hidden") continue;
    const raw = (answers[q.id] ?? "").toString().trim();
    if (!raw) {
      if (q.requirement === "required") errors[q.id] = "This field is required.";
      continue;
    }
    if (q.fieldType === "email" && !isValidEmail(raw)) errors[q.id] = "Enter a valid email address.";
    else if (q.fieldType === "phone" && !isValidPhone(raw)) errors[q.id] = "Enter a valid phone number.";
    else if (q.fieldType === "select" && q.options.length > 0 && !q.options.includes(raw)) errors[q.id] = "Choose one of the options.";
    else if (q.fieldType === "date" && Number.isNaN(Date.parse(raw))) errors[q.id] = "Enter a valid date.";
  }
  return errors;
}

export function validateSeeker(d: SeekerDetails): Record<string, string> {
  const e: Record<string, string> = {};
  if (!d.name.trim()) e.name = "Your name is required.";
  if (!isValidEmail(d.email)) e.email = "Enter a valid email address.";
  if (!isValidPhone(d.phone)) e.phone = "Enter a valid phone number.";
  return e;
}
