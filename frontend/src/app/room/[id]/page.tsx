"use client";

import { useEffect, useState, useCallback, useRef, useSyncExternalStore } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  getRoom, getSongs, addSong, upvoteSong, removeSong, playSong, skipSong, clearQueue,
  deleteRoom, updateRoomMode, searchYouTube, trackRoomJoin,
  Room, Song, YouTubeResult,
} from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useAuth } from "@/lib/auth-context";
import Navbar from "@/components/Navbar";
import YouTubePlayer, { PlaybackState } from "@/components/YouTubePlayer";
import RoomChat from "@/components/RoomChat";
import {
  ChevronLeft, Copy, Check, MoreVertical, Search, X, Music, ChevronRight,
  ChevronUp, Trash2, Play, Lock, Unlock, LogOut, ListMusic, Disc3, MessageCircle,
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

function extractVideoId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

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
  const [modal, setModal] = useState<{ title: string; message: string; type: "info" | "error" | "confirm"; onConfirm?: () => void } | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "reconnecting" | "disconnected">("connected");
  const [showChatSlide, setShowChatSlide] = useState(false);
  const [unreadChat, setUnreadChat] = useState(0);
  const [chatCollapsed, setChatCollapsed] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<YouTubeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingVideoId, setAddingVideoId] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  // debounceRef removed — search now triggers on Enter only
  const usersRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // ---- Click-outside ----
  useEffect(() => {
    function h(e: MouseEvent) {
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
    const onConnect = () => { setConnectionStatus("connected"); socket.emit("join-room", { roomId: id, userId: user?.id || `anon-${socket.id}`, userName: user?.name || "Anonymous" }); };
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
  }, [id, authLoading, user, fetchSongs]);

  // Auto-switch to player tab only on initial load if a song is already playing
  const initialTabSet = useRef(false);
  useEffect(() => {
    if (!isDesktop && !isTablet && !initialTabSet.current && songs.some((s) => s.isPlaying)) {
      setMobileTab("player");
      initialTabSet.current = true;
    }
  }, [songs, isDesktop, isTablet]);

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
  const executeSearch = async () => { const q = searchQuery.trim(); if (!q) return; setSearching(true); try { setSearchResults(await searchYouTube(q)); } catch { setSearchResults([]); } finally { setSearching(false); } };
  const sortSongs = (list: Song[]) => [...list].sort((a, b) => b.upvotes - a.upvotes || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const handleSelectResult = async (r: YouTubeResult) => { if (!id) return; setAddingVideoId(r.videoId); try { const t = r.title.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'"); const s = await addSong(id, { title: t, url: `https://www.youtube.com/watch?v=${r.videoId}`, thumbnail: r.thumbnail || undefined }); setSongs((p) => sortSongs([...p, s])); setSearchQuery(""); setSearchResults([]); getSocket().emit("song-added", { roomId: id, song: s }); } catch { setModal({ title: "Oops", message: "Failed to add song.", type: "error" }); } finally { setAddingVideoId(null); } };
  const handleUpvote = async (songId: string) => { if (!user) { setModal({ title: "Login required", message: "Please log in to vote.", type: "info" }); return; } setSongs((p) => sortSongs(p.map((s) => s.id !== songId ? s : { ...s, hasVoted: !s.hasVoted, upvotes: s.hasVoted ? s.upvotes - 1 : s.upvotes + 1 }))); try { const u = await upvoteSong(songId); setSongs((p) => sortSongs(p.map((s) => (s.id === songId ? u : s)))); getSocket().emit("song-upvoted", { roomId: id, songId, upvotes: u.upvotes }); } catch (e: unknown) { fetchSongs(); if (e instanceof Error && e.message === "Login required") setModal({ title: "Login required", message: "Please log in to vote.", type: "info" }); } };
  const handleRemoveSong = async (songId: string) => { try { await removeSong(songId); setSongs((p) => p.filter((s) => s.id !== songId)); getSocket().emit("song-removed", { roomId: id, songId }); } catch (e) { setModal({ title: "Error", message: e instanceof Error ? e.message : "Failed to remove", type: "error" }); } };
  const handlePlaySong = async (songId: string) => { if (!id) return; try { await playSong(songId); await fetchSongs(); getSocket().emit("playback-changed", { roomId: id }); } catch (e) { setModal({ title: "Error", message: e instanceof Error ? e.message : "Failed to play", type: "error" }); } };
  const handleSkipSong = useCallback(async () => { if (!id) return; /* Immediately clear the now-playing song to stop the player instantly */ setSongs((prev) => prev.map((s) => s.isPlaying ? { ...s, isPlaying: false } : s)); try { const u = await skipSong(id); setSongs(u); getSocket().emit("playback-changed", { roomId: id }); } catch (e) { console.error("Skip failed:", e); } }, [id]);
  const isCreatorRef = useRef(false);
  // When a song ends, any client emits song-ended — backend handles the skip with a lock
  const handleSongEnd = useCallback(() => {
    if (!id) return;
    // Immediately clear the current song so the player stops instantly (no brief replay)
    setSongs((prev) => prev.map((s) => s.isPlaying ? { ...s, isPlaying: false } : s));
    getSocket().emit("song-ended", { roomId: id });
  }, [id]);
  const handleHostPlayback = useCallback((isPaused: boolean, currentTime: number) => { if (!id) return; getSocket().emit("host-playback", { roomId: id, isPaused, currentTime }); }, [id]);
  const handleDeleteRoom = () => { if (!id) return; setShowMenu(false); setModal({ title: "Delete room?", message: "This will permanently delete the room and all its songs.", type: "confirm", onConfirm: async () => { setModal(null); setDeleting(true); try { await deleteRoom(id); router.push("/"); } catch (e) { setModal({ title: "Error", message: e instanceof Error ? e.message : "Failed", type: "error" }); setDeleting(false); } } }); };
  const handleLeaveRoom = () => { const s = getSocket(); if (id) s.emit("leave-room", id); s.disconnect(); router.push("/"); };
  const handleToggleMode = async () => { if (!id || !room) return; const m = room.mode === "open" ? "listen_only" : "open"; try { const u = await updateRoomMode(id, m); setRoom(u); setShowMenu(false); getSocket().emit("room-updated", { roomId: id, room: u }); } catch (e) { setModal({ title: "Error", message: e instanceof Error ? e.message : "Failed", type: "error" }); } };
  const handleClearQueue = () => { if (!id) return; setModal({ title: "Clear queue?", message: "This will remove all upcoming songs from the queue.", type: "confirm", onConfirm: async () => { setModal(null); try { await clearQueue(id); setSongs((p) => p.filter((s) => s.isPlaying)); getSocket().emit("song-removed", { roomId: id }); } catch (e) { setModal({ title: "Error", message: e instanceof Error ? e.message : "Failed to clear", type: "error" }); } } }); };

  // ---- Derived ----
  const isCreator = !!(user && room && room.createdBy === user.id);
  useEffect(() => { isCreatorRef.current = isCreator; }, [isCreator]);
  const isListenOnly = room?.mode === "listen_only";
  const canAddSongs = !!(user && (!isListenOnly || isCreator));
  const nowPlaying = songs.find((s) => s.isPlaying) || null;
  const queue = songs.filter((s) => !s.isPlaying);
  const currentVideoId = nowPlaying ? extractVideoId(nowPlaying.url) : null;

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
    <div className="flex h-full flex-col">
      {/* Room Info */}
      <section className="shrink-0 p-5 pb-0">
        {/* Row 1: Room name + code & menu on the right */}
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-display text-[32px] font-bold leading-tight text-[var(--text-primary)]">{room.name}</h1>
          <div className="flex shrink-0 items-center gap-2 pt-1">
            {/* Room code pill */}
            <div className="relative">
              <button onClick={() => { navigator.clipboard.writeText(room.code); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] px-2.5 py-1.5 text-[12px] transition hover:border-[var(--brand)]">
                <span className="font-mono font-bold tracking-widest text-[var(--brand)]">{room.code}</span>
                {copied ? <Check className="h-3 w-3 text-[var(--success)]" /> : <Copy className="h-3 w-3 text-[var(--text-muted)]" />}
              </button>
              {copied && <span className="absolute -top-7 left-1/2 -translate-x-1/2 rounded-md bg-[var(--success)] px-2 py-0.5 text-[10px] font-semibold text-white whitespace-nowrap animate-fade-in-up">Copied!</span>}
            </div>
            {/* Kebab menu */}
            <div className="relative" ref={menuRef}>
              <button onClick={() => setShowMenu(!showMenu)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] transition hover:bg-[var(--surface-hover)]">
                <MoreVertical className="h-4 w-4 text-[var(--text-muted)]" />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1.5 shadow-2xl">
                  {isCreator && (<>
                    <button onClick={handleToggleMode} className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]">
                      {isListenOnly ? <><Unlock className="h-4 w-4 text-[var(--success)]" /><span>Open to all</span></> : <><Lock className="h-4 w-4 text-amber-400" /><span>Listen only</span></>}
                    </button>
                    <div className="mx-3 my-1 border-t border-[var(--border)]" />
                    <button onClick={handleDeleteRoom} disabled={deleting} className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-[var(--danger)] transition disabled:opacity-50 hover:bg-red-500/5">
                      <Trash2 className="h-4 w-4" />{deleting ? "Deleting..." : "Delete room"}
                    </button>
                    <div className="mx-3 my-1 border-t border-[var(--border)]" />
                  </>)}
                  <button onClick={handleLeaveRoom} className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-orange-400 transition hover:bg-orange-500/5">
                    <LogOut className="h-4 w-4" />Leave room
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Metadata */}
        <div className="mt-3 flex flex-wrap items-center gap-4 text-[14px] text-[var(--text-secondary)]">
          {(() => { const host = users.find(u => u.isHost); return host ? <span>hosted by <span className="text-amber-400">{user && host.id === user.id ? "you" : host.name}</span></span> : null; })()}
          <span>{songs.length} song{songs.length !== 1 ? "s" : ""}</span>
          <div className="relative" ref={usersRef}>
            <button onClick={() => setShowUsers(!showUsers)} className="flex items-center gap-1.5 transition hover:text-[var(--text-primary)]">
              <span className="online-dot relative h-2 w-2 rounded-full bg-[var(--success)]" />
              {users.filter(u => !u.isOffline).length} online
              <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-200 ${showUsers ? "rotate-90" : ""}`} />
            </button>
            {showUsers && (
              <div className="absolute left-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
                <div className="border-b border-[var(--border)] px-4 py-2.5"><p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">People in room</p></div>
                <div className="max-h-60 overflow-y-auto p-2">
                  {users.filter(u => !u.isOffline).length === 0 ? <p className="py-3 text-center text-xs text-[var(--text-muted)]">No one here yet</p> : users.filter(u => !u.isOffline).map((u) => (
                    <div key={u.id} className="flex items-center gap-2.5 rounded-xl px-3 py-2">
                      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${u.isHost ? "bg-amber-500" : "bg-[var(--brand)]"}`}>{u.name.charAt(0).toUpperCase()}</div>
                      <span className="truncate text-sm font-medium text-[var(--text-primary)]">{u.name}</span>
                      <div className="ml-auto flex shrink-0 gap-1.5">
                        {u.isHost && <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-400">host</span>}
                        {user && u.id === user.id && <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[9px] font-medium text-[var(--text-muted)]">you</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {isListenOnly && <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[12px] font-medium text-amber-400 border border-amber-500/20">Listen only</span>}
        </div>
      </section>

      {/* Search */}
      <section className="shrink-0 px-5 pt-5">
        {canAddSongs ? (
          <div className="relative" ref={searchRef}>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                {searching ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent" /> : <Search className="h-4 w-4 text-[var(--text-muted)]" />}
              </div>
              <input type="text" value={searchQuery} onChange={(e) => handleSearchChange(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); executeSearch(); } }} enterKeyHint="search" placeholder="Search YouTube for a song..." className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] pl-10 pr-9 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brand-glow)]" />
              {searchQuery && <button onClick={() => { setSearchQuery(""); setSearchResults([]); }} className="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X className="h-4 w-4" /></button>}
            </div>
            {searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 space-y-1 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-2xl">
                {searchResults.map((r) => (
                  <div key={r.videoId} className="flex items-center gap-3 rounded-lg p-2 transition hover:bg-[var(--surface-hover)]">
                    {r.thumbnail && <div className="relative h-10 w-16 shrink-0 overflow-hidden rounded-lg"><Image src={r.thumbnail} alt={r.title} fill className="object-cover" unoptimized /></div>}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-[var(--text-primary)]" dangerouslySetInnerHTML={{ __html: r.title }} />
                      <p className="truncate text-[11px] text-[var(--text-muted)]">{r.channelTitle}</p>
                    </div>
                    <button onClick={() => handleSelectResult(r)} disabled={addingVideoId === r.videoId} className="shrink-0 rounded-lg bg-[var(--brand)] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 active:scale-[0.97] disabled:opacity-50">
                      {addingVideoId === r.videoId ? "..." : "+ Add"}
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

      {/* Up Next */}
      <section className="flex-1 overflow-y-auto px-5 pt-6 pb-5">
        {/* Now Playing card */}
        {nowPlaying && (
          <div className="mb-5">
            <h2 className="font-display text-[13px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Now Playing</h2>
            <div className="glass-panel flex items-center gap-3 border-l-[3px] !border-l-[var(--brand)] p-3" style={{ background: "var(--brand-glow)", boxShadow: "inset 0 0 20px var(--brand-glow)" }}>
              {nowPlaying.thumbnail ? (
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg">
                  <Image src={nowPlaying.thumbnail} alt={nowPlaying.title} fill className="object-cover" unoptimized />
                  {/* Equalizer overlay */}
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
                <p className="line-clamp-2 text-[14px] font-medium leading-tight text-[var(--text-primary)]">{nowPlaying.title}</p>
                <p className="mt-1 text-[12px] text-[var(--text-secondary)]">added by {user && nowPlaying.user?.id === user.id ? "you" : nowPlaying.user?.name || "unknown"}</p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">Up Next</h2>
            <div className="mt-1 h-[3px] w-6 rounded-full bg-[var(--brand)]" />
          </div>
          <div className="flex items-center gap-3">
            {isCreator && queue.length > 0 && (
              <button onClick={handleClearQueue} className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-[var(--danger)] transition hover:bg-red-500/10">
                Clear All
              </button>
            )}
            <span className="text-[12px] text-[var(--text-muted)]">{queue.length} track{queue.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
        {queue.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] py-12 text-center">
            <Music className="mx-auto mb-2 h-8 w-8 text-[var(--text-muted)]" />
            <p className="text-[13px] text-[var(--text-muted)]">{nowPlaying ? "Queue is empty." : canAddSongs ? "Search above to add a song!" : "Waiting for the host."}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map((song, idx) => {
              const canRemove = isCreator || (user && song.userId === user.id);
              const isMine = user && song.userId === user.id;
              return (
                <div key={song.id} className={`queue-card group glass-panel flex items-center gap-3 px-4 py-3 ${isMine ? "!border-l-[3px] !border-l-[var(--brand)] !bg-[var(--brand-glow)]" : ""}`}>
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
                    <p className="line-clamp-2 text-[15px] font-medium leading-snug text-[var(--text-primary)]">{song.title}</p>
                    <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                      added by {isMine ? "you" : song.user?.name || "unknown"}
                    </p>
                  </div>
                  {/* Actions */}
                  <div className="flex shrink-0 flex-col items-center gap-1">
                    <button onClick={() => handleUpvote(song.id)} className={`flex flex-col items-center rounded-lg px-2 py-1 transition ${song.hasVoted ? "text-[var(--brand)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}>
                      <ChevronUp className="h-5 w-5" />
                      <span className="text-[13px] font-semibold tabular-nums">{song.upvotes}</span>
                    </button>
                    {canRemove && (
                      <button onClick={() => handleRemoveSong(song.id)} className="text-[var(--text-muted)] transition hover:text-[var(--danger)]">
                        <Trash2 className="h-3.5 w-3.5" />
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
      </section>
    </div>
  );

  // ==================================================================
  // NOW PLAYING PANEL CONTENT
  // ==================================================================
  const playerPanelContent = (
    <div className="flex h-full flex-col items-center overflow-y-auto px-5 py-6 md:px-8">
      {/* NOW PLAYING header */}
      <h2 className="mb-5 font-display text-[13px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Now Playing</h2>
      <div className={`w-full transition-all duration-300 ${chatCollapsed ? "max-w-[640px]" : "max-w-[520px]"}`}>
        <YouTubePlayer videoId={currentVideoId} songTitle={nowPlaying?.title} songArtist={nowPlaying?.user?.name} isHost={isCreator} syncState={syncState} onSkip={handleSongEnd} onHostPlayback={handleHostPlayback} />
      </div>
    </div>
  );

  // ==================================================================
  // LAYOUT
  // ==================================================================
  return (
    <div className="flex h-screen flex-col bg-[var(--background)]">
      {/* Ambient orbs */}
      <div className="ambient-orb-1" />
      <div className="ambient-orb-2" />

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
          <button onClick={() => { navigator.clipboard.writeText(room.code); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-hover)] px-2.5 py-1 text-[11px]">
            <span className="font-mono font-bold tracking-wider text-[var(--brand)]">{room.code}</span>
            {copied ? <Check className="h-3 w-3 text-[var(--success)]" /> : <Copy className="h-3 w-3 text-[var(--text-muted)]" />}
          </button>
        </header>
      ) : (
        <Navbar />
      )}

      {/* Connection banner */}
      {connectionStatus !== "connected" && (
        <div className={`fixed top-14 left-0 right-0 z-50 flex items-center justify-center gap-2 py-2 text-sm font-medium ${connectionStatus === "reconnecting" ? "bg-amber-500/90 text-black" : "text-white"}`} style={connectionStatus === "disconnected" ? { background: "rgba(239,68,68,0.9)" } : undefined}>
          {connectionStatus === "reconnecting" ? (
            <><div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" />Reconnecting...</>
          ) : (
            <>Disconnected <button onClick={() => { getSocket().connect(); setConnectionStatus("reconnecting"); }} className="ml-2 rounded-full bg-white/20 px-3 py-0.5 text-xs font-semibold">Retry</button></>
          )}
        </div>
      )}

      {/* ===== DESKTOP >= 1024px: 3 columns ===== */}
      {isDesktop ? (
        <div className="flex flex-1 overflow-hidden pt-14">
          {/* Queue Panel */}
          <aside className={`shrink-0 border-r border-[var(--border)] overflow-hidden transition-[width] duration-300 ease-in-out ${chatCollapsed ? "w-[38%]" : "w-[32%] max-w-[480px]"}`}>
            {queuePanelContent}
          </aside>
          {/* Now Playing Panel */}
          <main className="relative flex-1 min-w-0 overflow-y-auto transition-[flex] duration-300 ease-in-out">
            {playerPanelContent}
            {/* "Open Chat" button — only when collapsed */}
            {chatCollapsed && (
              <button
                onClick={() => { setChatCollapsed(false); setUnreadChat(0); }}
                className="absolute top-3 right-3 z-30 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[13px] font-medium text-[var(--text-secondary)] transition hover:border-[var(--brand)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
              >
                <MessageCircle className="h-4 w-4" />
                Open Chat
                {unreadChat > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--danger)] px-1.5 text-[10px] font-bold text-white">{unreadChat}</span>}
              </button>
            )}
          </main>
          {/* Chat Panel — always mounted, width animates to 0 */}
          <aside className={`relative shrink-0 overflow-hidden transition-[width,border] duration-300 ease-in-out ${chatCollapsed ? "w-0 border-l-0" : "w-[24%] max-w-[380px] border-l border-[var(--border)]"}`}>
            {/* Red close button */}
            <button
              onClick={() => setChatCollapsed(true)}
              className="absolute top-2 right-2 z-30 flex h-7 w-7 items-center justify-center rounded-full text-white transition hover:brightness-110"
              style={{ background: "rgba(239,68,68,0.85)" }}
              title="Close chat"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            {/* Inner wrapper keeps chat content at a fixed min-width so it doesn't squish during animation */}
            <div className="h-full min-w-[280px]">
              {id && <RoomChat roomId={id} currentUserId={user?.id || null} fullHeight />}
            </div>
          </aside>
        </div>

      /* ===== TABLET 768-1023px: 2 columns + slide-over chat ===== */
      ) : isTablet ? (
        <div className="flex flex-1 overflow-hidden pt-14">
          <aside className="w-[300px] shrink-0 border-r border-[var(--border)] overflow-hidden">
            {queuePanelContent}
          </aside>
          <main className="flex-1 min-w-0 overflow-y-auto relative">
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
              <div className="fixed top-14 right-0 bottom-0 z-50 w-[300px] border-l border-[var(--border)] bg-[var(--background)]">
                {id && <RoomChat roomId={id} currentUserId={user?.id || null} fullHeight />}
              </div>
            </>
          )}
        </div>

      /* ===== MOBILE < 768px: bottom tab bar ===== */
      ) : (
        <div className="relative flex flex-1 flex-col overflow-hidden pt-12">
          {/* Content area — all panels always mounted, inactive panels positioned off-screen
              so the YouTube iframe stays alive (display:none kills postMessage) */}
          <div className={`absolute inset-0 overflow-y-auto pb-14 pt-12 ${mobileTab === "queue" ? "z-10" : "z-0 pointer-events-none -translate-x-full"}`}>
            {queuePanelContent}
          </div>
          <div className={`absolute inset-0 overflow-y-auto pb-14 pt-12 ${mobileTab === "player" ? "z-10" : "z-0 pointer-events-none -translate-x-full"}`}>
            {playerPanelContent}
          </div>
          <div className={`absolute inset-0 pb-14 pt-12 ${mobileTab === "chat" ? "z-10" : "z-0 pointer-events-none -translate-x-full"}`}>
            {id && <RoomChat roomId={id} currentUserId={user?.id || null} fullHeight />}
          </div>
          {/* Bottom tab bar */}
          <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-14 items-center border-t border-[var(--border)] bg-[var(--surface)]" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
            {([
              { key: "queue" as const, icon: ListMusic, label: "Queue" },
              { key: "player" as const, icon: Disc3, label: "Player" },
              { key: "chat" as const, icon: MessageCircle, label: "Chat" },
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

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm animate-fade-in-up rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: modal.type === "error" ? "rgba(239,68,68,0.1)" : modal.type === "confirm" ? "rgba(245,158,11,0.1)" : "rgba(124,58,237,0.1)" }}>
              {modal.type === "error" ? <X className="h-5 w-5 text-[var(--danger)]" /> : modal.type === "confirm" ? <Trash2 className="h-5 w-5 text-amber-400" /> : <Music className="h-5 w-5 text-[var(--brand)]" />}
            </div>
            <h3 className="mb-1 text-lg font-semibold text-[var(--text-primary)]">{modal.title}</h3>
            <p className="mb-6 text-sm leading-relaxed text-[var(--text-secondary)]">{modal.message}</p>
            {modal.type === "confirm" ? (
              <div className="flex gap-3">
                <button onClick={() => setModal(null)} className="flex-1 rounded-lg bg-[var(--surface-hover)] py-2.5 text-sm font-semibold text-[var(--text-primary)] transition hover:brightness-110">Cancel</button>
                <button onClick={modal.onConfirm} className="flex-1 rounded-lg bg-[var(--danger)] py-2.5 text-sm font-semibold text-white transition hover:brightness-110">Delete</button>
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
