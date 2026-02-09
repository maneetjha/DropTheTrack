"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function Navbar() {
  const { user, loading, logout } = useAuth();

  return (
    <header className="animate-slide-down fixed top-0 left-0 right-0 z-50 flex items-center justify-between border-b border-white/5 bg-[rgba(10,10,15,0.6)] px-6 py-4 backdrop-blur-xl sm:px-12">
      <Link href="/" className="flex items-center gap-3 transition-transform hover:scale-105">
        <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--accent-purple)]">
          <span className="animate-pulse-icon text-2xl">♪</span>
        </div>
        <span className="font-display text-xl text-[var(--text-light)] sm:text-2xl">
          DropTheTrack
        </span>
      </Link>

      <div className="flex items-center gap-3">
        {loading ? (
          <div className="h-5 w-20 animate-pulse rounded bg-white/10" />
        ) : user ? (
          <>
            <span className="hidden text-sm text-[var(--text-muted)] sm:block">
              {user.name}
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent-purple)] text-sm font-bold text-white">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <button
              onClick={logout}
              className="btn-ripple rounded-full border-2 border-white/20 bg-transparent px-5 py-2 text-sm font-semibold text-[var(--text-light)] transition-all hover:border-[var(--primary)] hover:bg-[rgba(107,90,237,0.1)]"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="btn-ripple rounded-full border-2 border-white/20 bg-transparent px-5 py-2 text-sm font-semibold text-[var(--text-light)] transition-all hover:border-[var(--primary)] hover:bg-[rgba(107,90,237,0.1)]"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="btn-ripple rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] px-5 py-2 text-sm font-semibold text-[var(--text-light)] shadow-[0_10px_30px_rgba(107,90,237,0.2)] transition-all hover:-translate-y-0.5 hover:shadow-[0_15px_40px_rgba(107,90,237,0.3)]"
            >
              Sign up
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
