export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 py-8 text-center">
      <p className="text-sm uppercase tracking-[0.4em] text-muted-foreground">
        404
      </p>
      <h1 className="text-3xl font-semibold text-foreground">Page not found</h1>
      <p className="max-w-xl text-base text-foreground/70">
        The page you are trying to access doesn’t exist or has been moved.
        Return to the homepage to continue exploring the Meta Tag Analyzer.
      </p>
    </div>
  );
}
