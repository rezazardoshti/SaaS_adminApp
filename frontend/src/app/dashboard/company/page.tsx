"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getMyMemberships } from "@/services/api/employees";
import { apiRequest } from "@/services/api/client";

type CompanyMembershipLite = {
  id: number;
  company: number;
  company_name?: string;
  company_public_id?: string;
  role?: "owner" | "admin" | "employee" | string;
  is_active?: boolean;
};

type CompanyOwner = {
  id?: number;
  public_id?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
};

type CompanyMemberUser = {
  id?: number;
  public_id?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
};

type CompanyMember = {
  id: number;
  role?: string;
  employee_number?: string;
  job_title?: string;
  department?: string;
  contract_type?: string;
  employment_status?: string;
  is_time_tracking_enabled?: boolean;
  is_active?: boolean;
  user?: CompanyMemberUser;
};

type GpsMode = "disabled" | "optional" | "required";

type CompanyDetail = {
  id: number;
  public_id?: string;
  company_name?: string;
  legal_form?: string;
  industry?: string;
  employee_range?: string;
  email?: string;
  phone?: string;
  website?: string;
  country?: string;
  country_name?: string;
  street?: string;
  postal_code?: string;
  city?: string;
  full_address?: string;
  billing_email?: string;
  timezone?: string;
  language?: string;
  is_active?: boolean;
  member_count?: number;
  owner_user?: CompanyOwner | null;
  memberships?: CompanyMember[];

  gps_tracking_mode?: GpsMode;
  gps_enabled?: boolean;
  is_gps_enabled?: boolean;
  gps_mode?: string;
  gps_status?: string;

  [key: string]: unknown;
};

type FlashMessage =
  | {
      type: "success" | "error";
      text: string;
    }
  | null;

function normalizeRole(role?: string) {
  const value = String(role || "").toLowerCase();
  if (value === "owner") return "Owner";
  if (value === "admin") return "Admin";
  if (value === "employee") return "Employee";
  return role || "-";
}

function getPersonName(user?: CompanyMemberUser | CompanyOwner | null) {
  if (!user) return "-";
  if (user.full_name?.trim()) return user.full_name.trim();
  const joined = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return joined || user.email || "-";
}

function readGpsMode(company: CompanyDetail | null): GpsMode {
  if (!company) return "disabled";

  const direct = String(company.gps_tracking_mode || "").toLowerCase();
  if (direct === "disabled" || direct === "optional" || direct === "required") {
    return direct as GpsMode;
  }

  const legacyMode = String(company.gps_mode || company.gps_status || "").toLowerCase();
  if (legacyMode === "disabled" || legacyMode === "optional" || legacyMode === "required") {
    return legacyMode as GpsMode;
  }

  if (company.is_gps_enabled || company.gps_enabled) {
    return "required";
  }

  return "disabled";
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
      {hint ? <div className="mt-1 text-sm text-slate-500">{hint}</div> : null}
    </div>
  );
}

