"use client";

import { useEffect, useRef, useState, useCallback, type CSSProperties } from "react";
import Image from "next/image";
import { ChevronRight, Link2, Music } from "lucide-react";
import DuotoneLogoBadge from "@/components/DuotoneLogoBadge";

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
  /** Album / video thumbnail for now-playing art */
  thumbnailUrl?: string | null;
  isHost: boolean;
  /** Incoming playback state from the server (play/pause + position sync) */
  syncState: PlaybackState | null;
  onSkip: () => void;
  /** Host emits this when they play/pause — parent sends it to the socket */
  onHostPlayback: (isPaused: boolean, currentTime: number) => void;
  /** Open full title / YouTube link (e.g. track detail sheet) */
  onSongTitleClick?: () => void;
  /**
   * Mobile: allocate ~60% height to video, ~30% to track info, ~10% to controls
   * so the bottom hint isn’t clipped above the tab bar. Parent must be a flex column with bounded height.
   */
  proportionedLayout?: boolean;
  /** Hide the logo + “Drop The Track” row (e.g. desktop where Navbar shows branding). */
  hidePlayerBrandHeader?: boolean;
}

const AUDIO_PREFS_KEY = "dtt-yt-audio";

function readAudioPrefs(): { unlocked: boolean; volume: number } {
  if (typeof sessionStorage === "undefined") return { unlocked: false, volume: 80 };
  try {
    const raw = sessionStorage.getItem(AUDIO_PREFS_KEY);
    if (!raw) return { unlocked: false, volume: 80 };
    const j = JSON.parse(raw) as { unlocked?: boolean; volume?: number };
    return {
      unlocked: !!j.unlocked,
      volume: typeof j.volume === "number" ? Math.min(100, Math.max(0, j.volume)) : 80,
    };
  } catch {
    return { unlocked: false, volume: 80 };
  }
}

function writeAudioPrefs(unlocked: boolean, volume: number) {
  try {
    sessionStorage.setItem(
      AUDIO_PREFS_KEY,
      JSON.stringify({ unlocked, volume: Math.min(100, Math.max(0, volume)) }),
    );
  } catch {
    /* private mode / quota */
  }
}

