import PublicButton from "@/components/ui/public-button";

export default function PublicHero() {
  return (
    <section className="mx-auto grid max-w-7xl gap-16 px-6 py-20 lg:grid-cols-2 lg:px-8 lg:py-28">
      <div className="flex flex-col justify-center">
        <div className="inline-flex w-fit items-center rounded-full border border-indigo-100 bg-white/80 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-700 shadow-sm">
          Für moderne Unternehmen
        </div>

        <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-tight tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
          Endlich Ordnung im Unternehmen – ohne komplizierte Software.
        </h1>

        <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
          Verwalte Mitarbeiter, Arbeitszeiten, Urlaube und Rechnungen in einem
          klaren System, das dein Team sofort versteht – ohne Schulung und ohne
          Chaos.
        </p>

        <p className="mt-4 text-sm font-medium text-slate-500">
          Keine Schulung. Kein Chaos. Kein unnötiger Aufwand.
        </p>

        <div className="mt-8 flex flex-wrap gap-4">
          <PublicButton
            label="Jetzt kostenlos starten"
            variant="primary"
            size="lg"
          />
          <PublicButton
            label="Demo ansehen"
            variant="secondary"
            size="lg"
          />
        </div>

        <div className="mt-10 grid max-w-xl gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Struktur
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              Alles an einem Ort
            </p>
          </div>

          <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Zugriff
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              Jeder sieht nur das Nötige
            </p>
          </div>

          <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Start
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              Sofort einsatzbereit
            </p>
          </div>
        </div>
      </div>

      <div className="relative flex items-center">
        <div className="absolute -left-10 top-12 h-44 w-44 rounded-full bg-indigo-200/40 blur-3xl" />
        <div className="absolute -bottom-8 right-0 h-44 w-44 rounded-full bg-sky-200/40 blur-3xl" />

        <div className="relative w-full rounded-[32px] border border-white/70 bg-white/90 p-6 shadow-2xl shadow-slate-200/70 backdrop-blur-xl">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-slate-100 bg-gradient-to-br from-indigo-50 to-white p-5">
              <p className="text-sm text-slate-500">Übersicht</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">
                Nie wieder Chaos
              </h2>
              <p className="mt-3 text-sm text-slate-600">
                Alle wichtigen Informationen an einem Ort – klar und jederzeit
                verfügbar.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-gradient-to-br from-sky-50 to-white p-5">
              <p className="text-sm text-slate-500">Rollen</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">
                Klare Verantwortung
              </h2>
              <p className="mt-3 text-sm text-slate-600">
                Jeder im Team hat genau die Funktionen, die er wirklich braucht.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-gradient-to-br from-violet-50 to-white p-5">
              <p className="text-sm text-slate-500">Alltag</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">
                Weniger Rückfragen
              </h2>
              <p className="mt-3 text-sm text-slate-600">
                Arbeitszeiten, Urlaube und Abläufe sind jederzeit nachvollziehbar.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-gradient-to-br from-emerald-50 to-white p-5">
              <p className="text-sm text-slate-500">Effizienz</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">
                Mehr Fokus aufs Wesentliche
              </h2>
              <p className="mt-3 text-sm text-slate-600">
                Dein Team arbeitet strukturierter und spart täglich Zeit.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}