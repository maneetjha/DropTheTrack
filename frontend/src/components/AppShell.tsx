"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode } from "react";
import { Home, Bookmark, User2, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import DuotoneLogoBadge from "@/components/DuotoneLogoBadge";
import { resolveAssetUrl } from "@/lib/api";

type NavItem = {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
};

const items: NavItem[] = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/library", label: "Library", Icon: Bookmark },
  { href: "/profile", label: "Profile", Icon: User2 },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const onLogout = () => {
    logout();
    router.push("/");
  };

  return (
    <div className="min-h-screen duotone-bg">
      {/* Top bar when sidebar is hidden (phone / small tablet) */}
      <header className="fixed top-0 left-0 right-0 z-40 flex h-[60px] items-center border-b border-black/10 bg-white/30 px-4 backdrop-blur-xl md:hidden">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <DuotoneLogoBadge size={40} />
          <span className="truncate text-[17px] font-extrabold tracking-tight text-ink">DropTheTrack</span>
        </Link>
      </header>

      {/* Sidebar: md+ (was lg-only, so many “desktop” widths saw no rail) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col border-r border-black/10 bg-white/25 backdrop-blur-xl md:flex">
        <div className="flex h-[72px] items-center gap-3 px-5">
          <DuotoneLogoBadge size={48} />
          <div className="min-w-0">
            <p className="truncate text-[22px] font-extrabold leading-none tracking-tight text-ink">DropTheTrack</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4">
          <div className="space-y-2">
            {items.map(({ href, label, Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-[13px] font-semibold transition ${
                    active
                      ? "bg-white/55 text-ink shadow-[0_18px_44px_rgba(17,24,39,0.10)] ring-1 ring-black/10"
                      : "text-ink-muted hover:bg-white/45 hover:text-ink"
                  }`}
                >
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl border transition ${
                    active ? "border-black/10 bg-white/60" : "border-black/10 bg-white/35 group-hover:bg-white/55"
                  }`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="px-4 pb-5">
          <div className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white/35 p-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#f46c52] to-[#8cc6e8] text-sm font-extrabold text-white shadow-[0_14px_34px_rgba(17,24,39,0.18)]">
              {user?.avatarUrl ? (
                <img src={resolveAssetUrl(user.avatarUrl) || ""} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                (user?.name || "U").charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-ink">{user?.name || "Guest"}</p>
              <p className="truncate text-[11px] text-ink-muted">{user?.email || "Signed in"}</p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 bg-white/45 text-ink-muted transition hover:bg-white/65 hover:text-ink"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content — pad under mobile top bar; indent when sidebar visible */}
      <div className="relative z-[1] mx-auto min-h-screen max-w-[1200px] px-5 pb-24 pt-[calc(60px+1rem)] sm:px-8 md:ml-[260px] md:max-w-none md:px-10 md:pt-8 lg:pt-10">
        {children}
      </div>

      {/* Bottom nav only when sidebar is hidden */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-black/10 bg-white/35 backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-[1200px] items-center justify-around px-4 py-2" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          {items.map(({ href, label, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-1 flex-col items-center gap-1 rounded-2xl py-2 text-[11px] font-semibold transition ${
                  active ? "text-ink" : "text-ink-muted"
                }`}
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 ${
                  active ? "bg-white/60" : "bg-white/35"
                }`}>
                  <Icon className="h-4 w-4" />
                </div>
                {label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={onLogout}
            className="flex flex-1 flex-col items-center gap-1 rounded-2xl py-2 text-[11px] font-semibold text-ink-muted transition hover:text-ink"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-white/35">
              <LogOut className="h-4 w-4" />
            </div>
            Logout
          </button>
        </div>
      </nav>
    </div>
  );
}

