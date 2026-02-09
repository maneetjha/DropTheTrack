"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  getRoom, getSongs, addSong, upvoteSong, deleteRoom, updateRoomMode,
  searchYouTube, Room, Song, YouTubeResult,
} from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useAuth } from "@/lib/auth-context";
import Navbar from "@/components/Navbar";

interface RoomUser {
  id: string;
  name: string;
}

export default function RoomPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [users, setUsers] = useState<RoomUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // YouTube search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<YouTubeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingVideoId, setAddingVideoId] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const usersRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (showUsers && usersRef.current && !usersRef.current.contains(e.target as Node)) {
        setShowUsers(false);
      }
      if (showMenu && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
      if (searchResults.length > 0 && searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchResults([]);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showUsers, showMenu, searchResults.length]);

  const fetchSongs = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getSongs(id);
      setSongs(data);
    } catch (err) {
      console.error("Failed to load songs:", err);
    }
  }, [id]);

  // Fetch room data immediately (doesn't need auth)
  useEffect(() => {
    if (!id) return;
    async function init() {
      try {
        const [roomData, songsData] = await Promise.all([
          getRoom(id),
          getSongs(id),
        ]);
        setRoom(roomData);
        setSongs(songsData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [id]);

  // Socket connection
  useEffect(() => {
    if (!id || authLoading) return;

    const socket = getSocket();
    socket.connect();

    const onConnect = () => {
      socket.emit("join-room", {
        roomId: id,
        userId: user?.id || `anon-${socket.id}`,
        userName: user?.name || "Anonymous",
      });
    };

    if (socket.connected) {
      onConnect();
    } else {
      socket.on("connect", onConnect);
    }

    socket.on("queue-updated", () => {
      getSongs(id).then(setSongs).catch(console.error);
    });

    socket.on("users-updated", (roomUsers: RoomUser[]) => {
      setUsers(roomUsers);
    });

    socket.on("room-updated", (data: { room: Room }) => {
      if (data.room) setRoom(data.room);
    });

    return () => {
      socket.emit("leave-room", id);
      socket.off("connect", onConnect);
      socket.off("queue-updated");
      socket.off("users-updated");
      socket.off("room-updated");
      socket.disconnect();
    };
  }, [id, authLoading, user, fetchSongs]);

  // Debounced YouTube search
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchYouTube(value.trim());
        setSearchResults(results);
      } catch (err) {
        console.error("YouTube search failed:", err);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const handleSelectResult = async (result: YouTubeResult) => {
    if (!id) return;
    setAddingVideoId(result.videoId);
    try {
      // Decode HTML entities in YouTube title
      const decodedTitle = result.title
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

      const song = await addSong(id, {
        title: decodedTitle,
        url: `https://www.youtube.com/watch?v=${result.videoId}`,
        thumbnail: result.thumbnail || undefined,
      });
      setSongs((prev) => [...prev, song].sort((a, b) => b.upvotes - a.upvotes));
      setSearchQuery("");
      setSearchResults([]);

      const socket = getSocket();
      socket.emit("song-added", { roomId: id, song });
    } catch (err) {
      console.error(err);
      alert("Failed to add song.");
    } finally {
      setAddingVideoId(null);
    }
  };

  const handleUpvote = async (songId: string) => {
    if (!user) {
      alert("Please log in to vote!");
      return;
    }

    // Optimistic update
    setSongs((prev) =>
      prev.map((s) => {
        if (s.id !== songId) return s;
        const wasVoted = s.hasVoted;
        return {
          ...s,
          hasVoted: !wasVoted,
          upvotes: wasVoted ? s.upvotes - 1 : s.upvotes + 1,
        };
      }).sort((a, b) => b.upvotes - a.upvotes)
    );

    try {
      const updated = await upvoteSong(songId);
      setSongs((prev) =>
        prev
          .map((s) => (s.id === songId ? updated : s))
          .sort((a, b) => b.upvotes - a.upvotes)
      );

      const socket = getSocket();
      socket.emit("song-upvoted", {
        roomId: id,
        songId,
        upvotes: updated.upvotes,
      });
    } catch (err: unknown) {
      // Revert optimistic update
      fetchSongs();
      if (err instanceof Error && err.message === "Login required") {
        alert("Please log in to vote!");
      } else {
        console.error(err);
      }
    }
  };

  const handleDeleteRoom = async () => {
    if (!id || !confirm("Are you sure you want to delete this room? This cannot be undone.")) return;
    setShowMenu(false);
    setDeleting(true);
    try {
      await deleteRoom(id);
      router.push("/");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete room");
      setDeleting(false);
    }
  };

  const handleLeaveRoom = () => {
    const socket = getSocket();
    if (id) socket.emit("leave-room", id);
    socket.disconnect();
    router.push("/");
  };

  const handleToggleMode = async () => {
    if (!id || !room) return;
    const newMode = room.mode === "open" ? "listen_only" : "open";
    try {
      const updated = await updateRoomMode(id, newMode);
      setRoom(updated);
      setShowMenu(false);
      const socket = getSocket();
      socket.emit("room-updated", { roomId: id, room: updated });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update mode");
    }
  };

  const isCreator = user && room && room.createdBy === user.id;
  const isListenOnly = room?.mode === "listen_only";
  const canAddSongs = user && (!isListenOnly || isCreator);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-dark)]">
        <Navbar />
        <div className="flex items-center justify-center py-32">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-[var(--bg-dark)]">
        <Navbar />
        <div className="mx-auto max-w-2xl px-4 pt-28 text-center">
          <h2 className="font-display text-2xl text-[var(--text-light)]">Room not found</h2>
          <p className="mt-2 text-[var(--text-muted)]">
            This room might not exist or the backend isn&apos;t running.
          </p>
          <Link
            href="/"
            className="btn-ripple mt-6 inline-block rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] px-6 py-3 font-semibold text-white transition-all hover:-translate-y-0.5"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-dark)]">
      {/* Background orbs */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-15">
        <div className="animate-float absolute -left-[10%] -top-[10%] h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,var(--primary)_0%,transparent_70%)] blur-[80px]" />
        <div className="animate-float-delay-5 absolute -bottom-[10%] -right-[10%] h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle,var(--accent-blue)_0%,transparent_70%)] blur-[80px]" />
      </div>

      <Navbar />

      <main className="relative z-[1] mx-auto max-w-3xl px-4 pt-24 pb-16 sm:px-6">
        {/* Room Header */}
        <div className="animate-fade-in-up relative z-20 mb-8">
          <button
            onClick={handleLeaveRoom}
            className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--text-muted)] transition hover:text-[var(--primary)]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Leave room
          </button>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-display text-3xl text-[var(--text-light)]">{room.name}</h1>
                {isListenOnly && (
                  <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400 border border-amber-500/20">
                    Listen only
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className="text-sm text-[var(--text-muted)]">
                  {songs.length} song{songs.length !== 1 ? "s" : ""} in queue
                </span>
                <span className="text-white/10">|</span>
                {/* Online badge */}
                <div className="relative" ref={usersRef}>
                  <button
                    onClick={() => setShowUsers(!showUsers)}
                    className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] transition hover:text-[var(--text-light)]"
                  >
                    <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                    {users.length} online
                    <svg className={`h-3 w-3 transition ${showUsers ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showUsers && (
                    <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-2xl border border-white/10 bg-[var(--bg-darker)] p-3 shadow-xl">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">People in room</p>
                      {users.length === 0 ? (
                        <p className="text-sm text-[var(--text-muted)]">No one here yet</p>
                      ) : (
                        <div className="space-y-1.5">
                          {users.map((u) => (
                            <div key={u.id} className="flex items-center gap-2">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent-purple)] text-xs font-bold text-white">
                                {u.name.charAt(0).toUpperCase()}
                              </div>
                              <span className="truncate text-sm text-[var(--text-light)]">
                                {u.name}
                                {user && u.id === user.id && (
                                  <span className="ml-1 text-xs text-[var(--text-muted)]">(you)</span>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {/* Share code */}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(room.code);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 transition-all hover:border-[var(--primary)]/40 hover:bg-[rgba(107,90,237,0.1)]"
              >
                <span className="font-mono text-sm font-bold tracking-widest text-[var(--primary)]">{room.code}</span>
                <svg className="h-4 w-4 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {copied ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  )}
                </svg>
                <span className="text-xs text-[var(--text-muted)]">{copied ? "Copied!" : "Copy"}</span>
              </button>

              {/* Three-dot menu */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 transition-all hover:border-white/20 hover:bg-white/10"
                >
                  <svg className="h-5 w-5 text-[var(--text-muted)]" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="5" r="1.5" />
                    <circle cx="12" cy="12" r="1.5" />
                    <circle cx="12" cy="19" r="1.5" />
                  </svg>
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-2xl border border-white/10 bg-[var(--bg-darker)] py-2 shadow-xl">
                    {isCreator && (
                      <>
                        <button onClick={handleToggleMode} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-[var(--text-light)] transition hover:bg-white/5">
                          {isListenOnly ? (
                            <>
                              <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                              <span>Open to all</span>
                            </>
                          ) : (
                            <>
                              <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                              <span>Listen only</span>
                            </>
                          )}
                        </button>
                        <div className="mx-3 my-1 border-t border-white/5" />
                        <button onClick={handleDeleteRoom} disabled={deleting} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-400 transition hover:bg-red-500/5 disabled:opacity-50">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          {deleting ? "Deleting..." : "Delete room"}
                        </button>
                      </>
                    )}
                    {isCreator && <div className="mx-3 my-1 border-t border-white/5" />}
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

        {/* Add Song — YouTube Search */}
        {canAddSongs ? (
          <div className="animate-fade-in-up-1 relative z-10 mb-8 rounded-3xl border border-white/5 bg-white/[0.02] p-6" ref={searchRef}>
            <h2 className="mb-4 text-lg font-semibold text-[var(--text-light)]">
              Add a Song
            </h2>
            {/* Search Input */}
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                {searching ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
                ) : (
                  <svg className="h-5 w-5 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )}
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search YouTube for a song..."
                className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-[var(--text-light)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(107,90,237,0.2)]"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(""); setSearchResults([]); }}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-[var(--text-muted)] hover:text-[var(--text-light)]"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mt-3 space-y-2">
                {searchResults.map((result) => (
                  <div
                    key={result.videoId}
                    className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-2.5 transition-all hover:border-[rgba(107,90,237,0.3)] hover:bg-white/[0.04]"
                  >
                    {/* Thumbnail */}
                    {result.thumbnail && (
                      <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg">
                        <Image
                          src={result.thumbnail}
                          alt={result.title}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    )}
                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--text-light)]" dangerouslySetInnerHTML={{ __html: result.title }} />
                      <p className="truncate text-xs text-[var(--text-muted)]">{result.channelTitle}</p>
                    </div>
                    {/* Add button */}
                    <button
                      onClick={() => handleSelectResult(result)}
                      disabled={addingVideoId === result.videoId}
                      className="shrink-0 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] px-4 py-1.5 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50"
                    >
                      {addingVideoId === result.videoId ? "..." : "Add"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* No results state */}
            {searchQuery && !searching && searchResults.length === 0 && (
              <p className="mt-3 text-center text-sm text-[var(--text-muted)]">
                No results found. Try a different search.
              </p>
            )}
          </div>
        ) : user && isListenOnly ? (
          <div className="animate-fade-in-up-1 mb-8 flex items-center gap-3 rounded-2xl border border-amber-500/10 bg-amber-500/5 px-5 py-4">
            <svg className="h-5 w-5 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p className="text-sm text-amber-200/80">
              This room is in <span className="font-semibold text-amber-400">listen-only</span> mode. Only the host can add songs. You can still upvote!
            </p>
          </div>
        ) : (
          <div className="animate-fade-in-up-1 mb-8 rounded-3xl border border-white/5 bg-white/[0.02] p-6 text-center">
            <p className="text-[var(--text-muted)]">
              <Link href="/login" className="text-[var(--primary)] hover:underline">Log in</Link>{" "}
              or{" "}
              <Link href="/register" className="text-[var(--primary)] hover:underline">sign up</Link>{" "}
              to add songs and vote
            </p>
          </div>
        )}

        {/* Song Queue */}
        <div className="animate-fade-in-up-2">
          <h2 className="mb-4 text-lg font-semibold text-[var(--text-light)]">Queue</h2>

          {songs.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 py-16 text-center text-[var(--text-muted)]">
              No songs yet. {canAddSongs ? "Search above to add one!" : user ? "Waiting for the host to add songs." : "Log in to add songs!"}
            </div>
          ) : (
            <div className="space-y-3">
              {songs.map((song, idx) => (
                <div
                  key={song.id}
                  className="group flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-3 transition-all duration-300 hover:border-[rgba(107,90,237,0.3)] hover:bg-white/[0.04] sm:gap-4 sm:p-4"
                >
                  {/* Position number */}
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center text-xs font-bold text-[var(--text-muted)]">
                    {idx + 1}
                  </div>

                  {/* Thumbnail */}
                  {song.thumbnail ? (
                    <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg sm:h-14 sm:w-24">
                      <Image
                        src={song.thumbnail}
                        alt={song.title}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--primary)]/20 to-[var(--accent-purple)]/20 sm:h-14 sm:w-24">
                      <svg className="h-6 w-6 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    </div>
                  )}

                  {/* Song Info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--text-light)] sm:text-base">
                      {song.title}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                      <span>by {song.user?.name || "unknown"}</span>
                      <a
                        href={song.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hidden text-[var(--primary)] hover:underline sm:inline"
                      >
                        YouTube
                      </a>
                    </div>
                  </div>

                  {/* Upvote Button */}
                  <button
                    onClick={() => handleUpvote(song.id)}
                    className={`flex shrink-0 flex-col items-center gap-0.5 rounded-xl border px-3 py-1.5 transition-all sm:px-4 sm:py-2 ${
                      song.hasVoted
                        ? "border-[var(--primary)] bg-[rgba(107,90,237,0.15)] shadow-[0_0_12px_rgba(107,90,237,0.2)]"
                        : "border-white/10 bg-white/5 hover:border-[rgba(107,90,237,0.4)] hover:bg-[rgba(107,90,237,0.1)]"
                    }`}
                  >
                    <svg
                      className={`h-4 w-4 sm:h-5 sm:w-5 transition-all ${
                        song.hasVoted ? "text-[var(--primary)] scale-110" : "text-[var(--text-muted)]"
                      }`}
                      fill={song.hasVoted ? "currentColor" : "none"}
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                    </svg>
                    <span className={`text-xs font-bold sm:text-sm ${
                      song.hasVoted ? "text-[var(--primary)]" : "text-[var(--text-light)]"
                    }`}>
                      {song.upvotes}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
