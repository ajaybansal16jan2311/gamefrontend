"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/lib/admin-auth-context";
import { getBaseUrl } from "@/lib/api";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(value: string): string | null {
  if (!value.trim()) return "Email is required";
  if (!EMAIL_REGEX.test(value.trim())) return "Enter a valid email address";
  return null;
}

function validatePassword(value: string): string | null {
  if (!value) return "Password is required";
  return null;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const { setAuthenticated } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    if (emailError || passwordError) {
      setFieldErrors({
        ...(emailError && { email: emailError }),
        ...(passwordError && { password: passwordError }),
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json().catch(() => ({}));
      const message =
        typeof data?.message === "string" ? data.message : "Login failed";

      if (!res.ok) {
        setError(message);
        return;
      }

      const csrfToken = typeof data?.csrfToken === "string" ? data.csrfToken : null;
      if (csrfToken && typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("csrf_token", csrfToken);
      }

      setAuthenticated();
      router.push("/admin/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="w-full max-w-[400px] rounded-2xl bg-white/90 backdrop-blur-sm p-8 shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-slate-200/80">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">
            Admin Login
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Sign in to access the dashboard
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div
              role="alert"
              className="rounded-xl bg-red-50 border border-red-200/80 text-red-700 text-sm px-4 py-3 flex items-start gap-2"
            >
              <span className="shrink-0 mt-0.5" aria-hidden>
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
              <span>{error}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="admin-email"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Email
            </label>
            <input
              id="admin-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/80 focus:border-slate-400 transition-shadow disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder="admin@example.com"
            />
            {fieldErrors.email && (
              <p className="mt-1.5 text-sm text-red-600">{fieldErrors.email}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="admin-password"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 pr-11 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/80 focus:border-slate-400 transition-shadow disabled:opacity-60 disabled:cursor-not-allowed"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                disabled={loading}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400/80 focus:ring-offset-0 disabled:opacity-50 transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878a4.5 4.5 0 106.262 6.262M4.031 11.117A10.047 10.047 0 003 12c0 4.478 2.943 8.268 7 9.543 2.244-1.062 4.23-2.56 5.857-4.031M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>
            {fieldErrors.password && (
              <p className="mt-1.5 text-sm text-red-600">
                {fieldErrors.password}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-slate-800 text-white font-medium py-3 shadow-sm hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 min-h-[48px]"
          >
            {loading ? (
              <>
                <svg
                  className="w-5 h-5 animate-spin text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Signing in…</span>
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
