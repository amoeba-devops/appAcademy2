export function FormHero({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: React.ReactNode;
}) {
  return (
    <section className="bg-navy px-4 py-16 text-center text-cream sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">
          {eyebrow}
        </p>
        <h1 className="mt-4 font-display text-2xl font-bold leading-snug text-cream sm:text-3xl lg:text-4xl">
          {title}
        </h1>
      </div>
    </section>
  );
}
