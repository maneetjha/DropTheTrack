"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRoom } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function CreateRoomForm() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user) return;
    setError(null);

    setLoading(true);
    try {
      const room = await createRoom(name.trim());
      router.push(`/room/${room.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <form onSubmit={handleSubmit} className="flex w-full gap-3">
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(null); }}
          placeholder="Enter room name..."
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[var(--text-light)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(107,90,237,0.2)]"
          maxLength={100}
        />
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="btn-ripple rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] px-6 py-3 font-semibold text-white shadow-[0_10px_30px_rgba(107,90,237,0.2)] transition-all hover:-translate-y-0.5 hover:shadow-[0_15px_40px_rgba(107,90,237,0.3)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Room"}
        </button>
      </form>

      {/* Error overlay */}
      {error && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm animate-fade-in-up rounded-2xl border border-white/10 bg-[var(--bg-darker)] p-6 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
              <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="mb-1 text-lg font-semibold text-[var(--text-light)]">
              Room limit reached
            </h3>
            <p className="mb-5 text-sm leading-relaxed text-[var(--text-muted)]">
              {error}
            </p>
            <button
              onClick={() => setError(null)}
              className="w-full rounded-xl bg-white/10 py-2.5 text-sm font-semibold text-[var(--text-light)] transition hover:bg-white/15"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
