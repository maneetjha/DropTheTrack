"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

export interface MobilePlaybackState {
  isPaused: boolean;
  currentTime: number;
  updatedAt: number;
}

interface MobileYouTubePlayerProps {
  videoId: string | null;
  songTitle?: string;
  songArtist?: string;
  thumbnailUrl?: string | null;
  isHost: boolean;
  syncState: MobilePlaybackState | null;
  onSkip: () => void;
  onHostPlayback: (isPaused: boolean, currentTime: number) => void;
  onSongTitleClick?: () => void;
}

const AUDIO_PREFS_KEY = "dtt-yt-audio";
const YT_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

function readAudioPrefs(): { unlocked: boolean; volume: number } {
  if (typeof sessionStorage === "undefined") return { unlocked: false, volume: 80 };
  try {
    const raw = sessionStorage.getItem(AUDIO_PREFS_KEY);
    if (!raw) return { unlocked: false, volume: 80 };
    const j = JSON.parse(raw) as { unlocked?: boolean; volume?: number };
    return {
      unlocked: !!j.unlocked,
      volume: typeof j.volume === "number" ? Math.max(0, Math.min(100, j.volume)) : 80,
    };
  } catch {
    return { unlocked: false, volume: 80 };
  }
}

function writeAudioPrefs(unlocked: boolean, volume: number) {
  try {
    sessionStorage.setItem(AUDIO_PREFS_KEY, JSON.stringify({ unlocked, volume: Math.max(0, Math.min(100, volume)) }));
  } catch {
    /* noop */
  }
}

function clampSeek(t: number): number {
  if (!Number.isFinite(t) || t < 0) return 0;
  return Math.max(0, Math.min(t, 60 * 60 * 6));
}

function normalizeVideoId(id: string | null): string | null {
  if (!id) return null;
  const t = id.trim();
  return YT_ID_RE.test(t) ? t : null;
}

