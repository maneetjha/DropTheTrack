"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getRoom, getSongs, addSong, upvoteSong, Room, Song } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useAuth } from "@/lib/auth-context";
import Navbar from "@/components/Navbar";

interface RoomUser {
  socketId: string;
  name: string;
}

export default function RoomPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [users, setUsers] = useState<RoomUser[]>([]);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchSongs = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getSongs(id);
      setSongs(data);
    } catch (err) {
      console.error("Failed to load songs:", err);
    }
  }, [id]);

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

    const socket = getSocket();
    socket.connect();
    socket.emit("join-room", { roomId: id, userName: user?.name || "Anonymous" });

    socket.on("queue-updated", () => {
      getSongs(id).then(setSongs).catch(console.error);
    });

    socket.on("users-updated", (roomUsers: RoomUser[]) => {
      setUsers(roomUsers);
    });

    return () => {
      socket.emit("leave-room", id);
      socket.off("queue-updated");
      socket.off("users-updated");
      socket.disconnect();
    };
  }, [id, fetchSongs, user]);

  const handleAddSong = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !title.trim() || !id) return;

    setAdding(true);
    try {
      const song = await addSong(id, {
        title: title.trim(),
        url: url.trim(),
      });
      setSongs((prev) => [...prev, song].sort((a, b) => b.upvotes - a.upvotes));
      setUrl("");
      setTitle("");

      const socket = getSocket();
      socket.emit("song-added", { roomId: id, song });
    } catch (err) {
      console.error(err);
      alert("Failed to add song. Make sure you're logged in.");
    } finally {
      setAdding(false);
    }
  };

  const handleUpvote = async (songId: string) => {
    if (!user) {
      alert("Please log in to vote!");
      return;
    }

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
      if (err instanceof Error && err.message === "Already voted") {
        alert("You already voted for this song!");
      } else if (err instanceof Error && err.message === "Login required") {
        alert("Please log in to vote!");
      } else {
        console.error(err);
      }
    }
  };

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
        <div className="animate-fade-in-up mb-8">
          <Link
            href="/"
            className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--text-muted)] transition hover:text-[var(--primary)]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            All rooms
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl text-[var(--text-light)]">{room.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className="text-sm text-[var(--text-muted)]">
                  {songs.length} song{songs.length !== 1 ? "s" : ""} in queue
                </span>
                <span className="text-white/10">|</span>
                <span className="flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                  {users.length} online
                </span>
              </div>
            </div>
            {/* Share code */}
            <button
              onClick={() => {
                navigator.clipboard.writeText(room.code);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 transition-all hover:border-[var(--primary)]/40 hover:bg-[rgba(107,90,237,0.1)]"
            >
              <span className="font-mono text-sm font-bold tracking-widest text-[var(--primary)]">
                {room.code}
              </span>
              <svg className="h-4 w-4 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {copied ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                )}
              </svg>
              <span className="text-xs text-[var(--text-muted)]">
                {copied ? "Copied!" : "Copy"}
              </span>
            </button>
          </div>
        </div>

        {/* Add Song Form */}
        {user ? (
          <form
            onSubmit={handleAddSong}
            className="animate-fade-in-up-1 mb-8 rounded-3xl border border-white/5 bg-white/[0.02] p-6"
          >
            <h2 className="mb-4 text-lg font-semibold text-[var(--text-light)]">
              Add a Song
            </h2>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Song title"
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[var(--text-light)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(107,90,237,0.2)]"
              />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="YouTube URL"
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[var(--text-light)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(107,90,237,0.2)]"
              />
              <button
                type="submit"
                disabled={adding || !title.trim() || !url.trim()}
                className="btn-ripple rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] px-6 py-3 font-semibold text-white transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {adding ? "Adding..." : "Add"}
              </button>
            </div>
          </form>
        ) : (
          <div className="animate-fade-in-up-1 mb-8 rounded-3xl border border-white/5 bg-white/[0.02] p-6 text-center">
            <p className="text-[var(--text-muted)]">
              <Link href="/login" className="text-[var(--primary)] hover:underline">
                Log in
              </Link>{" "}
              or{" "}
              <Link href="/register" className="text-[var(--primary)] hover:underline">
                sign up
              </Link>{" "}
              to add songs and vote
            </p>
          </div>
        )}

        {/* Song Queue */}
        <div className="animate-fade-in-up-2">
          <h2 className="mb-4 text-lg font-semibold text-[var(--text-light)]">Queue</h2>

          {songs.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 py-16 text-center text-[var(--text-muted)]">
              No songs yet. {user ? "Add one above!" : "Log in to add songs!"}
            </div>
          ) : (
            <div className="space-y-3">
              {songs.map((song, idx) => (
                <div
                  key={song.id}
                  className="group flex items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.02] p-4 transition-all duration-300 hover:border-[rgba(107,90,237,0.3)] hover:bg-white/[0.04]"
                >
                  {/* Position */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--primary)]/20 to-[var(--accent-purple)]/20 text-sm font-bold text-[var(--text-muted)]">
                    {idx + 1}
                  </div>

                  {/* Song Info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[var(--text-light)]">
                      {song.title}
                    </p>
                    <a
                      href={song.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-sm text-[var(--primary)] hover:underline"
                    >
                      {song.url}
                    </a>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      by {song.user?.name || "unknown"}
                    </p>
                  </div>

                  {/* Upvote Button */}
                  <button
                    onClick={() => handleUpvote(song.id)}
                    className="flex shrink-0 flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 transition-all hover:border-[rgba(107,90,237,0.4)] hover:bg-[rgba(107,90,237,0.1)]"
                  >
                    <svg
                      className="h-5 w-5 text-[var(--primary)]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 15l7-7 7 7"
                      />
                    </svg>
                    <span className="text-sm font-bold text-[var(--text-light)]">
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
