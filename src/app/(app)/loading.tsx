export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="bg-line h-8 w-40 animate-pulse rounded-lg" />
      <div className="bg-line h-64 w-full animate-pulse rounded-2xl" />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-line h-32 animate-pulse rounded-2xl" />
        <div className="bg-line h-32 animate-pulse rounded-2xl" />
      </div>
    </div>
  );
}
