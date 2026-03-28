"use client";

import { useMemo, useState } from "react";
import type {
  ContractType,
  EmployeeRole,
  EmploymentStatus,
  EmployeeMembershipItem,
} from "@/services/api/employees";

type CreateEmployeeModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    email: string;
    password: string;
    password_confirm: string;
    first_name: string;
    last_name: string;
    phone?: string;
    role: EmployeeRole;
    department?: string;
    job_title?: string;
    contract_type?: ContractType;
    employment_status?: EmploymentStatus;
    entry_date?: string;
    weekly_target_hours?: number | null;
    monthly_target_hours?: number | null;
    vacation_days_per_year?: number;
    is_time_tracking_enabled?: boolean;
    can_manage_projects?: boolean;
  }) => Promise<void>;
  canCreateAdmin: boolean;
  isSubmitting: boolean;
};

type FieldErrors = Record<string, string>;

const initialForm = {
  email: "",
  password: "",
  password_confirm: "",
  first_name: "",
  last_name: "",
  phone: "",
  role: "employee" as EmployeeRole,
  department: "",
  job_title: "",
  contract_type: "full_time" as ContractType,
  employment_status: "active" as EmploymentStatus,
  entry_date: "",
  weekly_target_hours: 40,
  monthly_target_hours: 173.33,
  vacation_days_per_year: 30,
  is_time_tracking_enabled: true,
  can_manage_projects: false,
};

export default function CreateEmployeeModal({
  open,
  onClose,
  onSubmit,
  canCreateAdmin,
  isSubmitting,
}: CreateEmployeeModalProps) {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [generalError, setGeneralError] = useState("");

  const roleOptions = useMemo(() => {
    const base: { value: EmployeeRole; label: string }[] = [
      { value: "employee", label: "Employee" },
    ];

    if (canCreateAdmin) {
      base.unshift({ value: "admin", label: "Admin" });
    }

    return base;
  }, [canCreateAdmin]);

  if (!open) return null;

  function updateField(name: string, value: string | boolean | number) {
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
    setGeneralError("");
  }

  function validate() {
    const nextErrors: FieldErrors = {};

    if (!form.first_name.trim()) nextErrors.first_name = "First name is required.";
    if (!form.last_name.trim()) nextErrors.last_name = "Last name is required.";
    if (!form.email.trim()) nextErrors.email = "Email is required.";
    if (!form.password.trim()) nextErrors.password = "Password is required.";

    if (!form.password_confirm.trim()) {
      nextErrors.password_confirm = "Please confirm the password.";
    }

    if (form.password.trim().length < 8) {
      nextErrors.password = "Password should be at least 8 characters.";
    }

    if (
      form.password &&
      form.password_confirm &&
      form.password !== form.password_confirm
    ) {
      nextErrors.password_confirm = "Passwords do not match.";
    }

    if (Number(form.vacation_days_per_year) < 0) {
      nextErrors.vacation_days_per_year = "Vacation days cannot be negative.";
    }

    if (Number(form.weekly_target_hours) < 0) {
      nextErrors.weekly_target_hours = "Weekly target hours cannot be negative.";
    }

    if (Number(form.monthly_target_hours) < 0) {
      nextErrors.monthly_target_hours = "Monthly target hours cannot be negative.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    try {
      await onSubmit({
        email: form.email.trim(),
        password: form.password,
        password_confirm: form.password_confirm,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim() || undefined,
        role: form.role,
        department: form.department.trim() || undefined,
        job_title: form.job_title.trim() || undefined,
        contract_type: form.contract_type,
        employment_status: form.employment_status,
        entry_date: form.entry_date || undefined,
        weekly_target_hours:
          form.weekly_target_hours === "" ? null : Number(form.weekly_target_hours),
        monthly_target_hours:
          form.monthly_target_hours === ""
            ? null
            : Number(form.monthly_target_hours),
        vacation_days_per_year: Number(form.vacation_days_per_year || 0),
        is_time_tracking_enabled: Boolean(form.is_time_tracking_enabled),
        can_manage_projects: Boolean(form.can_manage_projects),
      });

      setForm(initialForm);
      setErrors({});
      setGeneralError("");
      onClose();
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
        setGeneralError(data?.detail || "Employee could not be created.");
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Add employee</h2>
            <p className="mt-1 text-sm text-slate-500">
              Create the user account and assign the person directly to the current company.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8 p-6">
          {generalError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {generalError}
            </div>
          ) : null}

          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Account data
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
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
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                />
                {errors.email ? (
                  <p className="mt-1 text-xs text-red-600">{errors.email}</p>
                ) : null}
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
                {errors.phone ? (
                  <p className="mt-1 text-xs text-red-600">{errors.phone}</p>
                ) : null}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Password
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => updateField("password", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                />
                {errors.password ? (
                  <p className="mt-1 text-xs text-red-600">{errors.password}</p>
                ) : null}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Confirm password
                </label>
                <input
                  type="password"
                  value={form.password_confirm}
                  onChange={(e) => updateField("password_confirm", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                />
                {errors.password_confirm ? (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.password_confirm}
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Company role and employment
            </h3>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Role
                </label>
                <select
                  value={form.role}
                  onChange={(e) => updateField("role", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                >
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {errors.role ? (
                  <p className="mt-1 text-xs text-red-600">{errors.role}</p>
                ) : null}
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
                  Weekly target hours
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.25"
                  value={form.weekly_target_hours}
                  onChange={(e) =>
                    updateField("weekly_target_hours", Number(e.target.value))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                />
                {errors.weekly_target_hours ? (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.weekly_target_hours}
                  </p>
                ) : null}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Monthly target hours
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.25"
                  value={form.monthly_target_hours}
                  onChange={(e) =>
                    updateField("monthly_target_hours", Number(e.target.value))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none"
                />
                {errors.monthly_target_hours ? (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.monthly_target_hours}
                  </p>
                ) : null}
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
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
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
              disabled={isSubmitting}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {isSubmitting ? "Saving..." : "Create employee"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}