"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import Navbar from "@/components/Navbar";
import GoogleSignInButton from "@/components/GoogleSignInButton";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await register(name, email, password);
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-dark)]">
      {/* Background orbs */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-25">
        <div className="animate-float absolute -left-[10%] -top-[10%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,var(--primary)_0%,transparent_70%)] blur-[80px]" />
        <div className="animate-float-delay-5 absolute -bottom-[10%] -right-[10%] h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,var(--accent-blue)_0%,transparent_70%)] blur-[80px]" />
      </div>

      <Navbar />

      <main className="relative z-[1] mx-auto flex max-w-md flex-col items-center px-4 pt-28 pb-16">
        <h1 className="animate-fade-in-up-1 font-display mb-2 text-3xl text-[var(--text-light)]">
          Create account
        </h1>
        <p className="animate-fade-in-up-2 mb-8 text-[var(--text-muted)]">
          Join the party and start dropping tracks
        </p>

        <div className="animate-fade-in-up-3 w-full space-y-5 rounded-3xl border border-white/5 bg-white/[0.02] p-6">
          {/* Email/Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-400">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="name" className="mb-1 block text-sm font-medium text-[var(--text-muted)]">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[var(--text-light)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(107,90,237,0.2)]"
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-[var(--text-muted)]">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[var(--text-light)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(107,90,237,0.2)]"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-[var(--text-muted)]">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
                minLength={6}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[var(--text-light)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(107,90,237,0.2)]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-ripple w-full rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] py-3 font-semibold text-white shadow-[0_10px_30px_rgba(107,90,237,0.2)] transition-all hover:-translate-y-0.5 hover:shadow-[0_15px_40px_rgba(107,90,237,0.3)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Creating account..." : "Sign Up"}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-[var(--text-muted)]">or</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          {/* Google Sign In */}
          <GoogleSignInButton />

          <p className="text-center text-sm text-[var(--text-muted)]">
            Already have an account?{" "}
            <Link href="/login" className="text-[var(--primary)] hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
