"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";
import CreateRoomForm from "@/components/CreateRoomForm";
import JoinRoomForm from "@/components/JoinRoomForm";
import RoomList from "@/components/RoomList";
import { useAuth } from "@/lib/auth-context";

const features = [
  { icon: "🎵", title: "Crowd-Powered", description: "Democracy meets music. Every vote shapes the vibe.", gradient: "from-[var(--primary)] to-[var(--accent-purple)]" },
  { icon: "🔗", title: "Share Instantly", description: "One link. Unlimited participants. Zero friction.", gradient: "from-[var(--accent-blue)] to-[var(--primary)]" },
  { icon: "⚡", title: "Real-Time Sync", description: "Live updates. Instant reactions. Pure energy.", gradient: "from-[var(--secondary)] to-[var(--primary)]" },
];

export default function Home() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen bg-[#09090b]">
      <Navbar />

      {/* ---- Pre-login hero (unchanged) ---- */}
      {!loading && !user && (
        <>
          <div className="pointer-events-none fixed inset-0 z-0 opacity-25">
            <div className="animate-float absolute -left-[10%] -top-[10%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,var(--primary)_0%,transparent_70%)] blur-[80px]" />
            <div className="animate-float-delay-5 absolute -bottom-[10%] -right-[10%] h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,var(--accent-blue)_0%,transparent_70%)] blur-[80px]" />
          </div>
          <div className="noise-overlay" />
          <section className="relative z-[1] flex min-h-screen flex-col items-center justify-center px-5 pt-32 pb-16 text-center sm:px-8">
            <div className="animate-fade-in-up-1 mb-8 inline-flex items-center gap-2 rounded-full border border-[rgba(107,90,237,0.25)] bg-[rgba(107,90,237,0.08)] px-5 py-2 text-sm font-medium text-[var(--primary)]">
              <span className="animate-pulse-dot h-2 w-2 rounded-full bg-[var(--primary)]" />Collaborative Music Experience
            </div>
            <h1 className="animate-fade-in-up-2 font-display text-gradient-hero mb-6 text-[clamp(3rem,10vw,7rem)] leading-[1.1] tracking-tight">Drop the Track</h1>
            <p className="animate-fade-in-up-3 mx-auto mb-4 max-w-[600px] text-[clamp(1.125rem,2.5vw,1.5rem)] leading-relaxed text-[var(--text-muted)]">Create a room. Share the link. Add songs.</p>
            <p className="animate-fade-in-up-4 mx-auto mb-10 max-w-[500px] text-[clamp(1rem,2vw,1.25rem)] text-[var(--text-muted)]">Upvote.<br />The crowd decides what plays next.</p>
            <div className="animate-fade-in-up-5 flex flex-col items-stretch gap-4 sm:flex-row sm:justify-center">
              <Link href="/register" className="btn-ripple rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] px-8 py-3 text-base sm:px-10 sm:py-4 sm:text-lg font-semibold text-white shadow-[0_10px_30px_rgba(107,90,237,0.2)] transition-all hover:-translate-y-0.5 hover:shadow-[0_15px_40px_rgba(107,90,237,0.3)]">Get Started</Link>
              <Link href="/login" className="btn-ripple rounded-full border-2 border-white/20 bg-transparent px-8 py-3 text-base sm:px-10 sm:py-4 sm:text-lg font-semibold text-white transition-all hover:border-[var(--primary)] hover:bg-[rgba(107,90,237,0.1)]">Log In</Link>
            </div>
            <div className="animate-fade-in-up-6 mx-auto mt-16 grid max-w-[1200px] gap-6 px-4 sm:grid-cols-3">
              {features.map((f) => (
                <div key={f.title} className="feature-card-border group relative overflow-hidden rounded-3xl border border-white/5 bg-white/[0.02] p-5 sm:p-8 transition-all duration-400 hover:-translate-y-2 hover:border-[rgba(107,90,237,0.3)] hover:bg-white/[0.04] hover:shadow-[0_20px_60px_rgba(107,90,237,0.12)]">
                  <div className={`mb-4 sm:mb-6 flex h-[44px] w-[44px] sm:h-[60px] sm:w-[60px] items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br ${f.gradient} text-xl sm:text-3xl`}>{f.icon}</div>
                  <h3 className="mb-2 sm:mb-3 text-lg sm:text-2xl font-bold text-white">{f.title}</h3>
                  <p className="text-sm sm:text-base leading-relaxed text-[var(--text-muted)]">{f.description}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* ---- Dashboard ---- */}
      {!loading && user && (
        <main className="relative min-h-screen overflow-hidden">
          {/* Background blobs matching mockup */}
          <div className="pointer-events-none absolute inset-0 z-0">
            <div className="absolute -right-36 -top-24 h-[550px] w-[550px] rounded-full opacity-[0.28]" style={{ background: "radial-gradient(circle, rgba(6,182,212,0.4) 0%, transparent 65%)", filter: "blur(70px)" }} />
            <div className="absolute -left-28 top-[35%] h-[400px] w-[400px] rounded-full opacity-[0.18]" style={{ background: "radial-gradient(circle, rgba(124,58,237,0.35) 0%, transparent 65%)", filter: "blur(70px)" }} />
          </div>

          <div className="relative z-[1] mx-auto max-w-[1200px] px-5 pt-[60px] pb-6 sm:px-8 lg:px-10">

            {/* Hero — LEFT aligned */}
            <div className="dash-s1 pt-10 pb-10 md:pt-12 md:pb-12">
              <h1 className="text-[32px] font-bold leading-[1.2] text-white md:text-[48px]">Welcome back, {user.name.split(" ")[0]}</h1>
              <p className="mt-2 text-[16px] text-[#6b7280]">Create a room or join an existing one</p>
            </div>

            {/* Action cards — flexbox, two cols */}
            <div className="dash-s2 flex flex-col gap-6 md:flex-row">
              <div className="flex-1"><CreateRoomForm /></div>
              <div className="flex-1"><JoinRoomForm /></div>
            </div>

            {/* Rooms — full width */}
            <div className="dash-s3 mt-12">
              <RoomList />
            </div>

          </div>
        </main>
      )}
    </div>
  );
}
