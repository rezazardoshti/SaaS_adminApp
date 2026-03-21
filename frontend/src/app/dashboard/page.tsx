"use client";

import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";

export default function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Dashboard</p>
                <h1 className="mt-1 text-3xl font-semibold text-slate-900">
                  Welcome {user?.full_name || user?.first_name}
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  Your workspace is ready.
                </p>
              </div>

              <button
                onClick={logout}
                className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}