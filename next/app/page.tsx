export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
      <div className="max-w-2xl space-y-2 text-center">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Next.js preview</p>
        <h1 className="text-3xl font-semibold">Search Engine Analyzer</h1>
        <p className="text-base text-muted-foreground">
          This Next.js App Router shell mirrors the existing React Query and toast providers
          while delegating /api calls back to the Express backend during the migration.
        </p>
      </div>
    </main>
  )
}
