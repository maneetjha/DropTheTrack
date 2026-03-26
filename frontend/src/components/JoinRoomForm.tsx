"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { joinRoomByCode } from "@/lib/api";
import { ArrowRightCircle } from "lucide-react";

export default function JoinRoomForm() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    if (trimmed.length !== 6) {
      setError("Enter a 6‑character room code.");
      return;
    }
    setError(""); setLoading(true);
    try { const room = await joinRoomByCode(trimmed); router.push(`/room/${room.id}`); }
    catch (err) { setError(err instanceof Error ? err.message : "Room not found"); }
    finally { setLoading(false); }
  };

  return (
    <div
      className="glass-light h-full rounded-3xl p-7 ring-1 ring-black/10 sm:p-8"
      style={{
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.58) 0%, rgba(140,198,232,0.22) 55%, rgba(255,255,255,0.48) 100%)",
      }}
    >
      <div className="flex items-start gap-5">
        <div className="rounded-[22px] bg-gradient-to-br from-[#8cc6e8]/80 via-white/40 to-[#f46c52]/80 p-[2px] shadow-[0_18px_44px_rgba(17,24,39,0.10)]">
          <div className="flex h-[74px] w-[74px] shrink-0 items-center justify-center rounded-[20px] bg-white/65 ring-1 ring-white/70">
            <ArrowRightCircle className="h-8 w-8 text-ink" />
          </div>
        </div>
        <div className="pt-2">
          <h2 className="text-[20px] font-bold leading-tight text-ink">Join by Code</h2>
          <p className="mt-1 text-[14px] leading-snug text-ink-muted">Enter a room code (e.g. A3F1B2)</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="mt-7">
        <input
          type="text" value={code}
          onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(""); }}
          placeholder="Enter room code"
          className={`w-full rounded-2xl border border-white/50 bg-white/45 px-4 py-3 text-ink outline-none transition focus:border-[rgba(140,198,232,0.80)] focus:ring-4 focus:ring-[rgba(140,198,232,0.18)] placeholder:font-sans placeholder:text-[14px] placeholder:tracking-normal placeholder-[rgba(17,24,39,0.58)] ${
            code.trim()
              ? "font-mono text-[14px] tracking-[0.22em]"
              : "font-sans text-[14px] tracking-normal"
          }`}
          maxLength={6}
        />
        {error && <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>}

        {/* Compact FILLED cyan pill button — NOT full width, matching mockup */}
        <div className="mt-4">
          <button
            type="submit"
            disabled={loading}
            className="btn-ripple duotone-cta rounded-full px-10 py-2.5 text-[15px] font-bold text-white transition-all duration-200 active:scale-[0.97] disabled:opacity-50"
          >
            {loading ? "Joining..." : "Join"}
          </button>
        </div>
      </form>
    </div>
  );
}
