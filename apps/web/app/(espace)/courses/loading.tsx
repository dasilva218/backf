export default function ChargementCourses() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Chargement des courses">
      <div className="h-12 w-56 animate-pulse rounded-md bg-muted" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
