import { SPRITE_CONFIG } from './config';

/**
 * Removes ONLY the outer white background connected to the frame perimeter (plus any explicit
 * enclosed background gap seeds such as Frame 6's arm-crown gap) via 4-connected flood-fill,
 * preserving interior white regions (Songi's eyes/forehead above mask and white hands).
 * Also de-fringes the 1-2px anti-aliased exterior border against dark navy outlines so no
 * white halo appears on night backgrounds.
 */
export function removeOuterWhiteFromCellRgba(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  extraSeeds: ReadonlyArray<{ x: number; y: number }> = []
): void {
  const total = width * height;
  const visited = new Uint8Array(total);
  const exteriorBg = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const isBgWhite = (idx: number): boolean => {
    const p = idx * 4;
    const a = rgba[p + 3];
    if (a < 16) return true;
    const r = rgba[p];
    const g = rgba[p + 1];
    const b = rgba[p + 2];
    const minC = Math.min(r, g, b);
    const maxC = Math.max(r, g, b);
    // Pure/near-white background pixels with low saturation
    return minC >= 224 && maxC - minC <= 26;
  };

  const enqueueIfBg = (x: number, y: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    visited[idx] = 1;
    if (isBgWhite(idx)) {
      exteriorBg[idx] = 1;
      queue[tail++] = idx;
    }
  };

  // Seed flood-fill from all 4 borders of the cell
  for (let x = 0; x < width; x++) {
    enqueueIfBg(x, 0);
    enqueueIfBg(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    enqueueIfBg(0, y);
    enqueueIfBg(width - 1, y);
  }

  // Seed any known enclosed white background pocket (e.g. Frame 6 gap between crown & raised arm)
  for (let i = 0; i < extraSeeds.length; i++) {
    const seed = extraSeeds[i];
    enqueueIfBg(Math.round(seed.x), Math.round(seed.y));
  }

  // 4-connected BFS flood fill
  while (head < tail) {
    const cur = queue[head++];
    const cx = cur % width;
    const cy = (cur - cx) / width;

    if (cx > 0) enqueueIfBg(cx - 1, cy);
    if (cx < width - 1) enqueueIfBg(cx + 1, cy);
    if (cy > 0) enqueueIfBg(cx, cy - 1);
    if (cy < height - 1) enqueueIfBg(cx, cy + 1);
  }

  // Zero alpha for all exterior background pixels
  for (let i = 0; i < total; i++) {
    if (exteriorBg[i]) {
      rgba[i * 4 + 3] = 0;
    }
  }

  // Clean 1-2px anti-aliased light fringe directly bordering exteriorBg
  // Chubby Ninja Songi's silhouette outline is deep navy (~10, 26, 72).
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (exteriorBg[idx]) continue;
        const p = idx * 4;
        if (rgba[p + 3] === 0) continue;

        let touchesTransparent = false;
        for (let dy = -1; dy <= 1 && !touchesTransparent; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
              touchesTransparent = true;
              break;
            }
            if (rgba[(ny * width + nx) * 4 + 3] < 32) {
              touchesTransparent = true;
              break;
            }
          }
        }

        if (!touchesTransparent) continue;

        const r = rgba[p];
        const g = rgba[p + 1];
        const b = rgba[p + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (lum > 135) {
          const alphaNorm = Math.max(0, Math.min(1, (242 - lum) / 115));
          const nextAlpha = Math.round(alphaNorm * 255);
          rgba[p] = Math.min(r, 20);
          rgba[p + 1] = Math.min(g, 44);
          rgba[p + 2] = Math.min(b, 108);
          rgba[p + 3] = Math.min(rgba[p + 3], nextAlpha);
        }
      }
    }
  }
}

/**
 * Builds a clean, transparent, frame-aligned 4x2 sprite sheet canvas from the chubby Ninja Songi image.
 * Places each 384x512 raw cell onto a generous 432x528 output cell so headband ribbons, scarf tails,
 * and outstretched hands never clip, and normalizes horizontal face/torso center + foot baseline across
 * all 8 frames so running, jumping, wire-hanging, and sitting have zero frame-swap jitter.
 */
