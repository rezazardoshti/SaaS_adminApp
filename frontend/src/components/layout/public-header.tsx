import Link from "next/link";
import PublicButton from "@/components/ui/public-button";

export default function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/60 bg-white/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
        <Link href="/" className="group">
          <div>
            <p className="text-xl font-bold tracking-tight text-slate-950 transition group-hover:text-slate-700">
              Craft Flow
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Digitale Verwaltung für moderne Unternehmen
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <Link
            href="/"
            className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
          >
            Startseite
          </Link>
          <button
            type="button"
            className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
          >
            Funktionen
          </button>
          <button
            type="button"
            className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
          >
            Vorteile
          </button>
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/login">
            <PublicButton label="Anmelden" variant="secondary" size="sm" />
          </Link>

          <Link href="/register">
            <PublicButton label="Firma registrieren" variant="primary" size="sm" />
          </Link>
        </div>
      </div>
    </header>
  );
}