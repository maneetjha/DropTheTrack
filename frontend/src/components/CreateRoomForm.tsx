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
    try { const room = await createRoom(name.trim()); router.push(`/room/${room.id}`); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to create room"); }
    finally { setLoading(false); }
  };

  if (!user) return null;

  return (
    <>
      <div className="neon-purple h-full p-7 sm:p-8">
        {/* Row: 80px icon LEFT · title+subtitle RIGHT */}
        <div className="flex items-start gap-5">
          <div className="flex h-[80px] w-[80px] shrink-0 items-center justify-center rounded-full bg-[#7c3aed]">
            <svg className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <div className="pt-2">
            <h2 className="text-[20px] font-bold leading-tight text-white">Create a Room</h2>
            <p className="mt-1 text-[14px] leading-snug text-[#6b7280]">Start a listening session<br />with friends</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-7">
          <input
            type="text" value={name}
            onChange={(e) => { setName(e.target.value); setError(null); }}
            placeholder="Enter room name..."
            className="w-full rounded-lg px-4 py-3 text-[14px] text-white placeholder-[#4b5563] outline-none transition focus:border-[#7c3aed] focus:shadow-[0_0_10px_rgba(124,58,237,0.3)]"
            style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.1)" }}
            maxLength={30}
          />
          {error && <p className="mt-2 text-sm text-[#ef4444]">{error}</p>}

          {/* Compact purple pill button — NOT full width */}
          <div className="mt-4">
            <button type="submit" disabled={loading || !name.trim()}
              className="rounded-full bg-[#7c3aed] px-8 py-2.5 text-[15px] font-bold text-white transition-all duration-200 hover:shadow-[0_0_20px_rgba(124,58,237,0.6)] active:scale-[0.97] disabled:opacity-40 disabled:hover:shadow-none"
            >
              {loading ? "Creating..." : "Create Room"}
            </button>
          </div>
        </form>
      </div>

      {error && error.toLowerCase().includes("limit") && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-xl p-6 shadow-2xl" style={{ background: "#0f0f13", border: "1px solid rgba(255,255,255,0.1)" }}>
            <h3 className="mb-1 text-lg font-semibold text-white">Room limit reached</h3>
            <p className="mb-5 text-sm text-[#6b7280]">{error}</p>
            <button onClick={() => setError(null)} className="w-full rounded-lg bg-white/10 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15">Got it</button>
          </div>
        </div>
      )}
    </>
  );
}
