"use client";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Music, LogOut } from "lucide-react";

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex h-[60px] items-center justify-between bg-[#09090b] px-6 sm:px-10" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7c3aed]"><Music className="h-4 w-4 text-white" /></div>
        <span className="text-lg font-bold text-white sm:text-xl">DropTheTrack</span>
      </Link>
      <div className="flex items-center gap-3">
        {loading ? <div className="h-5 w-20 animate-pulse rounded bg-white/5" /> : user ? (
          <>
            <span className="hidden text-sm text-[#6b7280] sm:block">{user.name}</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7c3aed] text-xs font-bold text-white">{user.name.charAt(0).toUpperCase()}</div>
            <button onClick={logout} className="flex items-center gap-1.5 rounded-full bg-[#06b6d4] px-4 py-1.5 text-sm font-semibold text-black transition hover:brightness-110 active:scale-[0.97]">
              <LogOut className="h-3.5 w-3.5" /><span className="hidden sm:inline">Logout</span>
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className="rounded-lg border border-white/10 px-4 py-1.5 text-sm font-medium text-white transition hover:border-[#7c3aed] hover:bg-[rgba(124,58,237,0.1)]">Log in</Link>
            <Link href="/register" className="rounded-lg bg-[#7c3aed] px-4 py-1.5 text-sm font-medium text-white transition hover:shadow-[0_0_16px_rgba(124,58,237,0.4)]">Sign up</Link>
          </>
        )}
      </div>
    </header>
  );
}
