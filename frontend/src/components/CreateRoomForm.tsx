"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRoom } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Music2 } from "lucide-react";

export default function CreateRoomForm() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!user) return;
    if (trimmed.length < 3) {
      setError("Room name is too short (min 3 characters).");
      return;
    }
    setError(null);
    setLoading(true);
    try { const room = await createRoom(name.trim()); router.push(`/room/${room.id}`); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to create room"); }
    finally { setLoading(false); }
  };

  if (!user) return null;

  return (
    <>
      <div className="glass-light h-full rounded-3xl p-7 ring-1 ring-black/10 sm:p-8">
        <div className="flex items-start gap-5">
          <div className="rounded-[22px] bg-gradient-to-br from-[#f46c52]/80 via-white/40 to-[#8cc6e8]/80 p-[2px] shadow-[0_18px_44px_rgba(17,24,39,0.10)]">
            <div className="flex h-[74px] w-[74px] shrink-0 items-center justify-center rounded-[20px] bg-white/65 ring-1 ring-white/70">
              <Music2 className="h-8 w-8 text-ink" />
            </div>
          </div>
          <div className="pt-2">
            <h2 className="text-[20px] font-bold leading-tight text-ink">Create a Room</h2>
            <p className="mt-1 text-[14px] leading-snug text-ink-muted">Start a listening session with friends</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-7">
          <input
            type="text" value={name}
            onChange={(e) => { setName(e.target.value); setError(null); }}
            placeholder="Enter room name"
            className="w-full rounded-2xl border border-white/50 bg-white/45 px-4 py-3 text-[14px] text-ink placeholder:font-sans placeholder:text-[14px] placeholder:tracking-normal placeholder-[rgba(17,24,39,0.58)] outline-none transition focus:border-[rgba(244,108,82,0.60)] focus:ring-4 focus:ring-[rgba(244,108,82,0.14)]"
            maxLength={30}
          />
          {error && <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>}

          {/* Compact purple pill button — NOT full width */}
          <div className="mt-4">
            <button
              type="submit"
              disabled={loading}
              className="btn-ripple duotone-cta rounded-full px-8 py-2.5 text-[15px] font-bold text-white transition-all duration-200 active:scale-[0.97] disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Room"}
            </button>
          </div>
        </form>
      </div>

      {error && error.toLowerCase().includes("limit") && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-light mx-4 w-full max-w-sm rounded-2xl p-6 ring-1 ring-black/10">
            <h3 className="mb-1 text-lg font-semibold text-ink">Room limit reached</h3>
            <p className="mb-5 text-sm text-ink-muted">{error}</p>
            <button onClick={() => setError(null)} className="w-full rounded-xl border border-black/10 bg-white/45 py-2.5 text-sm font-semibold text-ink transition hover:bg-white/65">Got it</button>
          </div>
        </div>
      )}
    </>
  );
}
