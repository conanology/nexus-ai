import React from 'react';
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { useMotion } from '../../hooks/useMotion.js';
import { COLORS, withOpacity } from '../../utils/colors.js';
import { THEME } from '../../theme.js';
import { BackgroundGradient } from '../shared/BackgroundGradient.js';
import { ForegroundScreenshot } from '../shared/ForegroundScreenshot.js';
import { GlowEffect } from '../shared/GlowEffect.js';
import type { SceneComponentProps } from '../../types/scenes.js';
import { getLogoEntry } from '@nexus-ai/asset-library';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CARD_STAGGER = 3; // frames between each card's entrance (fast stagger)
const GLOW_PULSE_DURATION = 20; // frames for the glow pulse after card appears
const SEQUENTIAL_FADE_FRAMES = 5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ResolvedLogo {
  name: string;
  abbreviation: string;
  color: string;
  src?: string;
}

/** Returns true if src is a usable image URL (http/https/data URI) */
function isValidImageSrc(src?: string): boolean {
  if (!src) return false;
  return src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:');
}

/** Deterministic hash → palette color for unknown companies */
const FALLBACK_PALETTE = [
  COLORS.accentPrimary, '#FFFFFF', '#888888', '#CCCCCC', '#555555',
  '#AAAAAA', '#DDDDDD', '#777777', '#EEEEEE', '#999999',
];

function hashColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  }
  return FALLBACK_PALETTE[Math.abs(h) % FALLBACK_PALETTE.length];
}

/** Smart abbreviation: "GPT-4" → "G4", "OpenAI" → "OA", "Piper" → "PI" */
function smartAbbreviation(name: string): string {
  // Multi-word: take initials (max 3)
  const words = name.split(/[\s\-_]+/).filter(Boolean);
  if (words.length >= 2) {
    return words
      .map((w) => w.charAt(0).toUpperCase())
      .slice(0, 3)
      .join('');
  }
  // CamelCase: extract capitals
  const caps = name.replace(/[^A-Z]/g, '');
  if (caps.length >= 2) {
    return caps.slice(0, 3);
  }
  // Single word: first 2 chars uppercase
  return name.slice(0, 2).toUpperCase();
}

function resolveLogo(logoName: string, src?: string): ResolvedLogo {
  // Only pass through src if it's a valid URL — bare filenames like "logo.png"
  // resolve to the Remotion dev server and crash the render.
  const safeSrc = isValidImageSrc(src) ? src : undefined;
  const entry = getLogoEntry(logoName);
  if (entry) {
    return { name: entry.name, abbreviation: entry.abbreviation, color: entry.color, src: safeSrc };
  }
  return {
    name: logoName,
    abbreviation: smartAbbreviation(logoName),
    color: hashColor(logoName),
    src: safeSrc,
  };
}

// ---------------------------------------------------------------------------
// Grid Mode
// ---------------------------------------------------------------------------

interface LogoCardProps {
  logo: ResolvedLogo;
  startFrame: number;
  frame: number;
  fps: number;
}

