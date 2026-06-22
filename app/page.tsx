export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Astro Consultancy
      </h1>
      <p className="max-w-md text-balance text-sm text-gray-500 dark:text-gray-400">
        Multi-tenant SaaS for astrology consultants — booking, scheduling &amp; payments.
        This is a scaffold; product features are not built yet.
      </p>
      <a
        className="rounded-full border border-black/10 px-4 py-2 text-sm transition-colors hover:bg-black/[.05] dark:border-white/20 dark:hover:bg-white/[.06]"
        href="/api/health"
      >
        Health check →
      </a>
    </main>
  );
}
