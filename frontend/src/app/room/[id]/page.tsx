"use client";

import { useEffect, useState, useCallback, useRef, useSyncExternalStore } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  getRoom, getSongs, addSong, upvoteSong, removeSong, playSong, skipSong, clearQueue,
  deleteRoom, updateRoomMode, searchYouTube, resolveYouTube, trackRoomJoin,
  getPlaylists, getPlaylistItems, addPlaylistItem, createPlaylist, Room, Song, YouTubeResult, Playlist, PlaylistItem,
} from "@/lib/api";
import { extractYouTubeVideoId } from "@/lib/youtube";
import { getSocket } from "@/lib/socket";
import { useAuth } from "@/lib/auth-context";
import Navbar from "@/components/Navbar";
import YouTubePlayer, { PlaybackState } from "@/components/YouTubePlayer";
import RoomChat from "@/components/RoomChat";
import TrackDetailSheet from "@/components/TrackDetailSheet";
import PlaylistCoverGrid from "@/components/PlaylistCoverGrid";
import {
  ChevronLeft, Copy, Check, MoreVertical, Search, X, Music, ChevronRight,
  ChevronUp, Trash2, Play, Lock, Unlock, LogOut, ListMusic, Disc3, MessageCircle, Bookmark, UserRound, Plus,
} from "lucide-react";

interface RoomUser { id: string; name: string; isHost?: boolean; isOffline?: boolean; }

// ---- Media query hooks (SSR-safe) ----
const LG = "(min-width: 1024px)";
const MD = "(min-width: 768px)";
function sub(q: string) { return (cb: () => void) => { const m = window.matchMedia(q); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); }; }
function snap(q: string) { return () => typeof window !== "undefined" && window.matchMedia(q).matches; }
function ssrFalse() { return false; }
function useIsDesktop() { return useSyncExternalStore(sub(LG), snap(LG), ssrFalse); }
function useIsTablet() { return useSyncExternalStore(sub(MD), snap(MD), ssrFalse); }

