"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { loginUser } from "@/services/api/auth";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { login, getDefaultRoute } = useAuth();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  }

  function getErrorMessage(err: any): string {
    if (err?.detail) return err.detail;
    if (err?.email?.[0]) return err.email[0];
    if (err?.password?.[0]) return err.password[0];
    return "Login failed. Please check your credentials.";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await loginUser(form);
      await login(data);

      const redirectTo = data?.redirect_to || getDefaultRoute();
      router.push(redirectTo);
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="grid min-h-screen lg:grid-cols-2">
        <section className="hidden lg:flex flex-col justify-between border-r border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-10 xl:p-14">
          <div>
            <Link
              href="/"
              className="inline-flex items-center rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white/90 transition hover:border-white/30 hover:bg-white/5"
            >
              Craft Flow
            </Link>
          </div>

          <div className="max-w-xl">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.28em] text-sky-300">
              Employee & Admin Access
            </p>

            <h1 className="text-4xl font-semibold leading-tight xl:text-5xl">
              Sign in to your company workspace.
            </h1>

            <p className="mt-6 text-base leading-8 text-white/70 xl:text-lg">
              Track working hours, manage leave requests, receive schedules,
              send documents, and stay connected with your company in one
              secure place.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm font-semibold text-white">
                  For employees
                </p>
                <p className="mt-2 text-sm leading-7 text-white/65">
                  Start and end work, request vacation, upload documents, and
                  view messages from your admin.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm font-semibold text-white">
                  For admins and owners
                </p>
                <p className="mt-2 text-sm leading-7 text-white/65">
                  Access your own workspace first, then manage employees,
                  company operations, and team workflows.
                </p>
              </div>
            </div>
          </div>

          <div className="text-sm text-white/40">
            Structured daily operations for modern teams.
          </div>
        </section>

        <section className="flex items-center justify-center p-6 sm:p-8 lg:p-10">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-950/10 sm:p-8">
            <div className="mb-8 lg:hidden">
              <Link
                href="/"
                className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Craft Flow
              </Link>
            </div>

            <div className="mb-8">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
                Welcome back
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
                Sign in
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Use the email address and password provided for your company
                account.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                  placeholder="name@company.com"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Password
                  </label>

                  <Link
                    href="/forgot-password"
                    className="text-sm font-medium text-sky-700 transition hover:text-sky-800"
                  >
                    Forgot password?
                  </Link>
                </div>

                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={form.password}
                  onChange={handleChange}
                  required
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                  placeholder="Enter your password"
                />
              </div>

              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-slate-600">
              New company here?{" "}
              <Link
                href="/register"
                className="font-semibold text-sky-700 transition hover:text-sky-800"
              >
                Create your company account
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}