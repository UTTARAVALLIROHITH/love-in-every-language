import { LOVE_PHRASES, LovePhrase } from '../data/translations';
import {
  getHeartScanlineIntervals,
  getNormalizedHeartDepth,
  getScaledHeartPoints,
  HEART_POLYGON,
} from './heartGeometry';

export interface PlacedPhraseHit {
  x: number;
  y: number;
  w: number;
  h: number;
  phrase: LovePhrase;
}

export interface HeartRowMeta {
  yTop: number;
  yBottom: number;
  yCenter: number;
}

export interface PreRenderedHeart {
  width: number;
  height: number;
  dpr: number;
  heartCx: number;
  heartCy: number;
  heartW: number;
  heartH: number;
  baseCanvas: HTMLCanvasElement;
  glowCanvas: HTMLCanvasElement;
  rows: HeartRowMeta[];
  hitBoxes: PlacedPhraseHit[];
  renderedPhraseCount: number;
  uniqueLanguageCount: number;
}

const FONT_STACK =
  '"Noto Sans", "Noto Sans Telugu", "Noto Sans Devanagari", "Noto Sans Tamil", "Noto Sans Kannada", "Noto Sans Malayalam", "Noto Sans Bengali", "Noto Sans Arabic", "Noto Sans Hebrew", "Noto Sans JP", "Noto Sans KR", "Noto Sans SC", "Noto Sans TC", "Noto Sans Thai", "Noto Sans Sinhala", "Noto Sans Georgian", "Noto Sans Armenian", "Noto Sans Ethiopic", system-ui, sans-serif';

/** Deterministic seeded PRNG (Mulberry32) so layout never flickers on re-render */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Builds a deterministic, richly interleaved sequence across all 1,439 verified phrases,
 * ensuring the 17 flagship languages recur naturally while cycling through every language.
 */
const BALANCED_STREAM: LovePhrase[] = (() => {
  const featured = LOVE_PHRASES.slice(0, 18);
  const rest = LOVE_PHRASES.slice(18);
  const rand = mulberry32(20260214);

  // Fisher-Yates deterministic shuffle on rest
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = rest[i];
    rest[i] = rest[j];
    rest[j] = tmp;
  }

  const stream: LovePhrase[] = [];
  let fIdx = 0;
  for (let i = 0; i < rest.length; i++) {
    if (i % 7 === 0) {
      stream.push(featured[fIdx % featured.length]);
      fIdx++;
    }
    stream.push(rest[i]);
  }
  // Ensure all featured are also right near the start
  return [...featured, ...stream];
})();

const SHORT_TIP_PHRASES: LovePhrase[] = [
  LOVE_PHRASES[0], // I love you
  LOVE_PHRASES[7], // 愛してる
  LOVE_PHRASES[8], // 사랑해요
  LOVE_PHRASES[9], // 我爱你
  LOVE_PHRASES[11], // أحبك
  LOVE_PHRASES[12], // Te amo
  LOVE_PHRASES[13], // Je t'aime
  LOVE_PHRASES[15], // Ti amo
];

/**
 * Selects glowing crimson/vermilion/orange color from heart interior depth & harmonic shimmer.
 * Zero blue hues anywhere.
 */
function pickEmberColor(depth: number, seedVal: number, heartColor = '#ff542e'): string {
  // depth: 0 (edge) -> 1 (core)
  const wave = Math.sin(seedVal * 2.3) * 0.5 + 0.5; // [0, 1]
  const heat = Math.min(1, Math.max(0, depth * 0.72 + wave * 0.28));

  // Blend the selected base hue toward a luminous highlight while retaining depth.
  const hex = heartColor.replace('#', '');
  const safeHex = /^[0-9a-fA-F]{6}$/.test(hex) ? hex : 'ff542e';
  const baseR = parseInt(safeHex.slice(0, 2), 16);
  const baseG = parseInt(safeHex.slice(2, 4), 16);
  const baseB = parseInt(safeHex.slice(4, 6), 16);
  const highlight = 0.12 + heat * 0.52;
  const r = Math.round(baseR + (255 - baseR) * highlight);
  const g = Math.round(baseG + (245 - baseG) * highlight);
  const b = Math.round(baseB + (255 - baseB) * highlight);
  const a = 0.88 + depth * 0.12;
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
}

export interface BuildHeartLayoutOptions {
  canvasWidth: number;
  canvasHeight: number;
  dpr: number;
  fontSize: number;
  /** Optional custom heart box override (used for 2048x2048 3D texture generation) */
  fillRatio?: number;
  verticalOffset?: number;
  heartColor?: string;
  fontFamily?: string;
  heartShape?: 'classic' | 'wide' | 'tall';
}

