"use client";

import Image from "next/image";

export default function DuotoneLogoBadge({
  size = 48,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const outerRadius = Math.round(size * 0.375); // 48 -> 18
  const innerRadius = Math.round(size * 0.333); // 48 -> 16
  const pad = 2;

  return (
    <div
      className={`shadow-[0_20px_52px_rgba(17,24,39,0.14)] ${className}`}
      style={{
        borderRadius: outerRadius,
        padding: pad,
        background:
          "conic-gradient(from 180deg at 50% 50%, rgba(244,108,82,0.85), rgba(140,198,232,0.85), rgba(244,108,82,0.85))",
      }}
    >
      <div
        className="relative overflow-hidden ring-1 ring-black/10"
        style={{
          width: size,
          height: size,
          borderRadius: innerRadius,
          backgroundColor: "rgba(255,255,255,0.60)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.95]"
          style={{
            background:
              "radial-gradient(circle at 25% 20%, rgba(244,108,82,0.20) 0%, transparent 55%), radial-gradient(circle at 75% 80%, rgba(140,198,232,0.18) 0%, transparent 55%)",
          }}
          aria-hidden
        />
        <Image src="/logo-clean.png" alt="DropTheTrack" fill className="object-contain p-2" priority />
        <div className="pointer-events-none absolute inset-0 ring-1 ring-white/60" aria-hidden style={{ borderRadius: innerRadius }} />
      </div>
    </div>
  );
}

