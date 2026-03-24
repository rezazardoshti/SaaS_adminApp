"use client";

import { useEffect, useState } from "react";
import type {
  EmployeeMembershipDetail,
  EmployeeMembershipItem,
  EmployeeRole,
  EmployeeUserDetail,
} from "@/services/api/employees";

type EditEmployeeModalProps = {
  open: boolean;
  onClose: () => void;
  employee: EmployeeMembershipItem | null;
  canManageAdminRole: boolean;
  loadDetails: (employee: EmployeeMembershipItem) => Promise<{
    user: EmployeeUserDetail;
    membership: EmployeeMembershipDetail;
  }>;
  onSubmit: (payload: {
    employee: EmployeeMembershipItem | null;
    userData: {
      first_name?: string;
      last_name?: string;
      gender?: string;
      phone?: string;
      birth_date?: string | null;
      street?: string;
      postal_code?: string;
      city?: string;
      country?: string;
      emergency_contact_person?: string;
      emergency_contact_phone?: string;
      notes?: string;
    };
    membershipData: {
      role?: EmployeeRole;
      job_title?: string;
      department?: string;
      contract_type?: string;
      employment_status?: string;
      entry_date?: string | null;
      exit_date?: string | null;
      vacation_days_per_year?: number;
      is_time_tracking_enabled?: boolean;
      can_manage_projects?: boolean;
      notes?: string;
      is_active?: boolean;
    };
  }) => Promise<void>;
};

type FieldErrors = Record<string, string>;

const genderOptions = [
  { value: "", label: "Select gender" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "diverse", label: "Diverse" },
];

const countryOptions = [
  { value: "", label: "Select country" },
  { value: "DE", label: "Germany" },
  { value: "AT", label: "Austria" },
  { value: "CH", label: "Switzerland" },
  { value: "NL", label: "Netherlands" },
  { value: "BE", label: "Belgium" },
  { value: "FR", label: "France" },
  { value: "IT", label: "Italy" },
  { value: "ES", label: "Spain" },
  { value: "PL", label: "Poland" },
  { value: "TR", label: "Turkey" },
  { value: "US", label: "United States" },
];

const initialForm = {
  first_name: "",
  last_name: "",
  email: "",
  gender: "",
  phone: "",
  birth_date: "",
  street: "",
  postal_code: "",
  city: "",
  country: "",
  emergency_contact_person: "",
  emergency_contact_phone: "",
  user_notes: "",
  role: "employee",
  employee_number: "",
  department: "",
  job_title: "",
  contract_type: "full_time",
  employment_status: "active",
  entry_date: "",
  exit_date: "",
  vacation_days_per_year: 30,
  membership_notes: "",
  is_time_tracking_enabled: true,
  can_manage_projects: false,
  is_active: true,
};

