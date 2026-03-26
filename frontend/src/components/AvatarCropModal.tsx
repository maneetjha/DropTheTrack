"use client";

import { useCallback, useEffect, useState } from "react";
import Cropper from "react-easy-crop";
import type { Area, Point } from "react-easy-crop";
import { getCroppedImageBlob } from "@/lib/crop-image";
import { Minus, Plus, X } from "lucide-react";

type Props = {
  imageSrc: string;
  fileName: string;
  onCancel: () => void;
  onComplete: (file: File, previewObjectUrl: string) => void;
};

export default function AvatarCropModal({ imageSrc, fileName, onCancel, onComplete }: Props) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setErr(null);
  }, [imageSrc]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  async function apply() {
    if (!croppedAreaPixels) return;
    setBusy(true);
    setErr(null);
    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels);
      const base = fileName.replace(/\.[^.]+$/, "") || "avatar";
      const file = new File([blob], `${base}.jpg`, { type: "image/jpeg" });
      const previewUrl = URL.createObjectURL(blob);
      onComplete(file, previewUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not process image");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key === "Enter") {
        if (busy || !croppedAreaPixels) return;
        e.preventDefault();
        void apply();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, croppedAreaPixels, onCancel, imageSrc]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/45 p-4 pb-[calc(5.25rem+env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:pb-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="avatar-crop-title"
    >
      <div className="flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-[1.75rem] border border-black/10 bg-white/95 shadow-[0_24px_64px_rgba(17,24,39,0.25)]">
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-4">
          <h2 id="avatar-crop-title" className="text-lg font-extrabold text-ink">
            Adjust photo
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 bg-white/60 text-ink transition hover:bg-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative mx-4 mt-4 h-[min(52vh,380px)] overflow-hidden rounded-2xl bg-neutral-900">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={0}
            aspect={1}
            cropShape="round"
            showGrid={false}
            minZoom={1}
            maxZoom={3}
            zoomWithScroll
            restrictPosition
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            objectFit="contain"
            classes={{ containerClassName: "rounded-2xl" }}
          />
        </div>

        <div className="px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Zoom</span>
            <button
              type="button"
              aria-label="Zoom out"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-white/70 text-ink transition hover:bg-white"
              onClick={() => setZoom((z) => Math.max(1, Math.round((z - 0.1) * 100) / 100))}
            >
              <Minus className="h-4 w-4" />
            </button>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-black/10 accent-[rgb(244,108,82)]"
            />
            <button
              type="button"
              aria-label="Zoom in"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-white/70 text-ink transition hover:bg-white"
              onClick={() => setZoom((z) => Math.min(3, Math.round((z + 0.1) * 100) / 100))}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-ink-muted">Drag to reposition inside the circle</p>
        </div>

        {err && (
          <div className="mx-5 mb-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-600">
            {err}
          </div>
        )}

        <div className="flex gap-3 border-t border-black/5 px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-full border border-black/10 bg-white/60 py-3 text-sm font-semibold text-ink transition hover:bg-white"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!croppedAreaPixels || busy}
            onClick={() => void apply()}
            className="flex-1 rounded-full border border-black/10 bg-[linear-gradient(135deg,rgba(244,108,82,0.95),rgba(220,90,70,0.95))] py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(244,108,82,0.35)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Processing…" : "Use photo"}
          </button>
        </div>
      </div>
    </div>
  );
}