export default function YouTubePlayer({
  videoId,
  songTitle,
  songArtist,
  thumbnailUrl,
  isHost,
  syncState,
  onSkip,
  onHostPlayback,
  onSongTitleClick,
  proportionedLayout = false,
  hidePlayerBrandHeader = false,
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const prevVolume = useRef(80);

  useEffect(() => {
    const p = readAudioPrefs();
    prevVolume.current = p.volume;
    setVolume(p.volume);
  }, []);
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playerPaused, setPlayerPaused] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const autoplayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyRetryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initAttemptsRef = useRef(0);
  // Bumped each time a new player is created so the progress effect restarts
  const [playerGeneration, setPlayerGeneration] = useState(0);
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const onSkipRef = useRef(onSkip);
  useEffect(() => { onSkipRef.current = onSkip; }, [onSkip]);
  useEffect(() => { readyRef.current = ready; }, [ready]);

  // Whether we're intentionally paused by host (ignore auto-resume)
  const hostPausedRef = useRef(false);
  // Soften surprise pause→resume fights on mobile (buffer / power saving)
  const lastPlayingAtRef = useRef(0);
  const lastAutoResumeAtRef = useRef(0);
  const syncStateRef = useRef<PlaybackState | null>(null);
  syncStateRef.current = syncState;

  // Some mobile browsers reject unmuted autoplay intermittently.
  // Try normal play first; only allow mute fallback when audio has not been user-unlocked yet.
  const ensurePlaybackStarts = useCallback((player: any, opts?: { allowMuteFallback?: boolean; restoreVolume?: number }) => {
    const allowMuteFallback = opts?.allowMuteFallback ?? false;
    const restoreVolume = typeof opts?.restoreVolume === "number" ? opts.restoreVolume : null;
    if (!player) return;
    try {
      player.playVideo?.();
    } catch {
      /* noop */
    }
    window.setTimeout(() => {
      try {
        const st = player.getPlayerState?.();
        if (st === 1) return; // already playing
        if (!allowMuteFallback) return;
        player.mute?.();
        player.playVideo?.();
        setIsMuted(true);
        // If we had a previously unlocked volume, try restoring shortly after playback starts.
        if (restoreVolume && restoreVolume > 0) {
          window.setTimeout(() => {
            try {
              player.unMute?.();
              player.setVolume?.(restoreVolume);
              setVolume(restoreVolume);
              setIsMuted(false);
              prevVolume.current = restoreVolume;
              writeAudioPrefs(true, restoreVolume);
            } catch {
              /* noop */
            }
          }, 900);
        }
      } catch {
        /* noop */
      }
    }, 700);
  }, []);

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
      readyRef.current = false;
      setPlayerPaused(false);
      setProgress(0);
      setDuration(0);
      hostPausedRef.current = false;
      if (autoplayTimer.current) { clearTimeout(autoplayTimer.current); autoplayTimer.current = null; }
      if (readyRetryTimer.current) { clearTimeout(readyRetryTimer.current); readyRetryTimer.current = null; }
      initAttemptsRef.current = 0;
      return;
    }

    function createPlayer() {
      if (!containerRef.current) return;

      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch { /* noop */ }
        playerRef.current = null;
      }
      if (readyRetryTimer.current) {
        clearTimeout(readyRetryTimer.current);
        readyRetryTimer.current = null;
      }

      // Reset state for the new song
      setReady(false);
      readyRef.current = false;
      setProgress(0);
      setDuration(0);
      setPlayerPaused(false);
      setIsBuffering(false);
      hostPausedRef.current = false;
      const prefs = readAudioPrefs();
      if (prefs.unlocked && prefs.volume > 0) {
        setVolume(prefs.volume);
        setIsMuted(false);
        prevVolume.current = prefs.volume;
      }

      const wrapper = containerRef.current;
      wrapper.innerHTML = "";
      const el = document.createElement("div");
      wrapper.appendChild(el);

      // Calculate start time if we have sync state
      let startSeconds = 0;
      const currentSync = syncStateRef.current;
      let shouldAutoplay = 1;

      if (currentSync) {
        if (!currentSync.isPaused) {
          // Song is playing — calculate where it should be now
          const elapsed = (Date.now() - currentSync.updatedAt) / 1000;
          startSeconds = currentSync.currentTime + elapsed;
        } else {
          startSeconds = currentSync.currentTime;
          shouldAutoplay = 0;
        }
      } else if (!isHost) {
        // If guest hasn't received sync state yet, don't force iframe autoplay.
        // onReady will handle playing it if the socket says it's playing.
        shouldAutoplay = 0;
      }

      playerRef.current = new window.YT.Player(el, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: shouldAutoplay,
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
            const p = readAudioPrefs();
            setReady(true);
            readyRef.current = true;
            setPlayerGeneration((g) => g + 1); // trigger progress interval restart
            initAttemptsRef.current = 0;
            if (readyRetryTimer.current) {
              clearTimeout(readyRetryTimer.current);
              readyRetryTimer.current = null;
            }

            // If host has paused, pause immediately
            const latestSync = syncStateRef.current;
            if (latestSync?.isPaused) {
              hostPausedRef.current = true;
              setPlayerPaused(true);
              e.target.seekTo(latestSync.currentTime, true);
              e.target.pauseVideo();
              e.target.setVolume(p.unlocked && p.volume > 0 ? p.volume : 0);
            } else {
              hostPausedRef.current = false;
              if (p.unlocked && p.volume > 0) {
                e.target.unMute();
                e.target.setVolume(p.volume);
                setVolume(p.volume);
                setIsMuted(false);
                prevVolume.current = p.volume;
              } else {
                e.target.unMute();
                e.target.setVolume(p.volume > 0 ? p.volume : 80);
                setVolume(p.volume > 0 ? p.volume : 80);
                setIsMuted(false);
              }
              ensurePlaybackStarts(e.target, {
                // Do not force mute on track change once user has unlocked audio.
                allowMuteFallback: !(p.unlocked && p.volume > 0),
                restoreVolume: p.volume > 0 ? p.volume : 80,
              });

              // If autoplay is blocked, browsers only allow playback muted — but once the user
              // has unlocked audio (volume / unmute), never mute again on new tracks (slow loads
              // can still look "unstarted" at 1.5s and used to falsely trigger mute).
              if (autoplayTimer.current) clearTimeout(autoplayTimer.current);
              autoplayTimer.current = setTimeout(() => {
                try {
                  const st = e.target.getPlayerState();
                  const prefsNow = readAudioPrefs();
                  // -1 = unstarted, 5 = cued — autoplay may be blocked
                  if (st !== -1 && st !== 5) return;

                  if (prefsNow.unlocked && prefsNow.volume > 0) {
                    e.target.unMute();
                    e.target.setVolume(prefsNow.volume);
                    e.target.playVideo();
                    setVolume(prefsNow.volume);
                    setIsMuted(false);
                    prevVolume.current = prefsNow.volume;
                    return;
                  }

                  e.target.mute();
                  e.target.playVideo();
                  setIsMuted(true);
                  if (prefsNow.volume === 0) {
                    setVolume(0);
                  }
                } catch { /* player destroyed */ }
              }, 1800);
            }

            setDuration(e.target.getDuration() || 0);
          },
          onStateChange: (e: any) => {
            const state = e.data;
            if (state === 1) {
              // Playing
              lastPlayingAtRef.current = Date.now();
              setIsBuffering(false);
              setPlayerPaused(false);
              if (autoplayTimer.current) { clearTimeout(autoplayTimer.current); autoplayTimer.current = null; }
              setDuration(e.target.getDuration() || 0);
            } else if (state === 2) {
              // Paused — only stay paused if host intended it; otherwise resume carefully (mobile)
              if (!hostPausedRef.current) {
                const now = Date.now();
                if (now - lastPlayingAtRef.current < 1200) return;
                if (now - lastAutoResumeAtRef.current < 900) return;
                lastAutoResumeAtRef.current = now;
                ensurePlaybackStarts(e.target, {
                  allowMuteFallback: !readAudioPrefs().unlocked,
                  restoreVolume: readAudioPrefs().volume > 0 ? readAudioPrefs().volume : 80,
                });
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

      // Mobile Safari occasionally leaves iframe stuck uninitialized.
      // If onReady hasn't fired within a short window, rebuild once.
      readyRetryTimer.current = setTimeout(() => {
        if (readyRef.current) return;
        if (initAttemptsRef.current >= 1) return;
        initAttemptsRef.current += 1;
        try {
          playerRef.current?.destroy?.();
        } catch {
          /* noop */
        }
        playerRef.current = null;
        createPlayer();
      }, 4500);
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
      if (readyRetryTimer.current) {
        clearTimeout(readyRetryTimer.current);
        readyRetryTimer.current = null;
      }
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
        const p = readAudioPrefs();
        ensurePlaybackStarts(playerRef.current, {
          allowMuteFallback: !p.unlocked,
          restoreVolume: p.volume > 0 ? p.volume : 80,
        });
      } catch { /* noop */ }
    }
  }, [syncState, ready, ensurePlaybackStarts]);

  // Guests: gently correct drift vs server playback clock (host is source of truth)
  useEffect(() => {
    if (isHost || !ready || playerPaused) return;
    const id = setInterval(() => {
      const s = syncStateRef.current;
      const p = playerRef.current;
      if (!s || s.isPaused || !p?.getCurrentTime) return;
      try {
        const expected = s.currentTime + (Date.now() - s.updatedAt) / 1000;
        const actual = p.getCurrentTime();
        if (Math.abs(expected - actual) > 2.5) {
          p.seekTo(expected, true);
        }
      } catch { /* noop */ }
    }, 12000);
    return () => clearInterval(id);
  }, [isHost, ready, playerPaused, playerGeneration]);

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
    if (val > 0) {
      prevVolume.current = val;
      writeAudioPrefs(true, val);
    }
    if (playerRef.current) {
      playerRef.current.setVolume(val);
      // On mobile, setVolume may not work — use mute/unMute as fallback
      if (val === 0) {
        playerRef.current.mute();
      } else {
        playerRef.current.unMute();
      }
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (isMuted) {
      const restored = prevVolume.current > 0 ? prevVolume.current : 80;
      setVolume(restored);
      setIsMuted(false);
      writeAudioPrefs(true, restored);
      if (playerRef.current) {
        playerRef.current.unMute();
        playerRef.current.setVolume(restored);
      }
    } else {
      prevVolume.current = volume;
      setVolume(0);
      setIsMuted(true);
      if (playerRef.current) {
        playerRef.current.mute();
      }
    }
  }, [isMuted, volume]);

  // Re-assert local audio when browser/tab returns to foreground.
  // Mobile browsers sometimes keep playback running but drop audible output.
  const recoverAudio = useCallback(() => {
    const p = playerRef.current;
    if (!p?.setVolume) return;
    try {
      const prefs = readAudioPrefs();
      const targetVolume = prefs.volume > 0 ? prefs.volume : (prevVolume.current > 0 ? prevVolume.current : 80);
      p.unMute?.();
      p.setVolume(targetVolume);
      setVolume(targetVolume);
      setIsMuted(false);
      prevVolume.current = targetVolume;
      writeAudioPrefs(true, targetVolume);
      if (!hostPausedRef.current) {
        const prefs = readAudioPrefs();
        ensurePlaybackStarts(p, {
          allowMuteFallback: !prefs.unlocked,
          restoreVolume: prefs.volume > 0 ? prefs.volume : 80,
        });
      }
    } catch {
      /* noop */
    }
  }, [ensurePlaybackStarts]);

  useEffect(() => {
    const onVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        recoverAudio();
      }
    };
    const onFocus = () => recoverAudio();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onFocus);
    };
  }, [recoverAudio]);

  // Keep UI mute state aligned with underlying YouTube player state.
  useEffect(() => {
    if (!ready) return;
    const id = window.setInterval(() => {
      const p = playerRef.current;
      if (!p?.isMuted) return;
      try {
        const muted = !!p.isMuted();
        setIsMuted(muted);
        if (!muted && p.getVolume) {
          const v = Number(p.getVolume() || volume);
          if (Number.isFinite(v) && v >= 0 && v <= 100) setVolume(v);
        }
      } catch {
        /* noop */
      }
    }, 1200);
    return () => window.clearInterval(id);
  }, [ready, volume]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const pct = duration > 0 ? (progress / duration) * 100 : 0;

  const videoPane = (className: string, style: CSSProperties) => (
    <div className={className} style={style}>
      <div ref={containerRef} className="absolute inset-0" />

      {/* YouTube still toggles play/pause on video tap when controls=0 — block so only host bar (or server sync) drives state */}
      <div
        className="absolute inset-0 z-[11] cursor-default bg-transparent"
        aria-hidden
        role="presentation"
      />

      <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1 backdrop-blur-sm">
        {playerPaused ? (
          <>
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <span className="text-[11px] font-bold uppercase tracking-[1px] text-amber-400">Paused</span>
          </>
        ) : (
          <>
            <span className="animate-pulse-dot h-2 w-2 rounded-full bg-[var(--danger)]" />
            <span className="text-[11px] font-bold uppercase tracking-[1px] text-[var(--danger)]">LIVE</span>
            <div className="equalizer ml-0.5" style={{ height: "12px" }}>
              <span style={{ width: "2px" }} /><span style={{ width: "2px" }} /><span style={{ width: "2px" }} />
            </div>
          </>
        )}
      </div>

      {(!ready || (isBuffering && !playerPaused)) && (
        <div className="absolute inset-0 z-[25] flex items-center justify-center bg-black/80">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent" />
        </div>
      )}
      {playerPaused && ready && (
        <div className="absolute inset-0 z-[30] flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px]">
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
    </div>
  );

  const progressBlock = (compact: boolean) => (
    <div className={compact ? "w-full" : "mt-5 w-full"}>
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
          style={{ background: `linear-gradient(to right, var(--brand) ${pct}%, var(--surface-hover) ${pct}%)` }}
        />
      ) : (
        <div className="relative h-1 w-full overflow-hidden rounded-full bg-[var(--surface-hover)]">
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-[var(--brand)] transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      <div className={`flex justify-between text-[var(--text-muted)] ${compact ? "mt-0.5 text-[10px] tabular-nums" : "mt-2 text-[12px]"}`}>
        <span>{formatTime(progress)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );

  const controlsBlock = (compact: boolean) => (
    <div className={`flex w-full flex-col items-center ${compact ? "gap-1.5" : "mt-5 gap-3"}`}>
      <div className={`flex items-center ${compact ? "gap-2" : "gap-3"}`}>
        {isHost && (
          <button
            onClick={() => handleSeek(0)}
            className={`flex items-center justify-center rounded-xl text-[var(--text-secondary)] transition hover:bg-white/5 hover:text-[var(--text-primary)] active:scale-95 ${compact ? "h-9 w-9" : "h-11 w-11"}`}
            style={{ background: "rgba(19, 19, 26, 0.8)", border: "1px solid var(--border)" }}
            title="Restart song"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><rect x="5.5" y="4" width="2.5" height="16" rx="1" /><path d="M18 4L8 12l10 8V4z" /></svg>
          </button>
        )}
        {isHost ? (
          <button
            onClick={togglePlayPause}
            className={`glow-button flex shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-white transition hover:brightness-110 active:scale-95 ${compact ? "h-11 w-11" : "h-14 w-14"}`}
            style={{ boxShadow: "0 0 24px var(--brand-glow)" }}
            title={playerPaused ? "Resume for everyone" : "Pause for everyone"}
          >
            {playerPaused ? (
              <svg className="ml-0.5 h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            ) : (
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
            )}
          </button>
        ) : null}
        {isHost && (
          <button
            onClick={onSkip}
            className={`flex items-center justify-center rounded-xl text-[var(--text-secondary)] transition hover:bg-white/5 hover:text-[var(--text-primary)] active:scale-95 ${compact ? "h-9 w-9" : "h-11 w-11"}`}
            style={{ background: "rgba(19, 19, 26, 0.8)", border: "1px solid var(--border)" }}
            title="Skip to next song"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4l10 8-10 8V4z" /><rect x="16" y="4" width="2.5" height="16" rx="1" /></svg>
          </button>
        )}
      </div>
      <div
        className={`flex items-center rounded-xl ${compact ? "max-w-full gap-2 px-2.5 py-1" : "gap-3 px-4 py-2"}`}
        style={{ background: "rgba(19, 19, 26, 0.8)", border: "1px solid var(--border)" }}
      >
        <button
          onClick={toggleMute}
          className="shrink-0 text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? (
            <svg className="h-4 w-4 text-[var(--danger)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
          ) : volume < 50 ? (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072" /></svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
          )}
        </button>
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          onInput={(e) => handleVolume(Number((e.target as HTMLInputElement).value))}
          onChange={(e) => handleVolume(Number(e.target.value))}
          className={`volume-slider min-w-0 ${compact ? "flex-1" : "w-28"}`}
          style={{ background: `linear-gradient(to right, var(--text-secondary) ${volume}%, var(--surface-hover) ${volume}%)` }}
        />
        <span className="w-6 shrink-0 text-right text-[10px] tabular-nums text-[var(--text-muted)]">{volume}</span>
      </div>
    </div>
  );

  const footerHint = (compact: boolean) => (
    <p className={`text-center italic text-[var(--text-muted)] ${compact ? "line-clamp-2 px-1 text-[9px] leading-tight" : "mt-3 text-[11px]"}`}>
      {isHost
        ? "Play/pause controls the room for everyone"
        : isMuted
          ? "You muted your audio — the room is still playing"
          : playerPaused
            ? "Host paused the music"
            : compact
              ? "Host controls play/pause — your volume is only for you"
              : "Only the host can pause or skip for everyone. Volume and mute are only on your device."
      }
    </p>
  );

  // ---- No song playing — duotone “stage” so the room still feels on-brand on black ----
  if (!videoId) {
    return (
      <div className="relative isolate flex min-h-[min(320px,42vh)] w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/[0.07] px-6 py-14">
        <div
          className="pointer-events-none absolute inset-0 -z-20 rounded-2xl"
          style={{
            background:
              "radial-gradient(ellipse 85% 55% at 50% 22%, rgba(244, 108, 82, 0.18) 0%, transparent 58%), radial-gradient(ellipse 75% 48% at 78% 88%, rgba(140, 198, 232, 0.14) 0%, transparent 52%), #000000",
          }}
        />
        <div className="pointer-events-none absolute inset-0 -z-10 rounded-2xl shadow-[inset_0_0_100px_rgba(244,108,82,0.06)]" />
        <div className="pointer-events-none absolute -left-1/4 top-1/2 -z-10 h-[min(120%,480px)] w-[min(90%,420px)] -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(244,108,82,0.12)_0%,transparent_68%)] blur-3xl" />
        <div className="pointer-events-none absolute -right-1/4 bottom-0 -z-10 h-[min(100%,400px)] w-[min(85%,380px)] rounded-full bg-[radial-gradient(circle,rgba(140,198,232,0.10)_0%,transparent_68%)] blur-3xl" />

        <div className="relative mb-7">
          <div className="pointer-events-none absolute inset-0 scale-150 animate-pulse rounded-full bg-[var(--brand)]/25 blur-2xl" />
          <div className="relative flex items-center justify-center rounded-3xl p-1 ring-1 ring-white/[0.12] ring-offset-4 ring-offset-black">
            <DuotoneLogoBadge size={84} />
          </div>
        </div>
        <p className="relative text-center font-display text-lg font-semibold tracking-tight text-[var(--text-primary)]">
          No song playing
        </p>
        <p className="relative mt-2 max-w-[20rem] text-center text-[13px] leading-relaxed text-[var(--text-secondary)]">
          {isHost ? "Add a song from the queue or Library, then hit play to start the room." : "Waiting for the host to start playback."}
        </p>
      </div>
    );
  }

  // ---- Active player ----
  if (proportionedLayout) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col">

        {!hidePlayerBrandHeader && (
          <div className="flex shrink-0 items-center gap-3 px-1 pb-4 pt-5">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-black/30 ring-1 ring-white/10">
              <Image src="/dtt-logo.png" alt="Drop The Track" fill className="object-contain mix-blend-screen" priority />
            </div>
            <div className="min-w-0">
              <p
                className="font-display text-[20px] font-bold leading-tight tracking-tight"
                style={{
                  background: "linear-gradient(110deg, #f4f4f5 0%, #f48a72 55%, #8cc6e8 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                Drop The Track
              </p>
            </div>
          </div>
        )}

        {/* ── Video player ── */}
        <div className="relative w-full shrink-0">
          <div
            className="pointer-events-none absolute -inset-x-8 -inset-y-8 -z-10 opacity-90 blur-2xl"
            aria-hidden
            style={{
              background:
                "radial-gradient(52% 68% at 50% 38%, rgba(244,108,82,0.24) 0%, rgba(244,108,82,0.10) 42%, transparent 74%), radial-gradient(46% 60% at 84% 24%, rgba(140,198,232,0.12) 0%, transparent 64%)",
            }}
          />
          {videoPane("relative w-full overflow-hidden rounded-2xl bg-black ring-1 ring-white/10", {
            aspectRatio: "16/9",
            boxShadow:
              "0 0 84px 22px rgba(244,108,82,0.18), 0 0 130px 54px rgba(244,108,82,0.09), 0 0 170px 66px rgba(255,255,255,0.04)",
          })}
        </div>

        {/* Card + controls: pin to bottom of column; video stays at top */}
        <div className="mt-auto flex w-full shrink-0 flex-col gap-0 pt-3">
        {/* ── Song card ── */}
        <div className="w-full shrink-0">
          {onSongTitleClick ? (
            <button
              type="button"
              onClick={onSongTitleClick}
              aria-label="Track details: full title, copy, open on YouTube"
              className="group relative w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#15151c] via-[var(--surface)] to-[#0c0c10] text-left shadow-[0_24px_48px_-12px_rgba(0,0,0,0.75),inset_0_1px_0_0_rgba(255,255,255,0.06)] transition hover:border-[var(--border-glow)] active:scale-[0.995]"
            >
              <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-[var(--brand)] opacity-[0.12] blur-3xl transition group-hover:opacity-[0.18]" aria-hidden />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[var(--brand)]/25 to-transparent" aria-hidden />
              <div className="relative flex items-center gap-4 p-4">
                <div className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[var(--surface-hover)] shadow-lg ${!playerPaused ? "ring-2 ring-[var(--brand)]/40" : "ring-2 ring-white/10"} transition group-hover:ring-[var(--brand)]/55`}>
                  {thumbnailUrl ? (
                    <Image src={thumbnailUrl} alt={songTitle || "Now playing"} fill className="object-cover" unoptimized sizes="64px" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--surface-hover)] to-[var(--background)]">
                      <Music className="h-7 w-7 text-[var(--text-muted)]" aria-hidden />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">Now playing</p>
                  <p className="mt-1 font-display text-[1rem] font-semibold leading-snug tracking-tight text-[var(--text-primary)] [overflow-wrap:anywhere] line-clamp-2 transition group-hover:text-white" style={{ textWrap: "balance" }}>
                    {songTitle || "Unknown"}
                  </p>
                  {songArtist ? (
                    <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                      <span className="text-[var(--text-muted)]">Queued by</span>{" "}
                      <span className="font-semibold text-[var(--text-primary)]">{songArtist}</span>
                    </p>
                  ) : null}
                  <div className="mt-1.5 flex">
                    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--background)]/80 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] transition group-hover:border-[var(--border-glow)] group-hover:bg-[var(--brand-glow)] group-hover:text-[var(--brand)]">
                      <Link2 className="h-3 w-3" aria-hidden />
                      Details
                      <ChevronRight className="h-3 w-3 transition group-hover:translate-x-0.5" aria-hidden />
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ) : (
            <div className="relative w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#15151c] via-[var(--surface)] to-[#0c0c10] p-4">
              <div className="flex items-center gap-4">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl ring-2 ring-white/10">
                  {thumbnailUrl ? (
                    <Image src={thumbnailUrl} alt={songTitle || "Now playing"} fill className="object-cover" unoptimized sizes="64px" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[var(--surface-hover)]">
                      <Music className="h-7 w-7 text-[var(--text-muted)]" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">Now playing</p>
                  <p className="mt-1 font-display text-[1rem] font-semibold leading-snug text-[var(--text-primary)] line-clamp-2 [overflow-wrap:anywhere]" style={{ textWrap: "balance" }}>
                    {songTitle || "Unknown"}
                  </p>
                  {songArtist && (
                    <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                      <span className="text-[var(--text-muted)]">Queued by</span>{" "}
                      <span className="font-semibold text-[var(--text-primary)]">{songArtist}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Controls ── */}
        <div className="w-full shrink-0 pt-2">
          {progressBlock(false)}
          {controlsBlock(false)}
          {footerHint(false)}
        </div>
        </div>

      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center">
      {videoPane("relative w-full overflow-hidden rounded-2xl bg-black ring-1 ring-white/10", {
        aspectRatio: "16/9",
        boxShadow: "0 0 80px 20px var(--brand-glow), 0 0 160px 60px rgba(255, 255, 255, 0.05)",
      })}

      {/* Song info — use full row width under player */}
      <div className="mt-6 w-full px-0 sm:px-0">
        {onSongTitleClick ? (
          <button
            type="button"
            onClick={onSongTitleClick}
            aria-label="Track details: full title, copy, open on YouTube"
            className="group relative w-full max-w-2xl overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#15151c] via-[var(--surface)] to-[#0c0c10] text-left shadow-[0_24px_48px_-12px_rgba(0,0,0,0.75),inset_0_1px_0_0_rgba(255,255,255,0.06)] transition hover:border-[var(--border-glow)] hover:shadow-[0_28px_56px_-16px_rgba(0,0,0,0.85),0_0_40px_-8px_var(--brand-glow)] active:scale-[0.995]"
          >
            <div
              className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-[var(--brand)] opacity-[0.12] blur-3xl transition group-hover:opacity-[0.18]"
              aria-hidden
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[var(--brand)]/25 to-transparent" aria-hidden />
            <div className="relative flex flex-col items-center gap-4 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5 sm:text-left">
              <div
                className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[var(--surface-hover)] shadow-lg ${!playerPaused ? "ring-2 ring-[var(--brand)]/40" : "ring-2 ring-white/10"} transition group-hover:ring-[var(--brand)]/55`}
              >
                {thumbnailUrl ? (
                  <Image src={thumbnailUrl} alt={songTitle || "Now playing"} fill className="object-cover" unoptimized sizes="80px" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--surface-hover)] to-[var(--background)]">
                    <Music className="h-8 w-8 text-[var(--text-muted)]" aria-hidden />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 text-center sm:pb-0 sm:text-left">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">Now playing</p>
                <p
                  className="mt-1.5 font-display text-[clamp(0.95rem,2.6vw,1.22rem)] font-semibold leading-snug tracking-tight text-[var(--text-primary)] [overflow-wrap:anywhere] line-clamp-2 transition group-hover:text-white"
                  style={{ textWrap: "balance" }}
                >
                  {songTitle || "Unknown"}
                </p>
                {songArtist ? (
                  <p className="mt-1.5 text-[13px] text-[var(--text-secondary)]">
                    <span className="text-[var(--text-muted)]">Queued by</span>{" "}
                    <span className="font-semibold text-[var(--text-primary)]">{songArtist}</span>
                  </p>
                ) : null}
                <div className="mt-2 flex justify-center sm:justify-start">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--background)]/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] transition group-hover:border-[var(--border-glow)] group-hover:bg-[var(--brand-glow)] group-hover:text-[var(--brand)]">
                    <Link2 className="h-3.5 w-3.5" aria-hidden />
                    Details
                    <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </div>
              </div>
            </div>
          </button>
        ) : (
          <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#15151c] via-[var(--surface)] to-[#0c0c10] p-4 sm:p-5">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-5">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl ring-2 ring-white/10">
                {thumbnailUrl ? (
                  <Image src={thumbnailUrl} alt={songTitle || "Now playing"} fill className="object-cover" unoptimized sizes="80px" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[var(--surface-hover)]">
                    <Music className="h-8 w-8 text-[var(--text-muted)]" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">Now playing</p>
                <p
                  className="mt-1.5 font-display text-[clamp(0.95rem,2.6vw,1.22rem)] font-semibold leading-snug text-[var(--text-primary)] line-clamp-2 [overflow-wrap:anywhere]"
                  style={{ textWrap: "balance" }}
                >
                  {songTitle || "Unknown"}
                </p>
                {songArtist && (
                  <p className="mt-1.5 text-[13px] text-[var(--text-secondary)]">
                    <span className="text-[var(--text-muted)]">Queued by</span>{" "}
                    <span className="font-semibold text-[var(--text-primary)]">{songArtist}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {progressBlock(false)}
      {controlsBlock(false)}
      {footerHint(false)}
    </div>
  );
}
