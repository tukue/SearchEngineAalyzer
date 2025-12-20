export default function Page() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-white px-6">
      <div className="max-w-2xl text-center space-y-6">
        <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
          Search Engine Analyzer
        </p>
        <h1 className="text-4xl font-extrabold sm:text-5xl">
          Next.js API Migration
        </h1>
        <p className="text-base leading-relaxed text-slate-300">
          The new Next.js runtime is live for the Analyze API. Keep running
          the legacy React + Express frontend for the full experience while we
          migrate the remaining endpoints.
        </p>
        <div className="inline-flex flex-col gap-3 text-sm text-slate-400">
          <span>Next.js 14 | Edge ready serverless routes</span>
          <span>Your existing React bundle continues to run from `/client`.</span>
        </div>
      </div>
    </main>
  );
}
