import React, { useState } from 'react';

interface ControlDockProps {
  isPlaying: boolean;
  hasBuiltOnce: boolean;
  glowEnabled: boolean;
  textSize: number;
  is3DMode: boolean;
  rotationSpeed: number;
  isFullscreen: boolean;
  onBuildHeart: () => void;
  onReplay: () => void;
  onTogglePlay: () => void;
  onToggleGlow: () => void;
  onTextSizeChange: (val: number) => void;
  onToggle3D: () => void;
  onRotationSpeedChange: (val: number) => void;
  onResetView: () => void;
  onToggleFullscreen: () => void;
}

export const ControlDock: React.FC<ControlDockProps> = ({
  isPlaying,
  glowEnabled,
  textSize,
  is3DMode,
  rotationSpeed,
  isFullscreen,
  onBuildHeart,
  onReplay,
  onTogglePlay,
  onToggleGlow,
  onTextSizeChange,
  onToggle3D,
  onRotationSpeedChange,
  onResetView,
  onToggleFullscreen,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <div className="fixed bottom-4 right-4 z-30">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="flex items-center gap-2 rounded-full border border-orange-500/25 bg-black/80 px-3.5 py-2 text-xs font-medium tracking-wider text-orange-100/90 backdrop-blur-md transition hover:border-orange-400/50 hover:text-white"
          title="Show Controls"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_#ff5520]" />
          CONTROLS
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-3 sm:bottom-5 z-30 flex justify-center px-3 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-5xl rounded-2xl border border-orange-500/20 bg-black/75 px-3 py-2.5 sm:px-4 sm:py-2.5 shadow-[0_8px_40px_rgba(0,0,0,0.9)] backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 sm:gap-x-3">
          {/* Primary Playback Actions */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onBuildHeart}
              className="inline-flex items-center gap-1.5 rounded-lg border border-orange-500/40 bg-gradient-to-b from-orange-600/25 to-red-900/25 px-2.5 py-1.5 text-[11px] sm:text-xs font-medium tracking-wide text-orange-100 transition hover:border-orange-400/70 hover:from-orange-500/35 hover:to-red-800/35 active:scale-[0.98]"
            >
              <svg className="h-3.5 w-3.5 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" />
              </svg>
              <span>Build Heart</span>
            </button>

            <button
              type="button"
              onClick={onReplay}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-700/60 bg-stone-950/70 px-2.5 py-1.5 text-[11px] sm:text-xs font-medium text-stone-200 transition hover:border-orange-500/45 hover:text-orange-100 active:scale-[0.98]"
              title="Replay Animation"
            >
              <svg className="h-3.5 w-3.5 text-orange-400/90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v5h5" />
              </svg>
              <span className="hidden xs:inline sm:inline">Replay</span>
            </button>

            <button
              type="button"
              onClick={onTogglePlay}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-700/60 bg-stone-950/70 px-2.5 py-1.5 text-[11px] sm:text-xs font-medium text-stone-200 transition hover:border-orange-500/45 hover:text-orange-100 active:scale-[0.98]"
              title={isPlaying ? 'Pause' : 'Resume'}
            >
              {isPlaying ? (
                <>
                  <svg className="h-3.5 w-3.5 text-orange-400" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="5" width="4" height="14" rx="1" />
                    <rect x="14" y="5" width="4" height="14" rx="1" />
                  </svg>
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <svg className="h-3.5 w-3.5 text-orange-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7 5.5v13a1 1 0 0 0 1.52.85l10-6.5a1 1 0 0 0 0-1.7l-10-6.5A1 1 0 0 0 7 5.5z" />
                  </svg>
                  <span>Resume</span>
                </>
              )}
            </button>
          </div>

          <div className="hidden h-5 w-px bg-orange-500/15 md:block" />

          {/* Visual & Mode Toggles */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onToggleGlow}
              aria-pressed={glowEnabled}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] sm:text-xs font-medium transition active:scale-[0.98] ${
                glowEnabled
                  ? 'border-orange-500/50 bg-orange-950/50 text-orange-100 shadow-[0_0_12px_rgba(255,72,24,0.22)]'
                  : 'border-stone-700/60 bg-stone-950/70 text-stone-400 hover:text-stone-200'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full transition ${
                  glowEnabled
                    ? 'bg-orange-400 shadow-[0_0_8px_#ff6a2b]'
                    : 'bg-stone-600'
                }`}
              />
              <span>Glow {glowEnabled ? 'On' : 'Off'}</span>
            </button>

            <button
              type="button"
              onClick={onToggle3D}
              aria-pressed={is3DMode}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] sm:text-xs font-medium transition active:scale-[0.98] ${
                is3DMode
                  ? 'border-red-500/60 bg-gradient-to-b from-red-900/50 to-orange-950/50 text-orange-50 shadow-[0_0_14px_rgba(255,60,24,0.28)]'
                  : 'border-stone-700/60 bg-stone-950/70 text-stone-200 hover:border-orange-500/45'
              }`}
            >
              <svg className="h-3.5 w-3.5 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
              </svg>
              <span>3D {is3DMode ? 'On' : 'Off'}</span>
            </button>
          </div>

          <div className="hidden h-5 w-px bg-orange-500/15 md:block" />

          {/* Sliders: Text Size & Rotation Speed */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 px-1">
            <label className="flex items-center gap-2 text-[11px] text-stone-300">
              <span className="whitespace-nowrap tracking-wide text-stone-400">Text Size</span>
              <input
                type="range"
                min={2.5}
                max={12}
                step={0.5}
                value={textSize}
                onChange={(e) => onTextSizeChange(parseFloat(e.target.value))}
                className="ember-slider w-16 sm:w-20"
                aria-label="Text Size Adjustment"
              />
              <span className="w-6 text-right tabular-nums text-orange-200/80">{textSize}</span>
            </label>

            <label
              className={`flex items-center gap-2 text-[11px] transition ${
                is3DMode ? 'text-stone-300' : 'text-stone-500'
              }`}
              title={is3DMode ? '3D Rotation Speed' : 'Enable 3D Mode to adjust live rotation'}
            >
              <span className="whitespace-nowrap tracking-wide">Spin</span>
              <input
                type="range"
                min={0}
                max={3}
                step={0.1}
                value={rotationSpeed}
                onChange={(e) => onRotationSpeedChange(parseFloat(e.target.value))}
                className="ember-slider w-16 sm:w-20"
                aria-label="Rotation Speed"
              />
              <span className="w-7 text-right tabular-nums text-orange-200/80">
                {rotationSpeed.toFixed(1)}×
              </span>
            </label>
          </div>

          <div className="hidden h-5 w-px bg-orange-500/15 md:block" />

          {/* View & Fullscreen */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onResetView}
              className="inline-flex items-center gap-1 rounded-lg border border-stone-700/60 bg-stone-950/70 px-2.5 py-1.5 text-[11px] sm:text-xs font-medium text-stone-300 transition hover:border-orange-500/45 hover:text-orange-100 active:scale-[0.98]"
              title="Reset View"
            >
              <svg className="h-3.5 w-3.5 text-orange-400/85" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" />
                <circle cx="12" cy="12" r="2.2" />
              </svg>
              <span>Reset View</span>
            </button>

            <button
              type="button"
              onClick={onToggleFullscreen}
              className="inline-flex items-center gap-1 rounded-lg border border-stone-700/60 bg-stone-950/70 px-2.5 py-1.5 text-[11px] sm:text-xs font-medium text-stone-300 transition hover:border-orange-500/45 hover:text-orange-100 active:scale-[0.98]"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? (
                <svg className="h-3.5 w-3.5 text-orange-400/85" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5 text-orange-400/85" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
                </svg>
              )}
              <span className="hidden sm:inline">{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
            </button>

            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="inline-flex items-center justify-center rounded-lg border border-stone-800/70 bg-stone-950/60 p-1.5 text-stone-400 transition hover:border-orange-500/40 hover:text-orange-100"
              title="Hide Controls"
              aria-label="Hide Controls"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};