export default function RoomPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const isDesktop = useIsDesktop();
  const isTablet = useIsTablet();

  const [room, setRoom] = useState<Room | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [users, setUsers] = useState<RoomUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [mobileTab, setMobileTab] = useState<"queue" | "player" | "chat">("queue");
  const [syncState, setSyncState] = useState<PlaybackState | null>(null);
  const [modal, setModal] = useState<{
    title: string;
    message: string;
    type: "info" | "error" | "confirm";
    onConfirm?: () => void | Promise<void>;
    confirmLabel?: string;
    /** "danger" = destructive (red); "brand" = primary action (coral). */
    confirmTone?: "danger" | "brand";
  } | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "reconnecting" | "disconnected">("connected");
  const [showChatSlide, setShowChatSlide] = useState(false);
  const [unreadChat, setUnreadChat] = useState(0);
  const [chatCollapsed, setChatCollapsed] = useState(false);

  // Persist active mobile tab across dev full reloads (Fast Refresh can reset state).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem("dtt_room_mobile_tab");
      if (saved === "queue" || saved === "player" || saved === "chat") setMobileTab(saved);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("dtt_room_mobile_tab", mobileTab);
    } catch {}
  }, [mobileTab]);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<YouTubeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingVideoId, setAddingVideoId] = useState<string | null>(null);
  const [trackSheet, setTrackSheet] = useState<null | { kind: "song"; song: Song } | { kind: "search"; r: YouTubeResult }>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryErr, setLibraryErr] = useState<string | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activePlaylist, setActivePlaylist] = useState<{ id: string; name: string } | null>(null);
  const [playlistItems, setPlaylistItems] = useState<PlaylistItem[]>([]);
  const [plSearchQuery, setPlSearchQuery] = useState("");
  const [plSearchResults, setPlSearchResults] = useState<YouTubeResult[]>([]);
  const [plSearching, setPlSearching] = useState(false);
  const [plAddingVideoId, setPlAddingVideoId] = useState<string | null>(null);
  const [droppingId, setDroppingId] = useState<string | null>(null);
  const [savePickerOpenForSongId, setSavePickerOpenForSongId] = useState<string | null>(null);
  const [savePickerSong, setSavePickerSong] = useState<{ id: string; title: string; url: string; thumbnail?: string | null } | null>(null);
  const [savingToPlaylistId, setSavingToPlaylistId] = useState<string | null>(null);
  const [savedToastId, setSavedToastId] = useState<string | null>(null);
  const [createPlOpen, setCreatePlOpen] = useState(false);
  const [createPlName, setCreatePlName] = useState("");
  const [creatingPl, setCreatingPl] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  // debounceRef removed — search now triggers on Enter only
  const usersRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const prevSongsRef = useRef<Song[]>([]);
  const prevNowPlayingIdRef = useRef<string | null>(null);
  // Keep latest user in a ref so the socket effect can read it without re-running
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);
  const [movingToNowPlaying, setMovingToNowPlaying] = useState<Song | null>(null);
  const [nowPlayingAnimKey, setNowPlayingAnimKey] = useState(0);
  const anonIdRef = useRef<string | null>(null);

  const copyRoomCode = useCallback(async () => {
    if (!room?.code) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(room.code);
      } else {
        // iOS/private contexts can miss navigator.clipboard
        const el = document.createElement("textarea");
        el.value = room.code;
        el.setAttribute("readonly", "");
        el.style.position = "fixed";
        el.style.left = "-9999px";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setModal({ title: "Copy failed", message: "Could not copy room code on this device.", type: "error" });
    }
  }, [room?.code]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const key = "dtt_anon_room_uid";
      let id = window.localStorage.getItem(key);
      if (!id) {
        id = `anon-${Math.random().toString(36).slice(2, 10)}`;
        window.localStorage.setItem(key, id);
      }
      anonIdRef.current = id;
    } catch {
      anonIdRef.current = null;
    }
  }, []);

  // ---- Click-outside ----
  useEffect(() => {
    function h(e: MouseEvent) {
      const el = e.target;
      if (el instanceof Element && el.closest('[role="dialog"]')) return;
      if (showUsers && usersRef.current && !usersRef.current.contains(e.target as Node)) setShowUsers(false);
      if (showMenu && menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
      if (searchResults.length > 0 && searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchResults([]);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showUsers, showMenu, searchResults.length]);

  // ---- Data fetching ----
  const fetchSongs = useCallback(async () => { if (!id) return; try { setSongs(await getSongs(id)); } catch (e) { console.error(e); } }, [id]);
  useEffect(() => { if (!id) return; (async () => { try { const [r, s] = await Promise.all([getRoom(id), getSongs(id)]); setRoom(r); setSongs(s); } catch (e) { console.error(e); } finally { setLoading(false); } })(); }, [id]);
  useEffect(() => { if (!id || authLoading || !user) return; trackRoomJoin(id); }, [id, authLoading, user]);

  // ---- Socket ----
  useEffect(() => {
    if (!id || authLoading) return;
    const socket = getSocket(); socket.connect();
    const onConnect = () => {
      const u = userRef.current;
      const stableAnon = anonIdRef.current || `anon-${socket.id}`;
      setConnectionStatus("connected");
      socket.emit("join-room", {
        roomId: id,
        userId: u?.id || stableAnon,
        userName: u?.name || "Anonymous",
      });
    };
    const onDisconnect = () => { setConnectionStatus("reconnecting"); };
    const onReconnectAttempt = () => { setConnectionStatus("reconnecting"); };
    const onReconnectFailed = () => { setConnectionStatus("disconnected"); };
    const onConnectError = () => { setConnectionStatus("reconnecting"); };
    if (socket.connected) onConnect(); else socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("reconnect_attempt", onReconnectAttempt);
    socket.on("reconnect_failed", onReconnectFailed);
    socket.on("connect_error", onConnectError);
    socket.on("queue-updated", () => { getSongs(id).then(setSongs).catch(console.error); });
    socket.on("users-updated", (u: RoomUser[]) => setUsers(u));
    socket.on("room-updated", (d: { room: Room }) => { if (d.room) setRoom(d.room); });
    socket.on("playback-sync", (s: PlaybackState) => { setSyncState(s); });
    socket.on("room-deleted", () => { socket.disconnect(); router.push("/"); });
    return () => {
      socket.emit("leave-room", id);
      socket.off("connect", onConnect); socket.off("disconnect", onDisconnect);
      socket.off("reconnect_attempt", onReconnectAttempt); socket.off("reconnect_failed", onReconnectFailed);
      socket.off("connect_error", onConnectError);
      socket.off("queue-updated"); socket.off("users-updated"); socket.off("room-updated"); socket.off("playback-sync"); socket.off("room-deleted");
      socket.disconnect();
    };
  }, [id, authLoading]);

  // Auto-switch to player tab only on initial load if a song is already playing
  const initialTabSet = useRef(false);
  useEffect(() => {
    if (isDesktop || isTablet || initialTabSet.current) return;
    // Mark as set immediately so later song fetches don't "kick" the user off Clubhouse.
    initialTabSet.current = true;
    if (mobileTab === "queue" && songs.some((s) => s.isPlaying)) {
      setMobileTab("player");
    }
  }, [songs, isDesktop, isTablet, mobileTab]);

  // Load playlists once for save-to-playlist picker
  useEffect(() => {
    if (!user || authLoading) return;
    getPlaylists().then(setPlaylists).catch(() => {});
  }, [user, authLoading]);

  // Track unread chat messages on mobile when not on chat tab
  useEffect(() => {
    if (isDesktop) return;
    const socket = getSocket();
    const onMsg = () => { if (mobileTab !== "chat" && !showChatSlide) setUnreadChat((c) => c + 1); };
    socket.on("new-message", onMsg);
    return () => { socket.off("new-message", onMsg); };
  }, [isDesktop, mobileTab, showChatSlide]);

  // ---- Handlers ----
  const handleSearchChange = (v: string) => { setSearchQuery(v); if (!v.trim()) { setSearchResults([]); setSearching(false); } };
  const executeSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    try {
      if (extractYouTubeVideoId(q)) {
        const one = await resolveYouTube(q);
        setSearchResults([one]);
      } else {
        setSearchResults(await searchYouTube(q));
      }
    } catch (e) {
      setSearchResults([]);
      setModal({
        title: "Search or link",
        message: e instanceof Error ? e.message : "Could not find anything. Try different words or another link.",
        type: "error",
      });
    } finally {
      setSearching(false);
    }
  };
  const sortSongs = (list: Song[]) => [...list].sort((a, b) => b.upvotes - a.upvotes || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const handleSelectResult = async (r: YouTubeResult) => {
    if (!id) return;
    setAddingVideoId(r.videoId);
    try {
      const t = r.title.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      await addSong(id, {
        title: t,
        url: `https://www.youtube.com/watch?v=${r.videoId}`,
        thumbnail: r.thumbnail || undefined,
      });
      await fetchSongs();
      setSearchQuery("");
      setSearchResults([]);
      setTrackSheet(null);
    } catch {
      setModal({ title: "Oops", message: "Failed to add song.", type: "error" });
    } finally {
      setAddingVideoId(null);
    }
  };

  const openLibrary = async () => {
    if (!user) {
      setModal({ title: "Login required", message: "Please log in to use your library.", type: "info" });
      return;
    }
    setLibraryOpen(true);
    setLibraryErr(null);
    setLibraryLoading(true);
    setCreatePlOpen(false);
    setCreatePlName("");
    try {
      const p = await getPlaylists();
      setPlaylists(p);
      setActivePlaylist(null);
      setPlaylistItems([]);
    } catch (e) {
      setLibraryErr(e instanceof Error ? e.message : "Failed to load library");
    } finally {
      setLibraryLoading(false);
    }
  };

  const doCreatePlaylistInRoom = async () => {
    if (!user) return;
    const name = createPlName.trim();
    if (!name) return;
    setCreatingPl(true);
    try {
      await createPlaylist(name);
      const p = await getPlaylists();
      setPlaylists(p);
      setCreatePlName("");
      setCreatePlOpen(false);
      setLibraryErr(null);
    } catch (e) {
      setLibraryErr(e instanceof Error ? e.message : "Failed to create playlist");
    } finally {
      setCreatingPl(false);
    }
  };

  const openPlaylist = async (playlistId: string) => {
    setLibraryErr(null);
    setLibraryLoading(true);
    try {
      const data = await getPlaylistItems(playlistId);
      setActivePlaylist({ id: data.playlist.id, name: data.playlist.name });
      setPlaylistItems(data.items);
      setPlSearchQuery("");
      setPlSearchResults([]);
    } catch (e) {
      setLibraryErr(e instanceof Error ? e.message : "Failed to load playlist");
    } finally {
      setLibraryLoading(false);
    }
  };

  const executePlaylistSearch = async () => {
    const q = plSearchQuery.trim();
    if (!q) return;
    setPlSearching(true);
    try {
      if (extractYouTubeVideoId(q)) {
        const one = await resolveYouTube(q);
        setPlSearchResults([one]);
      } else {
        setPlSearchResults(await searchYouTube(q));
      }
    } catch (e) {
      setPlSearchResults([]);
      setLibraryErr(e instanceof Error ? e.message : "Search failed");
    } finally {
      setPlSearching(false);
    }
  };

  const addToActivePlaylist = async (r: YouTubeResult) => {
    if (!activePlaylist) return;
    setPlAddingVideoId(r.videoId);
    try {
      await addPlaylistItem(activePlaylist.id, {
        title: r.title,
        url: `https://www.youtube.com/watch?v=${r.videoId}`,
        thumbnail: r.thumbnail || null,
      });
      await openPlaylist(activePlaylist.id);
      setLibraryErr(null);
    } catch (e) {
      setLibraryErr(e instanceof Error ? e.message : "Failed to add");
    } finally {
      setPlAddingVideoId(null);
    }
  };

  const dropFromLibrary = async (it: PlaylistItem) => {
    if (!id) return;
    setDroppingId(it.id);
    try {
      await addSong(id, { title: it.title, url: it.url, thumbnail: it.thumbnail || undefined });
      await fetchSongs();
      setLibraryOpen(false);
    } catch (e) {
      setModal({ title: "Error", message: e instanceof Error ? e.message : "Failed to add", type: "error" });
    } finally {
      setDroppingId(null);
    }
  };

  const openSavePicker = (song: { id: string; title: string; url: string; thumbnail?: string | null }) => {
    if (!user) {
      setModal({ title: "Login required", message: "Please log in to save to your library.", type: "info" });
      return;
    }
    setSavePickerSong(song);
    setSavePickerOpenForSongId(song.id);
  };

  const saveToPlaylist = async (playlistId: string) => {
    if (!savePickerSong) return;
    setSavingToPlaylistId(playlistId);
    try {
      await addPlaylistItem(playlistId, {
        title: savePickerSong.title,
        url: savePickerSong.url,
        thumbnail: savePickerSong.thumbnail || null,
      });
      setSavedToastId(savePickerSong.id);
      setTimeout(() => setSavedToastId((cur) => (cur === savePickerSong.id ? null : cur)), 1200);
      setSavePickerSong(null);
      setSavePickerOpenForSongId(null);
    } catch (e) {
      setModal({ title: "Error", message: e instanceof Error ? e.message : "Failed to save", type: "error" });
    } finally {
      setSavingToPlaylistId(null);
    }
  };
  const handleUpvote = async (songId: string) => { if (!user) { setModal({ title: "Login required", message: "Please log in to vote.", type: "info" }); return; } setSongs((p) => sortSongs(p.map((s) => s.id !== songId ? s : { ...s, hasVoted: !s.hasVoted, upvotes: s.hasVoted ? s.upvotes - 1 : s.upvotes + 1 }))); try { const u = await upvoteSong(songId); setSongs((p) => sortSongs(p.map((s) => (s.id === songId ? u : s)))); getSocket().emit("song-upvoted", { roomId: id, songId, upvotes: u.upvotes }); } catch (e: unknown) { fetchSongs(); if (e instanceof Error && e.message === "Login required") setModal({ title: "Login required", message: "Please log in to vote.", type: "info" }); } };
  const handleRemoveSong = async (songId: string) => { try { await removeSong(songId); setSongs((p) => p.filter((s) => s.id !== songId)); getSocket().emit("song-removed", { roomId: id, songId }); } catch (e) { setModal({ title: "Error", message: e instanceof Error ? e.message : "Failed to remove", type: "error" }); } };
  const handlePlaySong = async (songId: string) => { if (!id) return; try { await playSong(songId); await fetchSongs(); getSocket().emit("playback-changed", { roomId: id }); } catch (e) { setModal({ title: "Error", message: e instanceof Error ? e.message : "Failed to play", type: "error" }); } };
  const handleSkipSong = useCallback(async () => { if (!id) return; /* Immediately mark song as played so it disappears from queue + stops the player */ setSongs((prev) => prev.map((s) => s.isPlaying ? { ...s, isPlaying: false, played: true } : s)); try { const u = await skipSong(id); setSongs(u); getSocket().emit("playback-changed", { roomId: id }); } catch (e) { console.error("Skip failed:", e); } }, [id]);
  const isCreatorRef = useRef(false);
  // When a song ends, any client emits song-ended — backend handles the skip with a lock
  const handleSongEnd = useCallback(() => {
    if (!id) return;
    // Immediately mark as played so it disappears from queue + stops the player
    setSongs((prev) => prev.map((s) => s.isPlaying ? { ...s, isPlaying: false, played: true } : s));
    getSocket().emit("song-ended", { roomId: id });
  }, [id]);
  const handleHostPlayback = useCallback((isPaused: boolean, currentTime: number) => { if (!id) return; getSocket().emit("host-playback", { roomId: id, isPaused, currentTime }); }, [id]);
  const handleDeleteRoom = () => { if (!id) return; setShowMenu(false); setModal({ title: "Delete room?", message: "This will permanently delete the room and all its songs.", type: "confirm", confirmLabel: "Delete", confirmTone: "danger", onConfirm: async () => { setModal(null); setDeleting(true); try { await deleteRoom(id); router.push("/"); } catch (e) { setModal({ title: "Error", message: e instanceof Error ? e.message : "Failed", type: "error" }); setDeleting(false); } } }); };
  const handleLeaveRoom = () => { const s = getSocket(); if (id) s.emit("leave-room", id); s.disconnect(); router.push("/"); };
  const handleToggleMode = async () => { if (!id || !room) return; const m = room.mode === "open" ? "listen_only" : "open"; try { const u = await updateRoomMode(id, m); setRoom(u); setShowMenu(false); getSocket().emit("room-updated", { roomId: id, room: u }); } catch (e) { setModal({ title: "Error", message: e instanceof Error ? e.message : "Failed", type: "error" }); } };
  const handleClearQueue = () => { if (!id) return; setModal({ title: "Clear queue?", message: "This will remove all upcoming songs from the queue.", type: "confirm", confirmLabel: "Clear queue", confirmTone: "danger", onConfirm: async () => { setModal(null); try { await clearQueue(id); setSongs((p) => p.filter((s) => s.isPlaying)); getSocket().emit("song-removed", { roomId: id }); } catch (e) { setModal({ title: "Error", message: e instanceof Error ? e.message : "Failed to clear", type: "error" }); } } }); };
  const handleOpenProfile = () => {
    if (!user) return;
    setModal({
      title: "Open profile?",
      message:
        "You’ll leave this room screen. Playback continues for everyone; reopen the room from home when you want to return.",
      type: "confirm",
      confirmLabel: "Go to profile",
      confirmTone: "brand",
      onConfirm: () => {
        setModal(null);
        router.push("/profile");
      },
    });
  };

  // ---- Derived ----
  const isCreator = !!(user && room && room.createdBy === user.id);
  useEffect(() => { isCreatorRef.current = isCreator; }, [isCreator]);
  const isListenOnly = room?.mode === "listen_only";
  const canAddSongs = !!(user && (!isListenOnly || isCreator));
  const nowPlaying = songs.find((s) => s.isPlaying) || null;
  const queue = songs.filter((s) => !s.isPlaying && !s.played);
  const queueForRender = movingToNowPlaying
    ? [movingToNowPlaying, ...queue.filter((s) => s.id !== movingToNowPlaying.id)]
    : queue;
  const currentVideoId = nowPlaying ? extractYouTubeVideoId(nowPlaying.url) : null;

  // Smooth “handoff” when a queue item becomes Now Playing.
  useEffect(() => {
    const currentId = nowPlaying?.id || null;
    const prevId = prevNowPlayingIdRef.current;
    const prevSongs = prevSongsRef.current;

    if (currentId && currentId !== prevId) {
      const fromQueue = prevSongs.find((s) => s.id === currentId && !s.isPlaying && !s.played);
      if (fromQueue) {
        setMovingToNowPlaying(fromQueue);
        window.setTimeout(() => setMovingToNowPlaying(null), 380);
      } else {
        setMovingToNowPlaying(null);
      }
      setNowPlayingAnimKey((k) => k + 1);
    }

    prevNowPlayingIdRef.current = currentId;
    prevSongsRef.current = songs;
  }, [songs, nowPlaying?.id]);

  // ---- Loading / Not found ----
  if (loading) return (
    <div className="flex h-screen flex-col bg-[var(--background)]">
      <Navbar />
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent" />
      </div>
    </div>
  );
  if (!room) return (
    <div className="flex h-screen flex-col bg-[var(--background)]">
      <Navbar />
      <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <h2 className="font-display text-2xl font-bold text-[var(--text-primary)]">Room not found</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">This room might not exist or the backend isn&apos;t running.</p>
        <Link href="/" className="mt-6 rounded-lg bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110">Back to Home</Link>
      </div>
    </div>
  );

  // ==================================================================
  // QUEUE PANEL CONTENT
  // ==================================================================
  const queuePanelContent = (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-x-hidden">
      <div className="min-w-0 shrink-0">
      {/* Room shell — gradient rail + ambient glow; Library entry */}
      <section className="relative shrink-0 overflow-visible px-4 pb-0 pt-4 sm:px-5">
        {/* overflow-visible so kebab + people popovers aren’t clipped; blurs stay masked in inner shell */}
        <div className="group relative overflow-visible rounded-2xl border border-white/[0.08] bg-[var(--surface)] shadow-[0_16px_48px_rgba(0,0,0,0.45)]">
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
            <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(244,108,82,0.28)_0%,transparent_68%)] opacity-90 blur-2xl transition-opacity group-hover:opacity-100" aria-hidden />
            <div className="absolute -bottom-10 -left-8 h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(140,198,232,0.22)_0%,transparent_68%)] blur-2xl" aria-hidden />
            <div
              className="absolute bottom-0 left-0 top-0 w-[3px] bg-gradient-to-b from-[#f46c52] via-[#e85a42] to-[#8cc6e8]"
              aria-hidden
            />
          </div>

          <div className="relative z-10 p-4 pl-5 sm:p-5 sm:pl-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">Listening room</p>
              <h1
                className="font-display text-[1.65rem] font-bold leading-[1.1] tracking-tight sm:text-[32px]"
                style={{
                  background: "linear-gradient(120deg, #fafafa 0%, #f4f4f5 45%, #b8d4e8 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                {room.name}
              </h1>
            </div>
            <div className="flex min-w-0 shrink-0 items-center gap-1.5 pt-0.5 sm:gap-2">
              <div className="relative min-w-0">
                <button type="button" onClick={() => { navigator.clipboard.writeText(room.code); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)]/60 px-2.5 py-1.5 text-[12px] transition hover:border-[var(--brand)]/50">
                  <span className="font-mono font-bold tracking-widest text-[var(--brand)]">{room.code}</span>
                  {copied ? <Check className="h-3 w-3 text-[var(--success)]" /> : <Copy className="h-3 w-3 text-[var(--text-muted)]" />}
                </button>
                {copied && <span className="absolute -top-7 left-1/2 -translate-x-1/2 rounded-md bg-[var(--success)] px-2 py-0.5 text-[10px] font-semibold text-white whitespace-nowrap animate-fade-in-up">Copied!</span>}
              </div>
              <div className="relative shrink-0" ref={menuRef}>
                <button type="button" onClick={() => setShowMenu(!showMenu)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--background)]/40 transition hover:bg-[var(--surface-hover)]" aria-expanded={showMenu} aria-haspopup="menu" aria-label="Room options">
                  <MoreVertical className="h-4 w-4 text-[var(--text-muted)]" />
                </button>
                {showMenu && (
                  <div
                    className="absolute right-0 top-full z-[200] mt-1.5 min-w-[13.5rem] rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-[0_16px_48px_rgba(0,0,0,0.55)] ring-1 ring-white/[0.04]"
                    role="menu"
                  >
                    {isCreator && (<>
                      <button
                        type="button"
                        onClick={handleToggleMode}
                        className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-[13px] font-medium text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
                        role="menuitem"
                      >
                        {isListenOnly ? (
                          <><Unlock className="h-4 w-4 shrink-0 text-emerald-400" strokeWidth={2} /><span>Open to all</span></>
                        ) : (
                          <><Lock className="h-4 w-4 shrink-0 text-amber-400/95" strokeWidth={2} /><span>Listen only</span></>
                        )}
                      </button>
                      <div className="mx-2 border-t border-[var(--border)]" />
                      <button
                        type="button"
                        onClick={handleDeleteRoom}
                        disabled={deleting}
                        className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-[13px] font-medium text-[var(--danger)] transition hover:bg-red-500/[0.08] disabled:opacity-50"
                        role="menuitem"
                      >
                        <Trash2 className="h-4 w-4 shrink-0 opacity-90" strokeWidth={2} />
                        {deleting ? "Deleting…" : "Delete room"}
                      </button>
                      <div className="mx-2 border-t border-[var(--border)]" />
                    </>)}
                    <button
                      type="button"
                      onClick={handleLeaveRoom}
                      className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-[13px] font-medium text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                      role="menuitem"
                    >
                      <LogOut className="h-4 w-4 shrink-0 text-[var(--text-muted)]" strokeWidth={2} />
                      Leave room
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-[var(--text-secondary)] sm:text-[14px]">
            {(() => { const host = users.find(u => u.isHost); return host ? <span>Hosted by <span className="font-medium text-amber-400">{user && host.id === user.id ? "you" : host.name}</span></span> : null; })()}
            <span>{songs.length} song{songs.length !== 1 ? "s" : ""}</span>
            <div className="relative shrink-0" ref={usersRef}>
              <button type="button" onClick={() => setShowUsers(!showUsers)} className="flex items-center gap-1.5 transition hover:text-[var(--text-primary)]">
                <span className="online-dot relative h-2 w-2 rounded-full bg-[var(--success)]" />
                {users.filter(u => !u.isOffline).length} online
                <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-200 ${showUsers ? "rotate-90" : ""}`} />
              </button>
              {showUsers && (
                <div className="absolute left-1/2 top-full z-[200] mt-1.5 w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_16px_48px_rgba(0,0,0,0.55)] ring-1 ring-white/[0.04]">
                  <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">People in room</p>
                      <p className="mt-0.5 text-[12px] text-[var(--text-secondary)]">{users.filter(u => !u.isOffline).length} online</p>
                    </div>
                    <button type="button" onClick={() => setShowUsers(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]" aria-label="Close">
                      <X className="h-4.5 w-4.5" />
                    </button>
                  </div>
                  <div className="max-h-[min(16rem,50vh)] overflow-y-auto overscroll-contain p-2">
                    {users.filter(u => !u.isOffline).length === 0 ? (
                      <p className="py-6 text-center text-xs text-[var(--text-muted)]">No one here yet</p>
                    ) : (
                      users.filter(u => !u.isOffline).map((u) => (
                        <div key={u.id} className="flex items-center gap-2.5 rounded-xl px-3 py-2">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${u.isHost ? "bg-amber-500" : "bg-[var(--brand)]"}`}>{u.name.charAt(0).toUpperCase()}</div>
                          <span className="truncate text-sm font-medium text-[var(--text-primary)]">{u.name}</span>
                          <div className="ml-auto flex shrink-0 gap-1.5">
                            {u.isHost && <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-400">host</span>}
                            {user && u.id === user.id && <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[9px] font-medium text-[var(--text-muted)]">you</span>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            {isListenOnly && <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[12px] font-medium text-amber-400">Listen only</span>}
          </div>

          {user && canAddSongs && (
            <button
              type="button"
              onClick={() => { void openLibrary(); }}
              className="group/lib mt-4 flex w-full items-center justify-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)]/60 py-2.5 text-[13px] font-semibold text-[var(--text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-[var(--brand)]/40 hover:bg-[var(--surface-hover)] hover:shadow-[0_0_24px_-4px_rgba(244,108,82,0.35)]"
            >
              <Bookmark className="h-4 w-4 shrink-0 text-[var(--brand)] transition group-hover/lib:scale-105" strokeWidth={2.25} />
              Library
            </button>
          )}
          </div>
        </div>
      </section>

      {/* Search */}
      <section className="shrink-0 px-4 pt-4 sm:px-5">
        {canAddSongs ? (
          <div className="relative" ref={searchRef}>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
                {searching ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent" /> : <Search className="h-3.5 w-3.5 text-[var(--text-muted)]" />}
              </div>
              <input type="text" value={searchQuery} onChange={(e) => handleSearchChange(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); executeSearch(); } }} enterKeyHint="search" placeholder="Search YouTube or paste a YouTube URL" className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] pl-9 pr-8 text-[13px] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--brand)] focus:shadow-[0_0_0_2px_var(--brand-glow)]" />
              {searchQuery && <button type="button" onClick={() => { setSearchQuery(""); setSearchResults([]); }} className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X className="h-3.5 w-3.5" /></button>}
            </div>
            {searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-[min(70vh,22rem)] space-y-1 overflow-y-auto overscroll-y-contain rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-2xl">
                {searchResults.map((r) => (
                  <div key={r.videoId} className="flex items-stretch gap-2 rounded-xl p-1.5 transition hover:bg-[var(--surface-hover)]">
                    <button
                      type="button"
                      onClick={() => setTrackSheet({ kind: "search", r })}
                      className="flex min-w-0 flex-1 gap-3 rounded-lg p-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                    >
                      <div className="relative h-[4.5rem] w-[7.5rem] shrink-0 overflow-hidden rounded-lg bg-black">
                        {r.thumbnail ? (
                          <Image src={r.thumbnail} alt={r.title} fill className="object-cover" unoptimized sizes="120px" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center"><Music className="h-6 w-6 text-[var(--text-muted)]" /></div>
                        )}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col justify-center py-0.5">
                        <p className="line-clamp-3 text-[13px] font-medium leading-snug text-[var(--text-primary)]">{r.title}</p>
                        <p className="mt-1 line-clamp-2 text-[11px] text-[var(--text-muted)]">
                          {r.channelTitle || "YouTube"}
                          {r.duration ? ` · ${r.duration}` : ""}
                        </p>
                        <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-[var(--brand)]/45 bg-[var(--brand-glow)] px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--brand)]">
                          Details <ChevronRight className="h-3 w-3" />
                        </span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); void handleSelectResult(r); }}
                      disabled={addingVideoId === r.videoId}
                      className="flex shrink-0 flex-col items-center justify-center self-center rounded-xl bg-[var(--brand)] px-3 py-2 text-[11px] font-bold text-white transition hover:brightness-110 active:scale-[0.97] disabled:opacity-50"
                    >
                      {addingVideoId === r.videoId ? "…" : "Add"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : user && isListenOnly ? (
          <div className="flex items-center gap-3 rounded-xl border border-amber-500/10 bg-amber-500/5 px-4 py-3">
            <Lock className="h-4 w-4 shrink-0 text-amber-400" />
            <p className="text-[13px] text-amber-200/80"><span className="font-semibold text-amber-400">Listen-only</span> mode.</p>
          </div>
        ) : !user ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-center">
            <p className="text-[13px] text-[var(--text-secondary)]"><Link href="/login" className="font-medium text-[var(--brand)] hover:underline">Log in</Link> to add songs and vote</p>
          </div>
        ) : null}
      </section>
      </div>

      {/* Up Next — flex-1 is only the scroll region below room + search */}
      <section className="flex min-h-0 flex-1 min-w-0 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-4 pb-5">
        {/* Now Playing — same rank gutter as queue rows so thumbnails align */}
        {nowPlaying && (
          <div className="mb-4">
            <h2 className="mb-1.5 font-display text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Now Playing</h2>
            <div
              key={`${nowPlaying.id}-${nowPlayingAnimKey}`}
              className="queue-card glass-panel animate-fade-in-up flex items-center gap-3 border-l-[3px] !border-l-[var(--brand)] !bg-[var(--brand-glow)] px-4 py-3"
              style={{ boxShadow: "inset 0 0 16px var(--brand-glow)" }}
            >
              <div className="flex w-6 shrink-0 items-center justify-center text-[var(--brand)]" title="Now playing">
                <Play className="h-5 w-5 drop-shadow-[0_0_6px_var(--brand-glow)]" fill="currentColor" aria-hidden />
              </div>
              {nowPlaying.thumbnail ? (
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg">
                  <Image src={nowPlaying.thumbnail} alt={nowPlaying.title} fill className="object-cover" unoptimized />
                  <div className="absolute inset-0 flex items-end justify-end bg-black/30 p-1">
                    <div className="equalizer"><span /><span /><span /></div>
                  </div>
                </div>
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-hover)]">
                  <Music className="h-5 w-5 text-[var(--brand)]" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => setTrackSheet({ kind: "song", song: nowPlaying })}
                  className="w-full rounded-lg text-left outline-none transition hover:text-[var(--brand)] focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                >
                  <p className="line-clamp-2 text-[13px] font-medium leading-snug text-[var(--text-primary)]">{nowPlaying.title}</p>
                  <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-[var(--brand)]/45 bg-[var(--brand-glow)] px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--brand)]">
                    Details
                    <ChevronRight className="h-3 w-3" />
                  </span>
                </button>
                <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                  Added by {user && nowPlaying.user?.id === user.id ? "you" : nowPlaying.user?.name || "unknown"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => openSavePicker(nowPlaying)}
                disabled={false}
                className="group flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-white/80 transition hover:border-[var(--brand)] hover:bg-white/[0.06] disabled:opacity-50"
                title="Save to playlist"
              >
                {savedToastId === nowPlaying.id ? <Check className="h-4 w-4 text-[var(--success)]" /> : <Bookmark className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}

        <div className="mb-4 flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">Up Next</h2>
            <div className="mt-1 h-[3px] w-6 rounded-full bg-[var(--brand)]" />
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {isCreator && queue.length > 0 && (
              <button onClick={handleClearQueue} className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-[var(--danger)] transition hover:bg-red-500/10">
                Clear All
              </button>
            )}
            <span className="text-[12px] text-[var(--text-muted)]">{queue.length} track{queue.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
        {queue.length === 0 ? (
          <div className="w-full max-w-full rounded-xl border border-dashed border-[var(--border)] py-12 text-center">
            <Music className="mx-auto mb-2 h-8 w-8 text-[var(--text-muted)]" />
            <p className="text-[13px] text-[var(--text-muted)]">{nowPlaying ? "Queue is empty." : canAddSongs ? "Search above to add a song!" : "Waiting for the host."}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {queueForRender.map((song, idx) => {
              const canRemove = isCreator || (user && song.userId === user.id);
              const isMine = user && song.userId === user.id;
              const isMoving = !!(movingToNowPlaying && song.id === movingToNowPlaying.id);
              return (
                <div
                  key={song.id}
                  className={`queue-card group glass-panel flex items-center gap-3 px-4 py-3 ${
                    isMine ? "!border-l-[3px] !border-l-[var(--brand)] !bg-[var(--brand-glow)]" : ""
                  } ${isMoving ? "animate-queue-to-now pointer-events-none !transition-none" : ""}`}
                >
                  {/* Rank */}
                  <div className={`flex w-6 shrink-0 items-center justify-center text-[20px] font-bold ${isMine ? "text-[var(--brand)]" : "text-[var(--text-muted)]"}`}>{idx + 1}</div>
                  {/* Thumbnail */}
                  {song.thumbnail ? (
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg">
                      <Image src={song.thumbnail} alt={song.title} fill className="object-cover" unoptimized />
                      {isCreator && (
                        <button onClick={() => handlePlaySong(song.id)} className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition group-hover:opacity-100">
                          <Play className="h-5 w-5 text-white" fill="white" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-hover)]">
                      <Music className="h-5 w-5 text-[var(--text-muted)]" />
                    </div>
                  )}
                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => setTrackSheet({ kind: "song", song })}
                      className="w-full rounded-lg text-left outline-none transition hover:text-[var(--brand)] focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                    >
                      <p className="line-clamp-2 text-[13px] font-medium leading-snug text-[var(--text-primary)]">{song.title}</p>
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-[var(--brand)]/45 bg-[var(--brand-glow)] px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--brand)]">
                        Details
                        <ChevronRight className="h-3 w-3" />
                      </span>
                    </button>
                    <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                      Added by {isMine ? "you" : song.user?.name || "unknown"}
                    </p>
                  </div>
                  {/* Actions — compact horizontal row (keeps cards shorter) */}
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openSavePicker(song)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-[var(--text-muted)] transition hover:border-[var(--brand)]/35 hover:bg-[var(--brand-glow)] hover:text-[var(--text-primary)]"
                      title="Save to playlist"
                    >
                      {savedToastId === song.id ? <Check className="h-4 w-4 text-[var(--success)]" /> : <Bookmark className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpvote(song.id)}
                      className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-[12px] font-semibold tabular-nums transition ${
                        song.hasVoted
                          ? "border-[var(--brand)]/35 bg-[var(--brand-glow)] text-[var(--brand)]"
                          : "border-white/10 bg-white/[0.03] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      }`}
                      title={song.hasVoted ? "Remove vote" : "Upvote"}
                    >
                      <ChevronUp className="h-4 w-4" />
                      {song.upvotes}
                    </button>
                    {canRemove && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSong(song.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-[var(--text-muted)] transition hover:border-red-400/35 hover:bg-red-500/10 hover:text-[var(--danger)]"
                        title="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {/* Start Playing button */}
        {isCreator && songs.length > 0 && !nowPlaying && queue.length > 0 && (
          <button onClick={() => queue[0] && handlePlaySong(queue[0].id)} className="glow-button mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] py-3 text-sm font-semibold text-white transition hover:brightness-110 active:scale-[0.97]">
            <Play className="h-4 w-4" fill="white" />Start Playing
          </button>
        )}
        </div>
      </section>

      {/* In-room Library (keeps socket + playback alive) */}
      {libraryOpen && (
        <div className="fixed inset-0 z-[105] flex items-end justify-center pb-[calc(env(safe-area-inset-bottom)+3.5rem)] sm:items-center sm:p-4 sm:pb-4" role="dialog" aria-modal="true" aria-label="Library">
          <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setLibraryOpen(false)} aria-label="Close" />
          <div className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl sm:max-h-[min(90vh,620px)] sm:rounded-2xl sm:mb-0 mb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                {activePlaylist ? (
                  <button
                    type="button"
                    onClick={() => { setActivePlaylist(null); setPlaylistItems([]); setPlSearchQuery(""); setPlSearchResults([]); }}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] text-[var(--text-primary)] transition hover:border-[var(--brand)]"
                    aria-label="Back"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                ) : null}
                <div className="min-w-0">
                  <h2 className="truncate font-display text-[15px] font-semibold text-[var(--text-primary)]">
                    {activePlaylist ? activePlaylist.name : "Library"}
                  </h2>
                  {!activePlaylist ? (
                    <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                      Pick a playlist, then add songs to the queue.
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {!activePlaylist && (
                  <button
                    type="button"
                    onClick={() => setCreatePlOpen((v) => !v)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-[var(--text-muted)] transition hover:border-[var(--brand)]/35 hover:bg-[var(--brand-glow)] hover:text-[var(--text-primary)]"
                    aria-label="Create playlist"
                    title="Create playlist"
                  >
                    <Plus className="h-4.5 w-4.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setLibraryOpen(false); setCreatePlOpen(false); setCreatePlName(""); }}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            {createPlOpen && !activePlaylist && (
              <div className="border-b border-[var(--border)] px-4 py-3">
                <div className="flex items-center gap-2">
                  <input
                    value={createPlName}
                    onChange={(e) => setCreatePlName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void doCreatePlaylistInRoom(); } }}
                    placeholder="New playlist name"
                    className="h-10 min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--background)]/40 px-3 text-[13px] text-[var(--text-primary)] outline-none transition focus:border-[var(--brand)] focus:shadow-[0_0_0_2px_var(--brand-glow)]"
                  />
                  <button
                    type="button"
                    onClick={() => { void doCreatePlaylistInRoom(); }}
                    disabled={creatingPl || !createPlName.trim()}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--brand)] px-4 text-[13px] font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                  >
                    {creatingPl ? "Creating…" : "Create"}
                  </button>
                </div>
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4">
              {libraryErr && (
                <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-400">
                  {libraryErr}
                </div>
              )}
              {libraryLoading ? (
                <div className="py-12 flex justify-center">
                  <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent" />
                </div>
              ) : !activePlaylist ? (
                playlists.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-hover)] p-10 text-center">
                    <p className="text-sm text-[var(--text-secondary)]">No playlists yet.</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">Create or import playlists from the Library page.</p>
                  </div>
                ) : (
                  <>
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        Your playlists
                      </p>
                      <a
                        href="/library"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-semibold text-[var(--brand)] hover:underline"
                        title="Opens in a new tab"
                      >
                        Manage
                      </a>
                    </div>
                    <div className="space-y-2">
                      {playlists.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => { void openPlaylist(p.id); }}
                          className="group flex w-full items-center gap-3 rounded-2xl border border-white/[0.08] bg-[var(--background)]/40 p-3 text-left shadow-[0_12px_34px_rgba(0,0,0,0.45)] transition hover:border-[var(--border-glow)] hover:bg-[var(--surface-hover)]"
                        >
                          <div className="shrink-0 transition group-hover:scale-[1.01] active:scale-[0.99]">
                            <PlaylistCoverGrid
                              thumbnails={p.coverThumbnails ?? []}
                              itemCount={p.itemCount}
                              name={p.name}
                              className="h-12 w-12 sm:h-[3.25rem] sm:w-[3.25rem]"
                            />
                          </div>
                          <div className="relative min-w-0 flex-1">
                            <p className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{p.name}</p>
                            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                              {p.itemCount} {p.itemCount === 1 ? "track" : "tracks"} · Updated {new Date(p.updatedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-[var(--text-muted)] transition group-hover:border-white/15 group-hover:text-[var(--text-primary)]">
                            <ChevronRight className="h-4 w-4" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )
              ) : playlistItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-hover)] p-10 text-center">
                  <p className="text-sm text-[var(--text-secondary)]">No tracks in this playlist.</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">Import a YouTube playlist link to fill it.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* YouTube search to add into this playlist */}
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                      {plSearching ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent" />
                      ) : (
                        <Search className="h-4 w-4 text-[var(--text-muted)]" />
                      )}
                    </div>
                    <input
                      value={plSearchQuery}
                      onChange={(e) => { setPlSearchQuery(e.target.value); if (!e.target.value.trim()) setPlSearchResults([]); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void executePlaylistSearch(); } }}
                      enterKeyHint="search"
                      className="h-11 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] pl-11 pr-11 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--brand)] focus:shadow-[0_0_0_2px_var(--brand-glow)]"
                      placeholder="Search YouTube or paste a YouTube URL"
                    />
                    {plSearchQuery && (
                      <button
                        type="button"
                        onClick={() => { setPlSearchQuery(""); setPlSearchResults([]); }}
                        className="absolute inset-y-0 right-0 flex items-center pr-4 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        aria-label="Clear"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {plSearchResults.length > 0 && (
                    <div className="max-h-[min(55vh,18rem)] space-y-1 overflow-y-auto overscroll-y-contain rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-2xl">
                      {plSearchResults.map((r) => (
                        <div key={r.videoId} className="flex items-stretch gap-2 rounded-xl p-1.5 transition hover:bg-[var(--surface-hover)]">
                          <div className="flex min-w-0 flex-1 gap-3 rounded-lg p-1">
                            <div className="relative h-[3.5rem] w-[5.5rem] shrink-0 overflow-hidden rounded-lg bg-black">
                              {r.thumbnail ? (
                                <Image src={r.thumbnail} alt={r.title} fill className="object-cover" unoptimized sizes="88px" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center"><Music className="h-5 w-5 text-[var(--text-muted)]" /></div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1 py-0.5">
                              <p className="line-clamp-2 text-[12px] font-medium text-[var(--text-primary)]">{r.title}</p>
                              <p className="mt-1 line-clamp-1 text-[10px] text-[var(--text-muted)]">
                                {r.channelTitle || "YouTube"}{r.duration ? ` · ${r.duration}` : ""}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => { void addToActivePlaylist(r); }}
                            disabled={plAddingVideoId === r.videoId}
                            className="flex shrink-0 items-center justify-center self-center rounded-xl bg-[var(--brand)] px-3 py-2 text-[11px] font-bold text-white transition hover:brightness-110 disabled:opacity-50"
                          >
                            {plAddingVideoId === r.videoId ? "…" : "Add"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {playlistItems.map((it) => (
                    <div key={it.id} className="flex items-stretch gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] p-2">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-black">
                        {it.thumbnail ? (
                          <Image src={it.thumbnail} alt={it.title} fill className="object-cover" unoptimized sizes="56px" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Music className="h-5 w-5 text-[var(--text-muted)]" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 py-0.5">
                        <p className="line-clamp-2 text-[13px] font-medium text-[var(--text-primary)]">{it.title}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { void dropFromLibrary(it); }}
                        disabled={droppingId === it.id}
                        className="flex shrink-0 items-center justify-center self-center rounded-xl bg-[var(--brand)] px-4 py-2 text-[12px] font-bold text-white transition hover:brightness-110 active:scale-[0.97] disabled:opacity-50"
                      >
                        {droppingId === it.id ? "Adding…" : "Add"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );


  // ==================================================================
  // NOW PLAYING PANEL CONTENT
  // ==================================================================
  const isPhoneLayout = !isTablet && !isDesktop;

  const playerPanelContent = (
    <div
      className={
        isPhoneLayout
          ? "flex h-full min-h-0 flex-1 flex-col overflow-hidden px-5 py-3"
          : "flex h-full flex-col items-center overflow-y-auto px-5 py-6 md:px-8"
      }
    >
      <div
        className={`w-full transition-all duration-300 ${isPhoneLayout ? "flex min-h-0 max-w-none flex-1 flex-col" : chatCollapsed ? "max-w-[640px]" : "max-w-[560px]"}`}
      >
        <YouTubePlayer
          videoId={currentVideoId}
          songTitle={nowPlaying?.title}
          songArtist={nowPlaying?.user?.name}
          thumbnailUrl={nowPlaying?.thumbnail}
          isHost={isCreator}
          syncState={syncState}
          onSkip={handleSongEnd}
          onHostPlayback={handleHostPlayback}
          onSongTitleClick={nowPlaying ? () => setTrackSheet({ kind: "song", song: nowPlaying }) : undefined}
          proportionedLayout={isPhoneLayout}
        />
      </div>
    </div>
  );

  // ==================================================================
  // LAYOUT
  // ==================================================================
  return (
    <div className="room-shell relative flex h-[100dvh] flex-col md:h-screen">
      {/* Soft duotone wash — low contrast so video + letterboxing stay neutral */}
      <div className="room-ambient-1" aria-hidden />
      <div className="room-ambient-2" aria-hidden />

      {/* Mobile room header (< 768px) */}
      {!isTablet && !isDesktop ? (
        <header className="fixed top-0 left-0 right-0 z-50 flex h-12 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-3">
          <button onClick={handleLeaveRoom} className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] transition hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 max-w-[50%]">
            {nowPlaying && <div className="equalizer shrink-0"><span /><span /><span /></div>}
            <h1 className="truncate text-[16px] font-semibold text-[var(--text-primary)]">{room.name}</h1>
          </div>
          <button onClick={() => { void copyRoomCode(); }} className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-hover)] px-2.5 py-1 text-[11px]">
            <span className="font-mono font-bold tracking-wider text-[var(--brand)]">{room.code}</span>
            {copied ? <Check className="h-3 w-3 text-[var(--success)]" /> : <Copy className="h-3 w-3 text-[var(--text-muted)]" />}
          </button>
        </header>
      ) : (
        <Navbar hideLibrary onAvatarClick={user ? handleOpenProfile : undefined} />
      )}

      {/* Connection banner — below mobile header (48px) or desktop navbar (72px) */}
      {connectionStatus !== "connected" && (
        <div className={`fixed left-0 right-0 z-50 flex items-center justify-center gap-2 py-2 text-sm font-medium ${isTablet || isDesktop ? "top-[72px]" : "top-12"} ${connectionStatus === "reconnecting" ? "bg-amber-500/90 text-black" : "text-white"}`} style={connectionStatus === "disconnected" ? { background: "rgba(239,68,68,0.9)" } : undefined}>
          {connectionStatus === "reconnecting" ? (
            <><div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" />Reconnecting...</>
          ) : (
            <>Disconnected <button onClick={() => { getSocket().connect(); setConnectionStatus("reconnecting"); }} className="ml-2 rounded-full bg-white/20 px-3 py-0.5 text-xs font-semibold">Retry</button></>
          )}
        </div>
      )}

      {/* ===== DESKTOP >= 1024px: 3 columns ===== */}
      {isDesktop ? (
        <div className="relative z-[1] flex flex-1 overflow-hidden pt-[72px]">
          {/* Queue rail — dark but not pure black (contrast with video stage) */}
          <aside className={`flex min-h-0 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--rail-bg)] pt-3 overflow-visible transition-[width] duration-300 ease-in-out ${chatCollapsed ? "w-[38%]" : "w-[32%] max-w-[480px]"}`}>
            {queuePanelContent}
          </aside>
          {/* Now Playing — OLED-friendly black behind video */}
          <main className="relative flex-1 min-w-0 overflow-y-auto bg-[var(--room-stage)] transition-[flex] duration-300 ease-in-out">
            {playerPanelContent}
            {/* "Clubhouse" button — only when collapsed */}
            {chatCollapsed && (
              <button
                onClick={() => { setChatCollapsed(false); setUnreadChat(0); }}
                className="absolute top-3 right-3 z-30 flex items-center gap-2 rounded-xl border border-[var(--brand)]/35 bg-[var(--brand-glow)] px-4 py-2 text-[13px] font-semibold text-[var(--text-primary)] shadow-[0_18px_44px_rgba(0,0,0,0.35)] transition hover:border-[var(--brand)]/55 hover:brightness-110 active:scale-[0.98]"
              >
                <MessageCircle className="h-4 w-4" />
                Clubhouse
                {unreadChat > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--danger)] px-1.5 text-[10px] font-bold text-white">{unreadChat}</span>}
              </button>
            )}
          </main>
          {/* Chat Panel — always mounted, width animates to 0 */}
          <aside className={`relative flex min-h-0 shrink-0 flex-col overflow-hidden border-[var(--border)] bg-[var(--surface)] pt-3 transition-[width,border] duration-300 ease-in-out ${chatCollapsed ? "w-0 border-l-0" : "w-[24%] max-w-[380px] border-l"}`}>
            {/* Inner wrapper keeps chat content at a fixed min-width so it doesn't squish during animation */}
            <div className="flex h-full min-h-0 min-w-[280px] flex-col overflow-hidden">
              {id && (
                <RoomChat
                  roomId={id}
                  currentUserId={user?.id || null}
                  fullHeight
                  onClose={() => setChatCollapsed(true)}
                />
              )}
            </div>
          </aside>
        </div>

      /* ===== TABLET 768-1023px: 2 columns + slide-over chat ===== */
      ) : isTablet ? (
        <div className="relative z-[1] flex flex-1 overflow-hidden pt-[72px]">
          <aside className="flex min-h-0 w-[300px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--rail-bg)] pt-3 overflow-visible">
            {queuePanelContent}
          </aside>
          <main className="relative flex-1 min-w-0 overflow-y-auto bg-[var(--room-stage)]">
            {playerPanelContent}
            {/* Chat toggle button */}
            <button onClick={() => { setShowChatSlide(!showChatSlide); setUnreadChat(0); }} className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand)] text-white shadow-lg transition hover:brightness-110 active:scale-95">
              <MessageCircle className="h-5 w-5" />
              {unreadChat > 0 && !showChatSlide && <span className="absolute -right-0.5 -top-0.5 h-[6px] w-[6px] rounded-full bg-[var(--danger)]" />}
            </button>
          </main>
          {/* Chat slide-over */}
          {showChatSlide && (
            <>
              <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowChatSlide(false)} />
              <div className="fixed top-[72px] right-0 bottom-0 z-50 flex min-h-0 w-[300px] flex-col overflow-hidden border-l border-[var(--border)] bg-[var(--surface)] shadow-[-12px_0_40px_rgba(0,0,0,0.5)]">
                {id && (
                  <RoomChat
                    roomId={id}
                    currentUserId={user?.id || null}
                    fullHeight
                    onClose={() => setShowChatSlide(false)}
                  />
                )}
              </div>
            </>
          )}
        </div>

      /* ===== MOBILE < 768px: bottom tab bar ===== */
      ) : (
        <div className="relative flex flex-1 flex-col overflow-hidden">
          {/* Content area — all panels always mounted, inactive panels positioned off-screen
              so the YouTube iframe stays alive (display:none kills postMessage) */}
          {/* top-12 = 48px = height of the mobile room header above */}
          <div className={`absolute inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] top-12 overflow-y-auto ${mobileTab === "queue" ? "z-10" : "z-0 pointer-events-none -translate-x-full"}`}>
            {queuePanelContent}
          </div>
          <div
            className={`absolute inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] top-12 flex min-h-0 flex-col bg-[var(--room-stage)] ${mobileTab === "player" ? "z-10 overflow-hidden" : "z-0 pointer-events-none -translate-x-full overflow-y-auto"}`}
          >
            {playerPanelContent}
          </div>
          <div
            className={`absolute inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] top-12 flex min-h-0 flex-col overflow-hidden ${mobileTab === "chat" ? "z-10" : "z-0 pointer-events-none -translate-x-full"}`}
          >
            {id && <RoomChat roomId={id} currentUserId={user?.id || null} fullHeight hideHeader />}
          </div>
          {/* Bottom tab bar */}
          <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-14 items-center border-t border-[var(--border)] bg-[var(--surface)]" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
            {([
              { key: "queue" as const, icon: ListMusic, label: "Queue" },
              { key: "player" as const, icon: Disc3, label: "Player" },
              { key: "chat" as const, icon: MessageCircle, label: "Clubhouse" },
            ]).map(({ key, icon: Icon, label }) => (
              <button key={key} onClick={() => { setMobileTab(key); if (key === "chat") setUnreadChat(0); }} className={`flex flex-1 flex-col items-center gap-1 py-1 transition ${mobileTab === key ? "text-[var(--brand)]" : "text-[var(--text-muted)]"}`}>
                <div className="relative">
                  <Icon className="h-5 w-5" />
                  {key === "player" && nowPlaying && mobileTab !== "player" && <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />}
                  {key === "chat" && unreadChat > 0 && mobileTab !== "chat" && <span className="absolute -right-1 -top-1 h-[6px] w-[6px] rounded-full bg-[var(--danger)]" />}
                </div>
                <span className="text-[11px]">{label}</span>
                {mobileTab === key && <div className="mt-0.5 h-[3px] w-3 rounded-full bg-[var(--brand)]" />}
              </button>
            ))}
          </nav>
        </div>
      )}

      <TrackDetailSheet
        open={trackSheet !== null}
        onClose={() => setTrackSheet(null)}
        tone="dark"
        saveLabel="Save to playlist"
        onSave={() => {
          if (!trackSheet) return;
          if (trackSheet.kind === "song") {
            openSavePicker({
              id: trackSheet.song.id,
              title: trackSheet.song.title,
              url: trackSheet.song.url,
              thumbnail: trackSheet.song.thumbnail,
            });
          } else {
            openSavePicker({
              id: trackSheet.r.videoId,
              title: trackSheet.r.title,
              url: `https://www.youtube.com/watch?v=${trackSheet.r.videoId}`,
              thumbnail: trackSheet.r.thumbnail,
            });
          }
          setTrackSheet(null);
        }}
        track={
          trackSheet === null
            ? null
            : trackSheet.kind === "song"
              ? {
                  title: trackSheet.song.title,
                  url: trackSheet.song.url,
                  thumbnail: trackSheet.song.thumbnail,
                  subtitle: `Added by ${user && trackSheet.song.userId === user.id ? "you" : trackSheet.song.user?.name || "someone"}`,
                }
              : {
                  title: trackSheet.r.title,
                  url: `https://www.youtube.com/watch?v=${trackSheet.r.videoId}`,
                  thumbnail: trackSheet.r.thumbnail,
                  subtitle: [trackSheet.r.channelTitle, trackSheet.r.duration].filter(Boolean).join(" · "),
                }
        }
        primaryAction={
          trackSheet?.kind === "search"
            ? {
                label: addingVideoId === trackSheet.r.videoId ? "Adding…" : "Add to queue",
                onClick: () => { void handleSelectResult(trackSheet.r); },
                disabled: addingVideoId === trackSheet.r.videoId,
              }
            : undefined
        }
      />

      {/* Save-to-playlist picker (global so it works from Player + Queue) */}
      {savePickerOpenForSongId && savePickerSong && (
        <div
          className="fixed inset-0 z-[111] flex items-center justify-center px-3 py-4 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Choose playlist"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => { setSavePickerOpenForSongId(null); setSavePickerSong(null); setCreatePlOpen(false); setCreatePlName(""); }}
            aria-label="Close"
          />
          <div className="relative z-10 flex max-h-[82vh] w-full max-w-[22rem] flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl sm:max-h-[min(90vh,520px)] sm:max-w-md">
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <div className="min-w-0">
                <h2 className="truncate font-display text-[15px] font-semibold text-[var(--text-primary)]">Save to playlist</h2>
                <p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--text-muted)]">{savePickerSong.title}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCreatePlOpen((v) => !v)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-[var(--text-muted)] transition hover:border-[var(--brand)]/35 hover:bg-[var(--brand-glow)] hover:text-[var(--text-primary)]"
                  aria-label="Create playlist"
                  title="Create playlist"
                >
                  <Plus className="h-4.5 w-4.5" />
                </button>
                <button
                  type="button"
                  onClick={() => { setSavePickerOpenForSongId(null); setSavePickerSong(null); setCreatePlOpen(false); setCreatePlName(""); }}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            {createPlOpen && (
              <div className="border-b border-[var(--border)] px-4 py-3">
                <div className="flex items-center gap-2">
                  <input
                    value={createPlName}
                    onChange={(e) => setCreatePlName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void doCreatePlaylistInRoom(); } }}
                    placeholder="New playlist name"
                    className="h-10 min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--background)]/40 px-3 text-[13px] text-[var(--text-primary)] outline-none transition focus:border-[var(--brand)] focus:shadow-[0_0_0_2px_var(--brand-glow)]"
                  />
                  <button
                    type="button"
                    onClick={() => { void doCreatePlaylistInRoom(); }}
                    disabled={creatingPl || !createPlName.trim()}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--brand)] px-4 text-[13px] font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                  >
                    {creatingPl ? "Creating…" : "Create"}
                  </button>
                </div>
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4">
              {playlists.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-hover)] p-10 text-center">
                  <p className="text-sm text-[var(--text-secondary)]">No playlists yet.</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">Create one from the Library page.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {playlists.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { void saveToPlaylist(p.id); }}
                      disabled={savingToPlaylistId === p.id}
                      className="group flex w-full items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] p-2.5 text-left transition hover:border-[var(--brand)] disabled:opacity-50"
                    >
                      <div className="shrink-0 transition group-hover:scale-[1.01] active:scale-[0.99]">
                        <PlaylistCoverGrid
                          thumbnails={p.coverThumbnails ?? []}
                          itemCount={p.itemCount}
                          name={p.name}
                          className="h-10 w-10"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-semibold text-[var(--text-primary)]">{p.name}</p>
                        <p className="mt-0.5 text-[10.5px] text-[var(--text-muted)]">Updated {new Date(p.updatedAt).toLocaleDateString()}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm animate-fade-in-up rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: modal.type === "error" ? "rgba(239,68,68,0.1)" : modal.type === "confirm" ? (modal.confirmTone === "brand" ? "var(--brand-glow)" : "rgba(245,158,11,0.1)") : "var(--brand-glow)" }}>
              {modal.type === "error" ? <X className="h-5 w-5 text-[var(--danger)]" /> : modal.type === "confirm" ? (modal.confirmTone === "brand" ? <UserRound className="h-5 w-5 text-[var(--brand)]" /> : <Trash2 className="h-5 w-5 text-amber-400" />) : <Music className="h-5 w-5 text-[var(--brand)]" />}
            </div>
            <h3 className="mb-1 text-lg font-semibold text-[var(--text-primary)]">{modal.title}</h3>
            <p className="mb-6 text-sm leading-relaxed text-[var(--text-secondary)]">{modal.message}</p>
            {modal.type === "confirm" ? (
              <div className="flex gap-3">
                <button type="button" onClick={() => setModal(null)} className="flex-1 rounded-lg bg-[var(--surface-hover)] py-2.5 text-sm font-semibold text-[var(--text-primary)] transition hover:brightness-110">Cancel</button>
                <button
                  type="button"
                  onClick={() => { void modal.onConfirm?.(); }}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-semibold text-white transition hover:brightness-110 ${modal.confirmTone === "brand" ? "bg-[var(--brand)]" : "bg-[var(--danger)]"}`}
                >
                  {modal.confirmLabel ?? "Delete"}
                </button>
              </div>
            ) : (
              <button onClick={() => setModal(null)} className="w-full rounded-lg bg-[var(--surface-hover)] py-2.5 text-sm font-semibold text-[var(--text-primary)] transition hover:brightness-110">OK</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
