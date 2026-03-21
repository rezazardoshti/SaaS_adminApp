"use client";

import { useState } from "react";
import Link from "next/link";
import { forgotPassword } from "@/services/api/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  function getErrorMessage(err: any): string {
    if (err?.detail) return err.detail;
    if (err?.email?.[0]) return err.email[0];
    return "We could not process your request. Please try again.";
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      const data = await forgotPassword({ email });

      setSuccessMessage(
        data?.detail ||
          "If an account with this email exists, a reset link has been sent."
      );
      setEmail("");
    } catch (err: any) {
      setErrorMessage(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
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
              Regain access to your workspace without losing momentum.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">
              Enter your email address and we will send you a secure link to
              reset your password and continue managing your company account.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-slate-200">
              Keep your business moving with a fast and secure password recovery
              flow.
            </p>
          </div>
        </div>

        <div className="flex w-full items-center justify-center px-6 py-10 lg:w-1/2 lg:px-10">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
                Forgot your password?
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Enter your email and we will send you a reset link.
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                  placeholder="you@company.com"
                />
              </div>

              {successMessage ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {successMessage}
                </div>
              ) : null}

              {errorMessage ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errorMessage}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Sending reset link..." : "Send reset link"}
              </button>
            </form>

            <div className="mt-6 flex items-center justify-between text-sm text-slate-500">
              <Link
                href="/login"
                className="font-medium text-slate-900 underline underline-offset-4"
              >
                Back to sign in
              </Link>

              <Link
                href="/register"
                className="font-medium text-slate-900 underline underline-offset-4"
              >
                Create account
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}