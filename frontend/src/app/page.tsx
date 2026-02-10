"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";
import CreateRoomForm from "@/components/CreateRoomForm";
import JoinRoomForm from "@/components/JoinRoomForm";
import RoomList from "@/components/RoomList";
import { useAuth } from "@/lib/auth-context";

const features = [
  {
    icon: "🎵",
    title: "Crowd-Powered",
    description: "Democracy meets music. Every vote shapes the vibe.",
    gradient: "from-[var(--primary)] to-[var(--accent-purple)]",
  },
  {
    icon: "🔗",
    title: "Share Instantly",
    description: "One link. Unlimited participants. Zero friction.",
    gradient: "from-[var(--accent-blue)] to-[var(--primary)]",
  },
  {
    icon: "⚡",
    title: "Real-Time Sync",
    description: "Live updates. Instant reactions. Pure energy.",
    gradient: "from-[var(--secondary)] to-[var(--primary)]",
  },
];

export default function Home() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen bg-[var(--bg-dark)]">
      {/* Noise overlay */}
      <div className="noise-overlay" />

      {/* Animated background orbs */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-25">
        <div className="animate-float absolute -left-[10%] -top-[10%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,var(--primary)_0%,transparent_70%)] blur-[80px]" />
        <div className="animate-float-delay-5 absolute -bottom-[10%] -right-[10%] h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,var(--accent-blue)_0%,transparent_70%)] blur-[80px]" />
        <div className="animate-float-delay-10 absolute left-1/2 top-1/2 h-[350px] w-[350px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,var(--accent-purple)_0%,transparent_70%)] blur-[80px]" />
      </div>

      {/* Navbar */}
      <Navbar />

      {/* Hero — shown when NOT logged in */}
      {!loading && !user && (
        <section className="relative z-[1] flex min-h-screen flex-col items-center justify-center px-5 pt-32 pb-16 text-center sm:px-8">
          {/* Badge */}
          <div className="animate-fade-in-up-1 mb-8 inline-flex items-center gap-2 rounded-full border border-[rgba(107,90,237,0.25)] bg-[rgba(107,90,237,0.08)] px-5 py-2 text-sm font-medium text-[var(--primary)]">
            <span className="animate-pulse-dot h-2 w-2 rounded-full bg-[var(--primary)]" />
            Collaborative Music Experience
          </div>

          {/* Title */}
          <h1 className="animate-fade-in-up-2 font-display text-gradient-hero mb-6 text-[clamp(3rem,10vw,7rem)] leading-[1.1] tracking-tight">
            Drop the Track
          </h1>

          {/* Subtitle */}
          <p className="animate-fade-in-up-3 mx-auto mb-4 max-w-[600px] text-[clamp(1.125rem,2.5vw,1.5rem)] leading-relaxed text-[var(--text-muted)]">
            Create a room. Share the link. Add songs.
          </p>

          {/* Description */}
          <p className="animate-fade-in-up-4 mx-auto mb-10 max-w-[500px] text-[clamp(1rem,2vw,1.25rem)] text-[var(--text-muted)]">
            Upvote.
            <br />
            The crowd decides what plays next.
          </p>

          {/* CTA Buttons */}
          <div className="animate-fade-in-up-5 flex flex-col items-stretch gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/register"
              className="btn-ripple rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] px-10 py-4 text-lg font-semibold text-[var(--text-light)] shadow-[0_10px_30px_rgba(107,90,237,0.2)] transition-all hover:-translate-y-0.5 hover:shadow-[0_15px_40px_rgba(107,90,237,0.3)]"
            >
              Get Started
            </Link>
            <Link
              href="/login"
              className="btn-ripple rounded-full border-2 border-white/20 bg-transparent px-10 py-4 text-lg font-semibold text-[var(--text-light)] transition-all hover:border-[var(--primary)] hover:bg-[rgba(107,90,237,0.1)]"
            >
              Log In
            </Link>
          </div>

          {/* Feature Cards */}
          <div className="animate-fade-in-up-6 mx-auto mt-16 grid max-w-[1200px] gap-6 px-4 sm:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="feature-card-border group relative overflow-hidden rounded-3xl border border-white/5 bg-white/[0.02] p-8 transition-all duration-400 hover:-translate-y-2 hover:border-[rgba(107,90,237,0.3)] hover:bg-white/[0.04] hover:shadow-[0_20px_60px_rgba(107,90,237,0.12)]"
              >
                <div
                  className={`mb-6 flex h-[60px] w-[60px] items-center justify-center rounded-2xl bg-gradient-to-br ${f.gradient} text-3xl`}
                >
                  {f.icon}
                </div>
                <h3 className="mb-3 text-2xl font-bold text-[var(--text-light)]">
                  {f.title}
                </h3>
                <p className="leading-relaxed text-[var(--text-muted)]">
                  {f.description}
                </p>
              </div>
            ))}
          </div>

          {/* Scroll Indicator */}
          <div className="animate-bounce-arrow absolute bottom-8 left-1/2">
            <svg
              className="h-8 w-8 stroke-[var(--primary)]"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3"
              />
            </svg>
          </div>
        </section>
      )}

      {/* Dashboard — shown when logged in */}
      {!loading && user && (
        <main className="relative z-[1] mx-auto max-w-3xl px-4 pt-28 pb-16 sm:px-6">
          <div className="animate-fade-in-up mb-10">
            <h1 className="font-display text-3xl text-[var(--text-light)] sm:text-4xl">
              Welcome back, {user.name.split(" ")[0]}
            </h1>
            <p className="mt-2 text-[var(--text-muted)]">
              Create a room or join an existing one
            </p>
          </div>

          <div className="space-y-10">
            <section className="animate-fade-in-up-1">
              <h2 className="mb-4 text-lg font-semibold text-[var(--text-light)]">
                Create a Room
              </h2>
              <CreateRoomForm />
            </section>

            <section className="animate-fade-in-up-2">
              <h2 className="mb-4 text-lg font-semibold text-[var(--text-light)]">
                Join by Code
              </h2>
              <JoinRoomForm />
            </section>

            <section className="animate-fade-in-up-3">
              <RoomList />
            </section>
          </div>
        </main>
      )}
    </div>
  );
}
