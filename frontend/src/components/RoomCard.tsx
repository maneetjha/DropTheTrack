"use client";
import Link from "next/link";
import { Room } from "@/lib/api";
import { ArrowRight, Music2, Users } from "lucide-react";

interface RoomCardProps {
  room: Room;
  badge?: "host";
}

export default function RoomCard({ room, badge }: RoomCardProps) {
  const song = room.currentSong;
  const liveCount = room.liveListeners ?? 0;
  const isHost = badge === "host";

  // Dashboard accents (duotone): coral for my rooms, sky for joined rooms
  const accentHex = isHost ? "#f46c52" : "#8cc6e8";

  let songDisplay = "";
  if (song?.title) {
    songDisplay = song.title;
  }

  return (
    <Link
      href={`/room/${room.id}`}
      className="group flex items-center gap-4 rounded-3xl border border-black/10 bg-white/40 p-4 shadow-[0_18px_44px_rgba(17,24,39,0.08)] transition-all duration-300 hover:-translate-y-1 hover:bg-white/55 hover:shadow-[0_26px_70px_rgba(17,24,39,0.10)] sm:p-5"
    >
      {/* Thumbnail — fixed 72×72 */}
      <div
        className="flex h-[72px] w-[72px] min-w-[72px] items-center justify-center overflow-hidden rounded-xl"
        style={{
          background: song?.thumbnail
            ? undefined
            : `linear-gradient(135deg, ${accentHex}33 0%, rgba(255,255,255,0.55) 100%)`,
        }}
      >
        {song?.thumbnail ? (
          <img
            src={song.thumbnail}
            alt={song.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <Music2 className="h-7 w-7 opacity-70" style={{ color: accentHex }} />
        )}
      </div>

      {/* Info — fills remaining space */}
      <div className="relative z-10 min-w-0 flex-1">
        <h3 className="truncate text-[15px] font-bold text-ink">
          {room.name}
        </h3>
        {song ? (
          <p className="mt-1 truncate text-[12px] text-ink-muted">
            {songDisplay}
          </p>
        ) : (
          <p className="mt-1 text-[12px] italic text-ink-muted">
            No song playing
          </p>
        )}
        <p className="mt-1 flex items-center gap-1 text-[11px]" style={{ color: accentHex }}>
          <Users className="h-3 w-3" />
          {liveCount} listening
        </p>
      </div>

      {/* Arrow button */}
      <div
        className="flex h-10 w-10 min-w-[40px] items-center justify-center rounded-full border border-black/10 bg-white/35 text-ink-muted transition-all duration-200 group-hover:bg-white/60 group-hover:text-ink"
      >
        <ArrowRight className="h-4 w-4" />
      </div>
    </Link>
  );
}