export function buildNormalizedSongiSheet(sourceImage: HTMLImageElement | HTMLCanvasElement): {
  canvas: HTMLCanvasElement;
  frameWidth: number;
  frameHeight: number;
} {
  const srcW = sourceImage.width;
  const srcH = sourceImage.height;
  const srcCellW = Math.floor(srcW / SPRITE_CONFIG.cols);
  const srcCellH = Math.floor(srcH / SPRITE_CONFIG.rows);

  const scaleX = srcCellW / 384;
  const scaleY = srcCellH / 512;
  const outCellW = Math.round(SPRITE_CONFIG.normCellWidth * scaleX);
  const outCellH = Math.round(SPRITE_CONFIG.normCellHeight * scaleY);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = outCellW * SPRITE_CONFIG.cols;
  outCanvas.height = outCellH * SPRITE_CONFIG.rows;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) {
    throw new Error('Failed to create 2D context for Songi sprite sheet');
  }

  const workCanvas = document.createElement('canvas');
  workCanvas.width = srcCellW;
  workCanvas.height = srcCellH;
  const workCtx = workCanvas.getContext('2d', { willReadFrequently: true });
  if (!workCtx) {
    throw new Error('Failed to create work 2D context for Songi frame');
  }

  for (let row = 0; row < SPRITE_CONFIG.rows; row++) {
    for (let col = 0; col < SPRITE_CONFIG.cols; col++) {
      const frameIndex = row * SPRITE_CONFIG.cols + col;
      workCtx.clearRect(0, 0, srcCellW, srcCellH);
      workCtx.drawImage(
        sourceImage,
        col * srcCellW,
        row * srcCellH,
        srcCellW,
        srcCellH,
        0,
        0,
        srcCellW,
        srcCellH
      );

      const rawSeeds = SPRITE_CONFIG.extraBgSeeds[frameIndex] ?? [];
      const scaledSeeds = rawSeeds.map((pt) => ({
        x: pt.x * scaleX,
        y: pt.y * scaleY,
      }));

      const imgData = workCtx.getImageData(0, 0, srcCellW, srcCellH);
      removeOuterWhiteFromCellRgba(imgData.data, srcCellW, srcCellH, scaledSeeds);
      workCtx.putImageData(imgData, 0, 0);

      const rawFaceX = SPRITE_CONFIG.rawFaceCentersX[frameIndex] ?? 225;
      const shiftX = Math.round((SPRITE_CONFIG.targetFaceCenterX - rawFaceX) * scaleX);
      const shiftY = Math.round((SPRITE_CONFIG.normShiftY[frameIndex] ?? 18) * scaleY);

      const destX = col * outCellW;
      const destY = row * outCellH;
      outCtx.save();
      outCtx.beginPath();
      outCtx.rect(destX, destY, outCellW, outCellH);
      outCtx.clip();
      outCtx.drawImage(workCanvas, destX + shiftX, destY + shiftY);
      outCtx.restore();
    }
  }

  return {
    canvas: outCanvas,
    frameWidth: outCellW,
    frameHeight: outCellH,
  };
}

/**
 * Scans non-transparent pixel bounds in RGBA data so outer transparent padding in an icon PNG
 * can be cropped tightly before scaling to gameplay size.
 */
export function findContentBoundsRgba(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  alphaThreshold = 20
): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = rgba[(y * width + x) * 4 + 3];
      if (a >= alphaThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return { minX: 0, minY: 0, maxX: width - 1, maxY: height - 1 };
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Crops away the large transparent margin around snowflake.png so the actual snowflower artwork
 * fills ~95% of the output canvas. When displayed at 43px, the visible snowflake is a true ~41-43px!
 */
export function buildNormalSnowflakeCanvas(
  sourceImage: HTMLImageElement | HTMLCanvasElement,
  size = 96
): HTMLCanvasElement {
  const srcW = sourceImage.width || size;
  const srcH = sourceImage.height || size;

  const scanCanvas = document.createElement('canvas');
  scanCanvas.width = srcW;
  scanCanvas.height = srcH;
  const scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });

  let cropX = 0;
  let cropY = 0;
  let cropW = srcW;
  let cropH = srcH;

  if (scanCtx) {
    scanCtx.drawImage(sourceImage, 0, 0);
    const imgData = scanCtx.getImageData(0, 0, srcW, srcH);
    const bounds = findContentBoundsRgba(imgData.data, srcW, srcH, 24);
    cropX = bounds.minX;
    cropY = bounds.minY;
    cropW = Math.max(1, bounds.maxX - bounds.minX + 1);
    cropH = Math.max(1, bounds.maxY - bounds.minY + 1);
  }

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Fit the tight content box into ~95% of the square texture while preserving 1:1 aspect ratio
  const pad = Math.round(size * 0.025);
  const avail = size - pad * 2;
  const fitScale = Math.min(avail / cropW, avail / cropH);
  const drawW = cropW * fitScale;
  const drawH = cropH * fitScale;
  const dx = (size - drawW) * 0.5;
  const dy = (size - drawH) * 0.5;

  ctx.drawImage(sourceImage, cropX, cropY, cropW, cropH, dx, dy, drawW, drawH);
  return canvas;
}

