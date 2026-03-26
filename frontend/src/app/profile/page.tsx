"use client";

import AppShell from "@/components/AppShell";
import AvatarCropModal from "@/components/AvatarCropModal";
import { useAuth } from "@/lib/auth-context";
import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Pencil, X } from "lucide-react";
import { resolveAssetUrl, updateMe, uploadAvatar } from "@/lib/api";

function revokeIfBlob(url: string | null) {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
}

export default function ProfilePage() {
  const { user, loading, refreshUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user?.name || "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [cropSession, setCropSession] = useState<{ src: string; fileName: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  const initials = useMemo(() => {
    const n = (name || user?.name || "U").trim();
    return n ? n.charAt(0).toUpperCase() : "U";
  }, [name, user?.name]);

  if (loading) return null;

  const joined = user?.createdAt
    ? new Date(user.createdAt).toLocaleString(undefined, { month: "short", year: "2-digit" }).replace(" ", " '")
    : null;

  const closeCrop = () => {
    setCropSession((prev) => {
      if (prev) URL.revokeObjectURL(prev.src);
      return null;
    });
  };

  return (
    <AppShell>
      {cropSession ? (
        <AvatarCropModal
          imageSrc={cropSession.src}
          fileName={cropSession.fileName}
          onCancel={closeCrop}
          onComplete={(file, previewUrl) => {
            setCropSession((prev) => {
              if (prev) URL.revokeObjectURL(prev.src);
              return null;
            });
            setAvatarPreview((prev) => {
              revokeIfBlob(prev);
              return previewUrl;
            });
            setAvatarFile(file);
            setLocalErr(null);
          }}
        />
      ) : null}

      <div className="mx-auto w-full max-w-5xl px-1 sm:px-0">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-bold tracking-tight text-ink md:text-5xl">Profile</h1>
            <p className="mt-2 text-base text-ink-muted md:text-lg">Update your name and photo.</p>
          </div>
        </div>

        {localErr && (
          <div className="mt-8 rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-base text-red-600">
            {localErr}
          </div>
        )}

        <div className="mt-10">
          <div className="rounded-[2rem] border border-black/10 bg-white/40 p-8 shadow-[0_18px_44px_rgba(17,24,39,0.08)] md:p-10 lg:p-12">
            <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:gap-10">
              {/* Avatar only (no strip) */}
              <div className="relative shrink-0">
                <div className="rounded-[1.75rem] bg-[conic-gradient(from_180deg_at_50%_50%,rgba(244,108,82,0.85),rgba(140,198,232,0.85),rgba(244,108,82,0.85))] p-[3px] shadow-[0_18px_44px_rgba(17,24,39,0.14)]">
                  <div className="relative h-32 w-32 overflow-hidden rounded-[1.6rem] bg-white/60 ring-1 ring-black/10 md:h-36 md:w-36">
                    {avatarPreview ? (
                      <Image src={avatarPreview} alt="Profile photo preview" fill className="object-cover" />
                    ) : user?.avatarUrl ? (
                      <img src={resolveAssetUrl(user.avatarUrl) || ""} alt="Profile photo" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_25%_20%,rgba(244,108,82,0.16)_0%,transparent_55%),radial-gradient(circle_at_75%_80%,rgba(140,198,232,0.14)_0%,transparent_55%)]">
                        <span className="text-4xl font-extrabold text-ink md:text-5xl">{initials}</span>
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-0 rounded-[1.6rem] ring-1 ring-white/60" aria-hidden />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="absolute -bottom-1 -right-1 flex h-12 w-12 items-center justify-center rounded-2xl border border-black/10 bg-white/70 text-ink shadow-[0_12px_30px_rgba(17,24,39,0.12)] transition hover:bg-white md:h-[3.25rem] md:w-[3.25rem]"
                  aria-label="Edit profile photo"
                >
                  <Pencil className="h-5 w-5" />
                </button>

                {avatarPreview && (
                  <button
                    type="button"
                    onClick={() => {
                      revokeIfBlob(avatarPreview);
                      setAvatarPreview(null);
                      setAvatarFile(null);
                    }}
                    className="absolute -top-1 -right-1 flex h-11 w-11 items-center justify-center rounded-2xl border border-black/10 bg-white/70 text-ink-muted shadow-[0_12px_30px_rgba(17,24,39,0.10)] transition hover:bg-white hover:text-ink"
                    aria-label="Remove photo"
                    title="Remove photo"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>

              <div className="min-w-0 flex-1 pt-0 sm:pt-1">
                <p className="truncate text-2xl font-extrabold tracking-tight text-ink md:text-3xl">{user?.name || "—"}</p>
                <p className="mt-2 truncate text-base text-ink-muted md:text-lg">{user?.email || ""}</p>
                {joined ? <p className="mt-3 text-sm text-ink-muted md:text-base">Joined {joined}</p> : null}
              </div>
            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-2 sm:gap-8">
              <div>
                <label className="mb-2.5 block text-sm font-semibold uppercase tracking-wider text-ink-muted md:text-[0.8125rem]">Name</label>
                <input
                  value={name}
                  onChange={(e) => { setName(e.target.value); setLocalErr(null); }}
                  className="h-14 w-full rounded-2xl border border-white/50 bg-white/45 px-5 text-base text-ink outline-none transition focus:border-[rgba(244,108,82,0.60)] focus:ring-4 focus:ring-[rgba(244,108,82,0.14)] md:h-[3.75rem] md:text-lg"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="mb-2.5 block text-sm font-semibold uppercase tracking-wider text-ink-muted md:text-[0.8125rem]">Email</label>
                <input
                  value={user?.email || ""}
                  readOnly
                  className="h-14 w-full cursor-not-allowed rounded-2xl border border-white/50 bg-white/35 px-5 text-base text-ink-muted outline-none md:h-[3.75rem] md:text-lg"
                />
              </div>
            </div>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
              <button
                type="button"
                disabled={saving}
                onClick={async () => {
                  try {
                    setSaving(true);
                    setLocalErr(null);
                    if (avatarFile) await uploadAvatar(avatarFile);
                    await updateMe({ name });
                    await refreshUser();
                    revokeIfBlob(avatarPreview);
                    setAvatarFile(null);
                    setAvatarPreview(null);
                  } catch (e) {
                    setLocalErr(e instanceof Error ? e.message : "Failed to save profile");
                  } finally {
                    setSaving(false);
                  }
                }}
                className="inline-flex w-full items-center justify-center rounded-full border border-black/10 bg-white/55 px-8 py-3.5 text-base font-semibold text-ink transition hover:bg-white/70 sm:w-auto sm:min-w-[11rem] md:py-4 md:text-lg"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                if (f.size > 5 * 1024 * 1024) {
                  setLocalErr("Image too large. Please choose a file under 5MB.");
                  return;
                }
                setLocalErr(null);
                const url = URL.createObjectURL(f);
                setCropSession({ src: url, fileName: f.name });
              }}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

