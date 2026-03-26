"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import Navbar from "@/components/Navbar";
import GoogleSignInButton from "@/components/GoogleSignInButton";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen duotone-bg">
      {/* Soft noise + vignette */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "url(data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='.55'/%3E%3C/svg%3E)",
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.10)_100%)]" />
      </div>

      <Navbar variant="duotone" />

      <main className="relative z-[1] mx-auto flex max-w-md flex-col items-center px-4 pt-28 sm:pt-32 pb-16">
        <h1 className="animate-fade-in-up-1 font-display mb-2 text-2xl sm:text-3xl text-ink">
          Welcome back
        </h1>
        <p className="animate-fade-in-up-2 mb-6 sm:mb-8 text-sm sm:text-base text-ink-muted">
          Log in to add songs and vote
        </p>

        <div className="animate-fade-in-up-3 glass-light w-full space-y-4 sm:space-y-5 rounded-2xl sm:rounded-3xl p-5 sm:p-6 ring-1 ring-black/10">
          {/* Email/Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-400">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-ink-muted">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full rounded-xl border border-white/50 bg-white/40 px-3.5 py-2.5 sm:px-4 sm:py-3 text-sm sm:text-base text-ink placeholder-[rgba(17,24,39,0.45)] outline-none transition focus:border-[rgba(140,198,232,0.80)] focus:ring-4 focus:ring-[rgba(140,198,232,0.18)]"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-ink-muted">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full rounded-xl border border-white/50 bg-white/40 px-3.5 py-2.5 sm:px-4 sm:py-3 text-sm sm:text-base text-ink placeholder-[rgba(17,24,39,0.45)] outline-none transition focus:border-[rgba(244,108,82,0.60)] focus:ring-4 focus:ring-[rgba(244,108,82,0.14)]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-ripple duotone-cta w-full rounded-full py-2.5 sm:py-3 text-sm sm:text-base font-semibold text-white transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Logging in..." : "Log In"}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-black/10" />
            <span className="text-xs text-ink-muted">or</span>
            <div className="h-px flex-1 bg-black/10" />
          </div>

          {/* Google Sign In */}
          <GoogleSignInButton variant="duotone" />

          <p className="text-center text-sm text-ink-muted">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-semibold text-[#f46c52] hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