function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const classes =
    tone === "success"
      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
      : tone === "warning"
      ? "bg-amber-100 text-amber-700 border-amber-200"
      : tone === "danger"
      ? "bg-rose-100 text-rose-700 border-rose-200"
      : "bg-slate-100 text-slate-700 border-slate-200";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${classes}`}>
      {children}
    </span>
  );
}

export default function CompanyPage() {
  const { access } = useAuth();

  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [currentRole, setCurrentRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [savingGps, setSavingGps] = useState(false);
  const [pageError, setPageError] = useState("");
  const [flash, setFlash] = useState<FlashMessage>(null);

  const canManageCompany = useMemo(() => {
    const role = currentRole.toLowerCase();
    return role === "owner" || role === "admin";
  }, [currentRole]);

  const loadCompany = useCallback(async () => {
    if (!access) return;

    setLoading(true);
    setPageError("");

    try {
      const memberships = (await getMyMemberships(access)) as CompanyMembershipLite[];
      const currentMembership =
        memberships.find((item) => item.is_active) || memberships[0];

      if (!currentMembership?.company) {
        throw { detail: "No active company membership found." };
      }

      const role = String(currentMembership.role || "");
      setCurrentRole(role);

      const normalizedRole = role.toLowerCase();
      if (normalizedRole !== "owner" && normalizedRole !== "admin") {
        setCompany(null);
        setLoading(false);
        return;
      }

      const detail = (await apiRequest(
        `/companies/${currentMembership.company}/`,
        "GET",
        undefined,
        access
      )) as CompanyDetail;

      setCompany(detail);
    } catch (error: any) {
      setPageError(error?.detail || "Company data could not be loaded.");
      setCompany(null);
    } finally {
      setLoading(false);
    }
  }, [access]);

  useEffect(() => {
    loadCompany();
  }, [loadCompany]);

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), 5000);
    return () => window.clearTimeout(timer);
  }, [flash]);

  const gpsMode = useMemo(() => readGpsMode(company), [company]);

  const gpsSummary = useMemo(() => {
    if (gpsMode === "disabled") {
      return {
        title: "Disabled",
        text: "GPS is off for this company. No location is requested in the frontend.",
        tone: "default" as const,
      };
    }

    if (gpsMode === "optional") {
      return {
        title: "Optional",
        text: "Employees can share location if the workflow requests it, but it is not mandatory.",
        tone: "warning" as const,
      };
    }

    return {
      title: "Required",
      text: "GPS is active for this company and the frontend should capture position for worktime actions.",
      tone: "success" as const,
    };
  }, [gpsMode]);

  const activeMembers = useMemo(() => {
    return (company?.memberships || []).filter((item) => item.is_active);
  }, [company]);

  async function handleSaveGpsMode(nextMode: GpsMode) {
    if (!access || !company?.id) return;

    if (!canManageCompany) {
      setFlash({
        type: "error",
        text: "Only owner or admin can change company settings.",
      });
      return;
    }

    setSavingGps(true);

    try {
      const updated = (await apiRequest(
        `/companies/${company.id}/`,
        "PATCH",
        { gps_tracking_mode: nextMode },
        access
      )) as CompanyDetail;

      setCompany((prev) => ({
        ...(prev || {}),
        ...updated,
        gps_tracking_mode: nextMode,
      }));

      setFlash({
        type: "success",
        text: `GPS setting was saved successfully: ${nextMode}.`,
      });
    } catch (error: any) {
      setFlash({
        type: "error",
        text: error?.detail || "GPS setting could not be saved.",
      });
    } finally {
      setSavingGps(false);
    }
  }

  if (!loading && !canManageCompany) {
    return (
      <div className="space-y-6">
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-amber-900">No access</h1>
          <p className="mt-3 text-sm leading-6 text-amber-800">
            Only company owner or admin can open the company management page.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {flash ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            flash.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {flash.text}
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Company</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Manage the current company profile and the GPS behavior for employee worktime tracking.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge tone={company?.is_active ? "success" : "danger"}>
              {company?.is_active ? "Company active" : "Company inactive"}
            </Badge>
            <Badge tone={canManageCompany ? "success" : "default"}>
              {canManageCompany ? "Owner/Admin access" : "Read only"}
            </Badge>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
          Loading company data...
        </div>
      ) : pageError ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-rose-800">
            Company data could not be loaded
          </h2>
          <p className="mt-2 text-sm text-rose-700">{pageError}</p>
        </div>
      ) : company ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Company"
              value={company.company_name || "-"}
              hint={company.public_id || "No public ID"}
            />
            <StatCard
              label="Members"
              value={company.member_count ?? activeMembers.length}
              hint={`${activeMembers.length} active in loaded list`}
            />
            <StatCard
              label="Timezone"
              value={company.timezone || "-"}
              hint={company.language ? `Language: ${company.language}` : undefined}
            />
            <StatCard
              label="GPS status"
              value={gpsSummary.title}
              hint={gpsSummary.text}
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Company profile
              </h2>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Company name
                  </div>
                  <div className="mt-1 text-sm text-slate-900">
                    {company.company_name || "-"}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Public ID
                  </div>
                  <div className="mt-1 text-sm text-slate-900">
                    {company.public_id || "-"}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Owner
                  </div>
                  <div className="mt-1 text-sm text-slate-900">
                    {getPersonName(company.owner_user)}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Industry
                  </div>
                  <div className="mt-1 text-sm text-slate-900">
                    {company.industry || "-"}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Email
                  </div>
                  <div className="mt-1 text-sm text-slate-900">
                    {company.email || "-"}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Phone
                  </div>
                  <div className="mt-1 text-sm text-slate-900">
                    {company.phone || "-"}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Website
                  </div>
                  <div className="mt-1 text-sm text-slate-900">
                    {company.website || "-"}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Address
                  </div>
                  <div className="mt-1 text-sm text-slate-900">
                    {company.full_address || "-"}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Country
                  </div>
                  <div className="mt-1 text-sm text-slate-900">
                    {company.country_name || company.country || "-"}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Billing email
                  </div>
                  <div className="mt-1 text-sm text-slate-900">
                    {company.billing_email || "-"}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    GPS settings
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Owner/Admin can define whether location is disabled, optional, or required for this company.
                  </p>
                </div>

                <Badge tone={gpsSummary.tone}>{gpsSummary.title}</Badge>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                {gpsSummary.text}
              </div>

              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  disabled={!canManageCompany || savingGps}
                  onClick={() => handleSaveGpsMode("disabled")}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    gpsMode === "disabled"
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <div className="font-medium">Disabled</div>
                  <div className={`mt-1 text-sm ${gpsMode === "disabled" ? "text-slate-200" : "text-slate-500"}`}>
                    No location capture in the employee workflow.
                  </div>
                </button>

                <button
                  type="button"
                  disabled={!canManageCompany || savingGps}
                  onClick={() => handleSaveGpsMode("optional")}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    gpsMode === "optional"
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <div className="font-medium">Optional</div>
                  <div className={`mt-1 text-sm ${gpsMode === "optional" ? "text-slate-200" : "text-slate-500"}`}>
                    Position can be sent, but the workflow does not force it.
                  </div>
                </button>

                <button
                  type="button"
                  disabled={!canManageCompany || savingGps}
                  onClick={() => handleSaveGpsMode("required")}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    gpsMode === "required"
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <div className="font-medium">Required</div>
                  <div className={`mt-1 text-sm ${gpsMode === "required" ? "text-slate-200" : "text-slate-500"}`}>
                    Frontend should collect and submit employee location on worktime actions.
                  </div>
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Personnel overview
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Quick overview of active members in this company.
                </p>
              </div>

              <Badge>{activeMembers.length} active</Badge>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="border-b border-slate-200 px-4 py-3">Person</th>
                    <th className="border-b border-slate-200 px-4 py-3">Role</th>
                    <th className="border-b border-slate-200 px-4 py-3">Employee no.</th>
                    <th className="border-b border-slate-200 px-4 py-3">Department</th>
                    <th className="border-b border-slate-200 px-4 py-3">Job title</th>
                    <th className="border-b border-slate-200 px-4 py-3">Time tracking</th>
                    <th className="border-b border-slate-200 px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activeMembers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-sm text-slate-500"
                      >
                        No personnel data available for this company.
                      </td>
                    </tr>
                  ) : (
                    activeMembers.map((member) => (
                      <tr key={member.id} className="text-sm text-slate-700">
                        <td className="border-b border-slate-100 px-4 py-4">
                          <div className="font-medium text-slate-900">
                            {getPersonName(member.user)}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {member.user?.email || member.user?.public_id || "-"}
                          </div>
                        </td>
                        <td className="border-b border-slate-100 px-4 py-4">
                          {normalizeRole(member.role)}
                        </td>
                        <td className="border-b border-slate-100 px-4 py-4">
                          {member.employee_number || "-"}
                        </td>
                        <td className="border-b border-slate-100 px-4 py-4">
                          {member.department || "-"}
                        </td>
                        <td className="border-b border-slate-100 px-4 py-4">
                          {member.job_title || "-"}
                        </td>
                        <td className="border-b border-slate-100 px-4 py-4">
                          <Badge tone={member.is_time_tracking_enabled ? "success" : "default"}>
                            {member.is_time_tracking_enabled ? "Enabled" : "Disabled"}
                          </Badge>
                        </td>
                        <td className="border-b border-slate-100 px-4 py-4">
                          <Badge tone={member.is_active ? "success" : "danger"}>
                            {member.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}