export default function EditEmployeeModal({
  open,
  onClose,
  employee,
  canManageAdminRole,
  loadDetails,
  onSubmit,
}: EditEmployeeModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generalError, setGeneralError] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    async function run() {
      if (!open || !employee) return;

      setLoading(true);
      setGeneralError("");
      setErrors({});

      try {
        const detail = await loadDetails(employee);

        setForm({
          first_name: detail.user.first_name || "",
          last_name: detail.user.last_name || "",
          email: detail.user.email || "",
          gender: detail.user.gender || "",
          phone: detail.user.phone || "",
          birth_date: detail.user.birth_date || "",
          street: detail.user.street || "",
          postal_code: detail.user.postal_code || "",
          city: detail.user.city || "",
          country: detail.user.country_code || "",
          emergency_contact_person: detail.user.emergency_contact_person || "",
          emergency_contact_phone: detail.user.emergency_contact_phone || "",
          user_notes: detail.user.notes || "",
          role: detail.membership.role || "employee",
          employee_number: detail.membership.employee_number || "",
          department: detail.membership.department || "",
          job_title: detail.membership.job_title || "",
          contract_type: String(detail.membership.contract_type || "full_time"),
          employment_status: String(detail.membership.employment_status || "active"),
          entry_date: detail.membership.entry_date || "",
          exit_date: detail.membership.exit_date || "",
          vacation_days_per_year: Number(detail.membership.vacation_days_per_year || 0),
          membership_notes: detail.membership.notes || "",
          is_time_tracking_enabled: Boolean(detail.membership.is_time_tracking_enabled),
          can_manage_projects: Boolean(detail.membership.can_manage_projects),
          is_active:
            detail.membership.is_active === undefined
              ? true
              : Boolean(detail.membership.is_active),
        });
      } catch (error: any) {
        setGeneralError(error?.detail || "Employee details could not be loaded.");
      } finally {
        setLoading(false);
      }
    }

    run();
  }, [open, employee, loadDetails]);

  if (!open || !employee) return null;

  function updateField(name: string, value: string | number | boolean) {
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
    setGeneralError("");
  }

  function validate() {
    const nextErrors: FieldErrors = {};

    if (!form.first_name.trim()) nextErrors.first_name = "First name is required.";
    if (!form.last_name.trim()) nextErrors.last_name = "Last name is required.";
    if (form.vacation_days_per_year < 0) {
      nextErrors.vacation_days_per_year = "Vacation days cannot be negative.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setGeneralError("");

    try {
      await onSubmit({
        employee,
        userData: {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          gender: form.gender || "",
          phone: form.phone.trim() || "",
          birth_date: form.birth_date || null,
          street: form.street.trim() || "",
          postal_code: form.postal_code.trim() || "",
          city: form.city.trim() || "",
          country: form.country || "",
          emergency_contact_person: form.emergency_contact_person.trim() || "",
          emergency_contact_phone: form.emergency_contact_phone.trim() || "",
          notes: form.user_notes.trim() || "",
        },
        membershipData: {
          role: form.role as EmployeeRole,
          job_title: form.job_title.trim() || "",
          department: form.department.trim() || "",
          contract_type: form.contract_type,
          employment_status: form.employment_status,
          entry_date: form.entry_date || null,
          exit_date: form.exit_date || null,
          vacation_days_per_year: Number(form.vacation_days_per_year || 0),
          is_time_tracking_enabled: Boolean(form.is_time_tracking_enabled),
          can_manage_projects: Boolean(form.can_manage_projects),
          notes: form.membership_notes.trim() || "",
          is_active: Boolean(form.is_active),
        },
      });
    } catch (error: any) {
      const nextErrors: FieldErrors = {};
      const data = error || {};

      Object.entries(data).forEach(([key, value]) => {
        if (Array.isArray(value) && value.length > 0) {
          nextErrors[key] = String(value[0]);
        } else if (typeof value === "string") {
          nextErrors[key] = value;
        }
      });

      setErrors(nextErrors);

      if (!Object.keys(nextErrors).length) {
        setGeneralError(data?.detail || "Employee could not be updated.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Edit employee</h2>
            <p className="mt-1 text-sm text-slate-600">
              Review and update the employee profile and company-related data.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700"
          >
            Close
          </button>
        </div>

        {loading ? (
          <div className="rounded-xl bg-slate-50 p-6 text-sm text-slate-600">
            Loading employee details...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {generalError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {generalError}
              </div>
            ) : null}

            <section className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Account data
              </h3>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    First name
                  </label>
                  <input
                    value={form.first_name}
                    onChange={(e) => updateField("first_name", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                  />
                  {errors.first_name ? (
                    <p className="mt-1 text-xs text-red-600">{errors.first_name}</p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Last name
                  </label>
                  <input
                    value={form.last_name}
                    onChange={(e) => updateField("last_name", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                  />
                  {errors.last_name ? (
                    <p className="mt-1 text-xs text-red-600">{errors.last_name}</p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Email
                  </label>
                  <input
                    value={form.email}
                    disabled
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-500 outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Gender
                  </label>
                  <select
                    value={form.gender}
                    onChange={(e) => updateField("gender", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                  >
                    {genderOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Phone
                  </label>
                  <input
                    value={form.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Birth date
                  </label>
                  <input
                    type="date"
                    value={form.birth_date}
                    onChange={(e) => updateField("birth_date", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Street
                  </label>
                  <input
                    value={form.street}
                    onChange={(e) => updateField("street", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Postal code
                  </label>
                  <input
                    value={form.postal_code}
                    onChange={(e) => updateField("postal_code", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    City
                  </label>
                  <input
                    value={form.city}
                    onChange={(e) => updateField("city", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Country
                  </label>
                  <select
                    value={form.country}
                    onChange={(e) => updateField("country", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                  >
                    {countryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Emergency contact person
                  </label>
                  <input
                    value={form.emergency_contact_person}
                    onChange={(e) =>
                      updateField("emergency_contact_person", e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Emergency contact phone
                  </label>
                  <input
                    value={form.emergency_contact_phone}
                    onChange={(e) =>
                      updateField("emergency_contact_phone", e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Personal notes
                  </label>
                  <textarea
                    rows={3}
                    value={form.user_notes}
                    onChange={(e) => updateField("user_notes", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Company and employment data
              </h3>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Employee number
                  </label>
                  <input
                    value={form.employee_number}
                    disabled
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-500 outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Role
                  </label>
                  <select
                    value={form.role}
                    onChange={(e) => updateField("role", e.target.value)}
                    disabled={!canManageAdminRole && form.role !== "employee"}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    <option value="employee">Employee</option>
                    <option value="admin">Admin</option>
                    <option value="owner">Owner</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Department
                  </label>
                  <input
                    value={form.department}
                    onChange={(e) => updateField("department", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Job title
                  </label>
                  <input
                    value={form.job_title}
                    onChange={(e) => updateField("job_title", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Contract type
                  </label>
                  <select
                    value={form.contract_type}
                    onChange={(e) => updateField("contract_type", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                  >
                    <option value="full_time">Full time</option>
                    <option value="part_time">Part time</option>
                    <option value="mini_job">Mini job</option>
                    <option value="working_student">Working student</option>
                    <option value="freelancer">Freelancer</option>
                    <option value="intern">Intern</option>
                    <option value="temporary">Temporary</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Employment status
                  </label>
                  <select
                    value={form.employment_status}
                    onChange={(e) => updateField("employment_status", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="on_leave">On leave</option>
                    <option value="terminated">Terminated</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Entry date
                  </label>
                  <input
                    type="date"
                    value={form.entry_date}
                    onChange={(e) => updateField("entry_date", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Exit date
                  </label>
                  <input
                    type="date"
                    value={form.exit_date}
                    onChange={(e) => updateField("exit_date", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Vacation days per year
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.vacation_days_per_year}
                    onChange={(e) =>
                      updateField("vacation_days_per_year", Number(e.target.value))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                  />
                  {errors.vacation_days_per_year ? (
                    <p className="mt-1 text-xs text-red-600">
                      {errors.vacation_days_per_year}
                    </p>
                  ) : null}
                </div>

                <div className="sm:col-span-3">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Membership notes
                  </label>
                  <textarea
                    rows={3}
                    value={form.membership_notes}
                    onChange={(e) => updateField("membership_notes", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.is_time_tracking_enabled}
                    onChange={(e) =>
                      updateField("is_time_tracking_enabled", e.target.checked)
                    }
                  />
                  Enable time tracking
                </label>

                <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.can_manage_projects}
                    onChange={(e) =>
                      updateField("can_manage_projects", e.target.checked)
                    }
                  />
                  Can manage projects
                </label>

                <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => updateField("is_active", e.target.checked)}
                  />
                  Membership active
                </label>
              </div>
            </section>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}