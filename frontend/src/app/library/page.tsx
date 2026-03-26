"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { createPlaylist, deletePlaylist, getPlaylists, importYouTubePlaylist, type Playlist } from "@/lib/api";
import PlaylistCoverGrid from "@/components/PlaylistCoverGrid";
import { FolderPlus, Import, Trash2, X, AlertTriangle } from "lucide-react";

export default function LibraryPage() {
  const { user, loading: authLoading } = useAuth();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [modal, setModal] = useState<null | { kind: "create" } | { kind: "import" } | { kind: "delete"; playlistId: string; name: string }>(null);
  const [field, setField] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getPlaylists()
      .then((p) => { setPlaylists(p); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [authLoading, user]);

  const refresh = async () => {
    if (!user) return;
    const p = await getPlaylists();
    setPlaylists(p);
  };

  const doCreate = async (name: string) => {
    setCreating(true);
    try {
      await createPlaylist(name);
      await refresh();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create playlist");
    } finally {
      setCreating(false);
    }
  };

  const doImport = async (url: string) => {
    setImporting(true);
    try {
      await importYouTubePlaylist(url);
      await refresh();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to import playlist");
    } finally {
      setImporting(false);
    }
  };

  const doDelete = async (id: string) => {
    try {
      await deletePlaylist(id);
      setPlaylists((p) => p.filter((x) => x.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl pb-8">
        <div className="pt-2 pb-6">
          <h1 className="text-[32px] font-bold leading-tight tracking-tight text-ink md:text-[40px]">Playlists</h1>
          <p className="mt-2 max-w-2xl text-base text-ink-muted">Create folders, import YouTube playlists, and drop tracks into rooms.</p>
        </div>

        {!user && !authLoading ? (
          <div className="mt-4 rounded-2xl border border-black/10 bg-white/40 p-6 text-center shadow-[0_18px_44px_rgba(17,24,39,0.08)]">
            <p className="text-sm text-ink-muted">Log in to save and view your library.</p>
            <div className="mt-4 flex justify-center gap-3">
              <Link href="/login" className="duotone-cta rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-105">Log in</Link>
              <Link
                href="/register"
                className="rounded-xl border border-black/10 bg-white/50 px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-black/15 hover:bg-white/70"
              >
                Sign up
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => { setField(""); setModal({ kind: "create" }); }}
                disabled={creating}
                className="duotone-cta inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50"
              >
                <FolderPlus className="h-4 w-4" />
                {creating ? "Creating…" : "Create playlist"}
              </button>
              <button
                type="button"
                onClick={() => { setField(""); setModal({ kind: "import" }); }}
                disabled={importing}
                className="inline-flex items-center gap-2 rounded-xl border border-black/12 bg-white/50 px-4 py-2.5 text-sm font-semibold text-ink shadow-[0_8px_24px_rgba(17,24,39,0.06)] transition hover:border-[#f46c52]/35 hover:bg-white/70 disabled:opacity-50"
              >
                <Import className="h-4 w-4 text-[#d84b36]" />
                {importing ? "Importing…" : "Import YouTube playlist"}
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {loading ? (
              <div className="mt-12 flex justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#f46c52] border-t-transparent" />
              </div>
            ) : playlists.length === 0 ? (
              <div className="mt-10 rounded-2xl border border-dashed border-black/15 bg-white/35 p-10 text-center">
                <p className="text-sm text-ink-muted">No playlists yet.</p>
                <p className="mt-1 text-xs text-ink-muted/80">Create one or import a YouTube playlist link.</p>
              </div>
            ) : (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {playlists.map((p) => (
                  <div
                    key={p.id}
                    className="group flex items-center gap-4 rounded-2xl border border-black/10 bg-white/50 p-3.5 pr-3 shadow-[0_18px_44px_rgba(17,24,39,0.07)] backdrop-blur-md transition hover:border-black/14 hover:bg-white/70 hover:shadow-[0_22px_50px_rgba(17,24,39,0.12)]"
                  >
                    <Link
                      href={`/library/${p.id}`}
                      className="shrink-0 transition group-hover:scale-[1.02] active:scale-[0.99]"
                    >
                      <PlaylistCoverGrid
                        thumbnails={p.coverThumbnails ?? []}
                        itemCount={p.itemCount}
                        name={p.name}
                        className="h-[4.75rem] w-[4.75rem] sm:h-[5.25rem] sm:w-[5.25rem]"
                      />
                    </Link>
                    <div className="min-w-0 flex-1 py-0.5">
                      <Link href={`/library/${p.id}`} className="block">
                        <p className="truncate text-[15px] font-extrabold tracking-tight text-ink">{p.name}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-muted">
                          <span className="font-semibold text-ink/65">Playlist</span>
                          {user?.name ? ` · ${user.name}` : ""}
                          <span className="tabular-nums">
                            {" "}
                            · {p.itemCount} {p.itemCount === 1 ? "track" : "tracks"}
                          </span>
                        </p>
                        <p className="mt-1 text-xs font-semibold text-[rgba(17,24,39,0.68)]">
                          Updated {new Date(p.updatedAt).toLocaleDateString()}
                        </p>
                      </Link>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setModal({ kind: "delete", playlistId: p.id, name: p.name }); }}
                      className="flex h-10 w-10 shrink-0 items-center justify-center self-center rounded-full border border-black/10 bg-white/60 text-ink-muted shadow-sm transition hover:border-red-400/45 hover:bg-red-500/10 hover:text-red-600"
                      title="Delete playlist"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Native modal (no browser prompt/confirm) */}
      {modal && (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center px-2 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] sm:items-center sm:p-4 sm:pb-4"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setModal(null)}
            aria-label="Close"
          />
          <div className="relative z-10 flex max-h-[82dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-black/10 bg-white/90 shadow-[0_24px_64px_rgba(17,24,39,0.18)] backdrop-blur-xl sm:max-h-[min(88vh,720px)] sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-black/8 px-5 py-4">
              <h2 className="text-base font-bold tracking-tight text-ink">
                {modal.kind === "create" ? "Create playlist" : modal.kind === "import" ? "Import YouTube playlist" : "Delete playlist"}
              </h2>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-muted transition hover:bg-black/[0.05] hover:text-ink"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-6">
              {modal.kind === "delete" ? (
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/12 text-red-600">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink">Delete “{modal.name}”?</p>
                    <p className="mt-1 text-xs text-ink-muted">This removes the playlist and all its tracks. This cannot be undone.</p>
                  </div>
                </div>
              ) : (
                <>
                  <label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-ink-muted">
                    {modal.kind === "create" ? "Playlist name" : "Public/Unlisted YouTube playlist link"}
                  </label>
                  <input
                    value={field}
                    onChange={(e) => setField(e.target.value)}
                    className="h-12 w-full rounded-2xl border border-black/10 bg-white/70 px-4 text-sm text-ink outline-none transition placeholder:text-ink-muted/60 focus:border-[rgba(244,108,82,0.55)] focus:ring-4 focus:ring-[rgba(244,108,82,0.12)]"
                    autoFocus
                  />
                  {modal.kind === "create" ? (
                    <p className="mt-4 text-xs text-ink-muted">
                      Examples: <span className="font-medium text-ink/80">Gym</span>,{" "}
                      <span className="font-medium text-ink/80">Chill</span>,{" "}
                      <span className="font-medium text-ink/80">Road Trip</span>
                    </p>
                  ) : null}
                </>
              )}

              <div className="mt-8 flex gap-4">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="flex-1 rounded-2xl border border-black/10 bg-white/60 py-3.5 text-sm font-semibold text-ink transition hover:bg-white/80"
                >
                  Cancel
                </button>
                {modal.kind === "delete" ? (
                  <button
                    type="button"
                    onClick={() => { void doDelete(modal.playlistId); setModal(null); }}
                    className="flex-1 rounded-2xl bg-[var(--danger)] py-3.5 text-sm font-semibold text-white transition hover:brightness-110"
                  >
                    Delete
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={(modal.kind === "create" ? creating : importing) || !field.trim()}
                    onClick={() => {
                      const v = field.trim();
                      if (!v) return;
                      if (modal.kind === "create") void doCreate(v);
                      else void doImport(v);
                      setModal(null);
                    }}
                    className="duotone-cta flex-1 rounded-2xl py-3.5 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50"
                  >
                    {modal.kind === "create" ? (creating ? "Creating…" : "Create") : (importing ? "Importing…" : "Import")}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

