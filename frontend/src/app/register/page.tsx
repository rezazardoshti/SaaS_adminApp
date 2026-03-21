"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registerOwner } from "@/services/api/auth";
import { useAuth } from "@/context/AuthContext";

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    company_name: "",
    password: "",
    password_confirm: "",
  });

  const [loading, setLoading] = useState(false);
  const [errorMap, setErrorMap] = useState<Record<string, string[]>>({});
  const [generalError, setGeneralError] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorMap({});
    setGeneralError("");

    try {
      const data = await registerOwner(form);
      await login(data);
      router.push("/dashboard");
    } catch (err: any) {
      if (typeof err === "object" && err !== null) {
        setErrorMap(err);
        if (err.detail) {
          setGeneralError(err.detail);
        }
      } else {
        setGeneralError("Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  function fieldError(name: string) {
    return errorMap?.[name]?.[0] || "";
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto flex min-h-[80vh] max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
        <div className="hidden w-1/2 bg-slate-900 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm">
              Craft Flow
            </span>
            <h1 className="mt-6 text-4xl font-semibold leading-tight">
              Build your company workspace with one clean start.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">
              Create your owner account, register your company, and start
              managing employees, work processes, and daily operations from one
              platform.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-slate-200">
              Your first registration creates the owner account and the first
              company space together.
            </p>
          </div>
        </div>

        <div className="flex w-full items-center justify-center px-6 py-10 lg:w-1/2 lg:px-10">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
                Create your company account
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Start with the owner profile and your company name.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    First name
                  </label>
                  <input
                    name="first_name"
                    value={form.first_name}
                    onChange={handleChange}
                    required
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-900"
                    placeholder="John"
                  />
                  {fieldError("first_name") ? (
                    <p className="mt-1 text-xs text-red-600">
                      {fieldError("first_name")}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Last name
                  </label>
                  <input
                    name="last_name"
                    value={form.last_name}
                    onChange={handleChange}
                    required
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-900"
                    placeholder="Doe"
                  />
                  {fieldError("last_name") ? (
                    <p className="mt-1 text-xs text-red-600">
                      {fieldError("last_name")}
                    </p>
                  ) : null}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Email address
                </label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-900"
                  placeholder="you@company.com"
                />
                {fieldError("email") ? (
                  <p className="mt-1 text-xs text-red-600">{fieldError("email")}</p>
                ) : null}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Phone
                </label>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-900"
                  placeholder="+49 ..."
                />
                {fieldError("phone") ? (
                  <p className="mt-1 text-xs text-red-600">{fieldError("phone")}</p>
                ) : null}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Company name
                </label>
                <input
                  name="company_name"
                  value={form.company_name}
                  onChange={handleChange}
                  required
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-900"
                  placeholder="Craft Flow GmbH"
                />
                {fieldError("company_name") ? (
                  <p className="mt-1 text-xs text-red-600">
                    {fieldError("company_name")}
                  </p>
                ) : null}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Password
                </label>
                <input
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  required
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-900"
                  placeholder="Create a secure password"
                />
                {fieldError("password") ? (
                  <p className="mt-1 text-xs text-red-600">
                    {fieldError("password")}
                  </p>
                ) : null}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Confirm password
                </label>
                <input
                  name="password_confirm"
                  type="password"
                  value={form.password_confirm}
                  onChange={handleChange}
                  required
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-900"
                  placeholder="Repeat your password"
                />
                {fieldError("password_confirm") ? (
                  <p className="mt-1 text-xs text-red-600">
                    {fieldError("password_confirm")}
                  </p>
                ) : null}
              </div>

              {generalError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {generalError}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Creating account..." : "Create company account"}
              </button>
            </form>

            <p className="mt-6 text-sm text-slate-500">
              Already have an account?{" "}
              <a
                href="/login"
                className="font-medium text-slate-900 underline underline-offset-4"
              >
                Sign in
              </a>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}