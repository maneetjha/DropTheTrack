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

  // Accent colors: purple for my rooms, cyan for joined rooms
  const accent = isHost ? "124,58,237" : "6,182,212";
  const accentHex = isHost ? "#7c3aed" : "#06b6d4";

  let songDisplay = "";
  if (song?.title) {
    songDisplay = song.title;
  }

  return (
    <Link
      href={`/room/${room.id}`}
      className={`dash-room-card group flex items-center gap-4 p-4 sm:p-5 ${!isHost ? "dash-room-card-cyan" : ""}`}
    >
      {/* Thumbnail — fixed 72×72 */}
      <div
        className="flex h-[72px] w-[72px] min-w-[72px] items-center justify-center overflow-hidden rounded-xl"
        style={{
          background: song?.thumbnail
            ? undefined
            : `linear-gradient(135deg, rgba(${accent},0.2) 0%, rgba(30,30,45,0.8) 100%)`,
        }}
      >
        {song?.thumbnail ? (
          <img
            src={song.thumbnail}
            alt={song.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <Music2 className="h-7 w-7 opacity-60" style={{ color: accentHex }} />
        )}
      </div>

      {/* Info — fills remaining space */}
      <div className="relative z-10 min-w-0 flex-1">
        <h3 className="truncate text-[15px] font-bold text-white">
          {room.name}
        </h3>
        {song ? (
          <p className="mt-1 truncate text-[12px] text-[#a1a1aa]">
            {songDisplay}
          </p>
        ) : (
          <p className="mt-1 text-[12px] italic text-[#52525b]">
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
        className="flex h-10 w-10 min-w-[40px] items-center justify-center rounded-full border border-white/10 text-white/40 transition-all duration-200 group-hover:text-white"
        style={{ ["--hover-border" as string]: accentHex }}
      >
        <ArrowRight className="h-4 w-4" />
      </div>
    </Link>
  );
}
