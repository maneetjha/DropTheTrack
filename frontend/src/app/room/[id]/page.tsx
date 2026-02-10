"use client";

import { useEffect, useState, useCallback, useRef, useSyncExternalStore } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  getRoom, getSongs, addSong, upvoteSong, removeSong, playSong, skipSong,
  deleteRoom, updateRoomMode, searchYouTube, trackRoomJoin,
  Room, Song, YouTubeResult,
} from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useAuth } from "@/lib/auth-context";
import Navbar from "@/components/Navbar";
import YouTubePlayer, { PlaybackState } from "@/components/YouTubePlayer";

interface RoomUser {
  id: string;
  name: string;
  isHost?: boolean;
  isOffline?: boolean;
}

// ---- Media query hook (SSR-safe) ----
const LG_QUERY = "(min-width: 1024px)";
function subscribeToMedia(cb: () => void) { const m = window.matchMedia(LG_QUERY); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); }
function getIsDesktop() { return typeof window !== "undefined" && window.matchMedia(LG_QUERY).matches; }
function getIsDesktopServer() { return false; }
function useIsDesktop() { return useSyncExternalStore(subscribeToMedia, getIsDesktop, getIsDesktopServer); }

function extractVideoId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

export default function RoomPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const isDesktop = useIsDesktop();

  const [room, setRoom] = useState<Room | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [users, setUsers] = useState<RoomUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [mobileTab, setMobileTab] = useState<"queue" | "player">("queue");
  const [syncState, setSyncState] = useState<PlaybackState | null>(null);
  const [modal, setModal] = useState<{ title: string; message: string; type: "info" | "error" | "confirm"; onConfirm?: () => void } | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<YouTubeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingVideoId, setAddingVideoId] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usersRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (showUsers && usersRef.current && !usersRef.current.contains(e.target as Node)) setShowUsers(false);
      if (showMenu && menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
      if (searchResults.length > 0 && searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchResults([]);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showUsers, showMenu, searchResults.length]);

  const fetchSongs = useCallback(async () => { if (!id) return; try { setSongs(await getSongs(id)); } catch (e) { console.error(e); } }, [id]);

  useEffect(() => { if (!id) return; (async () => { try { const [r, s] = await Promise.all([getRoom(id), getSongs(id)]); setRoom(r); setSongs(s); } catch (e) { console.error(e); } finally { setLoading(false); } })(); }, [id]);
  useEffect(() => { if (!id || authLoading || !user) return; trackRoomJoin(id); }, [id, authLoading, user]);

  useEffect(() => {
    if (!id || authLoading) return;
    const socket = getSocket(); socket.connect();
    const onConnect = () => { socket.emit("join-room", { roomId: id, userId: user?.id || `anon-${socket.id}`, userName: user?.name || "Anonymous" }); };
    if (socket.connected) onConnect(); else socket.on("connect", onConnect);
    socket.on("queue-updated", () => { getSongs(id).then(setSongs).catch(console.error); });
    socket.on("users-updated", (u: RoomUser[]) => setUsers(u));
    socket.on("room-updated", (d: { room: Room }) => { if (d.room) setRoom(d.room); });
    socket.on("playback-sync", (s: PlaybackState) => { setSyncState(s); });
    return () => { socket.emit("leave-room", id); socket.off("connect", onConnect); socket.off("queue-updated"); socket.off("users-updated"); socket.off("room-updated"); socket.off("playback-sync"); socket.disconnect(); };
  }, [id, authLoading, user, fetchSongs]);

  useEffect(() => { if (!isDesktop && songs.some((s) => s.isPlaying)) setMobileTab("player"); }, [songs, isDesktop]);

  // ---- Handlers ----
  const handleSearchChange = (v: string) => { setSearchQuery(v); if (debounceRef.current) clearTimeout(debounceRef.current); if (!v.trim()) { setSearchResults([]); setSearching(false); return; } setSearching(true); debounceRef.current = setTimeout(async () => { try { setSearchResults(await searchYouTube(v.trim())); } catch { setSearchResults([]); } finally { setSearching(false); } }, 300); };
  const handleSelectResult = async (r: YouTubeResult) => { if (!id) return; setAddingVideoId(r.videoId); try { const t = r.title.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'"); const s = await addSong(id, { title: t, url: `https://www.youtube.com/watch?v=${r.videoId}`, thumbnail: r.thumbnail || undefined }); setSongs((p) => [...p, s].sort((a, b) => b.upvotes - a.upvotes)); setSearchQuery(""); setSearchResults([]); getSocket().emit("song-added", { roomId: id, song: s }); } catch { setModal({ title: "Oops", message: "Failed to add song.", type: "error" }); } finally { setAddingVideoId(null); } };
  const handleUpvote = async (songId: string) => { if (!user) { setModal({ title: "Login required", message: "Please log in to vote.", type: "info" }); return; } setSongs((p) => p.map((s) => s.id !== songId ? s : { ...s, hasVoted: !s.hasVoted, upvotes: s.hasVoted ? s.upvotes - 1 : s.upvotes + 1 }).sort((a, b) => b.upvotes - a.upvotes)); try { const u = await upvoteSong(songId); setSongs((p) => p.map((s) => (s.id === songId ? u : s)).sort((a, b) => b.upvotes - a.upvotes)); getSocket().emit("song-upvoted", { roomId: id, songId, upvotes: u.upvotes }); } catch (e: unknown) { fetchSongs(); if (e instanceof Error && e.message === "Login required") setModal({ title: "Login required", message: "Please log in to vote.", type: "info" }); } };
  const handleRemoveSong = async (songId: string) => { try { await removeSong(songId); setSongs((p) => p.filter((s) => s.id !== songId)); getSocket().emit("song-removed", { roomId: id, songId }); } catch (e) { setModal({ title: "Error", message: e instanceof Error ? e.message : "Failed to remove", type: "error" }); } };
  const handlePlaySong = async (songId: string) => { if (!id) return; try { await playSong(songId); await fetchSongs(); getSocket().emit("playback-changed", { roomId: id }); } catch (e) { setModal({ title: "Error", message: e instanceof Error ? e.message : "Failed to play", type: "error" }); } };
  const handleSkipSong = useCallback(async () => { if (!id) return; try { const u = await skipSong(id); setSongs(u); getSocket().emit("playback-changed", { roomId: id }); } catch (e) { console.error("Skip failed:", e); } }, [id]);
  const isCreatorRef = useRef(false);
  const handleSongEnd = useCallback(() => { if (isCreatorRef.current) handleSkipSong(); }, [handleSkipSong]);
  const handleHostPlayback = useCallback((isPaused: boolean, currentTime: number) => { if (!id) return; getSocket().emit("host-playback", { roomId: id, isPaused, currentTime }); }, [id]);
  const handleDeleteRoom = () => { if (!id) return; setShowMenu(false); setModal({ title: "Delete room?", message: "This will permanently delete the room and all its songs.", type: "confirm", onConfirm: async () => { setModal(null); setDeleting(true); try { await deleteRoom(id); router.push("/"); } catch (e) { setModal({ title: "Error", message: e instanceof Error ? e.message : "Failed", type: "error" }); setDeleting(false); } } }); };
  const handleLeaveRoom = () => { const s = getSocket(); if (id) s.emit("leave-room", id); s.disconnect(); router.push("/"); };
  const handleToggleMode = async () => { if (!id || !room) return; const m = room.mode === "open" ? "listen_only" : "open"; try { const u = await updateRoomMode(id, m); setRoom(u); setShowMenu(false); getSocket().emit("room-updated", { roomId: id, room: u }); } catch (e) { setModal({ title: "Error", message: e instanceof Error ? e.message : "Failed", type: "error" }); } };

  // ---- Derived ----
  const isCreator = !!(user && room && room.createdBy === user.id);
  useEffect(() => { isCreatorRef.current = isCreator; }, [isCreator]);
  const isListenOnly = room?.mode === "listen_only";
  const canAddSongs = !!(user && (!isListenOnly || isCreator));
  const nowPlaying = songs.find((s) => s.isPlaying) || null;
  const queue = songs.filter((s) => !s.isPlaying);
  const currentVideoId = nowPlaying ? extractVideoId(nowPlaying.url) : null;

  if (loading) return (<div className="min-h-screen bg-[var(--bg-dark)]"><Navbar /><div className="flex items-center justify-center py-32"><div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" /></div></div>);
  if (!room) return (<div className="min-h-screen bg-[var(--bg-dark)]"><Navbar /><div className="mx-auto max-w-2xl px-4 pt-28 text-center"><h2 className="font-display text-2xl text-[var(--text-light)]">Room not found</h2><p className="mt-2 text-[var(--text-muted)]">This room might not exist or the backend isn&apos;t running.</p><Link href="/" className="btn-ripple mt-6 inline-block rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] px-6 py-3 font-semibold text-white transition-all hover:-translate-y-0.5">Back to Home</Link></div></div>);

  // ==============================================================
  // ROOM HEADER
  // ==============================================================
  const headerJSX = (
    <div className="relative z-20 mb-8">
      <button onClick={handleLeaveRoom} className="mb-3 inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] transition hover:text-[var(--primary)]">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        Leave room
      </button>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="truncate font-display text-3xl font-bold text-[var(--text-light)]">{room.name}</h1>
            {isListenOnly && <span className="shrink-0 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-medium text-amber-400 border border-amber-500/20">Listen only</span>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-[var(--text-muted)]">
            <span>{songs.length} song{songs.length !== 1 ? "s" : ""}</span>
            <span className="text-white/10">|</span>
            <div className="relative" ref={usersRef}>
              <button onClick={() => setShowUsers(!showUsers)} className="flex items-center gap-1.5 transition hover:text-[var(--text-light)]">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
                {users.length} online
                <svg className={`h-3 w-3 transition ${showUsers ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              {showUsers && (
                <div className="absolute left-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1a1a2e]/95 backdrop-blur-xl shadow-2xl">
                  <div className="border-b border-white/5 px-4 py-2.5"><p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">People in room</p></div>
                  <div className="max-h-60 overflow-y-auto p-2">
                    {users.length === 0 ? <p className="py-3 text-center text-xs text-[var(--text-muted)]">No one here yet</p> : users.map((u) => (
                      <div key={u.id} className={`flex items-center gap-2.5 rounded-xl px-3 py-2 ${u.isOffline ? "opacity-30" : ""}`}>
                        <div className="relative shrink-0">
                          <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ${u.isHost ? "bg-amber-500" : "bg-[var(--primary)]"}`}>{u.name.charAt(0).toUpperCase()}</div>
                          {!u.isOffline && <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-[1.5px] border-[#1a1a2e] bg-emerald-400" />}
                        </div>
                        <span className="truncate text-sm font-medium text-white/90">{u.name}</span>
                        <div className="ml-auto flex shrink-0 items-center gap-1.5">
                          {u.isHost && <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-400">host</span>}
                          {user && u.id === user.id && <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[9px] font-medium text-white/40">you</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={() => { navigator.clipboard.writeText(room.code); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 transition-all hover:border-[var(--primary)]/40 hover:bg-[rgba(107,90,237,0.08)]">
            <span className="font-mono text-sm font-bold tracking-widest text-[var(--primary)]">{room.code}</span>
            <svg className="h-3.5 w-3.5 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>{copied ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /> : <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />}</svg>
          </button>
          <div className="relative" ref={menuRef}>
            <button onClick={() => setShowMenu(!showMenu)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 transition-all hover:border-white/20 hover:bg-white/10">
              <svg className="h-5 w-5 text-[var(--text-muted)]" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" /></svg>
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-2xl border border-white/10 bg-[var(--bg-darker)] py-2 shadow-2xl">
                {isCreator && (<>
                  <button onClick={handleToggleMode} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-[var(--text-light)] transition hover:bg-white/5">
                    {isListenOnly ? (<><svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg><span>Open to all</span></>) : (<><svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg><span>Listen only</span></>)}
                  </button>
                  <div className="mx-3 my-1 border-t border-white/5" />
                  <button onClick={handleDeleteRoom} disabled={deleting} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-400 transition hover:bg-red-500/5 disabled:opacity-50">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    {deleting ? "Deleting..." : "Delete room"}
                  </button>
                  <div className="mx-3 my-1 border-t border-white/5" />
                </>)}
                <button onClick={handleLeaveRoom} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-orange-400 transition hover:bg-orange-500/5">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  Leave room
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // ==============================================================
  // SEARCH
  // ==============================================================
  const searchJSX = canAddSongs ? (
    <div className="relative z-10 mb-8" ref={searchRef}>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
          {searching ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" /> : <svg className="h-5 w-5 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>}
        </div>
        <input type="text" value={searchQuery} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Search YouTube for a song..." className="w-full rounded-2xl border border-white/10 bg-white/[0.03] py-3.5 pl-12 pr-10 text-[var(--text-light)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--primary)]/50 focus:bg-white/[0.05] focus:ring-2 focus:ring-[rgba(107,90,237,0.15)]" />
        {searchQuery && <button onClick={() => { setSearchQuery(""); setSearchResults([]); }} className="absolute inset-y-0 right-0 flex items-center pr-4 text-[var(--text-muted)] hover:text-[var(--text-light)]"><svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>}
      </div>
      {searchResults.length > 0 && (
        <div className="mt-3 space-y-1 rounded-2xl border border-white/5 bg-[var(--bg-darker)]/80 backdrop-blur-xl p-2">
          {searchResults.map((r) => (
            <div key={r.videoId} className="flex items-center gap-3 rounded-xl p-2 transition-all hover:bg-white/[0.04]">
              {r.thumbnail && <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg"><Image src={r.thumbnail} alt={r.title} fill className="object-cover" unoptimized /></div>}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--text-light)]" dangerouslySetInnerHTML={{ __html: r.title }} />
                <p className="truncate text-xs text-[var(--text-muted)]">{r.channelTitle}</p>
              </div>
              <button onClick={() => handleSelectResult(r)} disabled={addingVideoId === r.videoId} className="shrink-0 rounded-xl bg-[var(--primary)] px-5 py-2 text-xs font-semibold text-white transition-all hover:bg-[var(--primary-dark)] active:scale-95 disabled:opacity-50">
                {addingVideoId === r.videoId ? "Adding..." : "+ Add"}
              </button>
            </div>
          ))}
        </div>
      )}
      {searchQuery && !searching && searchResults.length === 0 && <p className="mt-3 text-center text-sm text-[var(--text-muted)]">No results found. Try different keywords.</p>}
    </div>
  ) : user && isListenOnly ? (
    <div className="mb-8 flex items-center gap-3 rounded-2xl border border-amber-500/10 bg-amber-500/5 px-5 py-4">
      <svg className="h-5 w-5 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
      <p className="text-sm text-amber-200/80"><span className="font-semibold text-amber-400">Listen-only</span> mode. Only the host can add songs.</p>
    </div>
  ) : !user ? (
    <div className="mb-8 rounded-2xl border border-white/5 bg-white/[0.02] p-6 text-center">
      <p className="text-[var(--text-muted)]"><Link href="/login" className="font-medium text-[var(--primary)] hover:underline">Log in</Link> or <Link href="/register" className="font-medium text-[var(--primary)] hover:underline">sign up</Link> to add songs and vote</p>
    </div>
  ) : null;

  // ==============================================================
  // QUEUE — the main redesign
  // ==============================================================
  const queueJSX = (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-[var(--text-light)]">Up Next</h2>
        {isCreator && songs.length > 0 && !nowPlaying && (
          <button onClick={() => queue[0] && handlePlaySong(queue[0].id)} className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[var(--primary)]/20 active:scale-95">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            Start Playing
          </button>
        )}
      </div>
      {queue.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center">
          <svg className="mx-auto mb-3 h-10 w-10 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
          <p className="text-sm text-[var(--text-muted)]">{nowPlaying ? "Queue is empty. Add more songs!" : canAddSongs ? "No songs yet. Search above to add one!" : user ? "Waiting for the host to add songs." : "Log in to add songs!"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {queue.map((song, idx) => {
            const canRemove = isCreator || (user && song.userId === user.id);
            const isMine = user && song.userId === user.id;
            return (
              <div key={song.id} className={`group relative flex items-center gap-4 rounded-2xl border-l-[3px] border p-3 transition-all duration-200 ${isMine ? "border-l-[var(--primary)] border-y-[var(--primary)]/20 border-r-[var(--primary)]/20 bg-[rgba(107,90,237,0.1)] shadow-[inset_0_0_20px_rgba(107,90,237,0.06)] hover:bg-[rgba(107,90,237,0.15)]" : "border-l-transparent border-white/[0.04] bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.05]"}`}>
                {/* Position */}
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${isMine ? "bg-[var(--primary)] text-white" : "bg-white/[0.04] text-[var(--text-muted)]"}`}>
                  {idx + 1}
                </div>

                {/* Thumbnail */}
                {song.thumbnail ? (
                  <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-xl">
                    <Image src={song.thumbnail} alt={song.title} fill className="object-cover" unoptimized />
                    {/* Play overlay on hover (host) */}
                    {isCreator && (
                      <button onClick={() => handlePlaySong(song.id)} className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition group-hover:opacity-100">
                        <svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex h-14 w-24 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--primary)]/10 to-[var(--accent-purple)]/10">
                    <svg className="h-6 w-6 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                  </div>
                )}

                {/* Song info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--text-light)] leading-tight">{song.title}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                    added by {song.user?.name || "unknown"}
                    {isMine && <span className="rounded bg-[var(--primary)]/15 px-1.5 py-px text-[9px] font-bold uppercase text-[var(--primary)]">you</span>}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-2">
                  {/* Remove button */}
                  {canRemove && (
                    <button onClick={() => handleRemoveSong(song.id)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-[var(--text-muted)] opacity-0 transition-all hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100" title="Remove">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  )}

                  {/* Upvote */}
                  <button onClick={() => handleUpvote(song.id)} className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 transition-all ${song.hasVoted ? "border-[var(--primary)]/50 bg-[var(--primary)]/10 shadow-[0_0_12px_rgba(107,90,237,0.15)]" : "border-white/[0.06] bg-white/[0.03] hover:border-[var(--primary)]/30 hover:bg-[var(--primary)]/5"}`}>
                    <svg className={`h-4 w-4 transition-all ${song.hasVoted ? "text-[var(--primary)] scale-110" : "text-[var(--text-muted)]"}`} fill={song.hasVoted ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                    <span className={`text-sm font-bold tabular-nums ${song.hasVoted ? "text-[var(--primary)]" : "text-[var(--text-light)]"}`}>{song.upvotes}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ==============================================================
  // PLAYER
  // ==============================================================
  const playerJSX = (
    <YouTubePlayer videoId={currentVideoId} songTitle={nowPlaying?.title} songArtist={nowPlaying?.user?.name} isHost={isCreator} syncState={syncState} onSkip={handleSongEnd} onHostPlayback={handleHostPlayback} />
  );

  // ==============================================================
  // LAYOUT
  // ==============================================================
  return (
    <div className="min-h-screen bg-[var(--bg-dark)]">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-15">
        <div className="animate-float absolute -left-[10%] -top-[10%] h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,var(--primary)_0%,transparent_70%)] blur-[80px]" />
        <div className="animate-float-delay-5 absolute -bottom-[10%] -right-[10%] h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle,var(--accent-blue)_0%,transparent_70%)] blur-[80px]" />
      </div>

      <Navbar />

      {isDesktop ? (
        <div className="relative z-[1] flex h-screen pt-16">
          <div className="flex-1 overflow-y-auto px-8 pt-8 pb-10">
            {headerJSX}
            {searchJSX}
            {queueJSX}
          </div>
          <div className="w-[55%] max-w-[680px] shrink-0 border-l border-white/5 overflow-y-auto">
            <div className="px-8 pt-8 pb-10">{playerJSX}</div>
          </div>
        </div>
      ) : (
        <>
          <div className="fixed top-16 left-0 right-0 z-30 border-b border-white/5 bg-[var(--bg-dark)]/90 backdrop-blur-md">
            <div className="flex">
              <button onClick={() => setMobileTab("queue")} className={`flex-1 py-3 text-center text-sm font-semibold transition ${mobileTab === "queue" ? "text-[var(--primary)] border-b-2 border-[var(--primary)]" : "text-[var(--text-muted)]"}`}>
                Queue ({songs.length})
              </button>
              <button onClick={() => setMobileTab("player")} className={`flex-1 py-3 text-center text-sm font-semibold transition ${mobileTab === "player" ? "text-[var(--primary)] border-b-2 border-[var(--primary)]" : "text-[var(--text-muted)]"}`}>
                {nowPlaying ? <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 animate-pulse rounded-full bg-[var(--primary)]" />Player</span> : "Player"}
              </button>
            </div>
          </div>
          <div className="relative z-[1] px-5 pt-28 pb-16">
            {mobileTab === "queue" ? <>{headerJSX}{searchJSX}{queueJSX}</> : <div className="pt-2">{playerJSX}</div>}
          </div>
        </>
      )}

      {modal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm animate-fade-in-up rounded-2xl border border-white/10 bg-[var(--bg-darker)] p-6 shadow-2xl">
            <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full ${modal.type === "error" ? "bg-red-500/10" : modal.type === "confirm" ? "bg-amber-500/10" : "bg-[var(--primary)]/10"}`}>
              {modal.type === "error" ? <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg> : modal.type === "confirm" ? <svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> : <svg className="h-5 w-5 text-[var(--primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            </div>
            <h3 className="mb-1 text-lg font-semibold text-[var(--text-light)]">{modal.title}</h3>
            <p className="mb-6 text-sm leading-relaxed text-[var(--text-muted)]">{modal.message}</p>
            {modal.type === "confirm" ? (
              <div className="flex gap-3">
                <button onClick={() => setModal(null)} className="flex-1 rounded-xl bg-white/10 py-2.5 text-sm font-semibold text-[var(--text-light)] transition hover:bg-white/15">Cancel</button>
                <button onClick={modal.onConfirm} className="flex-1 rounded-xl bg-red-500/90 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500">Delete</button>
              </div>
            ) : (
              <button onClick={() => setModal(null)} className="w-full rounded-xl bg-white/10 py-2.5 text-sm font-semibold text-[var(--text-light)] transition hover:bg-white/15">OK</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
