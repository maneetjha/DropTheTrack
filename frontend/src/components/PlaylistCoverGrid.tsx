"use client";

import Image from "next/image";
import { Music2 } from "lucide-react";

const cellGradients = [
  "from-[#f46c52]/35 to-[#f48a72]/20",
  "from-[#8cc6e8]/35 to-[#6ba8d4]/15",
  "from-[#fda4af]/28 to-[#f46c52]/18",
  "from-[#7dd3fc]/25 to-[#8cc6e8]/28",
] as const;

type Props = {
  thumbnails: (string | null | undefined)[];
  itemCount: number;
  name: string;
  className?: string;
};

/** YouTube Music–style 2×2 mosaic from up to four track thumbnails. */
export default function PlaylistCoverGrid({ thumbnails, itemCount, name, className = "" }: Props) {
  const cells: (string | null)[] = [0, 1, 2, 3].map((i) => thumbnails[i] ?? null);
  const isEmpty = itemCount === 0;

  return (
    <div
      role="img"
      aria-label={isEmpty ? `${name}, empty playlist` : `${name}, ${itemCount} tracks`}
      className={`relative overflow-hidden rounded-2xl ring-1 ring-black/[0.08] ${className}`}
      style={{
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.65), 0 10px 28px rgba(17,24,39,0.08), 0 0 0 1px rgba(255,255,255,0.4)",
      }}
    >
      {isEmpty ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-[#f46c52]/22 via-white/40 to-[#8cc6e8]/28 p-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/50 shadow-inner ring-1 ring-white/60">
            <Music2 className="h-5 w-5 text-[#e85a42]" strokeWidth={2.2} />
          </div>
          <span className="max-w-full truncate px-1 text-center text-[9px] font-bold uppercase tracking-wider text-ink-muted">Empty</span>
        </div>
      ) : (
        <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-black/15 p-px">
          {cells.map((url, i) => (
            <div key={i} className="relative min-h-0 min-w-0 overflow-hidden bg-white/40">
              {url ? (
                <Image
                  src={url}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="120px"
                  unoptimized
                />
              ) : (
                <div
                  className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${cellGradients[i % cellGradients.length]}`}
                >
                  <Music2 className="h-4 w-4 text-white/70" strokeWidth={2} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
