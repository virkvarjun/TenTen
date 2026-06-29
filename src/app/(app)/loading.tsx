export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-neutral-200" />
      <div className="h-64 w-full animate-pulse rounded-2xl bg-neutral-200" />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="h-32 animate-pulse rounded-2xl bg-neutral-200" />
        <div className="h-32 animate-pulse rounded-2xl bg-neutral-200" />
      </div>
    </div>
  );
}
