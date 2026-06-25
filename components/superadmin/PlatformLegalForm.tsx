"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { PLATFORM_DOC_LABELS, type PlatformDocType } from "@/lib/platform-legal";
import { savePlatformLegalAction } from "@/app/superadmin/legal/actions";

export interface PlatformDocDefault {
  docType: PlatformDocType;
  html: string;
  updatedAtISO: string | null;
}

const PUBLIC_PATH: Record<PlatformDocType, string> = {
  privacy: "/legal/privacy",
  terms_of_use: "/legal/terms-of-use",
  terms: "/legal/terms",
};

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

function DocEditor({ doc }: { doc: PlatformDocDefault }) {
  const [html, setHtml] = useState(doc.html);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setMsg(null);
    start(async () => {
      const r = await savePlatformLegalAction(doc.docType, html);
      setMsg(r.ok ? { ok: true, text: "Saved." } : { ok: false, text: r.error });
    });
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg text-ink">{PLATFORM_DOC_LABELS[doc.docType]}</h2>
        <a href={PUBLIC_PATH[doc.docType]} target="_blank" rel="noreferrer" className="text-sm text-terra underline">View public page →</a>
      </div>
      <div className="mt-3">
        <RichTextEditor value={html} onChange={setHtml} placeholder={`Write the platform ${PLATFORM_DOC_LABELS[doc.docType].toLowerCase()}…`} />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button type="button" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        {doc.updatedAtISO && <span className="text-xs text-muted">Last updated {fmtDate(doc.updatedAtISO)}</span>}
        {msg && <span className={`text-sm ${msg.ok ? "text-green" : "text-terra"}`}>{msg.text}</span>}
      </div>
    </Card>
  );
}

export function PlatformLegalForm({ docs }: { docs: PlatformDocDefault[] }) {
  return (
    <div className="space-y-5">
      {docs.map((d) => (
        <DocEditor key={d.docType} doc={d} />
      ))}
    </div>
  );
}
