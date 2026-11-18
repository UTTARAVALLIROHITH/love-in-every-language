import React, { useEffect, useRef, useState } from 'react';
import { LovePhrase } from '../data/translations';
import { buildPreRenderedHeart, PreRenderedHeart } from '../geometry/textHeartLayout';

interface HeartCanvas2DProps {
  textSize: number;
  glowEnabled: boolean;
  heartColor: string;
  fontFamily: string;
  heartShape: 'classic' | 'wide' | 'tall';
  animationSpeed: number;
  isPlaying: boolean;
  /** Incrementing this triggers/resumes building from 0 if not yet started or restarts build */
  animationKey: number;
  /** When true, auto-starts from 0 on animationKey change */
  autoStart: boolean;
  onBuildComplete?: () => void;
  onHoverPhrase?: (phrase: LovePhrase | null) => void;
  onStats?: (stats: { lines: number; phrases: number; languages: number }) => void;
}

const BUILD_DURATION_MS = 4200;

export const HeartCanvas2D: React.FC<HeartCanvas2DProps> = ({
  textSize,
  glowEnabled,
  heartColor,
  fontFamily,
  heartShape,
  animationSpeed,
  isPlaying,
  animationKey,
  autoStart,
  onBuildComplete,
  onHoverPhrase,
  onStats,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [fontsLoadedTick, setFontsLoadedTick] = useState(0);

  const preRenderedRef = useRef<PreRenderedHeart | null>(null);
  const progressRef = useRef<number>(autoStart ? 0 : 0);
  const completedEmittedRef = useRef<boolean>(false);
  const lastFrameTimeRef = useRef<number>(performance.now());
  const glowRef = useRef(glowEnabled);
  const isPlayingRef = useRef(isPlaying);

  glowRef.current = glowEnabled;
  isPlayingRef.current = isPlaying;

  // Track container dimensions cleanly
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize({ w: Math.floor(rect.width), h: Math.floor(rect.height) });
      }
    };
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Refresh layout silently once Google Noto multilingual fonts finish loading
  useEffect(() => {
    let active = true;
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (active) setFontsLoadedTick((v) => v + 1);
      });
    }
    return () => {
      active = false;
    };
  }, []);

  // Reset build progress when animationKey changes
  useEffect(() => {
    progressRef.current = 0;
    completedEmittedRef.current = false;
    lastFrameTimeRef.current = performance.now();
  }, [animationKey]);

  // Build offscreen heart whenever viewport size, textSize, or fonts change
  useEffect(() => {
    if (size.w === 0 || size.h === 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // Responsive layout tuning: slightly tighter fill on mobile so controls have breathing room
    const isMobile = size.w < 640;
    const fillRatio = isMobile ? 0.84 : 0.78;
    const verticalOffset = isMobile ? -size.h * 0.04 : -size.h * 0.02;

    // Scale effective font size softly on very small viewports while keeping user slider responsive
    const viewportScale = Math.min(1, Math.max(0.65, Math.min(size.w, size.h) / 760));
    const effectiveFontSize = Math.max(2.2, textSize * viewportScale);

    const rendered = buildPreRenderedHeart({
      canvasWidth: size.w,
      canvasHeight: size.h,
      dpr,
      fontSize: effectiveFontSize,
      fillRatio,
      verticalOffset,
      heartColor,
      fontFamily,
      heartShape,
    });

    preRenderedRef.current = rendered;
    onStats?.({
      lines: rendered.rows.length,
      phrases: rendered.renderedPhraseCount,
      languages: rendered.uniqueLanguageCount,
    });

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = rendered.baseCanvas.width;
      canvas.height = rendered.baseCanvas.height;
    }
  }, [size.w, size.h, textSize, heartColor, fontFamily, heartShape, fontsLoadedTick, onStats]);

  // 60fps Zero-Flicker Animation Loop
  useEffect(() => {
    let rafId = 0;

    const renderFrame = (now: number) => {
      const dt = Math.min(64, Math.max(0, now - lastFrameTimeRef.current));
      lastFrameTimeRef.current = now;

      if (isPlayingRef.current && progressRef.current < 1) {
        progressRef.current = Math.min(1, progressRef.current + dt * Math.max(0.35, Math.min(2.5, animationSpeed)) / BUILD_DURATION_MS);
        if (progressRef.current >= 1 && !completedEmittedRef.current) {
          completedEmittedRef.current = true;
          onBuildComplete?.();
        }
      }

      const canvas = canvasRef.current;
      const pre = preRenderedRef.current;
      if (canvas && pre) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const pw = canvas.width;
          const ph = canvas.height;
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, pw, ph);

          const p = progressRef.current;
          const rows = pre.rows;
          const totalRows = rows.length;

          // Subtle ambient obsidian-crimson backdrop glow when glow is enabled & heart is revealing
          if (glowRef.current && p > 0.01) {
            const cx = pre.heartCx * pre.dpr;
            const cy = pre.heartCy * pre.dpr;
            const rad = Math.max(pre.heartW, pre.heartH) * pre.dpr * 0.65;
            const breathe = p >= 1 ? 0.88 + 0.12 * Math.sin(now * 0.0014) : p;
            const grad = ctx.createRadialGradient(cx, cy, rad * 0.05, cx, cy, rad);
            grad.addColorStop(0, `rgba(140, 18, 6, ${(0.18 * breathe).toFixed(3)})`);
            grad.addColorStop(0.5, `rgba(75, 8, 4, ${(0.08 * breathe).toFixed(3)})`);
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, pw, ph);
          }

          if (p > 0 && totalRows > 0) {
            const leadWindow = Math.max(6, Math.round(totalRows * 0.1));
            const headPos = p * (totalRows + leadWindow);

            if (p >= 1) {
              // Fast-path full composite when build is complete
              ctx.globalAlpha = 1;
              ctx.globalCompositeOperation = 'source-over';
              ctx.drawImage(pre.baseCanvas, 0, 0);

              if (glowRef.current) {
                const breathe = 0.82 + 0.18 * Math.sin(now * 0.0016);
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = breathe;
                ctx.drawImage(pre.glowCanvas, 0, 0);
              }
            } else {
              // Smooth top-to-bottom progressive row reveal
              for (let i = 0; i < totalRows; i++) {
                const rawAlpha = (headPos - i) / leadWindow;
                if (rawAlpha <= 0) break; // Rows below are still invisible

                const clamped = rawAlpha >= 1 ? 1 : rawAlpha;
                const alpha = clamped * clamped * (3 - 2 * clamped); // smoothstep

                const row = rows[i];
                const sy = Math.max(0, Math.floor(row.yTop * pre.dpr));
                const ey = Math.min(ph, Math.ceil(row.yBottom * pre.dpr));
                const sh = ey - sy;
                if (sh <= 0) continue;

                ctx.globalCompositeOperation = 'source-over';
                ctx.globalAlpha = alpha;
                ctx.drawImage(pre.baseCanvas, 0, sy, pw, sh, 0, sy, pw, sh);

                if (glowRef.current) {
                  // Extra warm ember shimmer right at the leading edge as each line awakens
                  const frontierBoost = clamped < 1 ? Math.sin(clamped * Math.PI) * 0.45 : 0;
                  ctx.globalCompositeOperation = 'lighter';
                  ctx.globalAlpha = Math.min(1, alpha * 0.85 + frontierBoost);
                  ctx.drawImage(pre.glowCanvas, 0, sy, pw, sh, 0, sy, pw, sh);
                }
              }
            }

            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
          }
        }
      }

      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(rafId);
  }, [onBuildComplete, animationSpeed]);

  // Pointer hit-testing for subtle hovered/tapped language whisper
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!onHoverPhrase || progressRef.current < 0.15) return;
    const pre = preRenderedRef.current;
    const canvas = canvasRef.current;
    if (!pre || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Quick bounding check
    if (
      x < pre.heartCx - pre.heartW * 0.52 ||
      x > pre.heartCx + pre.heartW * 0.52 ||
      y < pre.heartCy - pre.heartH * 0.52 ||
      y > pre.heartCy + pre.heartH * 0.52
    ) {
      onHoverPhrase(null);
      return;
    }

    const boxes = pre.hitBoxes;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (y >= b.y && y <= b.y + b.h && x >= b.x && x <= b.x + b.w) {
        onHoverPhrase(b.phrase);
        return;
      }
    }
    onHoverPhrase(null);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full select-none overflow-hidden bg-black"
    >
      <canvas
        ref={canvasRef}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerMove}
        onPointerLeave={() => onHoverPhrase?.(null)}
        className="block w-full h-full cursor-crosshair touch-none"
      />
    </div>
  );
};