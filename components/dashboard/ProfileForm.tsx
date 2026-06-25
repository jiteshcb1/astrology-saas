"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { AiQuestionnaire, type AiAnswers, type AiStep } from "@/components/dashboard/AiQuestionnaire";
import { SPECIALITY_OPTIONS, type ProfileFormState } from "@/lib/consultant-profile";
import { updateProfileAction, generateProfileContentAction } from "@/app/dashboard/settings/actions";

export interface ProfileFormDefaults {
  displayName: string;
  bio: string;
  experience: string;
  specialities: string[];
  website: string;
  instagram: string;
  youtube: string;
  x: string;
  gstNumber: string;
  gstLegalName: string;
  complaintsContactNumber: string;
}

const textareaClass =
  "w-full rounded-control border border-line bg-white px-4 py-2.5 text-sm text-ink outline-none transition focus:border-marigold";

const PROFILE_STEPS: AiStep[] = [
  {
    id: "specialization",
    type: "multi",
    question: "What do you specialize in?",
    helper: "Pick all that apply.",
    options: ["Vedic / Jyotish", "Tarot", "Numerology", "Palmistry", "Vastu", "Prashna", "KP Astrology", "Lal Kitab", "Nadi Astrology", "Kundali / Birth Chart", "Matchmaking / Kundali Milan", "Gemstone & Remedies", "Muhurat / Timing", "Face Reading"],
  },
  { id: "years", type: "single", question: "How many years have you been practicing?", options: ["1-2", "3-5", "5-10", "10+", "20+"] },
  {
    id: "audience",
    type: "multi",
    question: "Who do you primarily help?",
    helper: "Pick all that apply.",
    options: ["Career & finance", "Relationships & marriage", "Health & wellbeing", "Spiritual growth", "Business decisions", "Marriage & matchmaking", "Education & students", "Family & children", "Wealth & investments", "Legal matters & disputes", "Foreign travel & settlement", "Job seekers & professionals"],
  },
  {
    id: "unique",
    type: "multi",
    question: "What makes your readings unique?",
    helper: "Pick all that apply.",
    options: ["Traditional Vedic methods", "Intuitive + classical blend", "Modern, practical approach", "Multilingual (Hindi/English)", "Focus on remedies & solutions", "Data-driven predictions", "Compassionate & non-judgmental", "Quick, actionable guidance", "Deep birth-chart analysis", "Honest, no sugar-coating", "Follow-up support after sessions"],
  },
  { id: "testimonials", type: "text", question: "What do your seekers say about working with you?", helper: "Add a couple of real lines — this makes your bio specific and trustworthy.", placeholder: "e.g. \"Vijay's guidance helped me avoid mistakes in my job search and land a role at CRISIL.\"", minLength: 50 },
  { id: "credentials", type: "text", question: "Any credentials or training to include?", helper: "Optional.", placeholder: "e.g. Trained under Pt. XYZ, ICAS certified", skippable: true },
  { id: "tone", type: "single", question: "What tone should your profile have?", options: ["Warm & approachable", "Professional & authoritative", "Spiritual & mystical", "Friendly & modern"] },
  { id: "language", type: "single", question: "Which language should we write your profile in?", helper: "Hinglish = a natural Hindi + English mix.", options: ["English", "Hindi", "Hinglish"] },
];

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-lg text-ink">{title}</h2>
      {hint ? <p className="mt-0.5 text-sm text-muted">{hint}</p> : null}
    </div>
  );
}

export function ProfileForm({ defaults, aiEnabled = false }: { defaults: ProfileFormDefaults; aiEnabled?: boolean }) {
  const [state, action, pending] = useActionState<ProfileFormState, FormData>(updateProfileAction, {});

  // AI can populate these, so they're controlled (other fields stay uncontrolled).
  const [bio, setBio] = useState(defaults.bio);
  const [experience, setExperience] = useState(defaults.experience);
  const [specialities, setSpecialities] = useState<string[]>(defaults.specialities);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiNotice, setAiNotice] = useState(false);

  async function onGenerate(answers: AiAnswers) {
    const res = await generateProfileContentAction(answers);
    if (!res.ok) return { ok: false as const };
    if (res.data.bio) setBio(res.data.bio);
    if (res.data.about) setExperience(res.data.about);
    if (res.data.specialities.length) setSpecialities(res.data.specialities);
    setAiNotice(true);
    return { ok: true as const };
  }

  return (
    <form action={action} className="space-y-5">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <SectionHeader title="Personal details" hint="What seekers see on your public booking page." />
          {aiEnabled && (
            <Button type="button" variant="ghost" className="shrink-0" onClick={() => setAiOpen(true)}>Generate with AI ✨</Button>
          )}
        </div>
        {aiNotice && <p className="mb-3 rounded-control bg-marigold/10 px-3 py-2 text-sm text-ink">✓ Generated — review and edit before saving.</p>}
        <div className="space-y-3">
          <Input name="displayName" label="Display name" defaultValue={defaults.displayName} placeholder="Pandit Ravi Sharma" required />
          <label className="block">
            <span className="mb-1.5 block text-sm text-muted">Bio <span className="text-muted/70">(short tagline)</span></span>
            <textarea name="bio" rows={2} value={bio} onChange={(e) => setBio(e.target.value)} className={textareaClass} placeholder="One warm line seekers see under your name…" required />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm text-muted">About <span className="text-muted/70">(your story)</span></span>
            <textarea name="experience" rows={6} value={experience} onChange={(e) => setExperience(e.target.value)} className={textareaClass} placeholder="Your background, approach and experience…" required />
          </label>
          <MultiSelect
            name="specialities"
            label="Specialities"
            options={SPECIALITY_OPTIONS}
            value={specialities}
            onChange={setSpecialities}
            placeholder="Select your specialities…"
          />
        </div>
      </Card>

      <Card>
        <SectionHeader
          title="Social details"
          hint="Optional — but consultants who add their socials get noticeably more bookings. Add the ones you're active on."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input name="website" label="Website" defaultValue={defaults.website} placeholder="https://…" />
          <Input name="instagram" label="Instagram" defaultValue={defaults.instagram} placeholder="https://instagram.com/…" />
          <Input name="youtube" label="YouTube" defaultValue={defaults.youtube} placeholder="https://youtube.com/…" />
          <Input name="x" label="X (Twitter)" defaultValue={defaults.x} placeholder="https://x.com/…" />
        </div>
      </Card>

      <Card>
        <SectionHeader title="Business details" hint="Used on receipts and shown for complaints/feedback." />
        <div className="space-y-3">
          <Input name="complaintsContactNumber" label="Complaints / feedback contact" defaultValue={defaults.complaintsContactNumber} placeholder="+91 98XXX XXXXX" required />
          <Input name="gstNumber" label="GST number (optional)" defaultValue={defaults.gstNumber} placeholder="22ABCDE1234F1Z5" />
          <Input name="gstLegalName" label="Registered business name (optional)" defaultValue={defaults.gstLegalName} placeholder="Auto-filled from your GSTIN once verification is connected" />
        </div>
      </Card>

      {state.error && <p className="text-sm text-terra">{state.error}</p>}
      {state.ok && <p className="text-sm text-green">Profile saved.</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </Button>

      {aiEnabled && (
        <AiQuestionnaire open={aiOpen} onClose={() => setAiOpen(false)} title="Generate your profile" generateLabel="Generate profile ✨" steps={PROFILE_STEPS} onGenerate={onGenerate} />
      )}
    </form>
  );
}
