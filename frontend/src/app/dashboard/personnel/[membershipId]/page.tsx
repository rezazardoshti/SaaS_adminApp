"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import EditEmployeeModal from "@/components/dashboard/EditEmployeeModal";
import { useAuth } from "@/context/AuthContext";
import {
  getEmployeeMembershipDetail,
  getEmployeeUserDetail,
  getMyMemberships,
  updateEmployeeMembership,
  updateEmployeeUser,
  type EmployeeMembershipDetail,
  type EmployeeMembershipItem,
  type EmployeeMembershipUpdatePayload,
  type EmployeeUserDetail,
  type EmployeeUserUpdatePayload,
} from "@/services/api/employees";

type FlashMessage =
  | {
      type: "success" | "error";
      text: string;
    }
  | null;

type MyMembershipItem = {
  id: number;
  company: number;
  role: "owner" | "admin" | "employee";
  is_active: boolean;
};

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="mt-2 text-sm text-slate-900">{value}</div>
    </div>
  );
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return String(value);
}

function getDisplayName(user: EmployeeUserDetail | null) {
  if (!user) return "-";

  return (
    user.full_name?.trim() ||
    [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
    user.email ||
    "-"
  );
}

export default function EmployeeProfilePage() {
  const { access } = useAuth();
  const params = useParams();

  const membershipIdParam = Array.isArray(params?.membershipId)
    ? params.membershipId[0]
    : params?.membershipId;

  const membershipId = Number(membershipIdParam);

  const [membership, setMembership] = useState<EmployeeMembershipDetail | null>(
    null
  );
  const [user, setUser] = useState<EmployeeUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [flash, setFlash] = useState<FlashMessage>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [currentRole, setCurrentRole] = useState<"owner" | "admin" | "employee">(
    "employee"
  );

  const loadProfile = useCallback(async () => {
    if (!access) return;

    if (!Number.isFinite(membershipId)) {
      setPageError("Invalid employee membership ID.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setPageError("");

    try {
      const myMemberships = (await getMyMemberships(access)) as MyMembershipItem[];
      const activeMembership =
        myMemberships.find((item) => item.is_active) || myMemberships[0];

      if (activeMembership?.role) {
        setCurrentRole(activeMembership.role);
      }

      const membershipDetail = await getEmployeeMembershipDetail(
        access,
        membershipId
      );

      let userDetail: EmployeeUserDetail | null = null;
      const userId = (membershipDetail as EmployeeMembershipItem).user?.id ?? null;

      if (userId) {
        userDetail = await getEmployeeUserDetail(access, userId);
      }

      setMembership(membershipDetail);
      setUser(userDetail);
    } catch (error: any) {
      setPageError(error?.detail || "Employee profile could not be loaded.");
      setMembership(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [access, membershipId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!flash) return;

    const timer = window.setTimeout(() => {
      setFlash(null);
    }, 6000);

    return () => window.clearTimeout(timer);
  }, [flash]);

  const displayName = useMemo(() => getDisplayName(user), [user]);

  const selectedEmployee = useMemo<EmployeeMembershipItem | null>(() => {
    if (!membership) return null;

    return {
      ...(membership as EmployeeMembershipItem),
      user: user
        ? {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            full_name: user.full_name,
            phone: user.phone,
            gender: user.gender,
            birth_date: user.birth_date,
            street: user.street,
            postal_code: user.postal_code,
            city: user.city,
            country: user.country,
            country_code: user.country_code,
            emergency_contact_person: user.emergency_contact_person,
            emergency_contact_phone: user.emergency_contact_phone,
            notes: user.notes,
            is_active: user.is_active,
          }
        : undefined,
    };
  }, [membership, user]);

  async function loadDetails(employee: EmployeeMembershipItem) {
    if (!access || !employee.user?.id) {
      throw { detail: "Employee details could not be loaded." };
    }

    const [userDetail, membershipDetail] = await Promise.all([
      getEmployeeUserDetail(access, employee.user.id),
      getEmployeeMembershipDetail(access, employee.id),
    ]);

    return {
      user: userDetail,
      membership: membershipDetail,
    };
  }

  async function handleUpdateEmployee(payload: {
    employee: EmployeeMembershipItem | null;
    userData: EmployeeUserUpdatePayload;
    membershipData: EmployeeMembershipUpdatePayload;
  }) {
    if (!access || !payload.employee?.user?.id) {
      throw { detail: "Employee could not be updated." };
    }

    try {
      await Promise.all([
        updateEmployeeUser(access, payload.employee.user.id, payload.userData),
        updateEmployeeMembership(
          access,
          payload.employee.id,
          payload.membershipData
        ),
      ]);

      setFlash({
        type: "success",
        text: "Employee profile was updated successfully.",
      });

      setEditOpen(false);
      await loadProfile();
    } catch (error: any) {
      setFlash({
        type: "error",
        text: error?.detail || "Employee profile could not be updated.",
      });
      throw error;
    }
  }

  if (loading) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Loading employee profile...</p>
      </section>
    );
  }

  if (pageError) {
    return (
      <section className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-red-800">
          Employee profile could not be loaded
        </h2>
        <p className="mt-2 text-sm text-red-700">{pageError}</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {flash ? (
        <div
          className={[
            "rounded-2xl border px-4 py-3 text-sm shadow-sm",
            flash.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800",
          ].join(" ")}
        >
          {flash.text}
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-4">
            {user?.profile_image ? (
              <img
                src={user.profile_image}
                alt={displayName}
                className="h-24 w-24 rounded-2xl object-cover ring-1 ring-slate-200"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-slate-100 text-3xl font-semibold text-slate-700">
                {displayName !== "-" ? displayName.charAt(0).toUpperCase() : "?"}
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-slate-500">
                Employee profile
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                {displayName}
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Employee No: {formatValue(membership?.employee_number)}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {formatValue(membership?.job_title)} •{" "}
                {formatValue(membership?.department)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
          >
            Edit profile
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InfoCard label="Email" value={formatValue(user?.email)} />
        <InfoCard label="Phone" value={formatValue(user?.phone)} />
        <InfoCard label="Gender" value={formatValue(user?.gender)} />
        <InfoCard label="Birth date" value={formatValue(user?.birth_date)} />
        <InfoCard label="Street" value={formatValue(user?.street)} />
        <InfoCard label="Postal code" value={formatValue(user?.postal_code)} />
        <InfoCard label="City" value={formatValue(user?.city)} />
        <InfoCard
          label="Country"
          value={formatValue(user?.country || user?.country_code)}
        />
        <InfoCard label="Role" value={formatValue(membership?.role)} />
        <InfoCard
          label="Contract type"
          value={formatValue(membership?.contract_type)}
        />
        <InfoCard
          label="Employment status"
          value={formatValue(membership?.employment_status)}
        />
        <InfoCard label="Entry date" value={formatValue(membership?.entry_date)} />
        <InfoCard label="Exit date" value={formatValue(membership?.exit_date)} />
        <InfoCard
          label="Weekly target hours"
          value={formatValue(membership?.weekly_target_hours)}
        />
        <InfoCard
          label="Monthly target hours"
          value={formatValue(membership?.monthly_target_hours)}
        />
        <InfoCard
          label="Vacation days / year"
          value={formatValue(membership?.vacation_days_per_year)}
        />
        <InfoCard
          label="Time tracking"
          value={membership?.is_time_tracking_enabled ? "Enabled" : "Disabled"}
        />
        <InfoCard
          label="Project management"
          value={membership?.can_manage_projects ? "Allowed" : "Not allowed"}
        />
        <InfoCard
          label="Membership active"
          value={membership?.is_active ? "Active" : "Inactive"}
        />
        <InfoCard
          label="Email verified"
          value={user?.is_email_verified ? "Yes" : "No"}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Emergency contact
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <InfoCard
              label="Contact person"
              value={formatValue(user?.emergency_contact_person)}
            />
            <InfoCard
              label="Phone"
              value={formatValue(user?.emergency_contact_phone)}
            />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Notes</h2>
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                User notes
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-900">
                {formatValue(user?.notes)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Membership notes
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-900">
                {formatValue(membership?.notes)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <EditEmployeeModal
        open={editOpen}
        onClose={async () => {
          setEditOpen(false);
          await loadProfile();
        }}
        employee={selectedEmployee}
        canManageAdminRole={currentRole === "owner" || currentRole === "admin"}
        loadDetails={loadDetails}
        onSubmit={handleUpdateEmployee}
      />
    </div>
  );
}