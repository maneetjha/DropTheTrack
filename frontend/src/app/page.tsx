"use client";

import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import AppShell from "@/components/AppShell";
import CreateRoomForm from "@/components/CreateRoomForm";
import JoinRoomForm from "@/components/JoinRoomForm";
import RoomList from "@/components/RoomList";
import { useAuth } from "@/lib/auth-context";
import { Music2, Link2, Zap } from "lucide-react";

const features = [
  { icon: Music2, title: "Crowd-Powered", description: "Democracy meets music. Every vote shapes the vibe.", gradient: "from-[#f46c52] to-[#8cc6e8]" },
  { icon: Link2, title: "Share Instantly", description: "One link. Unlimited participants. Zero friction.", gradient: "from-[#8cc6e8] to-[#f46c52]" },
  { icon: Zap, title: "Real-Time Sync", description: "Live updates. Instant reactions. Pure energy.", gradient: "from-[#f48a72] to-[#8cc6e8]" },
];

export default function Home() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen duotone-bg">
      {!loading && !user ? <Navbar variant="duotone" brand="icon+text" /> : null}

      {/* ---- Pre-login hero (unchanged) ---- */}
      {!loading && !user && (
        <>
          {/* Soft noise + vignette (matches auth pages) */}
          <div className="pointer-events-none fixed inset-0 z-0">
            <div
              className="absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage:
                  "url(data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='.55'/%3E%3C/svg%3E)",
              }}
            />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.10)_100%)]" />
          </div>
          <section className="relative z-[1] flex min-h-screen flex-col items-center justify-center px-5 pt-32 pb-16 text-center sm:px-8">
            <div className="animate-fade-in-up-1 mb-8 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/40 px-5 py-2 text-sm font-semibold text-ink shadow-[0_18px_44px_rgba(17,24,39,0.08)]">
              <span className="animate-pulse-dot h-2 w-2 rounded-full bg-[#f46c52]" />Collaborative Music Experience
            </div>
            <div className="animate-fade-in-up-2 mb-6 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
              <div className="rounded-[30px] bg-[conic-gradient(from_180deg_at_50%_50%,rgba(244,108,82,0.85),rgba(140,198,232,0.85),rgba(244,108,82,0.85))] p-[2px] shadow-[0_28px_80px_rgba(17,24,39,0.16)]">
                <div className="relative h-[84px] w-[84px] overflow-hidden rounded-[28px] bg-white/60 ring-1 ring-black/10 sm:h-[120px] sm:w-[120px]">
                  <div
                    className="pointer-events-none absolute inset-0 opacity-[0.9]"
                    style={{
                      background:
                        "radial-gradient(circle at 25% 20%, rgba(244,108,82,0.22) 0%, transparent 55%), radial-gradient(circle at 75% 80%, rgba(140,198,232,0.20) 0%, transparent 55%)",
                    }}
                    aria-hidden
                  />
                  <Image
                    src="/logo-clean.png"
                    alt="DropTheTrack"
                    fill
                    priority
                    className="object-contain p-2.5 drop-shadow-[0_18px_44px_rgba(17,24,39,0.18)]"
                  />
                  <div className="pointer-events-none absolute inset-0 rounded-[28px] ring-1 ring-white/60" aria-hidden />
                </div>
              </div>
              <h1 className="font-display text-[clamp(3rem,10vw,6.2rem)] leading-[1.02] tracking-tight text-ink">
                Drop the{" "}
                <span className="text-gradient-duotone">Track</span>
              </h1>
            </div>
            <p className="animate-fade-in-up-3 mx-auto mb-4 max-w-[600px] text-[clamp(1.125rem,2.5vw,1.5rem)] leading-relaxed text-ink-muted">
              Create a room. Share the link. Add songs.
            </p>
            <p className="animate-fade-in-up-4 mx-auto mb-10 max-w-[500px] text-[clamp(1rem,2vw,1.25rem)] text-ink-muted">
              Upvote.<br />The crowd decides what plays next.
            </p>
            <div className="animate-fade-in-up-5 flex flex-col items-stretch gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/register"
                className="btn-ripple duotone-cta rounded-full px-8 py-3 text-base sm:px-10 sm:py-4 sm:text-lg font-semibold text-white transition-all hover:-translate-y-0.5"
              >
                Get Started
              </Link>
              <Link
                href="/login"
                className="btn-ripple rounded-full border border-black/10 bg-white/45 px-8 py-3 text-base sm:px-10 sm:py-4 sm:text-lg font-semibold text-ink transition-all hover:bg-white/65"
              >
                Log In
              </Link>
            </div>
            <div className="animate-fade-in-up-6 mx-auto mt-16 grid max-w-[1200px] gap-6 px-4 sm:grid-cols-3">
              {features.map((f) => (
                <div key={f.title} className="group relative overflow-hidden rounded-3xl border border-black/10 bg-white/40 p-5 sm:p-8 transition-all duration-400 hover:-translate-y-2 hover:bg-white/55 hover:shadow-[0_28px_70px_rgba(17,24,39,0.10)]">
                  <div className="mb-4 sm:mb-6">
                    <div className={`relative inline-flex h-[46px] w-[46px] items-center justify-center rounded-2xl bg-gradient-to-br ${f.gradient} p-[1.5px] shadow-[0_18px_44px_rgba(17,24,39,0.10)] sm:h-[62px] sm:w-[62px]`}>
                      <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-white/65 ring-1 ring-white/70">
                        <f.icon className="h-5 w-5 text-ink sm:h-6 sm:w-6" />
                      </div>
                      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.60)_0%,transparent_60%)] opacity-60" aria-hidden />
                    </div>
                  </div>
                  <h3 className="mb-2 sm:mb-3 text-lg sm:text-2xl font-bold text-ink">{f.title}</h3>
                  <p className="text-sm sm:text-base leading-relaxed text-ink-muted">{f.description}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* ---- Dashboard ---- */}
      {!loading && user && (
        <AppShell>
          {/* Hero — LEFT aligned */}
          <div className="pb-10 pt-2 md:pb-12">
            <h1 className="text-[32px] font-bold leading-[1.15] text-ink md:text-[48px]">
              Welcome back,{" "}
              <span className="text-gradient-duotone">{user.name.split(" ")[0]}</span>
            </h1>
            <p className="mt-2 text-[16px] text-ink-muted">Create a room or join an existing one</p>
          </div>

          {/* Action cards */}
          <div className="flex flex-col gap-6 md:flex-row">
            <div className="flex-1"><CreateRoomForm /></div>
            <div className="flex-1"><JoinRoomForm /></div>
          </div>

          {/* Rooms */}
          <div className="mt-12">
            <RoomList />
          </div>
        </AppShell>
      )}
    </div>
  );
}
