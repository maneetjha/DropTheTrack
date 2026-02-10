"use client";

import Link from "next/link";
import { Room } from "@/lib/api";

interface RoomCardProps {
  room: Room;
  badge?: "host";
}

export default function RoomCard({ room, badge }: RoomCardProps) {
  const date = new Date(room.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Link
      href={`/room/${room.id}`}
      className="feature-card-border group relative block overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-[rgba(107,90,237,0.3)] hover:bg-white/[0.04] hover:shadow-[0_20px_60px_rgba(107,90,237,0.12)]"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate text-lg font-semibold text-[var(--text-light)] group-hover:text-[var(--accent-purple)]">
            {room.name}
          </h3>
          {badge === "host" && (
            <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-amber-400/90">
              host
            </span>
          )}
        </div>
        <span className="shrink-0 rounded-lg bg-[rgba(107,90,237,0.1)] px-2.5 py-1 font-mono text-xs font-bold tracking-wider text-[var(--primary)]">
          {room.code}
        </span>
      </div>
      <p className="mt-1 text-sm text-[var(--text-muted)]">{date}</p>
    </Link>
  );
}
