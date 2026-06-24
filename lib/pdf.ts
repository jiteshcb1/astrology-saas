// PDF adapter. STUB for SP-1.6: returns placeholder bytes so the receipt pipeline (record +
// storage + pdfUrl) works end-to-end. The real @react-pdf/renderer implementation drops in here
// later (reused by SP-4 consultation receipts + SP-6 profile export) with no billing-logic change.

export interface SubscriptionReceiptData {
  receiptNumber: string;
  orgName: string;
  issuedTo: string;
  gstNumber: string;
  legalName: string;
  amount: number; // paise
  currency: string;
  periodEnd: Date | null;
  issuedAt: Date;
}

export async function renderSubscriptionReceiptPdf(
  data: SubscriptionReceiptData,
): Promise<Uint8Array> {
  const lines = [
    `${data.legalName} — Subscription Receipt (PLACEHOLDER PDF)`,
    `Receipt: ${data.receiptNumber}`,
    `Issued to: ${data.issuedTo} (${data.orgName})`,
    `GST: ${data.gstNumber}`,
    `Amount: ${data.currency} ${(data.amount / 100).toFixed(2)}`,
    `Period end: ${data.periodEnd ? data.periodEnd.toISOString() : "—"}`,
    `Issued at: ${data.issuedAt.toISOString()}`,
  ];
  return new TextEncoder().encode(lines.join("\n"));
}

export interface ConsultationReceiptData {
  receiptNumber: string;
  consultantName: string; // issued BY (the consultant org)
  gstNumber: string; // consultant's GST (consultation → consultant GST)
  seekerName: string;
  packageTitle: string;
  amount: number; // paise
  currency: string;
  startsAt: Date | null;
  issuedAt: Date;
}

// STUB (SP-4.3): consultation receipt — consultant's GST, paid by the seeker. Real renderer drops in later.
export async function renderConsultationReceiptPdf(data: ConsultationReceiptData): Promise<Uint8Array> {
  const lines = [
    `${data.consultantName} — Consultation Receipt (PLACEHOLDER PDF)`,
    `Receipt: ${data.receiptNumber}`,
    `Paid by: ${data.seekerName}`,
    `Session: ${data.packageTitle}`,
    `When: ${data.startsAt ? data.startsAt.toISOString() : "—"}`,
    `GST: ${data.gstNumber || "—"}`,
    `Amount: ${data.currency} ${(data.amount / 100).toFixed(2)}`,
    `Issued at: ${data.issuedAt.toISOString()}`,
  ];
  return new TextEncoder().encode(lines.join("\n"));
}
