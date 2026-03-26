"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { LogOut, Bookmark } from "lucide-react";
import DuotoneLogoBadge from "@/components/DuotoneLogoBadge";
import { resolveAssetUrl } from "@/lib/api";

export default function Navbar({
  variant = "dark",
  brand = "icon+text",
  hideLibrary = false,
  onAvatarClick,
}: {
  variant?: "dark" | "aurora" | "duotone" | "library";
  brand?: "icon+text" | "text";
  /** When true, Library links are hidden (e.g. in-room; use queue panel for playlists). */
  hideLibrary?: boolean;
  /** If set, avatar is a button that calls this (e.g. confirm leave room view for profile). */
  onAvatarClick?: () => void;
}) {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const isAurora = variant === "aurora";
  const isDuotone = variant === "duotone";
  const isLibrary = variant === "library";
  const isLight = isAurora || isDuotone;
  const onLibraryRoute = pathname === "/library" || pathname.startsWith("/library/");

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 flex h-[72px] items-center justify-between px-5 font-sans antialiased sm:px-8 ${
        isLibrary
          ? "bg-black text-white"
          : isLight
            ? "bg-white/25 backdrop-blur-xl"
            : "bg-[var(--background)]"
      }`}
      style={{
        borderBottom: isLibrary
          ? "1px solid rgba(255,255,255,0.08)"
          : isLight
            ? "1px solid rgba(0,0,0,0.06)"
            : "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <Link
        href="/"
        className={`flex items-center gap-3 transition-opacity hover:opacity-85 ${
          isLibrary ? "text-white" : ""
        }`}
      >
        {brand === "icon+text" ? (
          isDuotone ? (
            <DuotoneLogoBadge size={48} />
          ) : (
            <div
              className={`relative h-11 w-11 shrink-0 overflow-hidden rounded-xl ring-1 sm:h-12 sm:w-12 ${
                isLibrary
                  ? "bg-zinc-950 ring-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  : isLight
                    ? "bg-white/55 ring-black/10 shadow-[0_18px_40px_rgba(17,24,39,0.16)]"
                    : "bg-white/[0.06] ring-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_18px_44px_rgba(0,0,0,0.55)]"
              }`}
            >
              <div
                className={`pointer-events-none absolute inset-0 ${
                isLibrary
                  ? "bg-[radial-gradient(circle_at_30%_25%,rgba(244,108,82,0.20)_0%,transparent_55%),radial-gradient(circle_at_72%_78%,rgba(140,198,232,0.18)_0%,transparent_55%)]"
                    : isLight
                      ? "bg-[radial-gradient(circle_at_30%_20%,rgba(244,108,82,0.25)_0%,transparent_55%),radial-gradient(circle_at_75%_80%,rgba(140,198,232,0.22)_0%,transparent_55%)]"
                      : "bg-[radial-gradient(circle_at_30%_20%,rgba(244,108,82,0.20)_0%,transparent_55%),radial-gradient(circle_at_75%_80%,rgba(140,198,232,0.18)_0%,transparent_55%)]"
                }`}
                aria-hidden
              />
              <Image src="/logo-clean.png" alt="DropTheTrack logo" fill className="object-contain p-1.5" priority />
            </div>
          )
        ) : null}
        <span
          className={`text-[17px] font-bold tracking-tight sm:text-[1.35rem] ${
            isLibrary ? "text-white" : isLight ? "text-ink" : "text-white"
          }`}
        >
          DropTheTrack
        </span>
      </Link>
      <div className="flex items-center gap-2.5 sm:gap-3">
        {loading ? (
          <div
            className={`h-5 w-20 animate-pulse rounded-md ${
              isLibrary ? "bg-white/10" : isLight ? "bg-black/5" : "bg-white/5"
            }`}
          />
        ) : user ? (
          <>
            {!hideLibrary && (
              <>
                <Link
                  href="/library"
                  className={`hidden items-center gap-2 rounded-xl border px-3.5 py-2 text-[13px] font-semibold tracking-wide transition sm:inline-flex ${
                    isLibrary
                      ? onLibraryRoute
                        ? "border-white/22 bg-white/[0.10] text-white"
                        : "border-white/14 bg-zinc-950/80 text-white hover:border-white/22 hover:bg-white/[0.08]"
                      : isLight
                        ? "border border-black/10 bg-white/35 text-ink hover:bg-white/50"
                        : "border border-white/10 bg-white/[0.03] text-white hover:border-white/20 hover:bg-white/[0.06]"
                  }`}
                  title="My Library"
                >
                  <Bookmark className="h-4 w-4 shrink-0 opacity-90" strokeWidth={2} />
                  Library
                </Link>
                <Link
                  href="/library"
                  className={`flex h-10 w-10 items-center justify-center rounded-xl border sm:hidden ${
                    isLibrary
                      ? onLibraryRoute
                        ? "border-white/22 bg-white/[0.10] text-white"
                        : "border-white/14 bg-zinc-950/80 text-white"
                      : "border border-white/10 bg-white/[0.03] text-white"
                  }`}
                  title="My Library"
                  aria-label="Library"
                >
                  <Bookmark className="h-4 w-4" />
                </Link>
              </>
            )}
            {onAvatarClick ? (
              <button
                type="button"
                onClick={onAvatarClick}
                title="Profile"
                className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold transition hover:ring-2 hover:ring-[var(--brand)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] ${
                  isLibrary
                    ? "h-10 w-10 ring-2 ring-white/12 ring-offset-2 ring-offset-black"
                    : isDuotone
                      ? "h-9 w-9 bg-gradient-to-br from-[#f46c52] to-[#8cc6e8] text-white shadow-[0_14px_34px_rgba(17,24,39,0.18)]"
                      : isLight
                        ? "h-9 w-9 bg-black/10 text-ink"
                        : "h-9 w-9 bg-[var(--brand)] text-white"
                }`}
              >
                {user.avatarUrl ? (
                  <img
                    src={resolveAssetUrl(user.avatarUrl) || ""}
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span
                    className={
                      isLibrary ? "flex h-full w-full items-center justify-center bg-zinc-800 text-white" : ""
                    }
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </button>
            ) : (
              <div
                className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold ${
                  isLibrary
                    ? "h-10 w-10 ring-2 ring-white/12 ring-offset-2 ring-offset-black"
                    : isDuotone
                      ? "h-9 w-9 bg-gradient-to-br from-[#f46c52] to-[#8cc6e8] text-white shadow-[0_14px_34px_rgba(17,24,39,0.18)]"
                      : isLight
                        ? "h-9 w-9 bg-black/10 text-ink"
                        : "h-9 w-9 bg-[var(--brand)] text-white"
                }`}
              >
                {user.avatarUrl ? (
                  <img
                    src={resolveAssetUrl(user.avatarUrl) || ""}
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span
                    className={
                      isLibrary ? "flex h-full w-full items-center justify-center bg-zinc-800 text-white" : ""
                    }
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={logout}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-bold tracking-wide transition active:scale-[0.98] sm:px-4 ${
                isLibrary
                  ? "border border-white/18 bg-white/[0.08] text-white hover:border-[#f46c52]/40 hover:bg-[#f46c52]/12"
                  : isLight
                    ? "bg-black/10 text-ink hover:bg-black/15"
                    : "border border-white/12 bg-white/[0.06] text-white hover:border-[#f46c52]/35 hover:bg-[#f46c52]/10"
              }`}
            >
              <LogOut className="h-4 w-4 shrink-0" strokeWidth={2.25} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className={`rounded-xl px-4 py-2 text-sm font-semibold tracking-wide transition ${
                isLibrary
                  ? "border border-white/14 bg-zinc-950/80 text-white hover:border-white/22 hover:bg-white/[0.07]"
                  : isLight
                    ? "border border-black/10 bg-white/35 text-ink hover:bg-white/55"
                    : "border border-white/10 text-white hover:border-[var(--brand)] hover:bg-[var(--brand-glow)]"
              }`}
            >
              Log in
            </Link>
            <Link
              href="/register"
              className={`rounded-xl px-4 py-2 text-sm font-bold tracking-wide transition ${
                isLibrary
                  ? "duotone-cta text-white hover:brightness-105"
                  : isAurora
                    ? "aurora-cta text-white hover:brightness-105"
                    : isDuotone
                      ? "duotone-cta text-white hover:brightness-105"
                      : "bg-[var(--brand)] text-white hover:shadow-[0_0_16px_var(--brand-glow)]"
              }`}
            >
              Sign up
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
