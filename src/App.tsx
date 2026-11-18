import { useCallback, useEffect, useRef, useState } from 'react';
import { ControlDock } from './components/ControlDock';
import { HeartCanvas2D } from './components/HeartCanvas2D';
import { HeartCanvas3D } from './components/HeartCanvas3D';
import {
  LovePhrase,
  VERIFIED_LANGUAGE_COUNT,
  VERIFIED_PHRASE_COUNT,
} from './data/translations';

const DEFAULT_TEXT_SIZE = 4.5;
const DEFAULT_ROTATION_SPEED = 0.7;

export function App() {
  const rootRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [hasBuiltOnce, setHasBuiltOnce] = useState(false);
  const [animationKey, setAnimationKey] = useState(1);
  const [glowEnabled, setGlowEnabled] = useState(true);
  const [textSize, setTextSize] = useState(DEFAULT_TEXT_SIZE);
  const [is3DMode, setIs3DMode] = useState(false);
  const [rotationSpeed, setRotationSpeed] = useState(DEFAULT_ROTATION_SPEED);
  const [resetViewKey, setResetViewKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSharedView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('shared') === '1' ||
      ['name', 'message', 'color', 'font', 'shape', 'particles', 'speed', 'mode', 'textSize', 'glow']
        .some((key) => params.has(key));
  });
  const [showIntro, setShowIntro] = useState(true);
  const [showLetter, setShowLetter] = useState(false);
  const [showPersonalize, setShowPersonalize] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftMessage, setDraftMessage] = useState('');
  const [personalName, setPersonalName] = useState('');
  const [personalMessage, setPersonalMessage] = useState('');
  const [shareStatus, setShareStatus] = useState('');
  const [heartColor, setHeartColor] = useState('#ff542e');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [fontFamily, setFontFamily] = useState('Arial');
  const [heartShape, setHeartShape] = useState<'classic' | 'wide' | 'tall'>('classic');
  const [particleDensity, setParticleDensity] = useState(1);

  const [hoveredPhrase, setHoveredPhrase] = useState<LovePhrase | null>(null);
  const [stats, setStats] = useState<{
    lines: number;
    phrases: number;
    languages: number;
  } | null>(null);

  // Sync fullscreen state with browser Escape / native controls
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Load every saved design choice from a shared URL.
  // Shared links open as a clean presentation: visitors see the heart, not the editing tools.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedName = (params.get('name') || '').slice(0, 32);
    const sharedMessage = (params.get('message') || '').slice(0, 110);
    const sharedColor = params.get('color') || '';
    const sharedFont = params.get('font') || '';
    const sharedShape = params.get('shape') || '';
    const sharedDensity = Number(params.get('particles'));
    const sharedSpeed = Number(params.get('speed'));
    const sharedTextSize = Number(params.get('textSize'));
    const sharedMode = params.get('mode');
    const sharedGlow = params.get('glow');

    if (/^#[0-9a-fA-F]{6}$/.test(sharedColor)) setHeartColor(sharedColor);
    if (['Arial', 'Georgia', 'Trebuchet MS', 'Courier New'].includes(sharedFont)) setFontFamily(sharedFont);
    if (['classic', 'wide', 'tall'].includes(sharedShape)) setHeartShape(sharedShape as 'classic' | 'wide' | 'tall');
    if (Number.isFinite(sharedDensity) && sharedDensity >= 0.5 && sharedDensity <= 1.5) setParticleDensity(sharedDensity);
    if (Number.isFinite(sharedSpeed) && sharedSpeed >= 0.35 && sharedSpeed <= 2.5) setRotationSpeed(sharedSpeed);
    if (Number.isFinite(sharedTextSize) && sharedTextSize >= 2.5 && sharedTextSize <= 12) setTextSize(sharedTextSize);
    if (sharedMode === '2d' || sharedMode === '3d') setIs3DMode(sharedMode === '3d');
    if (sharedGlow === '0' || sharedGlow === '1') setGlowEnabled(sharedGlow === '1');

    if (params.has('name') || params.has('message')) {
      setPersonalName(sharedName);
      setPersonalMessage(sharedMessage);
    }
    if (isSharedView) setShowIntro(false);
  }, [isSharedView]);

  // One canonical URL is used for both the system share sheet and the QR code.
  const buildShareUrl = useCallback(() => {
    const url = new URL(window.location.href);
    url.search = '';
    if (personalName.trim()) url.searchParams.set('name', personalName.trim());
    if (personalMessage.trim()) url.searchParams.set('message', personalMessage.trim());
    url.searchParams.set('color', heartColor);
    url.searchParams.set('font', fontFamily);
    url.searchParams.set('shape', heartShape);
    url.searchParams.set('particles', String(particleDensity));
    url.searchParams.set('speed', String(rotationSpeed));
    url.searchParams.set('mode', is3DMode ? '3d' : '2d');
    url.searchParams.set('textSize', String(textSize));
    url.searchParams.set('glow', glowEnabled ? '1' : '0');
    url.searchParams.set('shared', '1');
    return url;
  }, [personalName, personalMessage, heartColor, fontFamily, heartShape, particleDensity, rotationSpeed, is3DMode, textSize, glowEnabled]);

  const handleShareHeart = useCallback(async () => {
    const url = buildShareUrl();

    const shareData = {
      title: 'A heart made just for you',
      text: personalName
        ? `A special heart for ${personalName}.`
        : personalMessage
        ? 'Someone made a special heart with a message for you.'
        : 'Check out this custom heart design.',
      url: url.toString(),
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setShareStatus('Share sheet opened');
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url.toString());
        setShareStatus('Personalized link copied');
      } else {
        window.prompt('Copy your personalized heart link:', url.toString());
        setShareStatus('Your link is ready to copy');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      try {
        await navigator.clipboard.writeText(url.toString());
        setShareStatus('Personalized link copied');
      } catch {
        window.prompt('Copy your personalized heart link:', url.toString());
        setShareStatus('Your link is ready to copy');
      }
    }
    window.setTimeout(() => setShareStatus(''), 3000);
  }, [buildShareUrl, personalName, personalMessage]);

  const handleBuildHeart = useCallback(() => {
    if (!isPlaying && !hasBuiltOnce) {
      setIsPlaying(true);
      return;
    }
    setHasBuiltOnce(false);
    setIsPlaying(true);
    setAnimationKey((k) => k + 1);
  }, [isPlaying, hasBuiltOnce]);

  const handleReplay = useCallback(() => {
    setHasBuiltOnce(false);
    setIsPlaying(true);
    setAnimationKey((k) => k + 1);
  }, []);

  const handleTogglePlay = useCallback(() => {
    setIsPlaying((p) => !p);
  }, []);

  const handleToggleGlow = useCallback(() => {
    setGlowEnabled((g) => !g);
  }, []);

  const handleToggle3D = useCallback(() => {
    setIs3DMode((prev) => {
      const next = !prev;
      setHoveredPhrase(null);
      setHasBuiltOnce(false);
      setIsPlaying(true);
      setAnimationKey((k) => k + 1);
      return next;
    });
  }, []);

  const handleResetView = useCallback(() => {
    if (is3DMode) {
      setResetViewKey((k) => k + 1);
    } else {
      setTextSize(DEFAULT_TEXT_SIZE);
      setGlowEnabled(true);
    }
  }, [is3DMode]);

  const handleToggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        const el = rootRef.current || document.documentElement;
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Gracefully ignore if browser blocks fullscreen
    }
  }, []);

  const handleBuildComplete = useCallback(() => {
    setHasBuiltOnce(true);
  }, []);

  return (
    <div
      ref={rootRef}
      className="relative w-screen h-screen overflow-hidden bg-black text-stone-100 select-none"
    >
      {/* Cinematic first-entry intro */}
      {showIntro && (
        <section
          className="cinematic-intro fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#050303]"
          aria-label="Love in Every Language introduction"
        >
          <div className="intro-atmosphere" aria-hidden="true" />
          <div className="intro-particles intro-particles-one" aria-hidden="true" />
          <div className="intro-particles intro-particles-two" aria-hidden="true" />
          <div className="intro-content relative z-10 flex flex-col items-center px-6 text-center">
            <div className="intro-heart mb-8" aria-hidden="true"><span>♥</span></div>
            <p className="mb-4 text-[9px] sm:text-[10px] uppercase tracking-[0.48em] text-orange-200/55">A feeling beyond words</p>
            <h2 className="font-editorial text-3xl sm:text-5xl md:text-6xl font-medium tracking-[0.12em] text-orange-50">LOVE IN EVERY LANGUAGE</h2>
            <p className="mt-5 max-w-md text-xs sm:text-sm leading-7 tracking-[0.12em] text-stone-300/55">One heart. Thousands of ways to say it.</p>
            <button type="button" onClick={() => setShowIntro(false)} className="intro-enter mt-10 rounded-full border border-orange-200/30 px-8 py-3 text-[10px] font-medium uppercase tracking-[0.32em] text-orange-50/90 transition-all duration-500 hover:border-orange-100/70 hover:bg-orange-100/10 hover:shadow-[0_0_35px_rgba(255,90,50,0.18)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-200">
              Enter experience <span className="ml-2">→</span>
            </button>
            <span className="mt-5 font-mono text-[9px] tracking-[0.3em] text-stone-500/55">H4CK3R033</span>
          </div>
        </section>
      )}

      {/* Floating Minimalist Editorial Title */}
      <header className="pointer-events-none fixed inset-x-0 top-3 sm:top-5 z-20 flex flex-col items-center px-4 text-center">
        <h1 className="font-editorial text-lg sm:text-2xl md:text-[26px] font-medium tracking-[0.26em] text-orange-50/95 drop-shadow-[0_0_20px_rgba(255,68,24,0.38)]">
          LOVE IN EVERY LANGUAGE
        </h1>
        <p className="mt-1 text-[10px] sm:text-[11px] font-normal tracking-[0.24em] text-orange-200/55 uppercase">
          {VERIFIED_LANGUAGE_COUNT.toLocaleString()} Languages ·{' '}
          {VERIFIED_PHRASE_COUNT.toLocaleString()} Verified Expressions
          {stats && !is3DMode
            ? ` · ${stats.lines} Lines`
            : is3DMode
            ? ' · Volumetric 3D'
            : ''}
        </p>
      </header>

      {/* Main Typographic Heart Stage */}
      <main className="w-full h-full">
        {is3DMode ? (
          <HeartCanvas3D
            textSize={textSize}
            glowEnabled={glowEnabled}
            heartColor={heartColor}
            fontFamily={fontFamily}
            heartShape={heartShape}
            particleDensity={particleDensity}
            isPlaying={isPlaying}
            rotationSpeed={rotationSpeed}
            animationKey={animationKey}
            resetViewKey={resetViewKey}
            onBuildComplete={handleBuildComplete}
          />
        ) : (
          <HeartCanvas2D
            textSize={textSize}
            glowEnabled={glowEnabled}
            heartColor={heartColor}
            fontFamily={fontFamily}
            heartShape={heartShape}
            animationSpeed={rotationSpeed}
            isPlaying={isPlaying}
            animationKey={animationKey}
            autoStart={true}
            onBuildComplete={handleBuildComplete}
            onHoverPhrase={setHoveredPhrase}
            onStats={setStats}
          />
        )}
      </main>

      {/* Personalized dedication displayed over the heart */}
      {(personalName || personalMessage) && (
        <div className="personal-heart-overlay pointer-events-none fixed inset-x-0 top-[43%] z-20 flex -translate-y-1/2 justify-center px-8 text-center">
          <div className="max-w-[min(78vw,420px)]">
            {personalName && (
              <p className="font-editorial text-xl font-semibold tracking-[0.12em] text-orange-50 drop-shadow-[0_0_16px_rgba(255,100,65,.85)] sm:text-3xl">
                {personalName}
              </p>
            )}
            {personalMessage && (
              <p className="mt-2 font-editorial text-xs italic leading-relaxed text-orange-100/90 drop-shadow-[0_1px_8px_rgba(0,0,0,.95)] sm:text-sm">
                {personalMessage}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Subtle Whisper Caption for Hovered/Tapped Phrase or 3D Hint */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[118px] sm:bottom-[72px] z-20 flex justify-center px-4">
        {!is3DMode && hoveredPhrase ? (
          <div className="rounded-full border border-orange-500/20 bg-black/75 px-3.5 py-1 text-xs text-orange-100/95 backdrop-blur-md shadow-[0_0_24px_rgba(255,60,20,0.2)] transition-opacity">
            <span
              className="font-multilingual font-medium text-orange-300"
              dir={hoveredPhrase.r ? 'rtl' : 'ltr'}
            >
              {hoveredPhrase.t}
            </span>
            <span className="mx-2 text-orange-500/50">·</span>
            <span className="text-[11px] tracking-wider text-stone-300/90">
              {hoveredPhrase.l}
            </span>
          </div>
        ) : is3DMode ? (
          <div className="text-[10px] tracking-[0.2em] uppercase text-orange-200/40">
            Drag to orbit · Scroll to zoom
          </div>
        ) : null}
      </div>

      {/* Secret letter experience */}
      <button
        type="button"
        onClick={() => setShowLetter(true)}
        className="fixed left-4 bottom-[116px] sm:bottom-[88px] z-30 inline-flex items-center gap-2 rounded-full border border-orange-200/20 bg-black/75 px-4 py-2.5 text-[9px] sm:text-[10px] font-medium uppercase tracking-[0.22em] text-orange-100/85 shadow-[0_8px_30px_rgba(0,0,0,.45)] backdrop-blur-xl transition-all duration-300 hover:border-orange-200/50 hover:bg-orange-950/60 hover:text-white"
        aria-haspopup="dialog"
      >
        <span className="text-base" aria-hidden="true">✉</span>
        <span>Open secret letter</span>
      </button>

      {showLetter && (
        <div
          className="letter-backdrop fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/85 px-4 py-8 backdrop-blur-md"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowLetter(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="secret-letter-title"
            className="letter-card relative w-full max-w-xl overflow-hidden rounded-[28px] border border-orange-200/20 bg-[#100b0a] px-6 py-10 text-center shadow-[0_25px_100px_rgba(0,0,0,.75)] sm:px-12 sm:py-14"
          >
            <button
              type="button"
              onClick={() => setShowLetter(false)}
              aria-label="Close secret letter"
              className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-stone-700/70 text-xl text-stone-400 transition hover:border-orange-200/40 hover:text-orange-100"
            >
              ×
            </button>
            <div className="letter-envelope mx-auto mb-8 grid h-20 w-24 place-items-center rounded-2xl border border-orange-200/25 bg-gradient-to-br from-orange-950/70 to-[#1b0d0b] shadow-[0_0_45px_rgba(180,65,35,.12)]" aria-hidden="true">
              <span className="text-4xl text-orange-200/90">♡</span>
            </div>
            <p className="mb-3 text-[9px] uppercase tracking-[0.42em] text-orange-200/55">
              A little note from the heart
            </p>
            <h2 id="secret-letter-title" className="font-editorial text-3xl font-medium tracking-[0.08em] text-orange-50 sm:text-4xl">
              For Someone Special
            </h2>
            <div className="mx-auto my-7 h-px w-16 bg-gradient-to-r from-transparent via-orange-300/60 to-transparent" />
            <div className="space-y-4 font-editorial text-lg leading-8 text-stone-200/85 sm:text-xl sm:leading-9">
              <p>Some feelings are too beautiful to fit into a single language.</p>
              <p>They live in the little moments, the unexpected smiles, and the memories that stay long after the moment has passed.</p>
              <p>If words could become a thousand stars, every one would carry a simple message:</p>
            </div>
            <p className="mt-7 font-editorial text-3xl italic text-orange-200 sm:text-4xl">
              You are special. ♥
            </p>
            <p className="mt-8 text-[9px] uppercase tracking-[0.32em] text-stone-500">
              Written with love · H4CK3R033
            </p>
            <button
              type="button"
              onClick={() => setShowLetter(false)}
              className="mt-9 rounded-full border border-orange-200/30 px-7 py-3 text-[9px] font-medium uppercase tracking-[0.28em] text-orange-100/90 transition hover:bg-orange-100/10 hover:border-orange-100/60"
            >
              Keep this feeling
            </button>
          </section>
        </div>
      )}

      {!isSharedView && (
        <>
      {/* Personalize the heart */}
      <button
        type="button"
        onClick={() => {
          setDraftName(personalName);
          setDraftMessage(personalMessage);
          setShowPersonalize(true);
        }}
        className="fixed right-4 bottom-[116px] sm:bottom-[88px] z-30 inline-flex items-center gap-2 rounded-full border border-orange-200/20 bg-black/75 px-4 py-2.5 text-[9px] sm:text-[10px] font-medium uppercase tracking-[0.2em] text-orange-100/85 shadow-[0_8px_30px_rgba(0,0,0,.45)] backdrop-blur-xl transition-all duration-300 hover:border-orange-200/50 hover:bg-orange-950/60 hover:text-white"
        aria-haspopup="dialog"
      >
        <span aria-hidden="true">✧</span>
        <span>Personalize heart</span>
      </button>

      {showPersonalize && (
        <div
          className="personalize-backdrop fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/85 px-4 py-8 backdrop-blur-md"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowPersonalize(false);
          }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="personalize-title"
            className="personalize-card relative w-full max-w-md rounded-[26px] border border-orange-200/20 bg-[#100b0a] p-6 text-left shadow-[0_25px_100px_rgba(0,0,0,.8)] sm:p-8"
            onSubmit={(event) => {
              event.preventDefault();
              setPersonalName(draftName.trim().slice(0, 32));
              setPersonalMessage(draftMessage.trim().slice(0, 110));
              setShowPersonalize(false);
            }}
          >
            <button
              type="button"
              onClick={() => setShowPersonalize(false)}
              aria-label="Close personalization"
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full border border-stone-700/70 text-lg text-stone-400 transition hover:border-orange-200/40 hover:text-orange-100"
            >
              ×
            </button>
            <p className="mb-2 text-[9px] uppercase tracking-[0.38em] text-orange-200/55">
              Make it yours
            </p>
            <h2 id="personalize-title" className="font-editorial text-3xl text-orange-50">
              Personalize the heart
            </h2>
            <p className="mt-2 text-xs leading-6 text-stone-400">
              Add a name and a short message. They will appear over the heart.
            </p>

            <label htmlFor="heart-recipient" className="mt-6 block text-[10px] uppercase tracking-[0.2em] text-orange-100/75">
              Name
            </label>
            <input
              id="heart-recipient"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              maxLength={32}
              placeholder="e.g. Someone special"
              className="mt-2 w-full rounded-xl border border-stone-700/80 bg-black/45 px-4 py-3 text-sm text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-orange-300/50"
            />

            <label htmlFor="heart-message" className="mt-5 block text-[10px] uppercase tracking-[0.2em] text-orange-100/75">
              Personal message
            </label>
            <textarea
              id="heart-message"
              value={draftMessage}
              onChange={(event) => setDraftMessage(event.target.value)}
              maxLength={110}
              rows={3}
              placeholder="Write a short message from your heart..."
              className="mt-2 w-full resize-none rounded-xl border border-stone-700/80 bg-black/45 px-4 py-3 text-sm leading-6 text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-orange-300/50"
            />
            <p className="mt-2 text-right text-[10px] text-stone-500">
              {draftMessage.length}/110
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="submit"
                className="flex-1 rounded-full border border-orange-200/35 bg-orange-100/10 px-5 py-3 text-[10px] font-medium uppercase tracking-[0.22em] text-orange-50 transition hover:bg-orange-100/20"
              >
                Apply to heart
              </button>
              <button
                type="button"
                onClick={() => {
                  setPersonalName('');
                  setPersonalMessage('');
                  setDraftName('');
                  setDraftMessage('');
                  setShowPersonalize(false);
                }}
                className="rounded-full border border-stone-700/70 px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-stone-400 transition hover:text-stone-100"
              >
                Clear
              </button>
            </div>
          </form>
        </div>
      )}

        </>
      )}

      {!isSharedView && (
        <>
      {/* Heart color palette */}
      <div className="fixed left-4 top-20 z-30">
        <button
          type="button"
          onClick={() => setShowColorPicker((open) => !open)}
          className="inline-flex items-center gap-2 rounded-full border border-orange-200/20 bg-black/75 px-4 py-2.5 text-[9px] sm:text-[10px] font-medium uppercase tracking-[0.2em] text-orange-100/85 shadow-[0_8px_30px_rgba(0,0,0,.45)] backdrop-blur-xl transition hover:border-orange-200/50"
          aria-expanded={showColorPicker}
        >
          <span className="h-3 w-3 rounded-full border border-white/40" style={{ backgroundColor: heartColor }} />
          Heart color
        </button>
        {showColorPicker && (
          <div className="mt-2 w-52 rounded-2xl border border-orange-200/20 bg-[#100b0a]/95 p-4 shadow-2xl backdrop-blur-xl">
            <p className="mb-3 text-[9px] uppercase tracking-[0.24em] text-orange-100/65">Choose your color</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { name: 'Ruby', value: '#e62945' },
                { name: 'Rose', value: '#f06b91' },
                { name: 'Violet', value: '#9b72e8' },
                { name: 'Blue', value: '#438bea' },
                { name: 'Cyan', value: '#39b9c8' },
                { name: 'Emerald', value: '#39a978' },
                { name: 'Gold', value: '#e4ad42' },
                { name: 'Orange', value: '#ff542e' },
                { name: 'White', value: '#e8e8e8' },
                { name: 'Lavender', value: '#b9a5ee' },
                { name: 'Coral', value: '#ff806b' },
                { name: 'Mint', value: '#8bd8bd' },
              ].map((swatch) => (
                <button
                  key={swatch.value}
                  type="button"
                  title={swatch.name}
                  aria-label={`${swatch.name} heart`}
                  aria-pressed={heartColor === swatch.value}
                  onClick={() => setHeartColor(swatch.value)}
                  className={`h-8 w-8 rounded-full border-2 transition hover:scale-110 ${heartColor === swatch.value ? 'border-white ring-2 ring-orange-200/50' : 'border-white/20'}`}
                  style={{ backgroundColor: swatch.value }}
                />
              ))}
            </div>
            <label className="mt-4 flex items-center justify-between gap-2 text-[9px] uppercase tracking-[0.15em] text-stone-400">
              Custom
              <input
                type="color"
                value={heartColor}
                onChange={(event) => setHeartColor(event.target.value)}
                aria-label="Choose custom heart color"
                className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent"
              />
            </label>
          </div>
        )}
      </div>

        </>
      )}

      {!isSharedView && (
        <>
      {/* Live design customizer */}
      <button
        type="button"
        onClick={() => setShowCustomizer((open) => !open)}
        className="fixed left-4 top-[124px] z-30 inline-flex items-center gap-2 rounded-full border border-orange-200/20 bg-black/75 px-4 py-2.5 text-[9px] sm:text-[10px] font-medium uppercase tracking-[0.2em] text-orange-100/85 shadow-[0_8px_30px_rgba(0,0,0,.45)] backdrop-blur-xl transition hover:border-orange-200/50"
        aria-expanded={showCustomizer}
      >
        <span aria-hidden="true">✧</span>
        Design studio
      </button>

      {showCustomizer && (
        <aside className="design-studio fixed left-4 top-[170px] z-40 max-h-[min(68vh,620px)] w-[min(300px,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-orange-200/20 bg-[#100b0a]/95 p-4 text-stone-100 shadow-2xl backdrop-blur-2xl">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[9px] uppercase tracking-[0.3em] text-orange-200/55">Live preview</p>
              <h2 className="mt-1 font-editorial text-xl text-orange-50">Design studio</h2>
            </div>
            <button type="button" onClick={() => setShowCustomizer(false)} aria-label="Close design studio" className="text-xl text-stone-400 hover:text-white">×</button>
          </div>

          <label className="block text-[9px] uppercase tracking-[0.2em] text-orange-100/70" htmlFor="heart-shape">Heart shape</label>
          <select id="heart-shape" value={heartShape} onChange={(event) => setHeartShape(event.target.value as 'classic' | 'wide' | 'tall')} className="mt-2 w-full rounded-lg border border-stone-700 bg-black/50 px-3 py-2 text-xs text-stone-100">
            <option value="classic">Classic</option>
            <option value="wide">Wide & soft</option>
            <option value="tall">Tall & elegant</option>
          </select>

          <label className="mt-4 block text-[9px] uppercase tracking-[0.2em] text-orange-100/70" htmlFor="heart-font">Text font</label>
          <select id="heart-font" value={fontFamily} onChange={(event) => setFontFamily(event.target.value)} className="mt-2 w-full rounded-lg border border-stone-700 bg-black/50 px-3 py-2 text-xs text-stone-100">
            <option value="Arial">Modern Sans</option>
            <option value="Georgia">Elegant Serif</option>
            <option value="Trebuchet MS">Soft Rounded</option>
            <option value="Courier New">Typewriter</option>
          </select>

          <label className="mt-4 flex items-center justify-between text-[9px] uppercase tracking-[0.2em] text-orange-100/70" htmlFor="particle-density">
            Particle density <span className="text-orange-100">{Math.round(particleDensity * 100)}%</span>
          </label>
          <input id="particle-density" type="range" min="0.5" max="1.5" step="0.1" value={particleDensity} onChange={(event) => setParticleDensity(Number(event.target.value))} disabled={!is3DMode} className="mt-2 w-full accent-orange-400 disabled:cursor-not-allowed disabled:opacity-35" />
          {!is3DMode && <p className="mt-1 text-[9px] text-stone-500">Switch to 3D mode to preview particle density.</p>}

          <label className="mt-4 flex items-center justify-between text-[9px] uppercase tracking-[0.2em] text-orange-100/70" htmlFor="animation-speed">
            Animation speed <span className="text-orange-100">{rotationSpeed.toFixed(1)}×</span>
          </label>
          <input id="animation-speed" type="range" min="0.35" max="2.5" step="0.05" value={rotationSpeed} onChange={(event) => setRotationSpeed(Number(event.target.value))} className="mt-2 w-full accent-orange-400" />

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { setHeartShape('classic'); setFontFamily('Arial'); setParticleDensity(1); setRotationSpeed(DEFAULT_ROTATION_SPEED); }} className="rounded-full border border-stone-700 px-3 py-2 text-[9px] uppercase tracking-[0.16em] text-stone-300 hover:border-orange-200/40">Reset style</button>
            <button type="button" onClick={handleShareHeart} className="rounded-full border border-orange-200/30 bg-orange-100/10 px-3 py-2 text-[9px] uppercase tracking-[0.16em] text-orange-50 hover:bg-orange-100/20">Share design</button>
          </div>
          <p className="mt-3 text-[9px] leading-5 text-stone-500">Changes preview immediately and are included in your share link and QR code.</p>
        </aside>
      )}

        </>
      )}

      {!isSharedView && (
        <>
      {/* QR code for the current personalized share URL */}
      <button
        type="button"
        onClick={() => setShowQr(true)}
        className="fixed right-4 top-[124px] z-30 inline-flex items-center gap-2 rounded-full border border-orange-200/20 bg-black/75 px-4 py-2.5 text-[9px] sm:text-[10px] font-medium uppercase tracking-[0.2em] text-orange-100/85 shadow-[0_8px_30px_rgba(0,0,0,.45)] backdrop-blur-xl transition hover:border-orange-200/50"
      >
        <span aria-hidden="true">▦</span>
        QR code
      </button>

      {showQr && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 px-4 py-8 backdrop-blur-md"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowQr(false);
          }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="heart-qr-title" className="w-full max-w-sm rounded-[26px] border border-orange-200/20 bg-[#100b0a] p-6 text-center shadow-2xl">
            <button type="button" onClick={() => setShowQr(false)} aria-label="Close QR code" className="float-right text-2xl text-stone-400 hover:text-white">×</button>
            <p className="mt-3 text-[9px] uppercase tracking-[0.35em] text-orange-200/55">Scan to open</p>
            <h2 id="heart-qr-title" className="mt-2 font-editorial text-2xl text-orange-50">Your heart, in a code</h2>
            <div className="mx-auto mt-6 grid h-56 w-56 place-items-center rounded-2xl bg-white p-3">
              <img
                alt="QR code for this personalized heart"
                className="h-full w-full"
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(buildShareUrl().toString())}`}
              />
            </div>
            <p className="mt-4 text-xs leading-6 text-stone-400">Scan with a phone camera to open this personalized heart. The QR image is generated by an external QR service.</p>
            <button type="button" onClick={handleShareHeart} className="mt-5 rounded-full border border-orange-200/30 px-6 py-3 text-[9px] uppercase tracking-[0.2em] text-orange-100 hover:bg-orange-100/10">Share link</button>
          </section>
        </div>
      )}

        </>
      )}

      {!isSharedView && (
        <>
      {/* Share a self-contained personalized link */}
      <div className="fixed right-4 top-20 z-30 flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={handleShareHeart}
          className="inline-flex items-center gap-2 rounded-full border border-orange-200/20 bg-black/75 px-4 py-2.5 text-[9px] sm:text-[10px] font-medium uppercase tracking-[0.2em] text-orange-100/85 shadow-[0_8px_30px_rgba(0,0,0,.45)] backdrop-blur-xl transition-all duration-300 hover:border-orange-200/50 hover:bg-orange-950/60 hover:text-white"
          title="Share this personalized heart"
        >
          <span aria-hidden="true">↗</span>
          <span>Share heart</span>
        </button>
        {shareStatus && (
          <span role="status" className="rounded-full border border-orange-200/15 bg-black/85 px-3 py-1.5 text-[9px] tracking-[0.12em] text-orange-100/90 shadow-lg backdrop-blur-xl">
            {shareStatus}
          </span>
        )}
      </div>

        </>
      )}

      {/* Creator watermark — remains visible in fullscreen */}
      <div
        aria-label="Created by H4CK3R033"
        className="pointer-events-none fixed bottom-3 right-4 z-30 select-none font-mono text-[9px] sm:text-[10px] font-semibold tracking-[0.28em] text-stone-100/35 drop-shadow-[0_1px_8px_rgba(0,0,0,0.8)]"
      >
        H4CK3R033
      </div>

      {/* Playback controls remain available in both creator and shared presentation views. */}
      <ControlDock
        isPlaying={isPlaying}
        hasBuiltOnce={hasBuiltOnce}
        glowEnabled={glowEnabled}
        textSize={textSize}
        is3DMode={is3DMode}
        rotationSpeed={rotationSpeed}
        isFullscreen={isFullscreen}
        onBuildHeart={handleBuildHeart}
        onReplay={handleReplay}
        onTogglePlay={handleTogglePlay}
        onToggleGlow={handleToggleGlow}
        onTextSizeChange={setTextSize}
        onToggle3D={handleToggle3D}
        onRotationSpeedChange={setRotationSpeed}
        onResetView={handleResetView}
        onToggleFullscreen={handleToggleFullscreen}
      />
    </div>
  );
}

export default App;