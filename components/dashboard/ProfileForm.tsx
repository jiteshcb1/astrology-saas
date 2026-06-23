"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { SPECIALITY_OPTIONS, type ProfileFormState } from "@/lib/consultant-profile";
import { updateProfileAction } from "@/app/dashboard/settings/actions";

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

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-lg text-ink">{title}</h2>
      {hint ? <p className="mt-0.5 text-sm text-muted">{hint}</p> : null}
    </div>
  );
}

export function ProfileForm({ defaults }: { defaults: ProfileFormDefaults }) {
  const [state, action, pending] = useActionState<ProfileFormState, FormData>(updateProfileAction, {});

  return (
    <form action={action} className="space-y-5">
      {/* 1 — Personal details */}
      <Card>
        <SectionHeader title="Personal details" hint="What seekers see on your public booking page." />
        <div className="space-y-3">
          <Input name="displayName" label="Display name" defaultValue={defaults.displayName} placeholder="Pandit Ravi Sharma" required />
          <label className="block">
            <span className="mb-1.5 block text-sm text-muted">Bio</span>
            <textarea name="bio" rows={4} defaultValue={defaults.bio} className={textareaClass} placeholder="Tell seekers about your practice…" required />
          </label>
          <Input name="experience" label="Experience" defaultValue={defaults.experience} placeholder="e.g. 12 years in Vedic astrology" required />
          <MultiSelect
            name="specialities"
            label="Specialities"
            options={SPECIALITY_OPTIONS}
            defaultValue={defaults.specialities}
            placeholder="Select your specialities…"
          />
        </div>
      </Card>

      {/* 2 — Social details (optional, encouraged) */}
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

      {/* 3 — Business details (contact required; GST optional) */}
      <Card>
        <SectionHeader title="Business details" hint="Used on receipts and shown for complaints/feedback." />
        <div className="space-y-3">
          <Input
            name="complaintsContactNumber"
            label="Complaints / feedback contact"
            defaultValue={defaults.complaintsContactNumber}
            placeholder="+91 98XXX XXXXX"
            required
          />
          <Input
            name="gstNumber"
            label="GST number (optional)"
            defaultValue={defaults.gstNumber}
            placeholder="22ABCDE1234F1Z5"
          />
          <Input
            name="gstLegalName"
            label="Registered business name (optional)"
            defaultValue={defaults.gstLegalName}
            placeholder="Auto-filled from your GSTIN once verification is connected"
          />
        </div>
      </Card>

      {state.error && <p className="text-sm text-terra">{state.error}</p>}
      {state.ok && <p className="text-sm text-green">Profile saved.</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
