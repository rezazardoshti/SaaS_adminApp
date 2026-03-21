"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { resetPasswordConfirm } from "@/services/api/auth";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const uid = useMemo(() => searchParams.get("uid") || "", [searchParams]);
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);

  const [form, setForm] = useState({
    new_password: "",
    new_password_confirm: "",
  });

  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!uid || !token) {
      setGeneralError("This reset link is invalid or incomplete.");
    }
  }, [uid, token]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  }

  function getFieldError(name: string) {
    return fieldErrors?.[name]?.[0] || "";
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!uid || !token) {
      setGeneralError("This reset link is invalid or incomplete.");
      return;
    }

    setLoading(true);
    setSuccessMessage("");
    setGeneralError("");
    setFieldErrors({});

    try {
      const data = await resetPasswordConfirm({
        uid,
        token,
        new_password: form.new_password,
        new_password_confirm: form.new_password_confirm,
      });

      setSuccessMessage(
        data?.detail || "Your password has been reset successfully."
      );

      setForm({
        new_password: "",
        new_password_confirm: "",
      });

      setTimeout(() => {
        router.push("/login");
      }, 1800);
    } catch (err: any) {
      if (typeof err === "object" && err !== null) {
        setFieldErrors(err);
        if (err.detail) {
          setGeneralError(err.detail);
        }
      } else {
        setGeneralError("Password reset failed. Please try again.");
      }
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
              Set a new password and get back to work securely.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">
              Use your secure reset link to create a new password and restore
              access to your company workspace.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-slate-200">
              Make sure your new password is strong and easy for you to manage.
            </p>
          </div>
        </div>

        <div className="flex w-full items-center justify-center px-6 py-10 lg:w-1/2 lg:px-10">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
                Reset your password
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Enter your new password below to complete the reset.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="new_password"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  New password
                </label>
                <input
                  id="new_password"
                  name="new_password"
                  type="password"
                  value={form.new_password}
                  onChange={handleChange}
                  required
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                  placeholder="Create a new secure password"
                />
                {getFieldError("new_password") ? (
                  <p className="mt-1 text-xs text-red-600">
                    {getFieldError("new_password")}
                  </p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="new_password_confirm"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Confirm new password
                </label>
                <input
                  id="new_password_confirm"
                  name="new_password_confirm"
                  type="password"
                  value={form.new_password_confirm}
                  onChange={handleChange}
                  required
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                  placeholder="Repeat your new password"
                />
                {getFieldError("new_password_confirm") ? (
                  <p className="mt-1 text-xs text-red-600">
                    {getFieldError("new_password_confirm")}
                  </p>
                ) : null}
              </div>

              {successMessage ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {successMessage}
                </div>
              ) : null}

              {generalError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {generalError}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading || !uid || !token}
                className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Updating password..." : "Update password"}
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
                href="/forgot-password"
                className="font-medium text-slate-900 underline underline-offset-4"
              >
                Request a new link
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}