export default function MobileYouTubePlayer({
  videoId,
  songTitle,
  songArtist,
  thumbnailUrl,
  isHost,
  syncState,
  onSkip,
  onHostPlayback,
  onSongTitleClick,
}: MobileYouTubePlayerProps) {
  const normalizedVideoId = useMemo(() => normalizeVideoId(videoId), [videoId]);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const hostPausedRef = useRef(false);
  const lastPlayingAtRef = useRef(0);
  const lastAutoResumeAtRef = useRef(0);
  const postTrackAudioRetryRef = useRef<number | null>(null);
  const loadedVideoIdRef = useRef<string | null>(null);
  const loadTokenRef = useRef(0);
  const recoveredByErrorRef = useRef<string | null>(null);
  const lastDriftFixAtRef = useRef(0);
  /** True while the iframe was just created after queue was empty (not loadVideoById reuse). */
  const coldStartFromEmptyRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [playerPaused, setPlayerPaused] = useState(false);
  const [playerState, setPlayerState] = useState<number | null>(null);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [showTapOverlay, setShowTapOverlay] = useState(false);
  const [overlayMode, setOverlayMode] = useState<"start" | "syncing">("start");
  const [lastErrorCode, setLastErrorCode] = useState<number | null>(null);

  const prevVolumeRef = useRef(80);
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncStateRef = useRef<MobilePlaybackState | null>(null);
  syncStateRef.current = syncState;

  useEffect(() => {
    const p = readAudioPrefs();
    prevVolumeRef.current = p.volume;
    setVolume(p.volume);
  }, []);

  useEffect(() => {
    if (window.YT && window.YT.Player) return;
    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (existing) return;
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    document.head.appendChild(s);
  }, []);

  const computeDesiredStart = useCallback(() => {
    const s = syncStateRef.current;
    if (!s) return 0;
    if (s.isPaused) return clampSeek(s.currentTime);
    const elapsed = (Date.now() - s.updatedAt) / 1000;
    return clampSeek(s.currentTime + Math.max(0, elapsed));
  }, []);

  /** Mobile Safari often ignores a single seek before play; re-apply after rAF + delayed ticks. */
  const bumpSeekToRoom = useCallback((p: any) => {
    if (!p) return;
    const run = () => {
      try {
        p.seekTo?.(computeDesiredStart(), true);
      } catch {
        /* noop */
      }
    };
    run();
    requestAnimationFrame(run);
    window.setTimeout(run, 50);
    window.setTimeout(run, 180);
    window.setTimeout(run, 420);
  }, [computeDesiredStart]);

  const applyMobileIframePolicies = useCallback(() => {
    const wrapper = containerRef.current;
    if (!wrapper) return;
    const iframe = wrapper.querySelector("iframe");
    if (!iframe) return;
    // Help mobile browsers send a stable cross-origin referrer context to YouTube.
    iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    iframe.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture; fullscreen");
  }, []);

  const gestureKick = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    bumpSeekToRoom(p);
    const prefs = readAudioPrefs();
    const target = prefs.volume > 0 ? prefs.volume : (prevVolumeRef.current > 0 ? prevVolumeRef.current : 80);
    prevVolumeRef.current = target;
    writeAudioPrefs(true, target);
    try { p.playVideo?.(); } catch {}
    try { p.unMute?.(); } catch {}
    try { p.setVolume?.(target); } catch {}
    setVolume(target);
    setIsMuted(false);
    // Re-seek after play starts — mobile often resumes from 0 otherwise.
    bumpSeekToRoom(p);
    window.setTimeout(() => {
      try {
        p.playVideo?.();
      } catch {
        /* noop */
      }
      bumpSeekToRoom(p);
    }, 100);
    setShowTapOverlay(false);
    setOverlayMode("start");
  }, [bumpSeekToRoom]);

  const shouldShowOverlay = useMemo(() => {
    if (!normalizedVideoId) return false;
    if (!ready) return false;
    if (hostPausedRef.current || playerPaused) return false;
    if (playerState === 1 || playerState === 3) return false;
    // If we don't have sync yet, force an overlay so user can't start at 0.
    if (!syncStateRef.current) return true;
    const prefs = readAudioPrefs();
    if (!prefs.unlocked) return true;
    return isMuted || volume === 0 || playerState === -1 || playerState === 5 || playerState === 2;
  }, [normalizedVideoId, ready, playerPaused, playerState, isMuted, volume]);

  useEffect(() => {
    setShowTapOverlay(shouldShowOverlay);
  }, [shouldShowOverlay]);

  const attemptRestoreUnlockedAudio = useCallback(() => {
    const p = playerRef.current;
    if (!p || hostPausedRef.current) return false;
    const prefs = readAudioPrefs();
    if (!prefs.unlocked || prefs.volume <= 0) return false;
    try {
      bumpSeekToRoom(p);
      p.unMute?.();
      p.setVolume?.(prefs.volume);
      // Keep playback moving when browser momentarily pauses between transitions.
      p.playVideo?.();
      bumpSeekToRoom(p);
      setVolume(prefs.volume);
      setIsMuted(false);
      setShowTapOverlay(false);
      return true;
    } catch {
      return false;
    }
  }, [bumpSeekToRoom]);

  useEffect(() => {
    if (!ready) return;
    // Keep overlay intent accurate: syncing vs start/unmute.
    setOverlayMode(syncState ? "start" : "syncing");
  }, [ready, syncState]);

  useEffect(() => {
    if (!normalizedVideoId) {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          /* noop */
        }
        playerRef.current = null;
      }
      hostPausedRef.current = false;
      setReady(false);
      setPlayerPaused(false);
      setPlayerState(null);
      setDuration(0);
      setProgress(0);
      setShowTapOverlay(false);
      setLastErrorCode(null);
      if (postTrackAudioRetryRef.current) {
        clearInterval(postTrackAudioRetryRef.current);
        postTrackAudioRetryRef.current = null;
      }
      loadedVideoIdRef.current = null;
      recoveredByErrorRef.current = null;
      coldStartFromEmptyRef.current = false;
      return;
    }
    const loadToken = ++loadTokenRef.current;

    const createPlayer = () => {
      if (loadToken !== loadTokenRef.current) return;
      if (!containerRef.current) return;
      // Reuse player across track changes so autoplay/unmute state is preserved better.
      if (playerRef.current) {
        coldStartFromEmptyRef.current = false;
        if (loadedVideoIdRef.current === normalizedVideoId) return;
        loadedVideoIdRef.current = normalizedVideoId;
        recoveredByErrorRef.current = null;
        setPlayerPaused(false);
        setPlayerState(null);
        setProgress(0);
        setDuration(0);
        setShowTapOverlay(false);
        setLastErrorCode(null);

        const startAt = Math.max(0, Math.floor(computeDesiredStart()));
        try {
          playerRef.current.loadVideoById?.(normalizedVideoId, startAt);
        } catch {
          try { playerRef.current.cueVideoById?.(normalizedVideoId, startAt); } catch {}
          try { playerRef.current.playVideo?.(); } catch {}
        }

        // Re-apply sync/audio shortly after switching tracks.
        window.setTimeout(() => {
          if (loadToken !== loadTokenRef.current) return;
          const p = playerRef.current;
          if (!p) return;
          bumpSeekToRoom(p);
          const prefs = readAudioPrefs();
          const target = prefs.volume > 0 ? prefs.volume : (prevVolumeRef.current > 0 ? prevVolumeRef.current : 80);
          prevVolumeRef.current = target;
          try { p.playVideo?.(); } catch {}
          if (prefs.unlocked && target > 0) {
            try { p.unMute?.(); } catch {}
            try { p.setVolume?.(target); } catch {}
            setVolume(target);
            setIsMuted(false);
            setShowTapOverlay(false);
          } else {
            try { p.mute?.(); } catch {}
            setIsMuted(true);
            setOverlayMode("start");
            setShowTapOverlay(true);
          }
        }, 220);
        return;
      }
      coldStartFromEmptyRef.current = true;
      loadedVideoIdRef.current = normalizedVideoId;
      recoveredByErrorRef.current = null;
      containerRef.current.innerHTML = "";
      const el = document.createElement("div");
      containerRef.current.appendChild(el);

      setReady(false);
      setPlayerPaused(false);
      setPlayerState(null);
      setShowTapOverlay(false);
      setLastErrorCode(null);

      const origin = typeof window !== "undefined" ? window.location.origin : undefined;

      const sInit = syncStateRef.current;
      const startVar =
        sInit && !sInit.isPaused
          ? Math.max(0, Math.floor(clampSeek(sInit.currentTime + Math.max(0, (Date.now() - sInit.updatedAt) / 1000))))
          : sInit?.isPaused
            ? Math.max(0, Math.floor(clampSeek(sInit.currentTime)))
            : 0;

      playerRef.current = new window.YT.Player(el, {
        videoId: normalizedVideoId,
        host: "https://www.youtube.com",
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 1,
          controls: 0,
          enablejsapi: 1,
          modestbranding: 1,
          rel: 0,
          fs: 0,
          disablekb: 1,
          playsinline: 1,
          start: startVar,
          ...(origin ? { origin } : {}),
          ...(origin ? { widget_referrer: origin } : {}),
        },
        events: {
          onReady: (e: any) => {
            applyMobileIframePolicies();
            setReady(true);
            setDuration(e.target.getDuration?.() || 0);

            const s = syncStateRef.current;
            if (s?.isPaused) {
              hostPausedRef.current = true;
              setPlayerPaused(true);
              try { e.target.seekTo(clampSeek(s.currentTime), true); } catch {}
              try { e.target.pauseVideo(); } catch {}
              return;
            }

            hostPausedRef.current = false;
            setPlayerPaused(false);
            // If we don't have a syncState yet (common when user enters Player tab late),
            // do not start playback from 0. We'll start once sync arrives or user taps.
            if (!s) {
              try { e.target.pauseVideo?.(); } catch {}
              setOverlayMode("syncing");
              setShowTapOverlay(true);
              return;
            }

            bumpSeekToRoom(e.target);

            const prefs = readAudioPrefs();
            const target = prefs.volume > 0 ? prefs.volume : (prevVolumeRef.current > 0 ? prevVolumeRef.current : 80);
            prevVolumeRef.current = target;

            // Always attempt to start playback.
            try { e.target.playVideo?.(); } catch {}

            // If the user has unlocked audio before, attempt unmuted playback.
            if (prefs.unlocked && target > 0) {
              try { e.target.unMute?.(); } catch {}
              try { e.target.setVolume?.(target); } catch {}
              setVolume(target);
              setIsMuted(false);
              // Re-check shortly (some mobile builds "accept" unMute but stay muted).
              window.setTimeout(() => {
                if (loadToken !== loadTokenRef.current) return;
                bumpSeekToRoom(e.target);
                try {
                  const mutedNow = !!e.target.isMuted?.();
                  setIsMuted(mutedNow);
                  if (mutedNow) {
                    setOverlayMode("start");
                    setShowTapOverlay(true);
                  }
                } catch {
                  /* noop */
                }
              }, 450);
              return;
            }

            // Otherwise start muted and request a gesture.
            try { e.target.mute?.(); } catch {}
            setIsMuted(true);
            setOverlayMode("start");
            setShowTapOverlay(true);
          },
          onStateChange: (e: any) => {
            const st = e.data;
            setPlayerState(st);
            if (st === 1) {
              lastPlayingAtRef.current = Date.now();
              setPlayerPaused(false);
              setDuration(e.target.getDuration?.() || 0);
              setShowTapOverlay(false);
              // If we jumped to PLAYING from 0 while the room is far ahead, snap once (throttled).
              if (!hostPausedRef.current && syncStateRef.current && !syncStateRef.current.isPaused) {
                let ct = 0;
                try {
                  ct = e.target.getCurrentTime?.() ?? 0;
                } catch {
                  ct = 0;
                }
                const want = computeDesiredStart();
                const now = Date.now();
                if (want > 3 && ct < want - 2.5 && now - lastDriftFixAtRef.current > 800) {
                  lastDriftFixAtRef.current = now;
                  bumpSeekToRoom(e.target);
                }
              }
            } else if (st === 2) {
              if (hostPausedRef.current) {
                setPlayerPaused(true);
                return;
              }
              // Mobile can pause right after track transitions even when host is playing.
              // Auto-resume once in a throttled way and re-seek to room time.
              const now = Date.now();
              if (now - lastPlayingAtRef.current < 900) return;
              if (now - lastAutoResumeAtRef.current < 1200) return;
              lastAutoResumeAtRef.current = now;
              bumpSeekToRoom(e.target);
              const prefs = readAudioPrefs();
              if (prefs.unlocked && prefs.volume > 0) {
                try { e.target.unMute?.(); } catch {}
                try { e.target.setVolume?.(prefs.volume); } catch {}
                try { e.target.playVideo?.(); } catch {}
                setIsMuted(false);
                setShowTapOverlay(false);
              } else {
                try { e.target.mute?.(); } catch {}
                try { e.target.playVideo?.(); } catch {}
                setIsMuted(true);
                setOverlayMode("start");
                setShowTapOverlay(true);
              }
            } else if (st === 0) {
              setPlayerPaused(false);
              onSkip();
            }
          },
          onError: (e: any) => {
            const code = Number(e?.data);
            setLastErrorCode(Number.isFinite(code) ? code : null);
            // 101/150: owner disallows embedded playback, can't be fixed client-side.
            if (code === 101 || code === 150) {
              setOverlayMode("start");
              setShowTapOverlay(true);
              return;
            }
            // For transient mobile load errors, recover once for this track.
            if (recoveredByErrorRef.current === normalizedVideoId) return;
            recoveredByErrorRef.current = normalizedVideoId;
            const p = playerRef.current;
            if (!p) return;
            try { p.destroy?.(); } catch {}
            playerRef.current = null;
            createPlayer();
            window.setTimeout(() => {
              if (loadToken !== loadTokenRef.current) return;
              const pp = playerRef.current;
              if (!pp) return;
              bumpSeekToRoom(pp);
              try { pp.playVideo?.(); } catch {}
              const prefs = readAudioPrefs();
              if (prefs.unlocked && prefs.volume > 0) {
                try { pp.unMute?.(); } catch {}
                try { pp.setVolume?.(prefs.volume); } catch {}
                setIsMuted(false);
                setShowTapOverlay(false);
              } else {
                setIsMuted(true);
                setOverlayMode("start");
                setShowTapOverlay(true);
              }
            }, 250);
          },
        },
      });

      // Some mobile engines attach iframe attrs a moment after construct.
      window.setTimeout(() => applyMobileIframePolicies(), 0);
      window.setTimeout(() => applyMobileIframePolicies(), 250);
    };

    if (window.YT && window.YT.Player) createPlayer();
    else {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prev) prev();
        createPlayer();
      };
    }

    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
      if (postTrackAudioRetryRef.current) {
        clearInterval(postTrackAudioRetryRef.current);
        postTrackAudioRetryRef.current = null;
      }
    };
  }, [normalizedVideoId, computeDesiredStart, onSkip, applyMobileIframePolicies, bumpSeekToRoom]);

  // Mobile-only: after every track change (or new iframe after empty queue), re-assert unlocked audio.
  // Cold start (queue was empty → first song) gets longer retries + delayed kicks so idle rooms still auto-play like track changes.
  useEffect(() => {
    if (!normalizedVideoId || !ready) return;
    if (syncState?.isPaused === true) return;
    const prefs = readAudioPrefs();
    if (!prefs.unlocked || prefs.volume <= 0) return;

    if (postTrackAudioRetryRef.current) {
      clearInterval(postTrackAudioRetryRef.current);
      postTrackAudioRetryRef.current = null;
    }

    const cold = coldStartFromEmptyRef.current;
    const maxAttempts = cold ? 22 : 8;
    const intervalMs = cold ? 600 : 550;

    // Immediate attempt.
    attemptRestoreUnlockedAudio();

    const coldKickTimeouts: number[] = [];
    if (cold) {
      for (const ms of [1800, 4500, 12000]) {
        coldKickTimeouts.push(
          window.setTimeout(() => {
            if (!coldStartFromEmptyRef.current) return;
            if (syncStateRef.current?.isPaused) return;
            attemptRestoreUnlockedAudio();
          }, ms),
        );
      }
    }

    let attempts = 0;
    postTrackAudioRetryRef.current = window.setInterval(() => {
      attempts += 1;
      const p = playerRef.current;
      if (!p) {
        if (postTrackAudioRetryRef.current) {
          clearInterval(postTrackAudioRetryRef.current);
          postTrackAudioRetryRef.current = null;
        }
        coldStartFromEmptyRef.current = false;
        return;
      }
      let mutedNow = false;
      try {
        mutedNow = !!p.isMuted?.();
      } catch {
        mutedNow = false;
      }

      if (!mutedNow) {
        setIsMuted(false);
        setShowTapOverlay(false);
        coldStartFromEmptyRef.current = false;
        if (postTrackAudioRetryRef.current) {
          clearInterval(postTrackAudioRetryRef.current);
          postTrackAudioRetryRef.current = null;
        }
        return;
      }

      attemptRestoreUnlockedAudio();

      if (attempts >= maxAttempts) {
        coldStartFromEmptyRef.current = false;
        if (postTrackAudioRetryRef.current) {
          clearInterval(postTrackAudioRetryRef.current);
          postTrackAudioRetryRef.current = null;
        }
      }
    }, intervalMs);

    return () => {
      coldKickTimeouts.forEach((t) => clearTimeout(t));
      if (postTrackAudioRetryRef.current) {
        clearInterval(postTrackAudioRetryRef.current);
        postTrackAudioRetryRef.current = null;
      }
    };
  }, [normalizedVideoId, ready, attemptRestoreUnlockedAudio, syncState?.isPaused]);

  useEffect(() => {
    if (!syncState || !playerRef.current || !ready) return;
    if (syncState.isPaused) {
      hostPausedRef.current = true;
      setPlayerPaused(true);
      try {
        playerRef.current.seekTo(clampSeek(syncState.currentTime), true);
        playerRef.current.pauseVideo();
      } catch { /* noop */ }
      return;
    }

    hostPausedRef.current = false;
    setPlayerPaused(false);
    try {
      bumpSeekToRoom(playerRef.current);
      const prefs = readAudioPrefs();
      if (prefs.unlocked && prefs.volume > 0) {
        playerRef.current.unMute?.();
        playerRef.current.setVolume?.(prefs.volume);
        playerRef.current.playVideo?.();
        bumpSeekToRoom(playerRef.current);
        setIsMuted(false);
        setShowTapOverlay(false);
      } else {
        try { playerRef.current.mute?.(); } catch {}
        try { playerRef.current.playVideo?.(); } catch {}
        bumpSeekToRoom(playerRef.current);
        setIsMuted(true);
        setOverlayMode("start");
        setShowTapOverlay(true);
      }
    } catch { /* noop */ }
    window.setTimeout(() => {
      const p = playerRef.current;
      if (!p || hostPausedRef.current) return;
      bumpSeekToRoom(p);
    }, 120);
  }, [syncState, ready, computeDesiredStart, bumpSeekToRoom]);

  useEffect(() => {
    if (progressInterval.current) clearInterval(progressInterval.current);
    if (ready && playerRef.current && !playerPaused) {
      progressInterval.current = setInterval(() => {
        try {
          setProgress(playerRef.current.getCurrentTime?.() || 0);
          const d = playerRef.current.getDuration?.() || 0;
          if (d > 0) setDuration(d);
          if (playerRef.current?.isMuted) setIsMuted(!!playerRef.current.isMuted());
        } catch { /* noop */ }
      }, 500);
    }
    return () => { if (progressInterval.current) clearInterval(progressInterval.current); };
  }, [ready, playerPaused, normalizedVideoId]);

  const togglePlayPause = () => {
    if (!isHost || !playerRef.current) return;
    const t = playerRef.current.getCurrentTime?.() || 0;
    onHostPlayback(!playerPaused, t);
  };

  const handleSeek = useCallback(
    (val: number) => {
      if (!playerRef.current || !isHost) return;
      try {
        playerRef.current.seekTo(val, true);
      } catch {
        /* noop */
      }
      setProgress(val);
      onHostPlayback(playerPaused, val);
    },
    [isHost, playerPaused, onHostPlayback],
  );

  /** Wall clock so the bar can show room time when the iframe is still at 0 before first gesture. */
  const [wallMs, setWallMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setWallMs(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const effectiveProgress = useMemo(() => {
    if (!syncState || playerPaused) return progress;
    if (syncState.isPaused) return progress;
    const room = clampSeek(syncState.currentTime + Math.max(0, (wallMs - syncState.updatedAt) / 1000));
    if (progress < 0.75 && room > 2) return room;
    return progress;
  }, [progress, syncState, playerPaused, wallMs]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
  const pct = duration > 0 ? (effectiveProgress / duration) * 100 : 0;

  // ---- No song playing — same duotone “stage” as desktop YouTubePlayer ----
  if (!normalizedVideoId) {
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

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      {/* ── Header: logo + app name (match desktop proportioned layout) ── */}
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

      <div className="relative w-full shrink-0">
        <div
          className="pointer-events-none absolute -inset-x-8 -inset-y-8 -z-10 opacity-90 blur-2xl"
          aria-hidden
          style={{
            background:
              "radial-gradient(52% 68% at 50% 38%, rgba(244,108,82,0.24) 0%, rgba(244,108,82,0.10) 42%, transparent 74%), radial-gradient(46% 60% at 84% 24%, rgba(140,198,232,0.12) 0%, transparent 64%)",
          }}
        />
        <div
          className="relative w-full overflow-hidden rounded-2xl bg-black ring-1 ring-white/10"
          style={{
            aspectRatio: "16/9",
            boxShadow:
              "0 0 84px 22px rgba(244,108,82,0.18), 0 0 130px 54px rgba(244,108,82,0.09), 0 0 170px 66px rgba(255,255,255,0.04)",
          }}
        >
          <div ref={containerRef} className="absolute inset-0" />
          {showTapOverlay && (
            <div className="absolute inset-0 z-[20] flex items-end justify-center p-3">
              <button
                type="button"
                onClick={gestureKick}
                className="flex items-center gap-2 rounded-full border border-white/15 bg-black/70 px-4 py-2 text-[12px] font-semibold text-white backdrop-blur-md transition hover:bg-black/80 active:scale-[0.98]"
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand)]/20 ring-1 ring-[var(--brand)]/40">
                  <svg className="h-4 w-4 text-[var(--brand)]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
                {overlayMode === "syncing" ? "Syncing…" : "Tap to start"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Now playing + controls: pin to bottom; gap-6 = space between card and seek row */}
      <div className="mt-auto flex w-full min-h-0 shrink-0 flex-col gap-6 pt-4">
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
          ) : null}
        </div>

        <div className="w-full shrink-0 space-y-4">
          <div className="w-full">
          {isHost ? (
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.5}
              value={progress}
              onInput={(e) => handleSeek(Number((e.target as HTMLInputElement).value))}
              onChange={(e) => handleSeek(Number(e.target.value))}
              className="progress-slider w-full"
              style={{
                background: `linear-gradient(to right, var(--brand) ${duration > 0 ? (progress / duration) * 100 : 0}%, var(--surface-hover) ${duration > 0 ? (progress / duration) * 100 : 0}%)`,
              }}
            />
          ) : (
            <div className="relative h-1 w-full overflow-hidden rounded-full bg-[var(--surface-hover)]">
              <div className="absolute left-0 top-0 h-full rounded-full bg-[var(--brand)] transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
          )}
          <div className="mt-2 flex justify-between text-[12px] text-[var(--text-muted)]">
            <span>{formatTime(isHost ? progress : effectiveProgress)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          </div>

          <div className="flex w-full flex-col items-center gap-3">
          {isHost ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const p = playerRef.current;
                  if (!p) return;
                  try {
                    p.seekTo(0, true);
                  } catch {
                    /* noop */
                  }
                }}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--text-secondary)] transition hover:bg-white/5 hover:text-[var(--text-primary)] active:scale-95"
                style={{ background: "rgba(19, 19, 26, 0.8)", border: "1px solid var(--border)" }}
                title="Restart song"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="5.5" y="4" width="2.5" height="16" rx="1" />
                  <path d="M18 4L8 12l10 8V4z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={togglePlayPause}
                className="glow-button flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-white"
              >
                {playerPaused ? (
                  <svg className="ml-0.5 h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                ) : (
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                )}
              </button>
              <button
                type="button"
                onClick={onSkip}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--text-secondary)] transition hover:bg-white/5 hover:text-[var(--text-primary)] active:scale-95"
                style={{ background: "rgba(19, 19, 26, 0.8)", border: "1px solid var(--border)" }}
                title="Skip to next song"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4l10 8-10 8V4z" />
                  <rect x="16" y="4" width="2.5" height="16" rx="1" />
                </svg>
              </button>
            </div>
          ) : null}

          <div className="flex max-w-full items-center gap-2 rounded-xl px-2.5 py-1" style={{ background: "rgba(19, 19, 26, 0.8)", border: "1px solid var(--border)" }}>
            <button
              type="button"
              onClick={() => {
                const p = playerRef.current;
                if (!p) return;
                if (isMuted) {
                  const target = prevVolumeRef.current > 0 ? prevVolumeRef.current : 80;
                  prevVolumeRef.current = target;
                  writeAudioPrefs(true, target);
                  try { p.unMute?.(); } catch {}
                  try { p.setVolume?.(target); } catch {}
                  setVolume(target);
                  setIsMuted(false);
                } else {
                  prevVolumeRef.current = volume;
                  writeAudioPrefs(true, 0);
                  try { p.mute?.(); } catch {}
                  setVolume(0);
                  setIsMuted(true);
                }
              }}
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
              onInput={(e) => {
                const v = Number((e.target as HTMLInputElement).value);
                const p = playerRef.current;
                setVolume(v);
                setIsMuted(v === 0);
                writeAudioPrefs(true, v);
                if (!p) return;
                try { p.setVolume?.(v); } catch {}
                try { v === 0 ? p.mute?.() : p.unMute?.(); } catch {}
              }}
              onChange={(e) => {
                const v = Number(e.target.value);
                const p = playerRef.current;
                setVolume(v);
                setIsMuted(v === 0);
                writeAudioPrefs(true, v);
                if (!p) return;
                try { p.setVolume?.(v); } catch {}
                try { v === 0 ? p.mute?.() : p.unMute?.(); } catch {}
              }}
              className="volume-slider min-w-0 flex-1"
              style={{ background: `linear-gradient(to right, var(--text-secondary) ${volume}%, var(--surface-hover) ${volume}%)` }}
            />
            <span className="w-6 shrink-0 text-right text-[10px] tabular-nums text-[var(--text-muted)]">{volume}</span>
          </div>

          <p className="mt-3 text-center text-[11px] italic text-[var(--text-muted)]">
            {playerPaused ? "Host paused the music" : showTapOverlay ? "Autoplay blocked. Tap to start." : "Host controls play/pause. Volume is local to your device."}
          </p>
          {lastErrorCode !== null && (
            <p className="mt-1 text-center text-[10px] text-amber-300/90">
              YT error code: {lastErrorCode}
            </p>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}

