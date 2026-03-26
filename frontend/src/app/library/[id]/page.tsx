"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { addPlaylistItem, addSong, getPlaylistItems, resolveYouTube, searchYouTube, removePlaylistItem, type PlaylistItem, type YouTubeResult } from "@/lib/api";
import { extractYouTubeVideoId } from "@/lib/youtube";
import TrackDetailSheet from "@/components/TrackDetailSheet";
import { ChevronLeft, ChevronRight, ExternalLink, Music, Plus, Search, Trash2, X } from "lucide-react";

export default function PlaylistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [name, setName] = useState<string>("");
  const [items, setItems] = useState<PlaylistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [droppingId, setDroppingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<YouTubeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingVideoId, setAddingVideoId] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const [trackSheet, setTrackSheet] = useState<null | { kind: "search"; r: YouTubeResult }>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const qs = new URLSearchParams(window.location.search);
    setRoomId(qs.get("roomId"));
  }, []);

  const refresh = async () => {
    if (!id) return;
    const data = await getPlaylistItems(id);
    setName(data.playlist.name);
    setItems(data.items);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    refresh()
      .then(() => setError(null))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, id]);

  const onRemove = async (itemId: string) => {
    const prev = items;
    setItems((p) => p.filter((x) => x.id !== itemId));
    try {
      await removePlaylistItem(id, itemId);
    } catch (e) {
      setItems(prev);
      setError(e instanceof Error ? e.message : "Failed to remove");
    }
  };

  const onDrop = async (it: PlaylistItem) => {
    if (!roomId) return;
    setDroppingId(it.id);
    try {
      await addSong(roomId, { title: it.title, url: it.url, thumbnail: it.thumbnail || undefined });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add to room");
    } finally {
      setDroppingId(null);
    }
  };

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
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const addFromYouTube = async (r: YouTubeResult) => {
    setAddingVideoId(r.videoId);
    try {
      const url = `https://www.youtube.com/watch?v=${r.videoId}`;
      await addPlaylistItem(id, { title: r.title, url, thumbnail: r.thumbnail || null });
      await refresh();
      setSearchQuery("");
      setSearchResults([]);
      setTrackSheet(null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add");
    } finally {
      setAddingVideoId(null);
    }
  };

  useEffect(() => {
    function h(e: MouseEvent) {
      const el = e.target;
      if (el instanceof Element && el.closest('[role="dialog"]')) return;
      if (searchResults.length > 0 && searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchResults([]);
      }
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [searchResults.length]);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl pb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between pt-2 pb-6">
          <div>
            <h1 className="text-[32px] font-bold leading-tight tracking-tight text-ink md:text-[40px]">{name || "Playlist"}</h1>
            <p className="mt-2 text-base text-ink-muted">
              {items.length} track{items.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Link
            href={roomId ? `/room/${roomId}` : "/library"}
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/45 px-4 py-2 text-sm font-semibold text-ink transition hover:border-black/15 hover:bg-white/60"
          >
            <ChevronLeft className="h-4 w-4" />
            {roomId ? "Back to room" : "Back"}
          </Link>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!user && !authLoading ? (
          <div className="mt-4 rounded-2xl border border-black/10 bg-white/40 p-6 text-center shadow-[0_18px_44px_rgba(17,24,39,0.08)]">
            <p className="text-sm text-ink-muted">Log in to view playlists.</p>
            <div className="mt-4 flex justify-center gap-3">
              <Link href="/login" className="duotone-cta rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-105">
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-xl border border-black/10 bg-white/50 px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-black/15 hover:bg-white/70"
              >
                Sign up
              </Link>
            </div>
          </div>
        ) : loading ? (
          <div className="mt-12 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent" />
          </div>
        ) : (
          <>
            {/* YouTube search to add songs to this playlist */}
            <div className="mt-6" ref={searchRef}>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                  {searching ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent" />
                  ) : (
                    <Search className="h-4 w-4 text-ink-muted" strokeWidth={2.25} />
                  )}
                </div>
                <input
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); if (!e.target.value.trim()) setSearchResults([]); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void executeSearch(); } }}
                  enterKeyHint="search"
                  className="h-[3.25rem] w-full rounded-full border border-black/12 bg-white/75 pl-11 pr-11 text-sm text-ink shadow-[0_6px_24px_rgba(17,24,39,0.06)] outline-none transition placeholder:text-ink-muted/55 focus:border-[#f46c52]/55 focus:bg-white/90 focus:shadow-[0_8px_28px_rgba(244,108,82,0.12)] focus:ring-4 focus:ring-[#f46c52]/12"
                  placeholder="Search YouTube or paste a YouTube URL"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(""); setSearchResults([]); }}
                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-ink-muted transition hover:text-ink"
                    aria-label="Clear"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {searchResults.length > 0 && (
                <div className="mt-3 max-h-[min(70vh,22rem)] space-y-1 overflow-y-auto overscroll-y-contain rounded-2xl border border-black/10 bg-white/85 p-2 shadow-[0_16px_48px_rgba(17,24,39,0.1)] backdrop-blur-md">
                  {searchResults.map((r) => (
                    <div key={r.videoId} className="flex items-stretch gap-2 rounded-xl p-1.5 transition hover:bg-[#f46c52]/[0.06]">
                      <button
                        type="button"
                        onClick={() => setTrackSheet({ kind: "search", r })}
                        className="flex min-w-0 flex-1 gap-3 rounded-xl p-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#8cc6e8] focus-visible:ring-offset-2"
                      >
                        <div className="relative h-[4.5rem] w-[7.5rem] shrink-0 overflow-hidden rounded-lg bg-black/5 ring-1 ring-black/8">
                          {r.thumbnail ? (
                            <Image src={r.thumbnail} alt={r.title} fill className="object-cover" unoptimized sizes="120px" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Music className="h-6 w-6 text-ink-muted" />
                            </div>
                          )}
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col justify-center py-0.5">
                          <p className="line-clamp-3 text-[13px] font-semibold leading-snug text-ink">{r.title}</p>
                          <p className="mt-1 line-clamp-2 text-[11px] text-ink-muted">
                            {r.channelTitle || "YouTube"}
                            {r.duration ? ` · ${r.duration}` : ""}
                          </p>
                          <span className="mt-1.5 inline-flex items-center gap-0.5 text-[11px] font-bold tracking-wide text-[#d84b36]">
                            Details <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
                          </span>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); void addFromYouTube(r); }}
                        disabled={addingVideoId === r.videoId}
                        className="duotone-cta flex min-h-[2.75rem] shrink-0 items-center justify-center self-center rounded-full px-5 text-xs font-bold text-white transition hover:brightness-105 active:scale-[0.97] disabled:opacity-50"
                      >
                        {addingVideoId === r.videoId ? "…" : "Add"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {items.length === 0 ? (
              <div className="mt-10 rounded-2xl border border-dashed border-black/20 bg-white/45 p-10 text-center shadow-[0_12px_40px_rgba(17,24,39,0.06)]">
                <p className="text-sm font-semibold text-[rgba(17,24,39,0.78)]">No tracks in this playlist yet.</p>
                <p className="mt-2 text-sm leading-relaxed text-[rgba(17,24,39,0.62)]">
                  Add songs with the search bar above, or from a room: open your library in that room and use <span className="font-semibold text-[rgba(17,24,39,0.72)]">Add</span> on each track.
                </p>
              </div>
            ) : (
            <div className="mt-6 space-y-2">
              {items.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white/50 p-4 shadow-[0_14px_40px_rgba(17,24,39,0.06)] backdrop-blur-md transition hover:border-black/14 hover:bg-white/65"
                >
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-black/5 ring-1 ring-black/[0.08]">
                    {it.thumbnail ? (
                      <Image src={it.thumbnail} alt="" fill className="object-cover" unoptimized sizes="48px" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#f46c52]/10 to-[#8cc6e8]/15">
                        <Music className="h-5 w-5 text-ink-muted" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-bold text-ink">{it.title}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {roomId ? (
                      <button
                        type="button"
                        onClick={() => { void onDrop(it); }}
                        disabled={droppingId === it.id}
                        className="duotone-cta flex h-9 items-center justify-center gap-1.5 rounded-full px-4 text-[12px] font-bold text-white transition hover:brightness-105 active:scale-[0.98] disabled:opacity-50"
                        title="Add to this room"
                      >
                        <Plus className="h-4 w-4" />
                        Add
                      </button>
                    ) : null}
                    <a
                      href={it.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-white/55 text-ink transition hover:border-[var(--brand)]/35 hover:bg-white/80"
                      title="Open"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() => { void onRemove(it.id); }}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-white/55 text-ink-muted transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-600"
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            )}

            <TrackDetailSheet
              open={!!trackSheet}
              onClose={() => setTrackSheet(null)}
              track={
                trackSheet?.kind === "search"
                  ? {
                      title: trackSheet.r.title,
                      url: `https://www.youtube.com/watch?v=${trackSheet.r.videoId}`,
                      thumbnail: trackSheet.r.thumbnail,
                      subtitle: [trackSheet.r.channelTitle, trackSheet.r.duration].filter(Boolean).join(" · "),
                    }
                  : null
              }
              primaryAction={
                trackSheet?.kind === "search"
                  ? {
                      label: addingVideoId === trackSheet.r.videoId ? "Adding…" : "Add to playlist",
                      onClick: () => { void addFromYouTube(trackSheet.r); },
                      disabled: addingVideoId === trackSheet.r.videoId,
                    }
                  : undefined
              }
            />
          </>
        )}
      </div>
    </AppShell>
  );
}