const LogoCard: React.FC<LogoCardProps> = ({ logo, startFrame, frame, fps }) => {
  const relativeFrame = Math.max(0, frame - startFrame);

  const scale = spring({
    frame: relativeFrame,
    fps,
    config: { damping: 8, stiffness: 300, mass: 0.6 },
    durationInFrames: 20,
  });

  // Rotation: start tilted ±8deg, spring to 0
  const rotateSign = startFrame % 2 === 0 ? 1 : -1;
  const rotation = interpolate(scale, [0, 1], [rotateSign * 8, 0]);

  // Brief glow pulse that peaks shortly after card appears
  const glowProgress = relativeFrame - 10; // starts 10 frames after card entrance
  const glowOpacity =
    glowProgress > 0 && glowProgress < GLOW_PULSE_DURATION
      ? interpolate(glowProgress, [0, GLOW_PULSE_DURATION / 2, GLOW_PULSE_DURATION], [0, 0.6, 0])
      : 0;

  const hasImage = !!logo.src;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.bgElevated,
        border: '3px solid #ffffff',
        borderRadius: 16,
        padding: hasImage ? '20px 24px' : '32px 24px',
        minWidth: hasImage ? 160 : 180,
        height: hasImage ? 140 : undefined,
        transform: `scale(${scale}) rotate(${rotation}deg)`,
        boxShadow: glowOpacity > 0
          ? `0 0 30px ${withOpacity(logo.color, glowOpacity)}, 0 0 60px ${withOpacity(logo.color, glowOpacity * 0.4)}`
          : 'none',
        filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.6))',
      }}
    >
      {hasImage ? (
        <>
          {/* White inner card ensures logo looks clean on dark background */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#ffffff',
              borderRadius: 12,
              padding: 12,
            }}
          >
            <Img
              src={logo.src!}
              style={{
                maxWidth: 100,
                maxHeight: 100,
                objectFit: 'contain',
              }}
            />
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 24,
              fontFamily: THEME.fonts.body,
              fontWeight: 400,
              color: COLORS.textPrimary,
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            {logo.name}
          </div>
        </>
      ) : (
        <>
          <div
            style={{
              fontSize: 48,
              fontWeight: 700,
              fontFamily: THEME.fonts.mono,
              color: logo.color,
              lineHeight: 1,
              marginBottom: 12,
            }}
          >
            {logo.abbreviation}
          </div>
          <div
            style={{
              fontSize: 24,
              fontFamily: THEME.fonts.body,
              fontWeight: 400,
              color: COLORS.textPrimary,
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            {logo.name}
          </div>
        </>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sequential Mode
// ---------------------------------------------------------------------------

interface SequentialLogoProps {
  logo: ResolvedLogo;
  opacity: number;
  slamScale: number;
}

const SequentialLogo: React.FC<SequentialLogoProps> = ({ logo, opacity, slamScale }) => {
  const hasImage = !!logo.src;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        opacity,
        transform: `scale(${slamScale})`,
        zIndex: 3,
      }}
    >
      {hasImage ? (
        <>
          {/* White inner card ensures logo looks clean on dark background */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#ffffff',
              borderRadius: 12,
              padding: 16,
            }}
          >
            <Img
              src={logo.src!}
              style={{
                maxWidth: 140,
                maxHeight: 140,
                objectFit: 'contain',
                filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.8))',
              }}
            />
          </div>
          <div
            style={{
              marginTop: 16,
              fontSize: 36,
              fontFamily: THEME.fonts.heading,
              fontWeight: 500,
              color: COLORS.textPrimary,
              textAlign: 'center',
            }}
          >
            {logo.name}
          </div>
        </>
      ) : (
        <>
          <div
            style={{
              fontSize: 50,
              fontWeight: 700,
              fontFamily: THEME.fonts.mono,
              color: logo.color,
              lineHeight: 1.1,
              marginBottom: 16,
            }}
          >
            {logo.abbreviation}
          </div>
          <div
            style={{
              fontSize: 36,
              fontFamily: THEME.fonts.heading,
              fontWeight: 500,
              color: COLORS.textPrimary,
              textAlign: 'center',
            }}
          >
            {logo.name}
          </div>
        </>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const LogoShowcase: React.FC<SceneComponentProps<'logo-showcase'>> = (props) => {
  const { visualData, motion, backgroundImage, screenshotImage, screenshotDisplayMode, sourceMetadata } = props;
  const isForeground = screenshotDisplayMode === 'foreground' && screenshotImage;
  const bgScreenshot = !isForeground ? screenshotImage : undefined;
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const motionStyles = useMotion(motion, durationInFrames);

  const { logos, layout } = visualData;
  const resolvedLogos = logos.map((l) => resolveLogo(l.name, l.src));

  if (layout === 'sequential') {
    const count = resolvedLogos.length;
    const durationPerLogo = durationInFrames / count;

    return (
      <AbsoluteFill>
        <BackgroundGradient variant="default" backgroundImage={backgroundImage} screenshotImage={bgScreenshot} />

        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            ...motionStyles.entranceStyle,
            ...motionStyles.exitStyle,
          }}
        >
          {resolvedLogos.map((logo, i) => {
            const logoStart = i * durationPerLogo;
            const logoEnd = logoStart + durationPerLogo;

            // Fade in over first SEQUENTIAL_FADE_FRAMES, fade out over last SEQUENTIAL_FADE_FRAMES
            const fadeIn = interpolate(
              frame,
              [logoStart, logoStart + SEQUENTIAL_FADE_FRAMES],
              [0, 1],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
            );
            const fadeOut = interpolate(
              frame,
              [logoEnd - SEQUENTIAL_FADE_FRAMES, logoEnd],
              [1, 0],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
            );
            const opacity = Math.min(fadeIn, fadeOut);

            // Slam spring: scale 1.6→1.0 on entrance (elastic overshoot)
            const slamFrame = Math.max(0, frame - logoStart);
            const slamSpring = spring({
              frame: slamFrame,
              fps,
              config: { damping: 7, stiffness: 280, mass: 0.6 },
              durationInFrames: 12,
            });
            const slamScale = interpolate(slamSpring, [0, 1], [1.6, 1.0]);

            return (
              <React.Fragment key={i}>
                {opacity > 0 && (
                  <GlowEffect
                    color={logo.color}
                    intensity="medium"
                    size={300}
                    pulse={false}
                  />
                )}
                <SequentialLogo logo={logo} opacity={opacity} slamScale={slamScale} />
              </React.Fragment>
            );
          })}
        </div>
        {isForeground && <ForegroundScreenshot src={screenshotImage} sourceMetadata={sourceMetadata} />}
      </AbsoluteFill>
    );
  }

  // --- Grid mode ---
  const count = resolvedLogos.length;
  const cols = Math.ceil(Math.sqrt(count));

  return (
    <AbsoluteFill>
      <BackgroundGradient variant="default" backgroundImage={backgroundImage} screenshotImage={bgScreenshot} />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 80,
          zIndex: 2,
          ...motionStyles.entranceStyle,
          ...motionStyles.exitStyle,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: 32,
            justifyItems: 'center',
            alignItems: 'center',
          }}
        >
          {resolvedLogos.map((logo, i) => (
            <LogoCard
              key={i}
              logo={logo}
              startFrame={i * CARD_STAGGER}
              frame={frame}
              fps={fps}
            />
          ))}
        </div>
      </div>
      {isForeground && <ForegroundScreenshot src={screenshotImage} sourceMetadata={sourceMetadata} />}
    </AbsoluteFill>
  );
};
