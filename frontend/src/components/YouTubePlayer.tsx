"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

export interface PlaybackState {
  isPaused: boolean;
  currentTime: number;
  updatedAt: number; // epoch ms
}

interface YouTubePlayerProps {
  videoId: string | null;
  songTitle?: string;
  songArtist?: string;
  isHost: boolean;
  /** Incoming playback state from the server (play/pause + position sync) */
  syncState: PlaybackState | null;
  onSkip: () => void;
  /** Host emits this when they play/pause — parent sends it to the socket */
  onHostPlayback: (isPaused: boolean, currentTime: number) => void;
}

export default function YouTubePlayer({
  videoId,
  songTitle,
  songArtist,
  isHost,
  syncState,
  onSkip,
  onHostPlayback,
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const prevVolume = useRef(80);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playerPaused, setPlayerPaused] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  // Bumped each time a new player is created so the progress effect restarts
  const [playerGeneration, setPlayerGeneration] = useState(0);
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const onSkipRef = useRef(onSkip);
  useEffect(() => { onSkipRef.current = onSkip; }, [onSkip]);

  // Whether we're intentionally paused by host (ignore auto-resume)
  const hostPausedRef = useRef(false);

  // Load the YouTube IFrame API script once
  useEffect(() => {
    if (window.YT && window.YT.Player) return;
    const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (existingScript) return;
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.head.appendChild(script);
  }, []);

  // Create / update the player when videoId changes
  useEffect(() => {
    if (!videoId) {
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch { /* noop */ }
        playerRef.current = null;
      }
      setReady(false);
      setPlayerPaused(false);
      setProgress(0);
      setDuration(0);
      hostPausedRef.current = false;
      return;
    }

    function createPlayer() {
      if (!containerRef.current) return;

      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch { /* noop */ }
        playerRef.current = null;
      }

      // Reset state for the new song
      setReady(false);
      setProgress(0);
      setDuration(0);
      setPlayerPaused(false);
      setIsBuffering(false);
      hostPausedRef.current = false;

      const wrapper = containerRef.current;
      wrapper.innerHTML = "";
      const el = document.createElement("div");
      wrapper.appendChild(el);

      // Calculate start time if we have sync state
      let startSeconds = 0;
      if (syncState && !syncState.isPaused) {
        // Song is playing — calculate where it should be now
        const elapsed = (Date.now() - syncState.updatedAt) / 1000;
        startSeconds = syncState.currentTime + elapsed;
      } else if (syncState && syncState.isPaused) {
        startSeconds = syncState.currentTime;
      }

      playerRef.current = new window.YT.Player(el, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 1,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          fs: 0,
          iv_load_policy: 3,
          disablekb: 1,
          playsinline: 1,
          start: Math.floor(startSeconds),
          // Loop the same video as a playlist of 1 — this suppresses
          // YouTube's "More videos" / related-videos end-screen overlay.
          playlist: videoId,
          loop: 0,
        },
        events: {
          onReady: (e: any) => {
            setReady(true);
            setPlayerGeneration((g) => g + 1); // trigger progress interval restart
            e.target.setVolume(isMuted ? 0 : volume);

            // If host has paused, pause immediately
            if (syncState?.isPaused) {
              hostPausedRef.current = true;
              setPlayerPaused(true);
              e.target.seekTo(syncState.currentTime, true);
              e.target.pauseVideo();
            } else {
              hostPausedRef.current = false;
              e.target.playVideo();
            }

            setDuration(e.target.getDuration() || 0);
          },
          onStateChange: (e: any) => {
            const state = e.data;
            if (state === 1) {
              // Playing
              setIsBuffering(false);
              setPlayerPaused(false);
              setDuration(e.target.getDuration() || 0);
            } else if (state === 2) {
              // Paused — only stay paused if host intended it
              if (!hostPausedRef.current) {
                // Someone/something paused it unexpectedly — force resume
                e.target.playVideo();
              } else {
                setPlayerPaused(true);
              }
            } else if (state === 3) {
              setIsBuffering(true);
            } else if (state === 0) {
              // Ended
              setPlayerPaused(false);
              onSkipRef.current();
            }
          },
        },
      });
    }

    if (window.YT && window.YT.Player) {
      createPlayer();
    } else {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prev) prev();
        createPlayer();
      };
    }

    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  // React to incoming sync state changes (play/pause from host)
  useEffect(() => {
    if (!syncState || !playerRef.current || !ready) return;

    if (syncState.isPaused) {
      // Host paused → pause and seek to the paused position
      hostPausedRef.current = true;
      setPlayerPaused(true);
      try {
        playerRef.current.seekTo(syncState.currentTime, true);
        playerRef.current.pauseVideo();
      } catch { /* noop */ }
    } else {
      // Host resumed → calculate correct position and play
      hostPausedRef.current = false;
      setPlayerPaused(false);
      try {
        const elapsed = (Date.now() - syncState.updatedAt) / 1000;
        const seekTo = syncState.currentTime + elapsed;
        playerRef.current.seekTo(seekTo, true);
        playerRef.current.playVideo();
      } catch { /* noop */ }
    }
  }, [syncState, ready]);

  // Progress tracker — restarts when player is recreated (playerGeneration) or pause state changes
  useEffect(() => {
    if (progressInterval.current) clearInterval(progressInterval.current);
    if (ready && playerRef.current && !playerPaused) {
      progressInterval.current = setInterval(() => {
        try {
          const curr = playerRef.current?.getCurrentTime?.() || 0;
          const dur = playerRef.current?.getDuration?.() || 0;
          setProgress(curr);
          if (dur > 0) setDuration(dur);
        } catch { /* noop */ }
      }, 500);
    }
    return () => { if (progressInterval.current) clearInterval(progressInterval.current); };
  }, [ready, playerPaused, playerGeneration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch { /* noop */ }
        playerRef.current = null;
      }
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, []);

  // Host play/pause toggle
  const togglePlayPause = useCallback(() => {
    if (!playerRef.current || !isHost) return;
    const currentTime = playerRef.current.getCurrentTime?.() || 0;
    if (playerPaused) {
      // Resume
      onHostPlayback(false, currentTime);
    } else {
      // Pause
      onHostPlayback(true, currentTime);
    }
  }, [isHost, playerPaused, onHostPlayback]);

  // Host seeks to a position — sync to all clients
  const handleSeek = useCallback((val: number) => {
    if (!playerRef.current || !isHost) return;
    playerRef.current.seekTo(val, true);
    setProgress(val);
    // Broadcast the new position so all clients sync
    onHostPlayback(playerPaused, val);
  }, [isHost, playerPaused, onHostPlayback]);

  const handleVolume = useCallback((val: number) => {
    setVolume(val);
    setIsMuted(val === 0);
    if (playerRef.current) playerRef.current.setVolume(val);
  }, []);

  const toggleMute = useCallback(() => {
    if (isMuted) {
      const restored = prevVolume.current > 0 ? prevVolume.current : 80;
      setVolume(restored);
      setIsMuted(false);
      if (playerRef.current) playerRef.current.setVolume(restored);
    } else {
      prevVolume.current = volume;
      setVolume(0);
      setIsMuted(true);
      if (playerRef.current) playerRef.current.setVolume(0);
    }
  }, [isMuted, volume]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // ---- No song playing ----
  if (!videoId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 lg:py-20">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/[0.03] border border-white/5">
          <svg className="h-10 w-10 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        </div>
        <p className="text-sm text-[var(--text-muted)]">No song playing</p>
        <p className="mt-1 text-xs text-white/30">
          {isHost ? "Add a song and hit play to start" : "Waiting for the host to start playback"}
        </p>
      </div>
    );
  }

  // ---- Active player ----
  return (
    <div className="flex flex-col">
      {/* Song info */}
      <div className="mb-3 px-1">
        <div className="flex items-center gap-2">
          {playerPaused ? (
            <>
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">Paused</span>
            </>
          ) : (
            <>
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-red-400">Live</span>
            </>
          )}
        </div>
        <p className="mt-1 truncate text-lg font-bold text-[var(--text-light)]">{songTitle || "Unknown"}</p>
        {songArtist && (
          <p className="mt-0.5 truncate text-sm text-[var(--text-muted)]">added by {songArtist}</p>
        )}
      </div>

      {/* YouTube player embed */}
      <div className="relative w-full overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: "16/9" }}>
        <div ref={containerRef} className="absolute inset-0" />
        {/* Loading spinner — only when genuinely loading, NOT when paused */}
        {(!ready || (isBuffering && !playerPaused)) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
          </div>
        )}
        {/* Paused overlay */}
        {playerPaused && ready && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px]">
            <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
              <svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            </div>
            <p className="text-sm font-medium text-white/90">
              {isHost ? "Paused" : "Host paused the music"}
            </p>
          </div>
        )}
        {/* Overlay prevents clicking the iframe directly */}
        {!playerPaused && <div className="absolute inset-0 z-10" />}
      </div>

      {/* Progress bar — interactive for host, read-only for listeners */}
      <div className="mt-4 px-1">
        {isHost ? (
          <input
            type="range"
            min="0"
            max={duration || 1}
            step="0.5"
            value={progress}
            onInput={(e) => handleSeek(Number((e.target as HTMLInputElement).value))}
            onChange={(e) => handleSeek(Number(e.target.value))}
            className="progress-slider w-full"
            style={{ background: `linear-gradient(to right, var(--primary) ${duration > 0 ? (progress / duration) * 100 : 0}%, rgba(255,255,255,0.1) ${duration > 0 ? (progress / duration) * 100 : 0}%)` }}
          />
        ) : (
          <div className="relative h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-[var(--primary)] transition-all duration-500"
              style={{ width: `${duration > 0 ? (progress / duration) * 100 : 0}%` }}
            />
          </div>
        )}
        <div className="mt-1.5 flex justify-between text-xs text-[var(--text-muted)]">
          <span>{formatTime(progress)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-3 flex items-center gap-3">
        {/* Host: Play/Pause — affects everyone */}
        {isHost && (
          <button
            onClick={togglePlayPause}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105 active:scale-95"
            title={playerPaused ? "Resume for everyone" : "Pause for everyone"}
          >
            {playerPaused ? (
              <svg className="ml-0.5 h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            )}
          </button>
        )}

        {/* Non-host: Mute toggle as primary button */}
        {!isHost && (
          <button
            onClick={toggleMute}
            className={`flex h-12 w-12 items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95 ${
              isMuted ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-white text-black"
            }`}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            )}
          </button>
        )}

        {/* Volume slider */}
        <div className="flex flex-1 items-center gap-2">
          {/* Host also gets a small mute button */}
          {isHost && (
            <button
              onClick={toggleMute}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] transition hover:bg-white/5 hover:text-[var(--text-light)]"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : volume < 50 ? (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072" />
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              )}
            </button>
          )}
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onInput={(e) => handleVolume(Number((e.target as HTMLInputElement).value))}
            onChange={(e) => handleVolume(Number(e.target.value))}
            className="volume-slider flex-1"
            style={{ background: `linear-gradient(to right, rgba(255,255,255,0.7) ${volume}%, rgba(255,255,255,0.12) ${volume}%)` }}
          />
          <span className="w-7 text-right text-[10px] text-[var(--text-muted)]">{volume}</span>
        </div>

        {/* Skip — always visible for host */}
        {isHost && (
          <button
            onClick={onSkip}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-[var(--text-light)] transition hover:bg-white/20 active:scale-95"
            title="Skip to next song"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4l10 8-10 8V4z" />
              <rect x="16" y="4" width="2.5" height="16" rx="1" />
            </svg>
          </button>
        )}
      </div>

      {/* Hint */}
      <p className="mt-3 text-center text-[10px] text-white/20">
        {isHost
          ? "Play/pause controls the room for everyone"
          : isMuted
            ? "You muted your audio — song is still playing for everyone"
            : playerPaused
              ? "Host paused the music"
              : "Music is live — mute to silence your device only"
        }
      </p>
    </div>
  );
}
