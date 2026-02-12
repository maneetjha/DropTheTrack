"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Music, LogOut } from "lucide-react";

export default function Navbar() {
  const { user, loading, logout } = useAuth();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 sm:px-6">
      {/* Left: Logo */}
      <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand)]">
          <Music className="h-4 w-4 text-white" />
        </div>
        <span className="font-display text-[20px] font-bold text-[var(--text-primary)]">
          DropTheTrack
        </span>
      </Link>

      {/* Right: User */}
      <div className="flex items-center gap-3">
        {loading ? (
          <div className="h-5 w-20 animate-pulse rounded bg-[var(--surface-hover)]" />
        ) : user ? (
          <>
            <span className="hidden text-sm text-[var(--text-secondary)] sm:block">
              {user.name}
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand)] text-xs font-bold text-white">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <button
              onClick={logout}
              className="text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
            >
              <span className="hidden sm:inline">Logout</span>
              <LogOut className="h-4 w-4 sm:hidden" />
            </button>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="rounded-lg border border-[var(--border)] bg-transparent px-4 py-1.5 text-sm font-medium text-[var(--text-primary)] transition-all hover:border-[var(--brand)] hover:bg-[var(--brand-glow)]"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="glow-button rounded-lg bg-[var(--brand)] px-4 py-1.5 text-sm font-medium text-white transition-all hover:brightness-110 active:scale-[0.97]"
            >
              Sign up
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