/**
 * Generates a crisp, full-bleed (~95% fill) luminous Golden Snowflake texture.
 * When `sourceImage` is provided, crops the high-res snowflower icon identically to
 * `buildNormalSnowflakeCanvas` and recolors its RGBA buffer synchronously (`getImageData` -> `putImageData`)
 * into rich metallic gold + ivory facets + deep bronze-amber outline so WebGL/SwiftShader uploads
 * 100% intact pixel data with zero deferred-path clipping.
 */
export function buildGoldenSnowflakeCanvas(
  size = 112,
  sourceImage?: HTMLImageElement | HTMLCanvasElement
): HTMLCanvasElement {
  if (sourceImage) {
    const baseCanvas = buildNormalSnowflakeCanvas(sourceImage, size);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return baseCanvas;

    ctx.drawImage(baseCanvas, 0, 0);
    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    const half = size * 0.5;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const a = data[idx + 3];
        const dx = x - half;
        const dy = y - half;
        const distNorm = Math.hypot(dx, dy) / half;

        if (a < 14) {
          // Soft warm golden radial aura inside empty pixels
          if (distNorm < 0.96) {
            const glowA = Math.round(Math.pow(1 - distNorm / 0.96, 2.2) * 72);
            if (glowA > a) {
              data[idx] = 253;
              data[idx + 1] = 224;
              data[idx + 2] = 71;
              data[idx + 3] = glowA;
            }
          }
          continue;
        }

        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

        if (lum < 0.36) {
          // Deep high-contrast bronze-brown outline (replaces dark navy border)
          const t = lum / 0.36;
          data[idx] = Math.round(92 + t * 54);
          data[idx + 1] = Math.round(40 + t * 38);
          data[idx + 2] = Math.round(10 + t * 12);
        } else if (lum < 0.78) {
          // Rich warm amber -> bright gold body
          const t = (lum - 0.36) / 0.42;
          data[idx] = Math.round(245 + t * 10);
          data[idx + 1] = Math.round(158 + t * 72);
          data[idx + 2] = Math.round(11 + t * 62);
        } else {
          // Gleaming pale gold -> ivory-white crystal facet highlights
          const t = (lum - 0.78) / 0.22;
          data[idx] = 255;
          data[idx + 1] = Math.round(234 + t * 20);
          data[idx + 2] = Math.round(115 + t * 130);
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size * 0.468;

  ctx.save();
  ctx.translate(cx, cy);

  const glow = ctx.createRadialGradient(0, 0, rOuter * 0.18, 0, 0, size * 0.5);
  glow.addColorStop(0, 'rgba(255, 244, 180, 0.62)');
  glow.addColorStop(0.7, 'rgba(251, 191, 36, 0.24)');
  glow.addColorStop(1, 'rgba(245, 158, 11, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 6; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 3);

    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = size * 0.058;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const drawArmPath = () => {
      ctx.beginPath();
      ctx.moveTo(0, -rOuter);
      ctx.lineTo(size * 0.072, -rOuter * 0.78);
      ctx.lineTo(size * 0.046, -rOuter * 0.61);
      ctx.lineTo(size * 0.16, -rOuter * 0.72);
      ctx.lineTo(size * 0.182, -rOuter * 0.57);
      ctx.lineTo(size * 0.054, -rOuter * 0.41);
      ctx.lineTo(size * 0.054, -rOuter * 0.15);
      ctx.lineTo(-size * 0.054, -rOuter * 0.15);
      ctx.lineTo(-size * 0.054, -rOuter * 0.41);
      ctx.lineTo(-size * 0.182, -rOuter * 0.57);
      ctx.lineTo(-size * 0.16, -rOuter * 0.72);
      ctx.lineTo(-size * 0.046, -rOuter * 0.61);
      ctx.lineTo(-size * 0.072, -rOuter * 0.78);
      ctx.closePath();
    };

    drawArmPath();
    ctx.stroke();

    ctx.fillStyle = '#FBBF24';
    drawArmPath();
    ctx.fill();

    ctx.fillStyle = '#FFFDF5';
    ctx.beginPath();
    ctx.moveTo(0, -rOuter * 0.89);
    ctx.lineTo(size * 0.03, -rOuter * 0.68);
    ctx.lineTo(0, -rOuter * 0.32);
    ctx.lineTo(-size * 0.03, -rOuter * 0.68);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  ctx.fillStyle = '#FFFDF7';
  ctx.strokeStyle = '#B45309';
  ctx.lineWidth = size * 0.018;
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const rad = i % 2 === 0 ? rOuter * 0.36 : rOuter * 0.17;
    const ang = (i * Math.PI) / 6 - Math.PI / 2;
    const px = Math.cos(ang) * rad;
    const py = Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
  const flush = ctx.getImageData(0, 0, size, size);
  ctx.putImageData(flush, 0, 0);
  return canvas;
}
