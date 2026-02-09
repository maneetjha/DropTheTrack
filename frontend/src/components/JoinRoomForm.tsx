"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { joinRoomByCode } from "@/lib/api";

export default function JoinRoomForm() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setError("");
    setLoading(true);
    try {
      const room = await joinRoomByCode(code.trim());
      router.push(`/room/${room.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Room not found");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex w-full gap-3">
        <input
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setError("");
          }}
          placeholder="Enter room code (e.g. A3F1B2)"
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center font-mono text-lg tracking-widest text-[var(--text-light)] placeholder-[var(--text-muted)] placeholder:text-sm placeholder:tracking-normal placeholder:font-sans outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(107,90,237,0.2)]"
          maxLength={6}
        />
        <button
          type="submit"
          disabled={loading || !code.trim()}
          className="btn-ripple rounded-full border-2 border-white/20 bg-transparent px-6 py-3 font-semibold text-[var(--text-light)] transition-all hover:border-[var(--primary)] hover:bg-[rgba(107,90,237,0.1)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Joining..." : "Join"}
        </button>
      </div>
      {error && (
        <p className="text-center text-sm text-red-400">{error}</p>
      )}
    </form>
  );
}
