export type PixelCrop = { x: number; y: number; width: number; height: number };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", () => reject(new Error("Failed to load image")));
    img.src = src;
  });
}

/** Renders the cropped region to a canvas and returns a JPEG blob (max edge 1024px). */
export async function getCroppedImageBlob(
  imageSrc: string,
  pixelCrop: PixelCrop,
  quality = 0.92
): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  const x = Math.round(pixelCrop.x);
  const y = Math.round(pixelCrop.y);
  const safeW = Math.max(1, Math.round(pixelCrop.width));
  const safeH = Math.max(1, Math.round(pixelCrop.height));

  let outW = safeW;
  let outH = safeH;
  const maxDim = 1024;
  if (outW > maxDim || outH > maxDim) {
    const scale = maxDim / Math.max(outW, outH);
    outW = Math.round(outW * scale);
    outH = Math.round(outH * scale);
  }

  canvas.width = outW;
  canvas.height = outH;

  ctx.drawImage(image, x, y, safeW, safeH, 0, 0, outW, outH);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("Export failed"));
        else resolve(blob);
      },
      "image/jpeg",
      quality
    );
  });
}
