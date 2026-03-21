export default function PublicTrust() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-20">
      <div className="rounded-[32px] border border-white/70 bg-white/80 p-6 shadow-xl shadow-slate-200/60 backdrop-blur-xl lg:p-10">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-700">
            Warum Craft Flow
          </p>

          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">
            Entwickelt für Klarheit statt Komplexität
          </h2>

          <p className="mt-4 text-base leading-7 text-slate-600">
            Während viele Systeme überladen und schwer verständlich sind,
            konzentriert sich Craft Flow auf das Wesentliche: einfache,
            nachvollziehbare Abläufe im echten Arbeitsalltag.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-100 bg-gradient-to-b from-white to-slate-50 p-6">
            <h3 className="text-lg font-semibold text-slate-950">
              Kein unnötiger Ballast
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Du bekommst nur die Funktionen, die du wirklich brauchst – ohne
              überladene Menüs oder versteckte Einstellungen.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-gradient-to-b from-white to-slate-50 p-6">
            <h3 className="text-lg font-semibold text-slate-950">
              Sofort verständlich
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Dein Team kann direkt starten, ohne Schulung oder lange
              Einarbeitung.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-gradient-to-b from-white to-slate-50 p-6">
            <h3 className="text-lg font-semibold text-slate-950">
              Für den echten Alltag gebaut
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Fokus auf die Dinge, die täglich passieren: Zeiten, Urlaube,
              Mitarbeiter und klare Abläufe.
            </p>
          </div>
        </div>

        <div className="mt-12 rounded-3xl border border-slate-100 bg-white p-6 text-center shadow-sm">
          <p className="text-base font-medium text-slate-900">
            Kein kompliziertes System. Keine unnötigen Prozesse.
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Einfach ein Werkzeug, das dein Unternehmen besser organisiert.
          </p>
        </div>
      </div>
    </section>
  );
}