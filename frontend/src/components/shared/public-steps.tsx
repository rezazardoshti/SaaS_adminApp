export default function PublicSteps() {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-16 lg:px-8 lg:pb-24">
      <div className="rounded-[32px] border border-white/70 bg-white/80 p-6 shadow-xl shadow-slate-200/60 backdrop-blur-xl lg:p-8">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">
            Einfach starten
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
            So einfach startest du mit Craft Flow
          </h2>
          <p className="mt-3 text-base leading-7 text-slate-600">
            Ohne komplizierten Einstieg: Firma anlegen, Verwaltung strukturieren
            und Mitarbeitern einen klaren digitalen Bereich geben.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-100 bg-gradient-to-b from-white to-slate-50 p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-sm font-bold text-white">
              1
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-950">
              Firma registrieren
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Lege dein Unternehmen in wenigen Schritten an und schaffe die
              Basis für eine saubere digitale Verwaltung.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-gradient-to-b from-white to-slate-50 p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-sm font-bold text-white">
              2
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-950">
              Team und Prozesse ordnen
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Weise Rollen zu, verwalte Abläufe zentral und reduziere unnötige
              Abstimmungen im Alltag.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-gradient-to-b from-white to-slate-50 p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-sm font-bold text-white">
              3
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-950">
              Sofort produktiver arbeiten
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Dein Team findet schneller, was es braucht, und du behältst
              jederzeit den Überblick über das Wesentliche.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}