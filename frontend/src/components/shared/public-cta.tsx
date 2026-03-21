import PublicButton from "@/components/ui/public-button";

export default function PublicCTA() {
  return (
    <section className="mx-auto max-w-5xl px-6 pb-20 pt-10 lg:px-8">
      <div className="rounded-[32px] border border-white/70 bg-white/80 p-8 text-center shadow-xl shadow-slate-200/60 backdrop-blur-xl lg:p-12">
        <h2 className="text-3xl font-bold tracking-tight text-slate-950">
          Bring Struktur in dein Unternehmen
        </h2>

        <p className="mt-4 text-base leading-7 text-slate-600">
          Starte mit Craft Flow und organisiere dein Team, deine Abläufe und
          deine Daten in einem klaren System – ohne komplizierte Einrichtung.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <PublicButton
            label="Jetzt kostenlos starten"
            variant="primary"
            size="lg"
          />
          <PublicButton
            label="Mehr erfahren"
            variant="secondary"
            size="lg"
          />
        </div>

        <p className="mt-6 text-sm text-slate-500">
          Keine Verpflichtung · Sofort startklar
        </p>
      </div>
    </section>
  );
}