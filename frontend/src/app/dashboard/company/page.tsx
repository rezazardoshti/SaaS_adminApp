"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api";

type CompanyGpsMode = "off" | "optional" | "required";

type CompanyDetail = {
  id: number;
  public_id: string;
  company_name: string;
  legal_form?: string;
  industry?: string;
  employee_range?: string;
  email?: string;
  phone?: string;
  website?: string;
  country?: string;
  street?: string;
  postal_code?: string;
  city?: string;
  vat_id?: string;
  tax_number?: string;
  commercial_register?: string;
  billing_email?: string;
  timezone?: string;
  language?: string;
  gps_capture_mode?: CompanyGpsMode;
  gps_visible_to_admin?: boolean;
  gps_visible_to_employee?: boolean;
  is_active?: boolean;
};

type MembershipLike = {
  id: number;
  role?: "owner" | "admin" | "employee";
  company?: number;
  company_name?: string;
  is_active?: boolean;
};

function getSafeAccessToken(access?: string | null) {
  if (access && access.trim()) return access;

  if (typeof window !== "undefined") {
    const fallback =
      localStorage.getItem("access") ||
      localStorage.getItem("accessToken") ||
      sessionStorage.getItem("access") ||
      sessionStorage.getItem("accessToken");

    if (fallback && fallback.trim()) return fallback;
  }

  return "";
}