export function buildPreRenderedHeart(opts: BuildHeartLayoutOptions): PreRenderedHeart {
  const {
    canvasWidth,
    canvasHeight,
    dpr,
    fontSize,
    fillRatio = 0.8,
    verticalOffset = 0,
    heartColor = '#ff542e',
    fontFamily = 'Arial',
    heartShape = 'classic',
  } = opts;

  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = Math.max(1, Math.floor(canvasWidth * dpr));
  baseCanvas.height = Math.max(1, Math.floor(canvasHeight * dpr));

  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = baseCanvas.width;
  glowCanvas.height = baseCanvas.height;

  const ctx = baseCanvas.getContext('2d');
  const gCtx = glowCanvas.getContext('2d');
  if (!ctx || !gCtx) {
    return {
      width: canvasWidth,
      height: canvasHeight,
      dpr,
      heartCx: canvasWidth * 0.5,
      heartCy: canvasHeight * 0.5,
      heartW: 0,
      heartH: 0,
      baseCanvas,
      glowCanvas,
      rows: [],
      hitBoxes: [],
      renderedPhraseCount: 0,
      uniqueLanguageCount: 0,
    };
  }

  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // Fit exact mathematical heart aspect ratio cleanly inside viewport
  const maxAvailW = canvasWidth * fillRatio;
  const maxAvailH = canvasHeight * fillRatio;

  let heartW = maxAvailW;
  let heartH = heartW / HEART_POLYGON.aspectRatio;
  if (heartH > maxAvailH) {
    heartH = maxAvailH;
    heartW = heartH * HEART_POLYGON.aspectRatio;
  }

  // Gentle silhouette presets preserve the heart outline while changing its proportions.
  if (heartShape === 'wide') {
    heartW *= 1.12;
    heartH *= 0.92;
  } else if (heartShape === 'tall') {
    heartW *= 0.90;
    heartH *= 1.10;
  }

  const heartCx = canvasWidth * 0.5;
  const heartCy = canvasHeight * 0.5 + verticalOffset;
  const heartTop = heartCy - heartH * 0.5;

  // Build exact mathematical heart clip path so zero text ever escapes boundary
  const scaledPts = getScaledHeartPoints(heartCx, heartCy, heartW, heartH);
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < scaledPts.length; i++) {
    if (i === 0) ctx.moveTo(scaledPts[i].x, scaledPts[i].y);
    else ctx.lineTo(scaledPts[i].x, scaledPts[i].y);
  }
  ctx.closePath();
  ctx.clip();

  const lineHeight = Math.max(2.1, fontSize * 1.02);
  const totalRows = Math.max(16, Math.floor(heartH / lineHeight));
  const actualLineHeight = heartH / totalRows;

  const safeFont = ['Arial', 'Georgia', 'Trebuchet MS', 'Courier New'].includes(fontFamily) ? fontFamily : 'Arial';
  const fontSpec = `500 ${fontSize}px "${safeFont}", ${FONT_STACK}`;
  ctx.font = fontSpec;
  ctx.textBaseline = 'middle';

  const sepText = ' · ';
  const sepWidth = ctx.measureText(sepText).width;

  // Measure cache for speed
  const widthCache = new Map<string, number>();
  const measureCached = (text: string): number => {
    let w = widthCache.get(text);
    if (w === undefined) {
      w = ctx.measureText(text).width;
      widthCache.set(text, w);
    }
    return w;
  };

  const rows: HeartRowMeta[] = [];
  const hitBoxes: PlacedPhraseHit[] = [];
  const uniqueLangs = new Set<string>();
  let renderedPhraseCount = 0;
  let streamCursor = 0;

  for (let rowIdx = 0; rowIdx < totalRows; rowIdx++) {
    const yTop = heartTop + rowIdx * actualLineHeight;
    const yBottom = yTop + actualLineHeight;
    const yCenter = yTop + actualLineHeight * 0.5;
    const normY = (yCenter - heartCy) / heartH;

    rows.push({ yTop, yBottom, yCenter });

    const intervals = getHeartScanlineIntervals(normY);
    if (intervals.length === 0) continue;

    for (let ivIdx = 0; ivIdx < intervals.length; ivIdx++) {
      const iv = intervals[ivIdx];
      const xLeft = heartCx + iv.xStart * heartW;
      const xRight = heartCx + iv.xEnd * heartW;
      const ivWidth = xRight - xLeft;

      if (ivWidth < 2) continue;

      // Very narrow tips (top lobe peaks or sharp bottom cusp): render short crisp phrase centered
      if (ivWidth < Math.max(24, fontSize * 3.2)) {
        const tipPhrase = SHORT_TIP_PHRASES[(rowIdx + ivIdx) % SHORT_TIP_PHRASES.length];
        const normX = ((xLeft + xRight) * 0.5 - heartCx) / heartW;
        const depth = getNormalizedHeartDepth(normX, normY);
        ctx.fillStyle = pickEmberColor(depth, rowIdx * 0.41 + ivIdx, heartColor);
        ctx.direction = tipPhrase.r ? 'rtl' : 'ltr';
        ctx.textAlign = 'center';
        ctx.fillText(tipPhrase.t, (xLeft + xRight) * 0.5, yCenter);
        ctx.textAlign = 'left';
        uniqueLangs.add(tipPhrase.l);
        renderedPhraseCount++;
        continue;
      }

      // Small bleed of ~fontSize * 0.45 into the exact polygon clip ensures smooth, gap-free edges
      const bleed = Math.min(fontSize * 0.5, ivWidth * 0.12);
      let cursorX = xLeft - bleed;
      const limitX = xRight + bleed;

      // Deterministic staggered offset per row so vertical seams never form
      let guard = 0;
      while (cursorX < limitX && guard < 120) {
        guard++;
        const phrase = BALANCED_STREAM[streamCursor % BALANCED_STREAM.length];
        streamCursor++;

        const phraseW = measureCached(phrase.t);
        const remaining = limitX - cursorX;

        // If phrase is much wider than remaining space at the very end, still draw clipped
        // so the clipped polygon silhouette remains crisp and uniformly dense!
        const phraseMidX = cursorX + Math.min(phraseW, remaining) * 0.5;
        const normX = (phraseMidX - heartCx) / heartW;
        const depth = getNormalizedHeartDepth(normX, normY);

        ctx.fillStyle = pickEmberColor(depth, rowIdx * 0.37 + guard * 0.61, heartColor);
        ctx.direction = phrase.r ? 'rtl' : 'ltr';
        ctx.textAlign = 'left';
        // For RTL strings drawn with textAlign='left', Canvas2D anchors the left edge of the text box
        // only when direction='ltr' or anchors right edge when direction='rtl'!
        // So for RTL phrases we explicitly place at cursorX + phraseW with textAlign='right'
        // to ensure exact left-to-right packing without overlaps.
        if (phrase.r) {
          ctx.textAlign = 'right';
          ctx.fillText(phrase.t, cursorX + phraseW, yCenter);
        } else {
          ctx.textAlign = 'left';
          ctx.fillText(phrase.t, cursorX, yCenter);
        }

        // Record interactive hit box for clipped visible portion
        const boxStart = Math.max(xLeft, cursorX);
        const boxEnd = Math.min(xRight, cursorX + phraseW);
        if (boxEnd - boxStart > 2) {
          hitBoxes.push({
            x: boxStart,
            y: yTop,
            w: boxEnd - boxStart,
            h: actualLineHeight,
            phrase,
          });
        }

        uniqueLangs.add(phrase.l);
        renderedPhraseCount++;

        cursorX += phraseW;

        if (cursorX + sepWidth < limitX) {
          ctx.direction = 'ltr';
          ctx.textAlign = 'left';
          ctx.fillStyle = 'rgba(255, 86, 44, 0.42)';
          ctx.fillText(sepText, cursorX, yCenter);
          cursorX += sepWidth;
        } else {
          break;
        }
      }
    }
  }

  ctx.restore();

  // Pre-render atmospheric warm crimson-orange glow onto glowCanvas (zero-flicker 60fps compositing)
  gCtx.save();
  gCtx.clearRect(0, 0, glowCanvas.width, glowCanvas.height);

  // Pass 1: Tight inner ember bloom
  gCtx.filter = `blur(${Math.max(2, Math.round(3.5 * dpr))}px)`;
  gCtx.globalAlpha = 0.72;
  gCtx.drawImage(baseCanvas, 0, 0);

  // Pass 2: Soft wider atmospheric crimson aura
  gCtx.filter = `blur(${Math.max(6, Math.round(12 * dpr))}px)`;
  gCtx.globalAlpha = 0.5;
  gCtx.drawImage(baseCanvas, 0, 0);

  gCtx.restore();

  return {
    width: canvasWidth,
    height: canvasHeight,
    dpr,
    heartCx,
    heartCy,
    heartW,
    heartH,
    baseCanvas,
    glowCanvas,
    rows,
    hitBoxes,
    renderedPhraseCount,
    uniqueLanguageCount: uniqueLangs.size,
  };
}