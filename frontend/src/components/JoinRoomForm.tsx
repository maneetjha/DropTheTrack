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
    setError(""); setLoading(true);
    try { const room = await joinRoomByCode(code.trim()); router.push(`/room/${room.id}`); }
    catch (err) { setError(err instanceof Error ? err.message : "Room not found"); }
    finally { setLoading(false); }
  };

  return (
    <div className="neon-cyan h-full p-7 sm:p-8">
      {/* Row: 80px icon LEFT · title+subtitle RIGHT */}
      <div className="flex items-start gap-5">
        <div className="flex h-[80px] w-[80px] shrink-0 items-center justify-center rounded-full bg-[#06b6d4]">
          <svg className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M13.8 12H3" />
          </svg>
        </div>
        <div className="pt-2">
          <h2 className="text-[20px] font-bold leading-tight text-white">Join by Code</h2>
          <p className="mt-1 text-[14px] leading-snug text-[#6b7280]">Enter room code (e.g. A3F1B2)</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="mt-7">
        <input
          type="text" value={code}
          onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(""); }}
          placeholder="Enter room code (e.g. A3F1B2)"
          className="w-full rounded-lg px-4 py-3 text-center font-mono text-lg tracking-widest text-white placeholder:font-sans placeholder:text-[14px] placeholder:tracking-normal placeholder-[#4b5563] outline-none transition focus:border-[#06b6d4] focus:shadow-[0_0_10px_rgba(6,182,212,0.3)]"
          style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.1)" }}
          maxLength={6}
        />
        {error && <p className="mt-2 text-sm text-[#ef4444]">{error}</p>}

        {/* Compact FILLED cyan pill button — NOT full width, matching mockup */}
        <div className="mt-4">
          <button type="submit" disabled={loading || !code.trim()}
            className="rounded-full bg-[#06b6d4] px-10 py-2.5 text-[15px] font-bold text-black transition-all duration-200 hover:shadow-[0_0_20px_rgba(6,182,212,0.5)] active:scale-[0.97] disabled:opacity-40 disabled:hover:shadow-none"
          >
            {loading ? "Joining..." : "Join"}
          </button>
        </div>
      </form>
    </div>
  );
}
