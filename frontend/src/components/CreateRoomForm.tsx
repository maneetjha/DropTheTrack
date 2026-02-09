"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRoom } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function CreateRoomForm() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user) return;

    setLoading(true);
    try {
      const room = await createRoom(name.trim());
      router.push(`/room/${room.id}`);
    } catch (err) {
      console.error(err);
      alert("Failed to create room. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <form onSubmit={handleSubmit} className="flex w-full gap-3">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
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
  );
}
