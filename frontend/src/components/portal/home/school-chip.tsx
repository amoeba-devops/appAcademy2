export function SchoolChip({
  name,
  region,
}: {
  name: string;
  region: string;
}) {
  return (
    <div
      className="flex aspect-video items-center justify-center rounded-xl border border-slate-200 bg-white p-4 text-center"
      role="img"
      aria-label={`${name} ${region}`}
    >
      <div>
        <div className="font-display text-lg font-bold tracking-[0.15em] text-slate-600 sm:text-xl">
          {name}
        </div>
        <div className="mt-1 text-[10px] font-medium tracking-[0.2em] text-slate-400 sm:text-xs">
          {region}
        </div>
      </div>
    </div>
  );
}
