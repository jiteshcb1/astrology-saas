// Clean "page unavailable" state for a suspended consultant or an unknown slug — never a raw 404.
export function PublicOffline() {
  return (
    <div className="grid min-h-screen place-items-center bg-sand px-6">
      <div className="max-w-md rounded-card border border-line bg-white p-8 text-center shadow-[0_10px_30px_rgba(20,18,43,0.06)]">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-sand-2 text-marigold">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5M12 16h.01" strokeLinecap="round" />
          </svg>
        </div>
        <h1 className="font-display text-2xl text-ink">Page unavailable</h1>
        <p className="mt-2 text-sm text-muted">
          This booking page isn&apos;t available right now. Please check the link, or try again later.
        </p>
      </div>
    </div>
  );
}
