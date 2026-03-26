"use client";

import Image from "next/image";

interface PlayerAnimationProps {
  isPlaying?: boolean;
}

export default function PlayerAnimation({ isPlaying = true }: PlayerAnimationProps) {
  return (
    <div className="relative flex items-center justify-center w-full h-full">
      {/* Outer glowing rings that pulse when playing */}
      <div 
        className={`absolute w-32 h-32 rounded-full bg-[radial-gradient(circle,rgba(244,108,82,0.15)_0%,transparent_70%)] blur-xl transition-all duration-1000 ${
          isPlaying ? "animate-pulse scale-110" : "scale-90 opacity-50"
        }`}
      />
      
      <div 
        className={`absolute w-24 h-24 rounded-full bg-[radial-gradient(circle,rgba(140,198,232,0.15)_0%,transparent_70%)] blur-lg transition-all duration-1000 delay-75 ${
          isPlaying ? "animate-pulse scale-125" : "scale-90 opacity-30"
        }`}
      />

      {/* The Logo itself with a floating animation */}
      <div 
        className={`relative z-10 transition-transform duration-700 ${
          isPlaying ? "animate-logo-float" : "scale-95 opacity-80"
        }`}
      >
        <Image
          src="/dtt-logo.png"
          alt="DropTheTrack Logo"
          width={96}
          height={96}
          className="drop-shadow-[0_0_15px_rgba(244,108,82,0.3)] object-contain mix-blend-screen"
          priority
        />
      </div>
    </div>
  );
}