function MessageBox({
  type,
  text,
}: {
  type: "success" | "error";
  text: string;
}) {
  const classes =
    type === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-rose-200 bg-rose-50 text-rose-800";

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${classes}`}>
      {text}
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">{description}</p>
      </div>
      {children}
    </section>
  );
}

export default function DashboardCompanyPage() {
  const { access: authAccess, company, membership } = useAuth();
  const access = getSafeAccessToken(authAccess);

  const currentMembership = membership as MembershipLike | null;
  const currentCompanyId =
    (company as { id?: number } | null)?.id || currentMembership?.company || null;

  const canManageGps = useMemo(() => {
    const role = currentMembership?.role;
    return role === "owner" || role === "admin";
  }, [currentMembership?.role]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [companyData, setCompanyData] = useState<CompanyDetail | null>(null);

  const [gpsCaptureMode, setGpsCaptureMode] = useState<CompanyGpsMode>("off");
  const [gpsVisibleToAdmin, setGpsVisibleToAdmin] = useState(true);
  const [gpsVisibleToEmployee, setGpsVisibleToEmployee] = useState(true);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    if (successMessage || errorMessage) {
      timer = setTimeout(() => {
        setSuccessMessage("");
        setErrorMessage("");
      }, 6000);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [successMessage, errorMessage]);

  useEffect(() => {
    async function loadCompany() {
      if (!access) {
        setLoading(false);
        setErrorMessage("Anmeldedaten fehlen. Bitte melde dich neu an.");
        return;
      }

      if (!currentCompanyId) {
        setLoading(false);
        setErrorMessage("Keine Firma gefunden.");
        return;
      }

      try {
        setLoading(true);
        setErrorMessage("");

        const response = await fetch(`${API_BASE_URL}/companies/${currentCompanyId}/`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${access}`,
          },
          cache: "no-store",
        });

        let data: any = null;
        try {
          data = await response.json();
        } catch {
          data = null;
        }

        if (!response.ok) {
          throw data || { detail: "Firmendaten konnten nicht geladen werden." };
        }

        const normalized: CompanyDetail = {
          ...data,
          gps_capture_mode: (data?.gps_capture_mode || "off") as CompanyGpsMode,
          gps_visible_to_admin:
            typeof data?.gps_visible_to_admin === "boolean"
              ? data.gps_visible_to_admin
              : true,
          gps_visible_to_employee:
            typeof data?.gps_visible_to_employee === "boolean"
              ? data.gps_visible_to_employee
              : true,
        };

        setCompanyData(normalized);
        setGpsCaptureMode(normalized.gps_capture_mode || "off");
        setGpsVisibleToAdmin(normalized.gps_visible_to_admin ?? true);
        setGpsVisibleToEmployee(normalized.gps_visible_to_employee ?? true);
      } catch (error: any) {
        setErrorMessage(error?.detail || "Firmendaten konnten nicht geladen werden.");
      } finally {
        setLoading(false);
      }
    }

    loadCompany();
  }, [access, currentCompanyId]);

  async function handleSaveGpsSettings(e: React.FormEvent) {
    e.preventDefault();

    if (!access) {
      setErrorMessage("Anmeldedaten fehlen. Bitte melde dich neu an.");
      return;
    }

    if (!currentCompanyId) {
      setErrorMessage("Keine Firma gefunden.");
      return;
    }

    if (!canManageGps) {
      setErrorMessage("Nur Owner oder Admin dürfen diese Einstellungen ändern.");
      return;
    }

    try {
      setSaving(true);
      setErrorMessage("");
      setSuccessMessage("");

      const response = await fetch(`${API_BASE_URL}/companies/${currentCompanyId}/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access}`,
        },
        body: JSON.stringify({
          gps_capture_mode: gpsCaptureMode,
          gps_visible_to_admin: gpsVisibleToAdmin,
          gps_visible_to_employee: gpsVisibleToEmployee,
        }),
      });

      let data: any = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw data || { detail: "GPS-Einstellungen konnten nicht gespeichert werden." };
      }

      const normalized: CompanyDetail = {
        ...data,
        gps_capture_mode: (data?.gps_capture_mode || gpsCaptureMode) as CompanyGpsMode,
        gps_visible_to_admin:
          typeof data?.gps_visible_to_admin === "boolean"
            ? data.gps_visible_to_admin
            : gpsVisibleToAdmin,
        gps_visible_to_employee:
          typeof data?.gps_visible_to_employee === "boolean"
            ? data.gps_visible_to_employee
            : gpsVisibleToEmployee,
      };

      setCompanyData(normalized);
      setGpsCaptureMode(normalized.gps_capture_mode || "off");
      setGpsVisibleToAdmin(normalized.gps_visible_to_admin ?? true);
      setGpsVisibleToEmployee(normalized.gps_visible_to_employee ?? true);

      setSuccessMessage("GPS-Einstellungen wurden erfolgreich gespeichert.");
    } catch (error: any) {
      if (error?.gps_capture_mode?.[0]) {
        setErrorMessage(error.gps_capture_mode[0]);
      } else if (error?.gps_visible_to_admin?.[0]) {
        setErrorMessage(error.gps_visible_to_admin[0]);
      } else if (error?.gps_visible_to_employee?.[0]) {
        setErrorMessage(error.gps_visible_to_employee[0]);
      } else if (error?.detail) {
        setErrorMessage(error.detail);
      } else {
        setErrorMessage("GPS-Einstellungen konnten nicht gespeichert werden.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
          Company settings
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
          {companyData?.company_name || "Firma"}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          Hier verwaltet die Administration die GPS-Regeln für die Zeiterfassung.
        </p>
      </div>

      {successMessage ? <MessageBox type="success" text={successMessage} /> : null}
      {errorMessage ? <MessageBox type="error" text={errorMessage} /> : null}

      <SectionCard
        title="GPS & Standort"
        description="Lege fest, ob beim Start der Arbeitszeit ein Standort erfasst wird und wer diesen sehen darf."
      >
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
            Firmendaten werden geladen...
          </div>
        ) : (
          <form onSubmit={handleSaveGpsSettings} className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                GPS-Erfassung
              </label>
              <select
                value={gpsCaptureMode}
                onChange={(e) => setGpsCaptureMode(e.target.value as CompanyGpsMode)}
                disabled={!canManageGps || saving}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                <option value="off">Aus</option>
                <option value="optional">Optional</option>
                <option value="required">Pflicht</option>
              </select>

              <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {gpsCaptureMode === "off" && (
                  <p>Beim Start der Arbeitszeit wird kein GPS gespeichert.</p>
                )}
                {gpsCaptureMode === "optional" && (
                  <p>GPS kann beim Start gesendet werden, ist aber nicht verpflichtend.</p>
                )}
                {gpsCaptureMode === "required" && (
                  <p>Ohne GPS kann die Arbeitszeit nicht gestartet werden.</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <input
                  type="checkbox"
                  checked={gpsVisibleToAdmin}
                  onChange={(e) => setGpsVisibleToAdmin(e.target.checked)}
                  disabled={!canManageGps || saving}
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">
                    GPS für Admin sichtbar
                  </span>
                  <span className="mt-1 block text-sm text-slate-600">
                    Admin und Owner dürfen die gespeicherten GPS-Daten sehen.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <input
                  type="checkbox"
                  checked={gpsVisibleToEmployee}
                  onChange={(e) => setGpsVisibleToEmployee(e.target.checked)}
                  disabled={!canManageGps || saving}
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">
                    GPS für Mitarbeiter sichtbar
                  </span>
                  <span className="mt-1 block text-sm text-slate-600">
                    Mitarbeiter dürfen ihren eigenen gespeicherten Standort sehen.
                  </span>
                </span>
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={!canManageGps || saving}
                className="inline-flex items-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Speichern..." : "GPS-Einstellungen speichern"}
              </button>

              {!canManageGps ? (
                <div className="inline-flex items-center rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                  Nur Owner oder Admin dürfen diese Einstellungen ändern.
                </div>
              ) : null}
            </div>
          </form>
        )}
      </SectionCard>

      <SectionCard
        title="Aktueller Stand"
        description="Diese Werte kommen direkt aus dem Backend."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <p className="text-sm font-medium text-slate-500">GPS-Modus</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              {companyData?.gps_capture_mode || "-"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <p className="text-sm font-medium text-slate-500">Sichtbar für Admin</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              {companyData?.gps_visible_to_admin ? "Ja" : "Nein"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <p className="text-sm font-medium text-slate-500">Sichtbar für Mitarbeiter</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              {companyData?.gps_visible_to_employee ? "Ja" : "Nein"}
            </p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}