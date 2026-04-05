"use client";

import Link from "next/link";
import React from "react";
import { useAuth } from "@/context/AuthContext";

type MembershipLike = {
  id?: number;
  role?: "owner" | "admin" | "employee";
  company?: number;
  company_name?: string;
  employee_number?: string | null;
  department?: string | null;
  is_active?: boolean;
};

function DashboardCard({
  title,
  description,
  href,
  disabled = false,
}: {
  title: string;
  description: string;
  href: string;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-slate-100 p-6 shadow-sm opacity-70">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
        <div className="mt-5 inline-flex items-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-500">
          Nicht verfügbar
        </div>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
      <div className="mt-5 inline-flex items-center rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition group-hover:bg-slate-800">
        Öffnen
      </div>
    </Link>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { user, membership, company } = useAuth();

  const currentMembership = membership as MembershipLike | null;

  const displayName =
    (user as any)?.full_name?.trim() ||
    [(user as any)?.first_name, (user as any)?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    (user as any)?.email ||
    "Benutzer";

  const companyName =
    (company as any)?.company_name ||
    currentMembership?.company_name ||
    "Deine Firma";

  const role = currentMembership?.role || "employee";
  const employeeNumber = currentMembership?.employee_number || "-";
  const department = currentMembership?.department || "-";

  const isAdminArea = role === "owner" || role === "admin";

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
          Dashboard
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
          Willkommen, {displayName}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          Verwalte deine Firma, Mitarbeiter und wichtige Einstellungen zentral
          an einem Ort.
        </p>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <InfoCard label="Firma" value={companyName} />
          <InfoCard label="Rolle" value={role} />
          <InfoCard label="Personalnummer" value={employeeNumber} />
          <InfoCard label="Abteilung" value={department} />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">
            Schnellzugriff
          </h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Öffne die wichtigsten Bereiche direkt aus deinem Dashboard.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <DashboardCard
            title="Firma & GPS-Einstellungen"
            description="Verwalte Firmenangaben und lege fest, ob GPS bei Arbeitszeit aus, optional oder verpflichtend ist."
            href="/dashboard/company"
            disabled={!isAdminArea}
          />

          <DashboardCard
            title="Mitarbeiter"
            description="Verwalte Rollen, Personalnummern, Arbeitsmodelle und weitere Mitarbeiterdaten."
            href="/dashboard/personnel"
            disabled={!isAdminArea}
          />

          <DashboardCard
            title="Urlaube"
            description="Prüfe, bearbeite und verwalte Urlaubsanträge deiner Mitarbeiter."
            href="/dashboard/vacations"
            disabled={!isAdminArea}
          />
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">
          GPS-Verwaltung
        </h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          In den Firmeneinstellungen kann die Verwaltung jetzt steuern, ob beim
          Start der Arbeitszeit ein Standort gespeichert wird. Dort wird auch
          festgelegt, ob GPS für Admins oder Mitarbeiter sichtbar ist.
        </p>

        <div className="mt-5">
          {isAdminArea ? (
            <Link
              href="/dashboard/company"
              className="inline-flex items-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Firmeneinstellungen öffnen
            </Link>
          ) : (
            <div className="inline-flex items-center rounded-2xl border border-slate-300 bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-500">
              Nur für Owner oder Admin verfügbar
            </div>
          )}
        </div>
      </section>
    </div>
  );
}